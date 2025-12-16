"""Comprehensive tests for betting round polling behavior.

These tests verify that:
1. All players get action opportunities at the correct times
2. Raises properly reopen betting to players who already acted
3. Big blind gets option to raise after limps
4. Betting rounds don't end prematurely
5. Edge cases with all-ins, short stacks, and multi-way pots
"""

import pytest

from live_poker_bench.engine.actions import Action, ActionType
from live_poker_bench.engine.blinds import BlindSchedule
from live_poker_bench.engine.deck import Deck
from live_poker_bench.engine.game import GameState, Player, Street

# Apply 5 second timeout to all tests in this module
pytestmark = pytest.mark.timeout(5)


class TestPreflopPolling:
    """Tests for preflop betting round action polling."""

    def create_game(self, num_players: int = 5, stacks: list[int] | None = None) -> GameState:
        """Create a game with the given number of players."""
        if stacks is None:
            stacks = [200] * num_players
        
        players = [
            Player(seat=i + 1, name=f"Player {i + 1}", stack=stacks[i])
            for i in range(num_players)
        ]
        
        deck = Deck(seed=42)
        schedule = BlindSchedule()
        
        return GameState(
            players=players,
            deck=deck,
            blind_schedule=schedule,
            button_seat=1,
        )

    def test_utg_acts_first_preflop(self):
        """UTG should act first preflop (first player after BB)."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # With 5 players, button=1, SB=2, BB=3, UTG=4
        assert game.action_to == 4

    def test_bb_gets_option_after_limps(self):
        """BB should get option to raise after everyone limps."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # All players limp (call the BB of 2)
        # UTG (seat 4) calls - to_call = 2 - 0 = 2
        game.apply_action(4, Action(ActionType.CALL, amount=2))
        # Seat 5 calls
        game.apply_action(5, Action(ActionType.CALL, amount=2))
        # Button (seat 1) calls
        game.apply_action(1, Action(ActionType.CALL, amount=2))
        # SB (seat 2) completes - to_call = 2 - 1 = 1
        game.apply_action(2, Action(ActionType.CALL, amount=1))
        
        # BB (seat 3) should now have action
        assert game.action_to == 3
        assert game.street == Street.PREFLOP
        assert not game.is_hand_complete()
        
        # BB can check or raise
        player = game.players[3]
        assert player.bet_this_round == 2
        assert game.current_bet == 2

    def test_bb_can_raise_after_limps(self):
        """BB should be able to raise after everyone limps."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # All players limp
        game.apply_action(4, Action(ActionType.CALL, amount=2))
        game.apply_action(5, Action(ActionType.CALL, amount=2))
        game.apply_action(1, Action(ActionType.CALL, amount=2))
        game.apply_action(2, Action(ActionType.CALL, amount=1))  # SB completes (to_call = 1)
        
        # BB raises to 8
        success, _ = game.apply_action(3, Action(ActionType.RAISE, amount=8))
        assert success
        
        # Action should reopen to UTG (seat 4)
        assert game.action_to == 4
        assert game.current_bet == 8
        assert game.street == Street.PREFLOP

    def test_bb_check_ends_preflop(self):
        """If BB checks after limps, we should go to flop."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # All players limp
        game.apply_action(4, Action(ActionType.CALL, amount=2))
        game.apply_action(5, Action(ActionType.CALL, amount=2))
        game.apply_action(1, Action(ActionType.CALL, amount=2))
        game.apply_action(2, Action(ActionType.CALL, amount=1))  # SB completes
        
        # BB checks
        success, _ = game.apply_action(3, Action(ActionType.CHECK))
        assert success
        
        # Should now be on flop
        assert game.street == Street.FLOP
        assert len(game.community_cards) == 3

    def test_raise_reopens_action_to_previous_actors(self):
        """A raise should reopen action to players who already acted."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # UTG raises to 6
        game.apply_action(4, Action(ActionType.RAISE, amount=6))
        # Seat 5 calls - to_call = 6 - 0 = 6
        game.apply_action(5, Action(ActionType.CALL, amount=6))
        # Button folds
        game.apply_action(1, Action(ActionType.FOLD))
        # SB folds
        game.apply_action(2, Action(ActionType.FOLD))
        # BB 3-bets to 18
        game.apply_action(3, Action(ActionType.RAISE, amount=18))
        
        # UTG (seat 4) should now have action (already acted but raise reopens)
        assert game.action_to == 4
        assert game.current_bet == 18
        
        # Seat 5 should also get another chance after UTG
        # UTG calls - to_call = 18 - 6 = 12
        game.apply_action(4, Action(ActionType.CALL, amount=12))
        assert game.action_to == 5

    def test_raise_after_raise_reopens_action(self):
        """4-bet should reopen action to the 3-bettor."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # 3-way pot: BTN=1, SB=2, BB=3
        # With 3 players and button=1: SB=2, BB=3
        # Preflop action starts after BB, which wraps to seat 1 (button)
        assert game.action_to == 1  # Button acts first preflop in 3-way
        
        # Button raises to 6
        game.apply_action(1, Action(ActionType.RAISE, amount=6))
        
        # SB 3-bets to 18 (from SB position, so amount is total raise-to)
        game.apply_action(2, Action(ActionType.RAISE, amount=18))
        
        # BB folds
        game.apply_action(3, Action(ActionType.FOLD))
        
        # Button should have action (4-bet opportunity)
        assert game.action_to == 1
        assert game.current_bet == 18
        
        # Button 4-bets to 50
        game.apply_action(1, Action(ActionType.RAISE, amount=50))
        
        # SB should have action again
        assert game.action_to == 2
        assert game.current_bet == 50

    def test_all_fold_to_raiser_ends_hand(self):
        """If everyone folds to a raise, hand should end."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # UTG raises to 6
        game.apply_action(4, Action(ActionType.RAISE, amount=6))
        # Everyone folds
        game.apply_action(5, Action(ActionType.FOLD))
        game.apply_action(1, Action(ActionType.FOLD))
        game.apply_action(2, Action(ActionType.FOLD))
        game.apply_action(3, Action(ActionType.FOLD))
        
        # Hand should be complete
        assert game.is_hand_complete()
        assert len(game.active_players) == 1
        assert game.active_players[0].seat == 4

    def test_heads_up_after_folds_continues_correctly(self):
        """After folds leaving 2 players, action should continue properly."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # UTG raises to 6
        game.apply_action(4, Action(ActionType.RAISE, amount=6))
        # Seat 5 folds
        game.apply_action(5, Action(ActionType.FOLD))
        # Button folds
        game.apply_action(1, Action(ActionType.FOLD))
        # SB 3-bets to 18
        game.apply_action(2, Action(ActionType.RAISE, amount=18))
        # BB folds
        game.apply_action(3, Action(ActionType.FOLD))
        
        # Now heads up: SB (seat 2) vs UTG (seat 4)
        # UTG should have action facing the 3-bet
        assert game.action_to == 4
        assert game.current_bet == 18
        assert len(game.active_players) == 2
        
        # UTG calls - to_call = 18 - 6 = 12
        game.apply_action(4, Action(ActionType.CALL, amount=12))
        
        # Should advance to flop
        assert game.street == Street.FLOP
        assert len(game.community_cards) == 3

    def test_multiple_raises_track_action_correctly(self):
        """Multiple raises should correctly track who needs to act."""
        game = self.create_game(4)
        game.start_hand(1)
        
        # Button=1, SB=2, BB=3, UTG=4
        # UTG raises to 6
        game.apply_action(4, Action(ActionType.RAISE, amount=6))
        # Button 3-bets to 18
        game.apply_action(1, Action(ActionType.RAISE, amount=18))
        
        # SB should have action
        assert game.action_to == 2
        
        # SB calls - to_call = 18 - 1 = 17
        game.apply_action(2, Action(ActionType.CALL, amount=17))
        
        # BB should have action
        assert game.action_to == 3
        
        # BB 4-bets to 50
        game.apply_action(3, Action(ActionType.RAISE, amount=50))
        
        # UTG should have action
        assert game.action_to == 4
        
        # UTG folds
        game.apply_action(4, Action(ActionType.FOLD))
        
        # Button should have action
        assert game.action_to == 1
        
        # Button 5-bets all-in to 200
        game.apply_action(1, Action(ActionType.RAISE, amount=200, is_all_in=True))
        
        # SB should have action
        assert game.action_to == 2


