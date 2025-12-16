"""Base agent interface for poker players."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class Observation:
    """Game state observation sent to an agent."""

    # Hand info
    hand_number: int
    street: str  # preflop, flop, turn, river

    # Agent's private info
    my_seat: int
    my_position: str  # BTN, SB, BB, UTG, etc.
    my_hole_cards: tuple[str, str]
    my_stack: int

    # Public info
    community_cards: tuple[str, ...]
    pot_size: int
    current_bet: int  # Amount to call
    min_raise: int  # Minimum raise amount
    max_raise: int  # Maximum raise (all-in)

    # Blind info
    small_blind: int
    big_blind: int

    # Table state
    button_seat: int
    players: list[dict[str, Any]]  # List of {seat, name, stack, is_active, is_folded}

    # Action history this hand
    actions_this_hand: list[dict[str, Any]] = field(default_factory=list)

    # Legal actions
    legal_actions: list[str] = field(default_factory=list)  # ["fold", "call", "raise"]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "hand_number": self.hand_number,
            "street": self.street,
            "my_seat": self.my_seat,
            "my_position": self.my_position,
            "my_hole_cards": list(self.my_hole_cards),
            "my_stack": self.my_stack,
            "community_cards": list(self.community_cards),
            "pot_size": self.pot_size,
            "current_bet": self.current_bet,
            "min_raise": self.min_raise,
            "max_raise": self.max_raise,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "button_seat": self.button_seat,
            "players": self.players,
            "actions_this_hand": self.actions_this_hand,
            "legal_actions": self.legal_actions,
        }


@dataclass
class AgentAction:
    """Action returned by an agent."""

    action: Literal["fold", "check", "call", "raise"]
    raise_to: int | None = None  # Total amount to raise to (not the raise amount)
    reasoning: str = ""
    forced: bool = False  # True if this was a forced fold due to retries
    retries: int = 0  # Number of retries before this action
    thinking_time_ms: float = 0.0  # Time spent thinking

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "action": self.action,
            "raise_to": self.raise_to,
            "reasoning": self.reasoning,
            "forced": self.forced,
            "retries": self.retries,
            "thinking_time_ms": self.thinking_time_ms,
        }


class BaseAgent(ABC):
    """Abstract base class for poker agents."""

    def __init__(self, name: str, config: dict[str, Any] | None = None) -> None:
        """Initialize the agent.

        Args:
            name: Display name of the agent.
            config: Optional configuration dict.
        """
        self.name = name
        self.config = config or {}

    @abstractmethod
    def get_action(self, observation: Observation) -> AgentAction:
        """Get the agent's action for the current game state.

        Args:
            observation: Current game state from the agent's perspective.

        Returns:
            The agent's chosen action.
        """
        pass

    def reset(self) -> None:
        """Reset the agent's state for a new tournament.

        Override in subclasses if needed.
        """
        pass

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r})"
