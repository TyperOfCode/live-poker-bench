"""Agent manager for coordinating poker agents."""

from typing import Any

from live_poker_bench.agents.base import AgentAction, BaseAgent, Observation
from live_poker_bench.agents.llm_agent import LLMAgent
from live_poker_bench.agents.memory import AgentMemory, get_position_name


class AgentManager:
    """Manages poker agents, routes observations, and updates memory."""

    def __init__(self) -> None:
        """Initialize the agent manager."""
        self.agents: dict[int, BaseAgent] = {}  # seat -> agent
        self.memories: dict[int, AgentMemory] = {}  # seat -> memory
        self.active_seats: list[int] = []
        self.eliminated_seats: list[int] = []

    def add_agent(self, seat: int, agent: BaseAgent) -> None:
        """Add an agent to a seat.

        Args:
            seat: Seat number (1-8).
            agent: The agent to assign.
        """
        self.agents[seat] = agent
        if isinstance(agent, LLMAgent):
            agent.set_seat(seat)
            self.memories[seat] = agent.memory
        else:
            self.memories[seat] = AgentMemory(agent.name, seat)
        self.active_seats.append(seat)

    def get_agent(self, seat: int) -> BaseAgent | None:
        """Get the agent at a seat."""
        return self.agents.get(seat)

    def get_memory(self, seat: int) -> AgentMemory | None:
        """Get the memory for a seat."""
        return self.memories.get(seat)

    def is_active(self, seat: int) -> bool:
        """Check if a seat is still active (not eliminated)."""
        return seat in self.active_seats

    def eliminate_seat(self, seat: int) -> None:
        """Mark a seat as eliminated."""
        if seat in self.active_seats:
            self.active_seats.remove(seat)
            self.eliminated_seats.append(seat)

    def get_active_seats(self) -> list[int]:
        """Get list of active (non-eliminated) seats."""
        return self.active_seats.copy()

    def get_action(self, seat: int, observation: Observation) -> AgentAction:
        """Get an action from an agent.

        Args:
            seat: The seat to get action from.
            observation: The game state observation.

        Returns:
            The agent's action.
        """
        agent = self.agents.get(seat)
        if agent is None:
            raise ValueError(f"No agent at seat {seat}")

        return agent.get_action(observation)

    def start_hand(
        self,
        hand_number: int,
        hole_cards: dict[int, tuple[str, str]],
        button_seat: int,
    ) -> None:
        """Notify all agents that a new hand is starting.

        Args:
            hand_number: The hand number.
            hole_cards: Dict mapping seat -> hole cards.
            button_seat: The button seat.
        """
        for seat in self.active_seats:
            memory = self.memories.get(seat)
            cards = hole_cards.get(seat)
            if memory and cards:
                position = get_position_name(
                    seat, button_seat, len(self.agents), self.active_seats
                )
                memory.start_hand(hand_number, cards, position)

    def record_action(
        self,
        street: str,
        seat: int,
        action: str,
        amount: int | None = None,
    ) -> None:
        """Record an action to all active agents' memories.

        Args:
            street: The betting street.
            seat: The seat that acted.
            action: The action taken.
            amount: The bet/raise amount.
        """
        player_name = ""
        if seat in self.agents:
            player_name = self.agents[seat].name

        for active_seat in self.active_seats:
            memory = self.memories.get(active_seat)
            if memory:
                memory.record_action(street, seat, player_name, action, amount)

    def update_community_cards(self, cards: tuple[str, ...]) -> None:
        """Update community cards for all active agents.

        Args:
            cards: The community cards.
        """
        for seat in self.active_seats:
            memory = self.memories.get(seat)
            if memory:
                memory.update_community_cards(cards)

    def record_showdown(self, seat: int, cards: tuple[str, str]) -> None:
        """Record showdown cards to all active agents' memories.

        Args:
            seat: The seat showing cards.
            cards: The hole cards shown.
        """
        for active_seat in self.active_seats:
            memory = self.memories.get(active_seat)
            if memory:
                memory.record_showdown(seat, cards)

    def end_hand(
        self,
        results: dict[int, dict[str, Any]],
        pot_size: int,
    ) -> None:
        """End the current hand for all agents.

        Args:
            results: Dict mapping seat -> {result, chips_won, final_stack}.
            pot_size: Final pot size.
        """
        for seat in self.active_seats:
            memory = self.memories.get(seat)
            result_data = results.get(seat, {})
            if memory:
                memory.end_hand(
                    result=result_data.get("result", "folded"),
                    chips_won=result_data.get("chips_won", 0),
                    pot_size=pot_size,
                    final_stack=result_data.get("final_stack", 0),
                )

    def reset_for_tournament(self) -> None:
        """Reset all agents for a new tournament."""
        self.active_seats = list(self.agents.keys())
        self.eliminated_seats = []
        for agent in self.agents.values():
            agent.reset()
        for seat in self.agents:
            agent = self.agents[seat]
            if isinstance(agent, LLMAgent):
                self.memories[seat] = agent.memory
            else:
                self.memories[seat] = AgentMemory(agent.name, seat)

    def get_agent_traces(self, seat: int) -> list[dict[str, Any]]:
        """Get decision traces for an agent (if it's an LLM agent).

        Args:
            seat: The seat number.

        Returns:
            List of decision traces.
        """
        agent = self.agents.get(seat)
        if isinstance(agent, LLMAgent):
            return agent.get_traces()
        return []

    def get_last_trace(self, seat: int) -> dict[str, Any] | None:
        """Get the most recent decision trace for an agent.

        Args:
            seat: The seat number.

        Returns:
            The last decision trace, or None if not available.
        """
        agent = self.agents.get(seat)
        if isinstance(agent, LLMAgent):
            return agent.get_last_trace()
        return None

    @classmethod
    def from_config(
        cls,
        agent_configs: list[dict[str, Any]],
        global_settings: dict[str, Any] | None = None,
    ) -> "AgentManager":
        """Create an AgentManager from configuration.

        Args:
            agent_configs: List of agent configurations with name, model, and optional reasoning.
            global_settings: Global agent settings including default reasoning config.

        Returns:
            Configured AgentManager.
        """
        manager = cls()
        global_settings = global_settings or {}
        global_reasoning = global_settings.get("reasoning", {})

        for i, config in enumerate(agent_configs):
            seat = i + 1
            name = config.get("name", f"Agent_{seat}")
            model = config.get("model", "openrouter/openai/gpt-4o")

            # Per-agent reasoning overrides global reasoning
            agent_reasoning = config.get("reasoning")
            reasoning = agent_reasoning if agent_reasoning is not None else global_reasoning

            # Per-agent provider preferences
            provider = config.get("provider")

            agent = LLMAgent(
                name=name,
                model=model,
                seat=seat,
                max_retries=config.get("max_retries", global_settings.get("max_retries", 3)),
                reasoning=reasoning,
                provider=provider,
            )
            manager.add_agent(seat, agent)

        return manager
