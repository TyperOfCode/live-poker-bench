"""Agent memory system for storing observable game information."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class ActionRecord:
    """A single action observed during play."""

    street: str
    seat: int
    player_name: str
    action: str
    amount: int | None = None


@dataclass
class HandRecord:
    """Record of a hand from an agent's perspective."""

    hand_number: int
    my_position: str  # e.g., "BTN", "SB", "BB", "UTG", etc.
    my_hole_cards: tuple[str, str]
    community_cards: tuple[str, ...]
    actions: list[ActionRecord] = field(default_factory=list)
    showdown_cards: dict[int, tuple[str, str]] = field(default_factory=dict)  # seat -> cards
    result: Literal["won", "lost", "folded", "split"] = "folded"
    chips_won: int = 0
    pot_size: int = 0
    my_final_stack: int = 0

    def get_opponent_actions(self, opponent_seat: int) -> list[ActionRecord]:
        """Get all actions by a specific opponent in this hand."""
        return [a for a in self.actions if a.seat == opponent_seat]

    def get_actions_by_street(self, street: str) -> list[ActionRecord]:
        """Get all actions on a specific street."""
        return [a for a in self.actions if a.street == street]


def get_position_name(seat: int, button_seat: int, num_players: int, active_seats: list[int]) -> str:
    """Get position name for a seat.

    Args:
        seat: The seat number.
        button_seat: The button seat number.
        num_players: Total number of players at the table.
        active_seats: List of active seat numbers.

    Returns:
        Position name (BTN, SB, BB, UTG, MP, CO, etc.)
    """
    if seat not in active_seats:
        return "OUT"

    # Sort seats and find position relative to button
    sorted_seats = sorted(active_seats)
    n = len(sorted_seats)

    if n == 0:
        return "OUT"

    # Find button index
    btn_idx = sorted_seats.index(button_seat) if button_seat in sorted_seats else 0
    seat_idx = sorted_seats.index(seat)

    # Position relative to button (0 = button)
    relative_pos = (seat_idx - btn_idx) % n

    if relative_pos == 0:
        return "BTN"
    elif relative_pos == 1:
        if n == 2:
            return "BB"  # Heads-up: BTN is SB
        return "SB"
    elif relative_pos == 2:
        return "BB"
    elif n <= 4:
        return "UTG" if relative_pos == 3 else "CO"
    elif n == 5:
        positions = ["BTN", "SB", "BB", "UTG", "CO"]
        return positions[relative_pos]
    else:
        # 6+ players
        if relative_pos == 3:
            return "UTG"
        elif relative_pos == n - 1:
            return "CO"
        else:
            return f"MP{relative_pos - 3}"


