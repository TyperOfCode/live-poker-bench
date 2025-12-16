"""Seeded deck for deterministic poker games."""

import random
from dataclasses import dataclass

RANKS = "23456789TJQKA"
SUITS = "cdhs"  # clubs, diamonds, hearts, spades


@dataclass(frozen=True)
class Card:
    """A playing card with rank and suit."""

    rank: str
    suit: str

    def __post_init__(self) -> None:
        if self.rank not in RANKS:
            raise ValueError(f"Invalid rank: {self.rank}")
        if self.suit not in SUITS:
            raise ValueError(f"Invalid suit: {self.suit}")

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"

    def __repr__(self) -> str:
        return f"Card('{self.rank}{self.suit}')"

    @classmethod
    def from_str(cls, s: str) -> "Card":
        """Create a Card from a string like 'Ah' or 'Kd'."""
        if len(s) != 2:
            raise ValueError(f"Invalid card string: {s}")
        return cls(rank=s[0], suit=s[1])


def create_standard_deck() -> list[Card]:
    """Create a standard 52-card deck."""
    return [Card(rank=r, suit=s) for r in RANKS for s in SUITS]


class Deck:
    """A seeded deck supporting deterministic shuffling."""

    def __init__(self, seed: int | None = None) -> None:
        """Initialize a deck with optional seed for reproducibility.

        Args:
            seed: Random seed for deterministic shuffling. If None, uses system randomness.
        """
        self._cards = create_standard_deck()
        self._rng = random.Random(seed)
        self._dealt_count = 0
        self.shuffle()

    def shuffle(self) -> None:
        """Shuffle the deck using the seeded RNG."""
        self._cards = create_standard_deck()
        self._rng.shuffle(self._cards)
        self._dealt_count = 0

    def deal(self, n: int = 1) -> list[Card]:
        """Deal n cards from the top of the deck.

        Args:
            n: Number of cards to deal.

        Returns:
            List of dealt cards.

        Raises:
            ValueError: If not enough cards remain.
        """
        remaining = len(self._cards) - self._dealt_count
        if n > remaining:
            raise ValueError(f"Cannot deal {n} cards, only {remaining} remain")

        cards = self._cards[self._dealt_count : self._dealt_count + n]
        self._dealt_count += n
        return cards

    def deal_one(self) -> Card:
        """Deal a single card from the top of the deck."""
        return self.deal(1)[0]

    @property
    def remaining(self) -> int:
        """Number of cards remaining in the deck."""
        return len(self._cards) - self._dealt_count

    def reset(self, seed: int | None = None) -> None:
        """Reset the deck with a new seed.

        Args:
            seed: New random seed. If None, keeps the current RNG state.
        """
        if seed is not None:
            self._rng = random.Random(seed)
        self.shuffle()


def create_tournament_deck(seed_base: int, run_number: int) -> Deck:
    """Create a deck for a tournament run.

    Args:
        seed_base: Base seed from tournament config.
        run_number: Tournament run number (0-indexed).

    Returns:
        A shuffled Deck for this tournament run.
    """
    return Deck(seed=seed_base + run_number)
