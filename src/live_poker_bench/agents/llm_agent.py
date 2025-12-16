"""LLM-backed agent with multi-turn tool loop."""

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any

from live_poker_bench.agents.base import AgentAction, BaseAgent, Observation
from live_poker_bench.agents.memory import AgentMemory
from live_poker_bench.agents.tools import TOOL_DEFINITIONS, execute_tool
from live_poker_bench.llm.adapter import LLMAdapter, LLMConfig, ProviderSettings, ReasoningSettings


SYSTEM_PROMPT = """You are playing No-Limit Texas Hold'em poker in a tournament. Your goal is to win chips and ultimately win the tournament.

You have access to memory tools to recall information about past hands and opponent behavior. Use these tools strategically to inform your decisions.

When you decide on an action, respond with a JSON object in this exact format:
{
  "action": "fold" | "check" | "call" | "raise",
  "raise_to": <number if raising, otherwise null>,
  "reasoning": "<brief explanation of your decision>"
}

Important rules:
- Use "check" when there's nothing to call (amount to call is 0)
- Use "call" when facing a bet you want to match
- If raising, "raise_to" is the TOTAL amount you're putting in (not the additional amount)
- You can only raise if "raise" is in your legal_actions
- If you can't afford the minimum raise, you can go all-in
- Always provide reasoning for your decision

Think step by step about:
1. Your hand strength and potential
2. Your position and stack size
3. Opponent tendencies (use tools to recall)
4. Pot odds and implied odds
5. Tournament considerations (stack preservation vs. accumulation)"""


@dataclass
class DecisionTrace:
    """Trace of a single decision point."""

    observation: dict[str, Any]
    street: str = ""
    messages: list[dict[str, Any]] = field(default_factory=list)  # Full conversation
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    llm_responses: list[dict[str, Any]] = field(default_factory=list)
    final_action: dict[str, Any] | None = None
    retries: int = 0
    error: str | None = None
    forced_fold: bool = False
    thinking_time_ms: float = 0.0