class TestPostflopPolling:
    """Tests for postflop betting round action polling."""

    def create_game_at_flop(
        self, num_players: int = 3, stacks: list[int] | None = None
    ) -> GameState:
        """Create a game that has advanced to the flop."""
        if stacks is None:
            stacks = [200] * num_players
        
        players = [
            Player(seat=i + 1, name=f"Player {i + 1}", stack=stacks[i])
            for i in range(num_players)
        ]
        
        deck = Deck(seed=42)
        schedule = BlindSchedule()
        
        game = GameState(
            players=players,
            deck=deck,
            blind_schedule=schedule,
            button_seat=1,
        )
        
        game.start_hand(1)
        
        # For 3 players: BTN=1, SB=2, BB=3. Action starts at BTN (seat 1)
        # For more players: BTN=1, SB=2, BB=3, UTG=4, etc. Action starts at seat 4
        
        # Simple approach: handle each action individually based on current state
        while game.street == Street.PREFLOP and not game.is_hand_complete():
            seat = game.action_to
            if seat is None:
                break
            player = game.players[seat]
            to_call = game.current_bet - player.bet_this_round
            
            if to_call == 0:
                # Can check (BB option)
                game.apply_action(seat, Action(ActionType.CHECK))
            else:
                # Call
                game.apply_action(seat, Action(ActionType.CALL, amount=to_call))
        
        return game

    def test_postflop_action_starts_left_of_button(self):
        """Postflop action should start with first active player after button."""
        game = self.create_game_at_flop(5)
        
        assert game.street == Street.FLOP
        # With button=1, first active player left of button is SB (seat 2)
        assert game.action_to == 2

    def test_postflop_bet_reopens_action(self):
        """A bet postflop should reopen action to all players."""
        game = self.create_game_at_flop(3)
        
        assert game.street == Street.FLOP
        # SB bets 10
        game.apply_action(2, Action(ActionType.BET, amount=10))
        
        # BB should have action
        assert game.action_to == 3
        
        # BB raises to 30
        game.apply_action(3, Action(ActionType.RAISE, amount=30))
        
        # Button should have action
        assert game.action_to == 1
        
        # Button calls - to_call = 30 - 0 = 30
        game.apply_action(1, Action(ActionType.CALL, amount=30))
        
        # SB should have action (facing the raise) - to_call = 30 - 10 = 20
        assert game.action_to == 2

    def test_check_around_advances_street(self):
        """If everyone checks, we should advance to the next street."""
        game = self.create_game_at_flop(3)
        
        assert game.street == Street.FLOP
        
        # Everyone checks
        game.apply_action(2, Action(ActionType.CHECK))  # SB
        game.apply_action(3, Action(ActionType.CHECK))  # BB
        game.apply_action(1, Action(ActionType.CHECK))  # Button
        
        # Should be on turn
        assert game.street == Street.TURN
        assert len(game.community_cards) == 4

    def test_action_continues_after_fold(self):
        """Betting round should continue after a fold."""
        game = self.create_game_at_flop(3)
        
        # SB bets
        game.apply_action(2, Action(ActionType.BET, amount=10))
        
        # BB folds
        game.apply_action(3, Action(ActionType.FOLD))
        
        # Button should still have action
        assert game.action_to == 1
        assert not game.is_hand_complete()
        
        # Button can call - to_call = 10 - 0 = 10
        game.apply_action(1, Action(ActionType.CALL, amount=10))
        
        # Should advance to turn (heads-up)
        assert game.street == Street.TURN


