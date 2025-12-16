"""LLM-backed agent with multi-turn tool loop."""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from live_poker_bench.agents.base import AgentAction, BaseAgent, Observation
from live_poker_bench.agents.memory import AgentMemory
from live_poker_bench.agents.tools import TOOL_DEFINITIONS, execute_tool
from live_poker_bench.llm.adapter import LLMAdapter, LLMConfig


SYSTEM_PROMPT = """You are playing No-Limit Texas Hold'em poker in a tournament. Your goal is to win chips and ultimately win the tournament.

You have access to memory tools to recall information about past hands and opponent behavior. Use these tools strategically to inform your decisions.

When you decide on an action, respond with a JSON object in this exact format:
{
  "action": "fold" | "call" | "raise",
  "raise_to": <number if raising, otherwise null>,
  "reasoning": "<brief explanation of your decision>"
}

Important rules:
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
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    llm_responses: list[dict[str, Any]] = field(default_factory=list)
    final_action: dict[str, Any] | None = None
    retries: int = 0
    error: str | None = None


class LLMAgent(BaseAgent):
    """LLM-backed poker agent with multi-turn tool support."""

    def __init__(
        self,
        name: str,
        model: str,
        seat: int | None = None,
        max_retries: int = 3,
        config: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the LLM agent.

        Args:
            name: Display name of the agent.
            model: Model string (e.g., "openrouter/openai/gpt-4o").
            seat: The agent's seat number (set later if not known).
            max_retries: Maximum retries for invalid actions.
            config: Additional configuration.
        """
        super().__init__(name, config)
        self.model = model
        self.seat = seat
        self.max_retries = max_retries

        # Initialize LLM adapter
        llm_config = LLMConfig(model=model)
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

    def _parse_action(self, response_text: str, observation: Observation) -> AgentAction | None:
        """Parse the LLM response into an action."""
        # Try to extract JSON from the response
        try:
            # Look for JSON in the response
            json_match = re.search(r'\{[^{}]*"action"[^{}]*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                # Try parsing the whole response as JSON
                data = json.loads(response_text)

            action = data.get("action", "").lower()
            raise_to = data.get("raise_to")
            reasoning = data.get("reasoning", "")

            if action not in ["fold", "call", "raise"]:
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
        trace = DecisionTrace(observation=observation.to_dict())

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
                    "usage": response.usage,
                    "latency_ms": response.latency_ms,
                })

                if not response.content:
                    retries += 1
                    trace.retries = retries
                    messages.append({
                        "role": "user",
                        "content": "Please provide your action decision in the required JSON format.",
                    })
                    continue

                # Parse the action
                action = self._parse_action(response.content, observation)
                if action is None:
                    retries += 1
                    trace.retries = retries
                    messages.append({
                        "role": "assistant",
                        "content": response.content,
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
                        "content": response.content,
                    })
                    messages.append({
                        "role": "user",
                        "content": f"Invalid action: {error_msg}. Please choose a valid action.",
                    })
                    continue

                # Valid action found
                trace.final_action = action.to_dict()
                self.decision_traces.append(trace)
                return action

            except Exception as e:
                trace.error = str(e)
                retries += 1
                trace.retries = retries

        # Max retries exceeded, force fold
        trace.error = f"Max retries ({self.max_retries}) exceeded, forcing fold"
        trace.final_action = {"action": "fold", "raise_to": None, "reasoning": "Forced fold due to invalid actions"}
        self.decision_traces.append(trace)
        return AgentAction(action="fold", reasoning="Forced fold due to invalid actions")

    def get_traces(self) -> list[dict[str, Any]]:
        """Get all decision traces for logging."""
        return [
            {
                "observation": t.observation,
                "tool_calls": t.tool_calls,
                "llm_responses": t.llm_responses,
                "final_action": t.final_action,
                "retries": t.retries,
                "error": t.error,
            }
            for t in self.decision_traces
        ]