class LLMAgent(BaseAgent):
    """LLM-backed poker agent with multi-turn tool support."""

    def __init__(
        self,
        name: str,
        model: str,
        seat: int | None = None,
        max_retries: int = 3,
        config: dict[str, Any] | None = None,
        reasoning: dict[str, Any] | None = None,
        provider: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the LLM agent.

        Args:
            name: Display name of the agent.
            model: Model string (e.g., "openrouter/openai/gpt-4o").
            seat: The agent's seat number (set later if not known).
            max_retries: Maximum retries for invalid actions.
            config: Additional configuration.
            reasoning: Reasoning configuration dict with keys:
                - enabled: bool - Enable reasoning for supported models
                - effort: str - "low", "medium", "high", or "xhigh"
                - max_tokens: int - Max tokens for reasoning
                - include_reasoning: bool - Include reasoning in response
                - preserve_blocks: bool - Preserve reasoning_details for multi-turn (required for Gemini)
            provider: OpenRouter provider preferences dict with keys:
                - order: list[str] - Ordered list of provider names to prefer
                - allow_fallbacks: bool - Allow fallback to other providers
                - require_parameters: bool - Require all parameters to be supported
                - data_collection: str - "allow" or "deny"
                - only: list[str] - Only use these providers
                - ignore: list[str] - Never use these providers
                - quantizations: list[str] - Allowed quantization levels
        """
        super().__init__(name, config)
        self.model = model
        self.seat = seat
        self.max_retries = max_retries

        # Build reasoning settings
        reasoning_settings = ReasoningSettings()
        if reasoning:
            reasoning_settings = ReasoningSettings(
                enabled=reasoning.get("enabled", False),
                effort=reasoning.get("effort"),
                max_tokens=reasoning.get("max_tokens"),
                include_reasoning=reasoning.get("include_reasoning", False),
                preserve_blocks=reasoning.get("preserve_blocks", True),
            )

        # Build provider settings
        provider_settings = None
        if provider:
            provider_settings = ProviderSettings(
                order=provider.get("order"),
                allow_fallbacks=provider.get("allow_fallbacks"),
                require_parameters=provider.get("require_parameters"),
                data_collection=provider.get("data_collection"),
                only=provider.get("only"),
                ignore=provider.get("ignore"),
                quantizations=provider.get("quantizations"),
            )

        # Initialize LLM adapter
        llm_config = LLMConfig(model=model, reasoning=reasoning_settings, provider=provider_settings)
        self.llm = LLMAdapter(llm_config)

        # Memory will be initialized when seat is set
        self._memory: AgentMemory | None = None

        # Trace history for logging
        self.decision_traces: list[DecisionTrace] = []

    @property
    def memory(self) -> AgentMemory:
        """Get or create the agent's memory."""
        if self._memory is None:
            if self.seat is None:
                raise ValueError("Seat must be set before accessing memory")
            self._memory = AgentMemory(self.name, self.seat)
        return self._memory

    def set_seat(self, seat: int) -> None:
        """Set the agent's seat number."""
        self.seat = seat
        self._memory = AgentMemory(self.name, seat)

    def reset(self) -> None:
        """Reset the agent for a new tournament."""
        if self.seat is not None:
            self._memory = AgentMemory(self.name, self.seat)
        self.decision_traces = []

    def _build_observation_prompt(self, observation: Observation) -> str:
        """Build a human-readable prompt from the observation."""
        lines = [
            f"=== Hand #{observation.hand_number} - {observation.street.upper()} ===",
            "",
            f"Your Position: {observation.my_position} (Seat {observation.my_seat})",
            f"Your Cards: {observation.my_hole_cards[0]} {observation.my_hole_cards[1]}",
            f"Your Stack: {observation.my_stack} chips ({observation.my_stack / observation.big_blind:.1f} BB)",
            "",
            f"Blinds: {observation.small_blind}/{observation.big_blind}",
            f"Pot: {observation.pot_size} chips",
        ]

        if observation.community_cards:
            lines.append(f"Board: {' '.join(observation.community_cards)}")

        lines.append("")
        lines.append("Players at table:")
        for p in observation.players:
            status = ""
            if p.get("is_folded"):
                status = " (folded)"
            elif not p.get("is_active"):
                status = " (out)"
            lines.append(f"  Seat {p['seat']}: {p['name']} - {p['stack']} chips{status}")

        if observation.actions_this_hand:
            lines.append("")
            lines.append("Actions this hand:")
            for a in observation.actions_this_hand:
                amount_str = f" {a['amount']}" if a.get('amount') else ""
                lines.append(f"  {a['street']}: Seat {a['seat']} {a['action']}{amount_str}")

        lines.append("")
        lines.append(f"Amount to call: {observation.current_bet}")
        if observation.min_raise > 0:
            lines.append(f"Minimum raise to: {observation.min_raise}")
        lines.append(f"Legal actions: {', '.join(observation.legal_actions)}")

        return "\n".join(lines)

    def _extract_json_from_markdown(self, text: str) -> str | None:
        """Extract JSON content from markdown code blocks.
        
        Handles formats like:
        - ```json\n{...}\n```
        - ```\n{...}\n```
        - ``` json\n{...}\n```
        
        Returns the content of the first code block containing valid JSON with "action",
        or None if no such block is found.
        """
        # Pattern to match markdown code blocks with optional language tag
        pattern = r'```\s*(?:json)?\s*\n?(.*?)\n?```'
        matches = re.finditer(pattern, text, re.DOTALL | re.IGNORECASE)
        
        for match in matches:
            content = match.group(1).strip()
            # Check if this block contains JSON with "action" key
            if '"action"' in content and '{' in content:
                return content
        
        return None

    def _parse_action(self, response_text: str, observation: Observation) -> AgentAction | None:
        """Parse the LLM response into an action."""
        # Try to extract JSON from the response
        try:
            # First, try to extract JSON from markdown code blocks
            markdown_json = self._extract_json_from_markdown(response_text)
            
            if markdown_json:
                # Found JSON in a markdown block - try to parse it
                json_match = re.search(r'\{[^{}]*"action"[^{}]*\}', markdown_json, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    data = json.loads(markdown_json)
            else:
                # No markdown block found, search in raw text
                json_match = re.search(r'\{[^{}]*"action"[^{}]*\}', response_text, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    # Try parsing the whole response as JSON
                    data = json.loads(response_text)

            action = data.get("action", "").lower()
            raise_to = data.get("raise_to")
            reasoning = data.get("reasoning", "")

            if action not in ["fold", "check", "call", "raise"]:
                return None

            if action == "raise" and raise_to is None:
                return None

            return AgentAction(
                action=action,
                raise_to=int(raise_to) if raise_to is not None else None,
                reasoning=reasoning,
            )
        except (json.JSONDecodeError, ValueError, TypeError):
            return None

    def _validate_action(self, action: AgentAction, observation: Observation) -> tuple[bool, str]:
        """Validate an action against the current game state."""
        if action.action not in observation.legal_actions:
            return False, f"Action '{action.action}' not in legal actions: {observation.legal_actions}"

        if action.action == "raise":
            if action.raise_to is None:
                return False, "Raise action requires raise_to amount"
            if action.raise_to < observation.min_raise and action.raise_to < observation.my_stack:
                return False, f"Raise to {action.raise_to} below minimum {observation.min_raise}"
            if action.raise_to > observation.max_raise:
                return False, f"Raise to {action.raise_to} exceeds maximum {observation.max_raise}"

        return True, ""

    def _tool_executor(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool call."""
        return execute_tool(tool_name, self.memory, args)

    def get_action(self, observation: Observation) -> AgentAction:
        """Get the agent's action using multi-turn LLM calls.

        Args:
            observation: Current game state.

        Returns:
            The agent's chosen action.
        """
        start_time = time.time()
        trace = DecisionTrace(
            observation=observation.to_dict(),
            street=observation.street,
        )

        # Build messages
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": self._build_observation_prompt(observation)},
        ]

        retries = 0
        while retries <= self.max_retries:
            try:
                # Make LLM call with tools
                response, tool_calls = self.llm.call_with_tools(
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    tool_executor=self._tool_executor,
                    max_turns=5,
                )

                trace.tool_calls.extend(tool_calls)
                trace.llm_responses.append({
                    "content": response.content,
                    "reasoning_content": response.reasoning_content,
                    "usage": response.usage,
                    "latency_ms": response.latency_ms,
                })

                # For thinking models, the response may be in reasoning_content instead of content
                response_text = response.content or response.reasoning_content

                if not response_text:
                    retries += 1
                    trace.retries = retries
                    messages.append({
                        "role": "user",
                        "content": "Please provide your action decision in the required JSON format.",
                    })
                    continue

                # Parse the action
                action = self._parse_action(response_text, observation)
                if action is None:
                    retries += 1
                    trace.retries = retries
                    messages.append({
                        "role": "assistant",
                        "content": response_text,
                    })
                    messages.append({
                        "role": "user",
                        "content": "Invalid response format. Please respond with a JSON object containing 'action', 'raise_to' (if raising), and 'reasoning'.",
                    })
                    continue

                # Validate the action
                is_valid, error_msg = self._validate_action(action, observation)
                if not is_valid:
                    retries += 1
                    trace.retries = retries
                    messages.append({
                        "role": "assistant",
                        "content": response_text,
                    })
                    messages.append({
                        "role": "user",
                        "content": f"Invalid action: {error_msg}. Please choose a valid action.",
                    })
                    continue

                # Valid action found
                thinking_time_ms = (time.time() - start_time) * 1000
                trace.final_action = action.to_dict()
                trace.thinking_time_ms = thinking_time_ms
                trace.messages = messages.copy()  # Capture final conversation state
                action.thinking_time_ms = thinking_time_ms
                action.retries = retries
                self.decision_traces.append(trace)
                return action

            except Exception as e:
                trace.error = str(e)
                retries += 1
                trace.retries = retries

        # Max retries exceeded, force fold
        thinking_time_ms = (time.time() - start_time) * 1000
        trace.error = f"Max retries ({self.max_retries}) exceeded, forcing fold"
        trace.forced_fold = True
        trace.final_action = {"action": "fold", "raise_to": None, "reasoning": "Forced fold due to invalid actions"}
        trace.thinking_time_ms = thinking_time_ms
        trace.messages = messages.copy()  # Capture final conversation state
        self.decision_traces.append(trace)
        return AgentAction(
            action="fold",
            reasoning="Forced fold due to invalid actions",
            forced=True,
            retries=retries,
            thinking_time_ms=thinking_time_ms,
        )

    def get_traces(self) -> list[dict[str, Any]]:
        """Get all decision traces for logging."""
        return [
            {
                "observation": t.observation,
                "street": t.street,
                "messages": t.messages,
                "tool_calls": t.tool_calls,
                "llm_responses": t.llm_responses,
                "final_action": t.final_action,
                "retries": t.retries,
                "error": t.error,
                "forced_fold": t.forced_fold,
                "thinking_time_ms": t.thinking_time_ms,
            }
            for t in self.decision_traces
        ]

    def get_last_trace(self) -> dict[str, Any] | None:
        """Get the most recent decision trace for immediate logging."""
        if not self.decision_traces:
            return None
        t = self.decision_traces[-1]
        return {
            "observation": t.observation,
            "street": t.street,
            "messages": t.messages,
            "tool_calls": t.tool_calls,
            "llm_responses": t.llm_responses,
            "final_action": t.final_action,
            "retries": t.retries,
            "error": t.error,
            "forced_fold": t.forced_fold,
            "thinking_time_ms": t.thinking_time_ms,
        }