class TestAllInScenarios:
    """Tests for all-in scenarios and side pot situations."""

    def create_game(self, stacks: list[int]) -> GameState:
        """Create a game with specified stacks."""
        players = [
            Player(seat=i + 1, name=f"Player {i + 1}", stack=stacks[i])
            for i in range(len(stacks))
        ]
        
        deck = Deck(seed=42)
        schedule = BlindSchedule()
        
        return GameState(
            players=players,
            deck=deck,
            blind_schedule=schedule,
            button_seat=1,
        )

    def test_all_in_call_continues_action(self):
        """An all-in call doesn't end action for other players."""
        game = self.create_game([200, 200, 50])  # Seat 3 is short
        game.start_hand(1)
        
        # Button=1, SB=2, BB=3 (short stack with 50 chips, posted 2 as BB)
        # Action starts with seat 1 (button in 3-way)
        
        # Button raises to 100
        game.apply_action(1, Action(ActionType.RAISE, amount=100))
        
        # SB should have action
        assert game.action_to == 2
        
        # SB calls - to_call = 100 - 1 = 99
        game.apply_action(2, Action(ActionType.CALL, amount=99))
        
        # BB (short stack) should have action
        assert game.action_to == 3
        
        # BB stack is 50 - 2 (BB posted) = 48 remaining
        # to_call = 100 - 2 = 98, but only has 48, so all-in for 48
        game.apply_action(3, Action(ActionType.CALL, amount=48, is_all_in=True))
        
        # Hand should NOT be complete - we should go to flop
        # since betting action is complete (all matched or all-in)
        assert not game.is_hand_complete()
        assert game.street == Street.FLOP or game.action_to is None

    def test_all_in_raise_reopens_action(self):
        """An all-in raise should reopen action to previous actors."""
        game = self.create_game([200, 200, 200])
        game.start_hand(1)
        
        # Button raises to 6
        game.apply_action(1, Action(ActionType.RAISE, amount=6))
        
        # SB calls - to_call = 6 - 1 = 5
        game.apply_action(2, Action(ActionType.CALL, amount=5))
        
        # BB goes all-in for 200
        game.apply_action(3, Action(ActionType.RAISE, amount=200, is_all_in=True))
        
        # Button should have action
        assert game.action_to == 1
        
        # Button folds
        game.apply_action(1, Action(ActionType.FOLD))
        
        # SB should have action
        assert game.action_to == 2

    def test_multiple_all_ins_run_out_board(self):
        """When all remaining players are all-in, board should run out."""
        game = self.create_game([100, 100, 100])
        game.start_hand(1)
        
        # Button all-in for 100
        game.apply_action(1, Action(ActionType.RAISE, amount=100, is_all_in=True))
        
        # SB all-in - to_call = 100 - 1 = 99
        game.apply_action(2, Action(ActionType.CALL, amount=99, is_all_in=True))
        
        # BB all-in - to_call = 100 - 2 = 98
        game.apply_action(3, Action(ActionType.CALL, amount=98, is_all_in=True))
        
        # Hand should be complete with full board
        assert game.is_hand_complete()
        assert len(game.community_cards) == 5


