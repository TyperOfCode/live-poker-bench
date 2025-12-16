"""Blind schedule management for tournament play."""

from dataclasses import dataclass


@dataclass
class BlindLevel:
    """A single blind level in the tournament structure."""

    level: int
    hands: int | None  # None means infinite (final level)
    small_blind: int
    big_blind: int

    @property
    def is_final(self) -> bool:
        """Return True if this is the final (infinite) level."""
        return self.hands is None


DEFAULT_BLIND_SCHEDULE = [
    BlindLevel(level=1, hands=20, small_blind=1, big_blind=2),
    BlindLevel(level=2, hands=20, small_blind=2, big_blind=4),
    BlindLevel(level=3, hands=20, small_blind=4, big_blind=8),
    BlindLevel(level=4, hands=20, small_blind=8, big_blind=16),
    BlindLevel(level=5, hands=20, small_blind=16, big_blind=32),
    BlindLevel(level=6, hands=None, small_blind=32, big_blind=64),
]


class BlindSchedule:
    """Manages blind progression based on hand count."""

    def __init__(self, levels: list[BlindLevel] | None = None) -> None:
        """Initialize blind schedule.

        Args:
            levels: List of BlindLevel objects. Uses default schedule if None.
        """
        self._levels = levels if levels is not None else DEFAULT_BLIND_SCHEDULE
        if not self._levels:
            raise ValueError("Blind schedule cannot be empty")

        # Validate that last level is infinite
        if not self._levels[-1].is_final:
            raise ValueError("Last blind level must have hands=None (infinite)")

    @classmethod
    def from_config(
        cls, config: list[dict[str, int | None]]
    ) -> "BlindSchedule":
        """Create a BlindSchedule from a config list.

        Args:
            config: List of dicts with 'hands', 'sb', 'bb' keys.

        Returns:
            BlindSchedule instance.
        """
        levels = [
            BlindLevel(
                level=i + 1,
                hands=item.get("hands"),
                small_blind=item["sb"],
                big_blind=item["bb"],
            )
            for i, item in enumerate(config)
        ]
        return cls(levels)

    def get_level_for_hand(self, hand_number: int) -> BlindLevel:
        """Get the blind level for a given hand number.

        Args:
            hand_number: The current hand number (1-indexed).

        Returns:
            The BlindLevel for this hand.
        """
        if hand_number < 1:
            raise ValueError(f"Hand number must be >= 1, got {hand_number}")

        hands_played = hand_number - 1  # Hands completed before this one
        cumulative = 0

        for level in self._levels:
            if level.is_final:
                return level

            cumulative += level.hands
            if hands_played < cumulative:
                return level

        # Should never reach here if schedule is valid
        return self._levels[-1]

    def get_blinds(self, hand_number: int) -> tuple[int, int]:
        """Get the small and big blind for a given hand number.

        Args:
            hand_number: The current hand number (1-indexed).

        Returns:
            Tuple of (small_blind, big_blind).
        """
        level = self.get_level_for_hand(hand_number)
        return level.small_blind, level.big_blind

    @property
    def levels(self) -> list[BlindLevel]:
        """Return a copy of all blind levels."""
        return list(self._levels)

    def __len__(self) -> int:
        """Return the number of blind levels."""
        return len(self._levels)

    def get_level(self, hand_number: int) -> int:
        """Get the level number for a given hand number.

        Args:
            hand_number: The current hand number (1-indexed).

        Returns:
            The level number (1-indexed).
        """
        return self.get_level_for_hand(hand_number).level
