"""Unit tests for the poker engine components."""

import pytest

from live_poker_bench.engine.deck import Card, Deck, create_standard_deck
from live_poker_bench.engine.evaluator import (
    card_to_treys,
    determine_winners,
    evaluate_hand,
    rank_to_string,
)
from live_poker_bench.engine.blinds import BlindLevel, BlindSchedule
from live_poker_bench.engine.actions import (
    Action,
    ActionType,
    BettingState,
    PlayerState,
    get_legal_actions,
    validate_action,
)


class TestCard:
    """Tests for Card class."""

    def test_create_card(self):
        card = Card(rank="A", suit="h")
        assert card.rank == "A"
        assert card.suit == "h"
        assert str(card) == "Ah"

    def test_card_from_string(self):
        card = Card.from_str("Kd")
        assert card.rank == "K"
        assert card.suit == "d"

    def test_invalid_rank(self):
        with pytest.raises(ValueError):
            Card(rank="X", suit="h")

    def test_invalid_suit(self):
        with pytest.raises(ValueError):
            Card(rank="A", suit="x")

    def test_card_equality(self):
        card1 = Card(rank="A", suit="h")
        card2 = Card.from_str("Ah")
        assert card1 == card2


class TestDeck:
    """Tests for Deck class."""

    def test_standard_deck_size(self):
        deck = create_standard_deck()
        assert len(deck) == 52

    def test_deck_initialization(self):
        deck = Deck(seed=42)
        assert deck.remaining == 52

    def test_seeded_deck_determinism(self):
        deck1 = Deck(seed=42)
        deck2 = Deck(seed=42)

        cards1 = deck1.deal(5)
        cards2 = deck2.deal(5)

        assert cards1 == cards2

    def test_different_seeds_different_order(self):
        deck1 = Deck(seed=42)
        deck2 = Deck(seed=123)

        cards1 = deck1.deal(5)
        cards2 = deck2.deal(5)

        assert cards1 != cards2

    def test_deal_reduces_remaining(self):
        deck = Deck(seed=42)
        deck.deal(5)
        assert deck.remaining == 47

    def test_deal_one(self):
        deck = Deck(seed=42)
        card = deck.deal_one()
        assert isinstance(card, Card)
        assert deck.remaining == 51

    def test_cannot_deal_more_than_remaining(self):
        deck = Deck(seed=42)
        deck.deal(50)
        with pytest.raises(ValueError):
            deck.deal(5)

    def test_shuffle_resets_deck(self):
        deck = Deck(seed=42)
        deck.deal(10)
        deck.shuffle()
        assert deck.remaining == 52


class TestEvaluator:
    """Tests for hand evaluation."""

    def test_card_to_treys(self):
        card = Card.from_str("Ah")
        treys_card = card_to_treys(card)
        assert treys_card is not None

    def test_evaluate_pair(self):
        hole = [Card.from_str("Ah"), Card.from_str("Ad")]
        board = [Card.from_str("Ks"), Card.from_str("Qh"), Card.from_str("Jd"),
                 Card.from_str("5c"), Card.from_str("2s")]
        rank = evaluate_hand(hole, board)
        assert rank_to_string(rank) == "Pair"

    def test_evaluate_flush(self):
        hole = [Card.from_str("Ah"), Card.from_str("Kh")]
        board = [Card.from_str("Qh"), Card.from_str("Jh"), Card.from_str("9h"),
                 Card.from_str("2c"), Card.from_str("3d")]
        rank = evaluate_hand(hole, board)
        assert rank_to_string(rank) == "Flush"

    def test_evaluate_straight(self):
        hole = [Card.from_str("Ah"), Card.from_str("Kd")]
        board = [Card.from_str("Qh"), Card.from_str("Js"), Card.from_str("Tc"),
                 Card.from_str("2h"), Card.from_str("3d")]
        rank = evaluate_hand(hole, board)
        assert rank_to_string(rank) == "Straight"

    def test_determine_winners_single(self):
        player_cards = {
            1: [Card.from_str("Ah"), Card.from_str("Kh")],
            2: [Card.from_str("2d"), Card.from_str("3c")],
        }
        board = [Card.from_str("As"), Card.from_str("Ks"), Card.from_str("Qd"),
                 Card.from_str("Jh"), Card.from_str("5c")]

        winners, rank = determine_winners(player_cards, board)
        assert winners == [1]

    def test_determine_winners_tie(self):
        player_cards = {
            1: [Card.from_str("Ah"), Card.from_str("Kh")],
            2: [Card.from_str("Ad"), Card.from_str("Kd")],
        }
        board = [Card.from_str("Qs"), Card.from_str("Js"), Card.from_str("Tc"),
                 Card.from_str("2h"), Card.from_str("3c")]

        winners, rank = determine_winners(player_cards, board)
        assert len(winners) == 2
        assert 1 in winners and 2 in winners


