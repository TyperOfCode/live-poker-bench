"""Observation builder for creating agent prompts."""

from dataclasses import dataclass
from typing import Any

from live_poker_bench.agents.base import Observation


@dataclass
class FormattedObservation:
    """Formatted observation for LLM consumption."""

    observation: Observation
    use_bb_notation: bool = True

    def format_stack(self, chips: int) -> str:
        """Format stack size, optionally in BB notation.

        Args:
            chips: Stack size in chips.

        Returns:
            Formatted string.
        """
        if self.use_bb_notation:
            bb = self.observation.big_blind
            bbs = chips / bb if bb > 0 else chips
            return f"{bbs:.1f}BB ({chips} chips)"
        return f"{chips} chips"

    def format_pot(self) -> str:
        """Format pot size."""
        return self.format_stack(self.observation.pot_size)

    def format_bet(self) -> str:
        """Format current bet to call."""
        if self.observation.current_bet == 0:
            return "nothing (can check)"
        return self.format_stack(self.observation.current_bet)

    def format_raise_range(self) -> str:
        """Format min/max raise range."""
        min_r = self.format_stack(self.observation.min_raise)
        max_r = self.format_stack(self.observation.max_raise)
        return f"{min_r} to {max_r}"

    def format_players(self) -> str:
        """Format player information."""
        lines = []
        for p in self.observation.players:
            status = "folded" if p["is_folded"] else "active"
            stack = self.format_stack(p["stack"])
            lines.append(f"  Seat {p['seat']}: {p['name']} - {stack} ({status})")
        return "\n".join(lines)

    def format_actions(self) -> str:
        """Format action history this hand."""
        if not self.observation.actions_this_hand:
            return "  No actions yet"

        lines = []
        current_street = None
        for a in self.observation.actions_this_hand:
            if a["street"] != current_street:
                current_street = a["street"]
                lines.append(f"  {current_street.upper()}:")

            action_str = a["action"]
            if a.get("amount"):
                action_str += f" {a['amount']}"
            lines.append(f"    Seat {a['seat']}: {action_str}")

        return "\n".join(lines)

    def to_prompt(self) -> str:
        """Generate the full observation prompt for the LLM.

        Returns:
            Formatted string for LLM consumption.
        """
        obs = self.observation

        # Build the prompt
        lines = [
            f"=== POKER DECISION - Hand #{obs.hand_number} ===",
            "",
            "YOUR INFORMATION:",
            f"  Seat: {obs.my_seat}",
            f"  Position: {obs.my_position}",
            f"  Hole Cards: {obs.my_hole_cards[0]} {obs.my_hole_cards[1]}",
            f"  Stack: {self.format_stack(obs.my_stack)}",
            "",
            "GAME STATE:",
            f"  Street: {obs.street}",
            f"  Community Cards: {' '.join(obs.community_cards) if obs.community_cards else 'None'}",
            f"  Pot: {self.format_pot()}",
            f"  To Call: {self.format_bet()}",
            "",
            f"BLINDS: {obs.small_blind}/{obs.big_blind}",
            f"Button: Seat {obs.button_seat}",
            "",
            "PLAYERS:",
            self.format_players(),
            "",
            "ACTION HISTORY THIS HAND:",
            self.format_actions(),
            "",
            "LEGAL ACTIONS:",
            f"  {', '.join(obs.legal_actions)}",
        ]

        if "raise" in obs.legal_actions:
            lines.append(f"  Raise range: {self.format_raise_range()}")

        lines.extend([
            "",
            "=== MAKE YOUR DECISION ===",
        ])

        return "\n".join(lines)


class ObservationBuilder:
    """Builder for creating observations from game state."""

    def __init__(self, use_bb_notation: bool = True) -> None:
        """Initialize the builder.

        Args:
            use_bb_notation: Whether to show stacks in BB notation.
        """
        self.use_bb_notation = use_bb_notation

    def build(
        self,
        hand_number: int,
        street: str,
        seat: int,
        position: str,
        hole_cards: tuple[str, str],
        stack: int,
        community_cards: tuple[str, ...],
        pot_size: int,
        current_bet: int,
        min_raise: int,
        max_raise: int,
        small_blind: int,
        big_blind: int,
        button_seat: int,
        players: list[dict[str, Any]],
        actions_this_hand: list[dict[str, Any]],
        legal_actions: list[str],
    ) -> Observation:
        """Build an observation from game state.

        Args:
            hand_number: Current hand number.
            street: Current street (preflop, flop, turn, river).
            seat: Agent's seat number.
            position: Agent's position (BTN, SB, BB, etc.).
            hole_cards: Agent's hole cards.
            stack: Agent's current stack.
            community_cards: Community cards on the board.
            pot_size: Current pot size.
            current_bet: Amount to call.
            min_raise: Minimum raise amount.
            max_raise: Maximum raise (all-in).
            small_blind: Small blind amount.
            big_blind: Big blind amount.
            button_seat: Button seat number.
            players: List of player info dicts.
            actions_this_hand: Actions taken this hand.
            legal_actions: List of legal actions.

        Returns:
            Observation object.
        """
        return Observation(
            hand_number=hand_number,
            street=street,
            my_seat=seat,
            my_position=position,
            my_hole_cards=hole_cards,
            my_stack=stack,
            community_cards=community_cards,
            pot_size=pot_size,
            current_bet=current_bet,
            min_raise=min_raise,
            max_raise=max_raise,
            small_blind=small_blind,
            big_blind=big_blind,
            button_seat=button_seat,
            players=players,
            actions_this_hand=actions_this_hand,
            legal_actions=legal_actions,
        )

    def format(self, observation: Observation) -> FormattedObservation:
        """Create a formatted observation for LLM consumption.

        Args:
            observation: The observation to format.

        Returns:
            FormattedObservation with formatting methods.
        """
        return FormattedObservation(
            observation=observation,
            use_bb_notation=self.use_bb_notation,
        )

    def to_prompt(self, observation: Observation) -> str:
        """Convert observation to LLM prompt string.

        Args:
            observation: The observation to convert.

        Returns:
            Formatted prompt string.
        """
        return self.format(observation).to_prompt()
