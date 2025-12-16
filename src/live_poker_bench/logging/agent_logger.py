"""Agent trace logging for debugging and analysis."""

import json
from pathlib import Path
from typing import Any


class AgentLogger:
    """Logs full reasoning traces for each agent."""

    def __init__(self, log_dir: Path) -> None:
        """Initialize the agent logger.

        Args:
            log_dir: Directory to write agent logs to.
        """
        self.log_dir = log_dir
        self.agents_dir = log_dir / "agents"
        self.agents_dir.mkdir(parents=True, exist_ok=True)
        self._traces: dict[int, list[dict[str, Any]]] = {}  # seat -> traces
        self._agent_names: dict[int, str] = {}  # seat -> name

    def register_agent(self, seat: int, name: str) -> None:
        """Register an agent for logging.

        Args:
            seat: Agent's seat number.
            name: Agent's name.
        """
        self._traces[seat] = []
        self._agent_names[seat] = name

    def log_decision(
        self,
        seat: int,
        hand_number: int,
        observation: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        llm_responses: list[dict[str, Any]],
        final_action: dict[str, Any],
        retries: int = 0,
        error: str | None = None,
    ) -> None:
        """Log a decision point for an agent.

        Args:
            seat: Agent's seat.
            hand_number: Current hand number.
            observation: The observation sent to the agent.
            tool_calls: List of tool calls made.
            llm_responses: List of LLM responses.
            final_action: The final action taken.
            retries: Number of retries needed.
            error: Any error message.
        """
        if seat not in self._traces:
            self._traces[seat] = []

        trace = {
            "hand_number": hand_number,
            "observation": observation,
            "tool_calls": tool_calls,
            "llm_responses": llm_responses,
            "final_action": final_action,
            "retries": retries,
        }
        if error:
            trace["error"] = error

        self._traces[seat].append(trace)

    def add_traces_from_agent(
        self,
        seat: int,
        traces: list[dict[str, Any]],
    ) -> None:
        """Add traces directly from an agent.

        Args:
            seat: Agent's seat.
            traces: List of trace dictionaries from the agent.
        """
        if seat not in self._traces:
            self._traces[seat] = []
        self._traces[seat].extend(traces)

    def save(self) -> None:
        """Save all agent traces to files."""
        for seat, traces in self._traces.items():
            name = self._agent_names.get(seat, f"agent_{seat}")
            # Sanitize name for filename
            safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)
            filename = f"seat_{seat}_{safe_name}.json"
            filepath = self.agents_dir / filename

            data = {
                "seat": seat,
                "agent_name": name,
                "total_decisions": len(traces),
                "total_tool_calls": sum(len(t.get("tool_calls", [])) for t in traces),
                "total_retries": sum(t.get("retries", 0) for t in traces),
                "traces": traces,
            }

            # Calculate token usage
            total_prompt_tokens = 0
            total_completion_tokens = 0
            for trace in traces:
                for resp in trace.get("llm_responses", []):
                    usage = resp.get("usage", {})
                    total_prompt_tokens += usage.get("prompt_tokens", 0)
                    total_completion_tokens += usage.get("completion_tokens", 0)

            data["token_usage"] = {
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "total_tokens": total_prompt_tokens + total_completion_tokens,
            }

            with open(filepath, "w") as f:
                json.dump(data, f, indent=2)

    def get_stats(self, seat: int) -> dict[str, Any]:
        """Get statistics for an agent.

        Args:
            seat: Agent's seat.

        Returns:
            Statistics dictionary.
        """
        traces = self._traces.get(seat, [])
        total_retries = sum(t.get("retries", 0) for t in traces)
        errors = [t.get("error") for t in traces if t.get("error")]

        return {
            "seat": seat,
            "agent_name": self._agent_names.get(seat, f"agent_{seat}"),
            "total_decisions": len(traces),
            "total_retries": total_retries,
            "error_count": len(errors),
            "invalid_action_rate": total_retries / len(traces) if traces else 0,
        }

    def get_all_stats(self) -> list[dict[str, Any]]:
        """Get statistics for all agents.

        Returns:
            List of statistics dictionaries.
        """
        return [self.get_stats(seat) for seat in sorted(self._traces.keys())]
