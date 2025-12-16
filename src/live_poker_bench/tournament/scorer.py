"""Placement scoring for tournament results."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Elimination:
    """Record of a player elimination."""

    seat: int
    agent_name: str
    hand_number: int
    placement: int | None = None


class PlacementScorer:
    """Tracks eliminations and calculates placement scores."""

    def __init__(self, num_players: int) -> None:
        """Initialize the scorer.

        Args:
            num_players: Total number of players in the tournament.
        """
        self.num_players = num_players
        self.eliminations: list[Elimination] = []
        self._active_players: set[int] = set(range(1, num_players + 1))
        self._agent_names: dict[int, str] = {}

    def register_player(self, seat: int, name: str) -> None:
        """Register a player.

        Args:
            seat: Seat number.
            name: Agent name.
        """
        self._agent_names[seat] = name

    def record_elimination(self, seat: int, hand_number: int) -> None:
        """Record a player elimination.

        Args:
            seat: The eliminated player's seat.
            hand_number: The hand they were eliminated on.
        """
        if seat not in self._active_players:
            return

        self._active_players.remove(seat)
        name = self._agent_names.get(seat, f"Player_{seat}")

        self.eliminations.append(
            Elimination(
                seat=seat,
                agent_name=name,
                hand_number=hand_number,
            )
        )

    def record_multi_elimination(
        self,
        seats: list[int],
        hand_number: int,
    ) -> None:
        """Record multiple eliminations on the same hand.

        When multiple players bust on the same hand, they share the placement.

        Args:
            seats: List of eliminated seats.
            hand_number: The hand they were eliminated on.
        """
        for seat in seats:
            if seat in self._active_players:
                self._active_players.remove(seat)
                name = self._agent_names.get(seat, f"Player_{seat}")
                self.eliminations.append(
                    Elimination(
                        seat=seat,
                        agent_name=name,
                        hand_number=hand_number,
                    )
                )

    def get_remaining_players(self) -> set[int]:
        """Get seats of remaining active players."""
        return self._active_players.copy()

    def is_tournament_over(self) -> bool:
        """Check if tournament is over (one or zero players remain)."""
        return len(self._active_players) <= 1

    def get_winner(self) -> int | None:
        """Get the winning seat number.

        Returns:
            Winning seat number, or None if no winner yet.
        """
        if len(self._active_players) == 1:
            return list(self._active_players)[0]
        return None

    def calculate_placements(self) -> dict[int, int]:
        """Calculate final placements for all players.

        Returns:
            Dictionary mapping seat -> placement (1 = winner).
        """
        placements: dict[int, int] = {}

        # Winner gets 1st place
        if self._active_players:
            for seat in self._active_players:
                placements[seat] = 1

        # Eliminations in reverse order (last eliminated = 2nd place, etc.)
        current_placement = len(self._active_players) + 1

        # Group eliminations by hand number for tie handling
        elims_by_hand: dict[int, list[Elimination]] = {}
        for elim in reversed(self.eliminations):
            if elim.hand_number not in elims_by_hand:
                elims_by_hand[elim.hand_number] = []
            elims_by_hand[elim.hand_number].append(elim)

        # Process in order (most recent elimination first)
        for hand_num in sorted(elims_by_hand.keys(), reverse=True):
            hand_elims = elims_by_hand[hand_num]
            # All players eliminated on same hand share the placement
            shared_placement = current_placement
            for elim in hand_elims:
                placements[elim.seat] = shared_placement
            current_placement += len(hand_elims)

        return placements

    def get_placements_by_name(self) -> dict[str, int]:
        """Get placements mapped by agent name.

        Returns:
            Dictionary mapping agent_name -> placement.
        """
        seat_placements = self.calculate_placements()
        return {
            self._agent_names.get(seat, f"Player_{seat}"): placement
            for seat, placement in seat_placements.items()
        }

    def get_placement_percentile(self, seat: int) -> float:
        """Calculate placement percentile for a player.

        Args:
            seat: The player's seat.

        Returns:
            Percentile (1.0 = winner, 0.0 = first eliminated).
        """
        placements = self.calculate_placements()
        placement = placements.get(seat)
        if placement is None:
            return 0.0

        # 1st place = 1.0, last place = 1/n
        return (self.num_players - placement + 1) / self.num_players

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        placements = self.calculate_placements()
        return {
            "num_players": self.num_players,
            "placements": {
                self._agent_names.get(seat, f"Player_{seat}"): placement
                for seat, placement in placements.items()
            },
            "elimination_order": [
                {
                    "seat": e.seat,
                    "agent_name": e.agent_name,
                    "hand_number": e.hand_number,
                    "placement": placements.get(e.seat),
                }
                for e in self.eliminations
            ],
        }
