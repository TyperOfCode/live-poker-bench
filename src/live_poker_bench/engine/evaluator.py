"""Hand evaluation using the treys library."""

from treys import Card as TreysCard
from treys import Evaluator as TreysEvaluator

from .deck import Card

_evaluator = TreysEvaluator()


def card_to_treys(card: Card) -> int:
    """Convert internal Card to treys format.

    Args:
        card: Internal Card object.

    Returns:
        Treys integer card representation.
    """
    return TreysCard.new(str(card))


def cards_to_treys(cards: list[Card]) -> list[int]:
    """Convert a list of Cards to treys format.

    Args:
        cards: List of internal Card objects.

    Returns:
        List of treys integer card representations.
    """
    return [card_to_treys(c) for c in cards]


def treys_to_card(treys_card: int) -> Card:
    """Convert treys card to internal Card.

    Args:
        treys_card: Treys integer card representation.

    Returns:
        Internal Card object.
    """
    s = TreysCard.int_to_str(treys_card)
    return Card.from_str(s)


def evaluate_hand(hole_cards: list[Card], community_cards: list[Card]) -> int:
    """Evaluate a poker hand (5-7 cards).

    Args:
        hole_cards: Player's hole cards (2 cards).
        community_cards: Community cards (3-5 cards).

    Returns:
        Hand rank (lower is better, 1 = royal flush, 7462 = worst hand).
    """
    hand = cards_to_treys(hole_cards)
    board = cards_to_treys(community_cards)
    return _evaluator.evaluate(board, hand)


def get_rank_class(rank: int) -> int:
    """Get the rank class (1-9) for a hand rank.

    1 = Straight Flush, 2 = Four of a Kind, ..., 9 = High Card

    Args:
        rank: Hand rank from evaluate_hand.

    Returns:
        Rank class (1-9).
    """
    return _evaluator.get_rank_class(rank)


def rank_to_string(rank: int) -> str:
    """Convert a hand rank to a human-readable string.

    Args:
        rank: Hand rank from evaluate_hand.

    Returns:
        Human-readable hand description (e.g., "Straight Flush").
    """
    return _evaluator.class_to_string(get_rank_class(rank))


def compare_hands(
    hands: list[tuple[list[Card], list[Card]]]
) -> list[tuple[int, int]]:
    """Compare multiple hands and return rankings.

    Args:
        hands: List of (hole_cards, community_cards) tuples.

    Returns:
        List of (player_index, rank) tuples, sorted by rank (best first).
    """
    evaluated = [(i, evaluate_hand(h, c)) for i, (h, c) in enumerate(hands)]
    return sorted(evaluated, key=lambda x: x[1])


def determine_winners(
    player_hole_cards: dict[int, list[Card]], community_cards: list[Card]
) -> tuple[list[int], int]:
    """Determine the winner(s) of a showdown.

    Args:
        player_hole_cards: Dict mapping seat number to hole cards.
        community_cards: The 5 community cards.

    Returns:
        Tuple of (list of winning seat numbers, winning hand rank).
        Multiple seats indicates a tie.
    """
    if len(community_cards) != 5:
        raise ValueError(f"Expected 5 community cards, got {len(community_cards)}")

    ranks = {}
    for seat, hole in player_hole_cards.items():
        ranks[seat] = evaluate_hand(hole, community_cards)

    best_rank = min(ranks.values())
    winners = [seat for seat, rank in ranks.items() if rank == best_rank]

    return winners, best_rank
