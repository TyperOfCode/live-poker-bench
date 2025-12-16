"""Hand logger for recording complete hand histories."""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class HandLog:
    """Complete log of a single hand."""

    hand_number: int
    blind_level: int
    button_seat: int
    small_blind: int
    big_blind: int
    players: list[dict[str, Any]] = field(default_factory=list)
    hole_cards: dict[int, list[str]] = field(default_factory=dict)
    community_cards: list[str] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    showdown: dict[int, list[str]] = field(default_factory=dict)
    winners: list[int] = field(default_factory=list)
    pot: int = 0
    pots_awarded: dict[int, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "hand_number": self.hand_number,
            "blind_level": self.blind_level,
            "button_seat": self.button_seat,
            "blinds": {
                "small": self.small_blind,
                "big": self.big_blind,
            },
            "players": self.players,
            "hole_cards": {str(k): v for k, v in self.hole_cards.items()},
            "community_cards": self.community_cards,
            "actions": self.actions,
            "showdown": {str(k): v for k, v in self.showdown.items()},
            "winners": self.winners,
            "pot": self.pot,
            "pots_awarded": {str(k): v for k, v in self.pots_awarded.items()},
        }


class HandLogger:
    """Logs complete hand histories to JSON files."""

    def __init__(self, log_dir: Path) -> None:
        """Initialize the hand logger.

        Args:
            log_dir: Directory to write hand logs.
        """
        self.log_dir = log_dir
        self.hands_dir = log_dir / "hands"
        self.hands_dir.mkdir(parents=True, exist_ok=True)
        self._current_hand: HandLog | None = None

    def start_hand(
        self,
        hand_number: int,
        blind_level: int,
        button_seat: int,
        small_blind: int,
        big_blind: int,
        players: list[dict[str, Any]],
        hole_cards: dict[int, list[str]],
    ) -> None:
        """Start logging a new hand.

        Args:
            hand_number: The hand number.
            blind_level: Current blind level (1-indexed).
            button_seat: The dealer button seat.
            small_blind: Small blind amount.
            big_blind: Big blind amount.
            players: List of player info dicts.
            hole_cards: Dict mapping seat -> hole cards.
        """
        self._current_hand = HandLog(
            hand_number=hand_number,
            blind_level=blind_level,
            button_seat=button_seat,
            small_blind=small_blind,
            big_blind=big_blind,
            players=players,
            hole_cards=hole_cards,
        )

    def record_action(
        self,
        street: str,
        seat: int,
        action: str,
        amount: int | None = None,
        pot_after: int | None = None,
    ) -> None:
        """Record an action.

        Args:
            street: The betting street.
            seat: The seat that acted.
            action: The action taken.
            amount: Amount bet/raised (if applicable).
            pot_after: Pot size after the action.
        """
        if self._current_hand is None:
            return

        action_record: dict[str, Any] = {
            "street": street,
            "seat": seat,
            "action": action,
        }
        if amount is not None:
            action_record["amount"] = amount
        if pot_after is not None:
            action_record["pot_after"] = pot_after

        self._current_hand.actions.append(action_record)

    def record_community_cards(self, cards: list[str]) -> None:
        """Record community cards.

        Args:
            cards: The community cards.
        """
        if self._current_hand is not None:
            self._current_hand.community_cards = cards

    def record_showdown(self, seat: int, cards: list[str]) -> None:
        """Record cards shown at showdown.

        Args:
            seat: The seat showing cards.
            cards: The hole cards shown.
        """
        if self._current_hand is not None:
            self._current_hand.showdown[seat] = cards

    def end_hand(
        self,
        winners: list[int],
        pot: int,
        pots_awarded: dict[int, int],
    ) -> None:
        """End the current hand and write to file.

        Args:
            winners: List of winning seat numbers.
            pot: Total pot size.
            pots_awarded: Dict mapping seat -> amount won.
        """
        if self._current_hand is None:
            return

        self._current_hand.winners = winners
        self._current_hand.pot = pot
        self._current_hand.pots_awarded = pots_awarded

        # Write to file
        filename = f"hand_{self._current_hand.hand_number:03d}.json"
        filepath = self.hands_dir / filename

        with open(filepath, "w") as f:
            json.dump(self._current_hand.to_dict(), f, indent=2)

        self._current_hand = None

    def get_hand_log(self, hand_number: int) -> dict[str, Any] | None:
        """Read a hand log from file.

        Args:
            hand_number: The hand number to read.

        Returns:
            Hand log dict or None if not found.
        """
        filename = f"hand_{hand_number:03d}.json"
        filepath = self.hands_dir / filename

        if filepath.exists():
            with open(filepath) as f:
                return json.load(f)
        return None

    def get_all_hand_logs(self) -> list[dict[str, Any]]:
        """Read all hand logs.

        Returns:
            List of hand log dicts, sorted by hand number.
        """
        logs = []
        for filepath in sorted(self.hands_dir.glob("hand_*.json")):
            with open(filepath) as f:
                logs.append(json.load(f))
        return logs