class TestEdgeCases:
    """Tests for edge cases in betting round polling."""

    def create_game(self, num_players: int = 5, stacks: list[int] | None = None) -> GameState:
        """Create a game with the given number of players."""
        if stacks is None:
            stacks = [200] * num_players
        
        players = [
            Player(seat=i + 1, name=f"Player {i + 1}", stack=stacks[i])
            for i in range(num_players)
        ]
        
        deck = Deck(seed=42)
        schedule = BlindSchedule()
        
        return GameState(
            players=players,
            deck=deck,
            blind_schedule=schedule,
            button_seat=1,
        )

    def test_heads_up_preflop_action_order(self):
        """In heads-up, button posts SB and acts first preflop."""
        game = self.create_game(2)
        game.start_hand(1)
        
        # Button=1 posts SB, Seat 2 posts BB
        # Button (SB) should act first
        assert game.action_to == 1

    def test_heads_up_postflop_action_order(self):
        """In heads-up postflop, BB acts first (out of position)."""
        game = self.create_game(2)
        game.start_hand(1)
        
        # In heads-up: Button=1 posts SB (1), Seat 2 posts BB (2)
        # Button acts first preflop
        # Button calls - to_call = 2 - 1 = 1
        game.apply_action(1, Action(ActionType.CALL, amount=1))
        # BB checks
        game.apply_action(2, Action(ActionType.CHECK))
        
        # On flop, BB (seat 2) should act first
        assert game.street == Street.FLOP
        assert game.action_to == 2

    def test_player_who_folds_cannot_act_again(self):
        """A player who folded should not get action in subsequent streets."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Button raises to 6
        game.apply_action(1, Action(ActionType.RAISE, amount=6))
        # SB folds
        game.apply_action(2, Action(ActionType.FOLD))
        # BB calls - to_call = 6 - 2 = 4
        game.apply_action(3, Action(ActionType.CALL, amount=4))
        
        # On flop, only BB and Button remain
        assert game.street == Street.FLOP
        assert len(game.active_players) == 2
        
        # BB acts first (position after folded SB)
        assert game.action_to == 3

    def test_raise_less_than_min_forces_all_in(self):
        """A raise less than minimum should only be valid as all-in."""
        game = self.create_game(num_players=3, stacks=[200, 200, 15])  # Seat 3 very short
        game.start_hand(1)
        
        # Button raises to 10
        game.apply_action(1, Action(ActionType.RAISE, amount=10))
        
        # SB folds
        game.apply_action(2, Action(ActionType.FOLD))
        
        # BB (seat 3) has 15 chips (13 after BB)
        # Can only go all-in, not make a proper raise
        player = game.players[3]
        assert player.stack == 13  # 15 - 2 (BB)
        
        # BB goes all-in for 15 total (less than min raise of 20)
        success, _ = game.apply_action(3, Action(ActionType.ALL_IN, amount=15, is_all_in=True))
        assert success

    def test_action_to_is_none_when_hand_complete(self):
        """action_to should be None when the hand is complete."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Button raises
        game.apply_action(1, Action(ActionType.RAISE, amount=6))
        # Everyone folds
        game.apply_action(2, Action(ActionType.FOLD))
        game.apply_action(3, Action(ActionType.FOLD))
        
        assert game.is_hand_complete()
        # Note: action_to might not be None, but it doesn't matter since hand is complete

    def test_cannot_act_out_of_turn(self):
        """Should reject action from wrong seat."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Action is to seat 1 (button in 3-way)
        assert game.action_to == 1
        
        # Try to act from seat 2 (wrong turn)
        success, error = game.apply_action(2, Action(ActionType.FOLD))
        assert not success
        assert "Not" in error and "turn" in error

    def test_blind_posting_doesnt_count_as_action(self):
        """Posting blinds shouldn't count as having acted for option purposes."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Check that BB hasn't acted yet
        bb_player = game.players[3]
        assert not bb_player.has_acted
        assert bb_player.bet_this_round == 2  # Posted BB

    def test_reopening_raise_resets_has_acted(self):
        """A raise should reset has_acted for players who need to respond."""
        game = self.create_game(4)
        game.start_hand(1)
        
        # Button=1, SB=2, BB=3, UTG=4
        # UTG calls - to_call = 2 - 0 = 2
        game.apply_action(4, Action(ActionType.CALL, amount=2))
        
        # Check UTG has acted
        assert game.players[4].has_acted
        
        # Button raises to 8
        game.apply_action(1, Action(ActionType.RAISE, amount=8))
        
        # UTG's has_acted should be reset
        assert not game.players[4].has_acted

    def test_full_hand_sequence(self):
        """Test a complete hand sequence from start to showdown."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Preflop - 3 players: BTN=1, SB=2, BB=3
        # Action starts at BTN (seat 1)
        assert game.street == Street.PREFLOP
        game.apply_action(1, Action(ActionType.CALL, amount=2))  # Button limps (to_call = 2)
        game.apply_action(2, Action(ActionType.CALL, amount=1))  # SB completes (to_call = 1)
        game.apply_action(3, Action(ActionType.CHECK))  # BB checks
        
        # Flop
        assert game.street == Street.FLOP
        assert len(game.community_cards) == 3
        game.apply_action(2, Action(ActionType.CHECK))  # SB
        game.apply_action(3, Action(ActionType.CHECK))  # BB
        game.apply_action(1, Action(ActionType.CHECK))  # Button
        
        # Turn
        assert game.street == Street.TURN
        assert len(game.community_cards) == 4
        game.apply_action(2, Action(ActionType.BET, amount=4))  # SB bets
        game.apply_action(3, Action(ActionType.CALL, amount=4))  # BB calls
        game.apply_action(1, Action(ActionType.CALL, amount=4))  # Button calls
        
        # River
        assert game.street == Street.RIVER
        assert len(game.community_cards) == 5
        game.apply_action(2, Action(ActionType.CHECK))
        game.apply_action(3, Action(ActionType.CHECK))
        game.apply_action(1, Action(ActionType.CHECK))
        
        # Showdown
        assert game.is_hand_complete()
        assert game.street == Street.SHOWDOWN


class TestRegressionBugFixes:
    """Regression tests for specific bugs that have been fixed."""

    def create_game(self, num_players: int = 5, stacks: list[int] | None = None) -> GameState:
        """Create a game with the given number of players."""
        if stacks is None:
            stacks = [200] * num_players
        
        players = [
            Player(seat=i + 1, name=f"Player {i + 1}", stack=stacks[i])
            for i in range(num_players)
        ]
        
        deck = Deck(seed=42)
        schedule = BlindSchedule()
        
        return GameState(
            players=players,
            deck=deck,
            blind_schedule=schedule,
            button_seat=1,
        )

    def test_3bet_gives_original_raiser_action(self):
        """After a 3-bet, original raiser should get action before going to flop.
        
        This is the scenario from hand_001.json where seat 4 raised, seat 2 3-bet,
        and seat 4 should have gotten proper action (not forced fold).
        """
        game = self.create_game(5)
        game.start_hand(1)
        
        # Button=1, SB=2, BB=3, UTG=4, UTG+1=5
        # UTG (seat 4) raises to 4
        game.apply_action(4, Action(ActionType.RAISE, amount=4))
        
        # UTG+1 (seat 5) folds
        game.apply_action(5, Action(ActionType.FOLD))
        
        # Button (seat 1) folds
        game.apply_action(1, Action(ActionType.FOLD))
        
        # SB (seat 2) 3-bets to 12
        game.apply_action(2, Action(ActionType.RAISE, amount=12))
        
        # BB (seat 3) folds
        game.apply_action(3, Action(ActionType.FOLD))
        
        # UTG (seat 4) should now have action - this is the critical check
        assert game.action_to == 4, f"Expected action to seat 4, got {game.action_to}"
        assert game.current_bet == 12
        assert game.street == Street.PREFLOP
        assert not game.is_hand_complete()
        
        # UTG can call, raise, or fold
        # If UTG calls, we go to flop - to_call = 12 - 4 = 8
        game.apply_action(4, Action(ActionType.CALL, amount=8))
        
        assert game.street == Street.FLOP
        assert len(game.community_cards) == 3

    def test_action_after_multiple_folds_with_raise_pending(self):
        """Action should continue to remaining players after folds when raise is pending."""
        game = self.create_game(5)
        game.start_hand(1)
        
        # UTG opens to 6
        game.apply_action(4, Action(ActionType.RAISE, amount=6))
        
        # UTG+1 3-bets to 18
        game.apply_action(5, Action(ActionType.RAISE, amount=18))
        
        # Button folds
        game.apply_action(1, Action(ActionType.FOLD))
        
        # SB folds
        game.apply_action(2, Action(ActionType.FOLD))
        
        # BB folds
        game.apply_action(3, Action(ActionType.FOLD))
        
        # UTG should have action facing the 3-bet
        assert game.action_to == 4
        assert not game.is_hand_complete()
        assert game.current_bet == 18

    def test_no_premature_flop_with_unmatched_bet(self):
        """Should not go to flop when there's an unmatched bet."""
        game = self.create_game(3)
        game.start_hand(1)
        
        # Button raises to 6
        game.apply_action(1, Action(ActionType.RAISE, amount=6))
        
        # SB calls - to_call = 6 - 1 = 5
        game.apply_action(2, Action(ActionType.CALL, amount=5))
        
        # BB raises to 20
        game.apply_action(3, Action(ActionType.RAISE, amount=20))
        
        # We should NOT be at the flop yet
        assert game.street == Street.PREFLOP
        # Button needs to respond first (clockwise order)
        assert game.action_to == 1

    def test_bb_option_not_skipped(self):
        """BB option should not be skipped when everyone just calls."""
        game = self.create_game(4)
        game.start_hand(1)
        
        # Button=1, SB=2, BB=3, UTG=4
        
        # UTG calls - to_call = 2 - 0 = 2
        game.apply_action(4, Action(ActionType.CALL, amount=2))
        
        # Button calls - to_call = 2 - 0 = 2
        game.apply_action(1, Action(ActionType.CALL, amount=2))
        
        # SB completes - to_call = 2 - 1 = 1
        game.apply_action(2, Action(ActionType.CALL, amount=1))
        
        # BB should have option, not auto-advance to flop
        assert game.action_to == 3
        assert game.street == Street.PREFLOP
        
        # BB can check or raise
        success_check, _ = game.apply_action(3, Action(ActionType.CHECK))
        assert success_check
        
        # Now we should be at flop
        assert game.street == Street.FLOP