class TestBlindSchedule:
    """Tests for blind schedule."""

    def test_default_schedule(self):
        schedule = BlindSchedule()
        assert len(schedule) == 6

    def test_get_blinds_level_1(self):
        schedule = BlindSchedule()
        sb, bb = schedule.get_blinds(1)
        assert sb == 1
        assert bb == 2

    def test_get_blinds_level_transition(self):
        schedule = BlindSchedule()
        # Hand 20 is still level 1
        sb, bb = schedule.get_blinds(20)
        assert sb == 1
        assert bb == 2
        # Hand 21 is level 2
        sb, bb = schedule.get_blinds(21)
        assert sb == 2
        assert bb == 4

    def test_final_level_continues(self):
        schedule = BlindSchedule()
        # After all levels, should stay at final
        sb, bb = schedule.get_blinds(200)
        assert sb == 32
        assert bb == 64

    def test_from_config(self):
        config = [
            {"hands": 10, "sb": 5, "bb": 10},
            {"hands": None, "sb": 10, "bb": 20},
        ]
        schedule = BlindSchedule.from_config(config)
        assert len(schedule) == 2
        sb, bb = schedule.get_blinds(1)
        assert sb == 5
        assert bb == 10


class TestActions:
    """Tests for action validation."""

    def test_fold_is_legal_when_facing_bet(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)

        actions = get_legal_actions(player, betting)
        action_types = [a.action_type for a in actions]
        assert ActionType.FOLD in action_types

    def test_check_is_legal_when_no_bet(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=3, current_bet=0, min_raise=2, big_blind=2)

        actions = get_legal_actions(player, betting)
        action_types = [a.action_type for a in actions]
        assert ActionType.CHECK in action_types
        assert ActionType.FOLD not in action_types

    def test_call_is_legal_when_facing_bet(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)

        actions = get_legal_actions(player, betting)
        action_types = [a.action_type for a in actions]
        assert ActionType.CALL in action_types

    def test_raise_is_legal_with_chips(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)

        actions = get_legal_actions(player, betting)
        action_types = [a.action_type for a in actions]
        assert ActionType.RAISE in action_types

    def test_validate_valid_fold(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)
        action = Action(ActionType.FOLD)

        is_valid, error = validate_action(action, player, betting)
        assert is_valid
        assert error == ""

    def test_validate_invalid_check_when_facing_bet(self):
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)
        action = Action(ActionType.CHECK)

        is_valid, error = validate_action(action, player, betting)
        assert not is_valid

    def test_all_in_call_with_short_stack(self):
        player = PlayerState(seat=1, stack=5, bet_this_round=0)
        betting = BettingState(pot=10, current_bet=10, min_raise=10, big_blind=2)

        actions = get_legal_actions(player, betting)
        call_actions = [a for a in actions if a.action_type == ActionType.CALL]
        assert len(call_actions) == 1
        assert call_actions[0].is_all_in
        assert call_actions[0].amount == 5