class AgentMemory:
    """Stores what an agent has legally observed during play."""

    def __init__(self, agent_name: str, seat: int) -> None:
        """Initialize agent memory.

        Args:
            agent_name: Name of the agent.
            seat: The agent's seat number.
        """
        self.agent_name = agent_name
        self.seat = seat
        self.hands: list[HandRecord] = []
        self._current_hand: HandRecord | None = None

    def start_hand(
        self,
        hand_number: int,
        hole_cards: tuple[str, str],
        position: str,
    ) -> None:
        """Start recording a new hand.

        Args:
            hand_number: The hand number.
            hole_cards: The agent's hole cards as strings.
            position: The agent's position (BTN, SB, BB, etc.)
        """
        self._current_hand = HandRecord(
            hand_number=hand_number,
            my_position=position,
            my_hole_cards=hole_cards,
            community_cards=(),
        )

    def record_action(
        self,
        street: str,
        seat: int,
        player_name: str,
        action: str,
        amount: int | None = None,
    ) -> None:
        """Record an observed action.

        Args:
            street: The betting street.
            seat: The seat that acted.
            player_name: Name of the player.
            action: The action taken.
            amount: The amount bet/raised (if applicable).
        """
        if self._current_hand is None:
            return

        self._current_hand.actions.append(
            ActionRecord(
                street=street,
                seat=seat,
                player_name=player_name,
                action=action,
                amount=amount,
            )
        )

    def update_community_cards(self, cards: tuple[str, ...]) -> None:
        """Update the community cards for the current hand.

        Args:
            cards: Tuple of card strings.
        """
        if self._current_hand is not None:
            self._current_hand.community_cards = cards

    def record_showdown(self, seat: int, cards: tuple[str, str]) -> None:
        """Record cards revealed at showdown.

        Args:
            seat: The seat showing cards.
            cards: The hole cards shown.
        """
        if self._current_hand is not None:
            self._current_hand.showdown_cards[seat] = cards

    def end_hand(
        self,
        result: Literal["won", "lost", "folded", "split"],
        chips_won: int,
        pot_size: int,
        final_stack: int,
    ) -> None:
        """End the current hand and store the record.

        Args:
            result: The outcome for this agent.
            chips_won: Amount won (0 if lost/folded).
            pot_size: Final pot size.
            final_stack: Agent's stack after the hand.
        """
        if self._current_hand is not None:
            self._current_hand.result = result
            self._current_hand.chips_won = chips_won
            self._current_hand.pot_size = pot_size
            self._current_hand.my_final_stack = final_stack
            self.hands.append(self._current_hand)
            self._current_hand = None

    def get_hand(self, hand_number: int) -> HandRecord | None:
        """Get a specific hand record by number."""
        for hand in self.hands:
            if hand.hand_number == hand_number:
                return hand
        return None

    def get_hands_against(self, opponent_seat: int) -> list[HandRecord]:
        """Get all hands where a specific opponent was involved."""
        result = []
        for hand in self.hands:
            if any(a.seat == opponent_seat for a in hand.actions):
                result.append(hand)
        return result

    def get_showdowns_by_opponent(self, opponent_seat: int) -> list[HandRecord]:
        """Get all hands where an opponent's cards were revealed."""
        return [h for h in self.hands if opponent_seat in h.showdown_cards]

    def get_winning_hands(self) -> list[HandRecord]:
        """Get all hands the agent won."""
        return [h for h in self.hands if h.result == "won"]

    def get_recent_hands(self, n: int = 10) -> list[HandRecord]:
        """Get the N most recent hands."""
        return self.hands[-n:]

    def search_observations(self, query: str) -> list[HandRecord]:
        """Search hands for matching observations.

        Simple text search across hand data.

        Args:
            query: Search query string.

        Returns:
            List of matching HandRecords.
        """
        query = query.lower()
        results = []

        for hand in self.hands:
            # Search in cards
            if any(query in c.lower() for c in hand.my_hole_cards):
                results.append(hand)
                continue
            if any(query in c.lower() for c in hand.community_cards):
                results.append(hand)
                continue

            # Search in position
            if query in hand.my_position.lower():
                results.append(hand)
                continue

            # Search in result
            if query in hand.result.lower():
                results.append(hand)
                continue

            # Search in actions
            for action in hand.actions:
                if query in action.action.lower() or query in action.player_name.lower():
                    results.append(hand)
                    break

        return results

    def to_dict(self) -> dict:
        """Convert memory to a serializable dict."""
        return {
            "agent_name": self.agent_name,
            "seat": self.seat,
            "hands": [
                {
                    "hand_number": h.hand_number,
                    "my_position": h.my_position,
                    "my_hole_cards": h.my_hole_cards,
                    "community_cards": h.community_cards,
                    "actions": [
                        {
                            "street": a.street,
                            "seat": a.seat,
                            "player_name": a.player_name,
                            "action": a.action,
                            "amount": a.amount,
                        }
                        for a in h.actions
                    ],
                    "showdown_cards": {
                        str(k): v for k, v in h.showdown_cards.items()
                    },
                    "result": h.result,
                    "chips_won": h.chips_won,
                    "pot_size": h.pot_size,
                    "my_final_stack": h.my_final_stack,
                }
                for h in self.hands
            ],
        }
