"""Core poker game state engine."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

from .actions import Action, ActionType, BettingState, PlayerState, validate_action
from .blinds import BlindSchedule
from .deck import Card, Deck
from .evaluator import determine_winners, rank_to_string


class Street(Enum):
    """Betting streets in a poker hand."""

    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"


@dataclass
class Player:
    """A player in the game."""

    seat: int
    name: str
    stack: int
    hole_cards: list[Card] = field(default_factory=list)
    bet_this_round: int = 0
    bet_this_hand: int = 0
    has_acted: bool = False
    is_all_in: bool = False
    has_folded: bool = False

    def to_state(self) -> PlayerState:
        """Convert to PlayerState for action validation."""
        return PlayerState(
            seat=self.seat,
            stack=self.stack,
            bet_this_round=self.bet_this_round,
            has_acted=self.has_acted,
            is_all_in=self.is_all_in,
            has_folded=self.has_folded,
        )

    def reset_for_hand(self) -> None:
        """Reset player state for a new hand."""
        self.hole_cards = []
        self.bet_this_round = 0
        self.bet_this_hand = 0
        self.has_acted = False
        self.is_all_in = False
        self.has_folded = False

    def reset_for_street(self) -> None:
        """Reset player state for a new betting round."""
        self.bet_this_round = 0
        self.has_acted = False


@dataclass
class HandAction:
    """Record of a single action in a hand."""

    street: Street
    seat: int
    action: Action
    pot_after: int


@dataclass
class HandResult:
    """Result of a completed hand."""

    hand_number: int
    winners: list[int]  # Seat numbers
    winning_hand: str  # Hand description
    pot: int
    pots_awarded: dict[int, int]  # seat -> amount won
    showdown_cards: dict[int, list[Card]]  # Cards revealed at showdown


class GameState:
    """Manages the state of a poker game/hand."""

    def __init__(
        self,
        players: list[Player],
        deck: Deck,
        blind_schedule: BlindSchedule,
        button_seat: int,
    ) -> None:
        """Initialize game state.

        Args:
            players: List of Player objects (must have unique seats).
            deck: The deck to use for dealing.
            blind_schedule: Blind schedule for the tournament.
            button_seat: Seat number of the dealer button.
        """
        self.players = {p.seat: p for p in players}
        self.deck = deck
        self.blind_schedule = blind_schedule
        self.button_seat = button_seat

        self.hand_number = 0
        self.street = Street.PREFLOP
        self.community_cards: list[Card] = []
        self.pot = 0
        self.side_pots: list[tuple[int, set[int]]] = []  # (amount, eligible_seats)
        self.current_bet = 0
        self.min_raise = 0
        self.last_raiser: int | None = None
        self.actions: list[HandAction] = []
        self.action_to: int | None = None
        self.hand_complete = False

    @property
    def active_players(self) -> list[Player]:
        """Players still in the hand (not folded, have chips or all-in)."""
        return [p for p in self.players.values() if not p.has_folded]

    @property
    def players_to_act(self) -> list[Player]:
        """Players who can still take actions (not folded, not all-in)."""
        return [p for p in self.active_players if not p.is_all_in]

    @property
    def seats_in_order(self) -> list[int]:
        """All seats in clockwise order from button."""
        seats = sorted(self.players.keys())
        btn_idx = seats.index(self.button_seat)
        return seats[btn_idx + 1 :] + seats[: btn_idx + 1]

    def get_betting_state(self) -> BettingState:
        """Get current betting state for action validation."""
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)
        return BettingState(
            pot=self.pot,
            current_bet=self.current_bet,
            min_raise=self.min_raise,
            big_blind=bb,
            last_raiser_seat=self.last_raiser,
            num_active_players=len(self.active_players),
        )

    def start_hand(self, hand_number: int) -> None:
        """Start a new hand.

        Args:
            hand_number: The hand number (1-indexed).
        """
        self.hand_number = hand_number
        self.street = Street.PREFLOP
        self.community_cards = []
        self.pot = 0
        self.side_pots = []
        self.current_bet = 0
        self.min_raise = 0
        self.last_raiser = None
        self.actions = []
        self.hand_complete = False

        # Reset players
        for player in self.players.values():
            if player.stack > 0:
                player.reset_for_hand()
            else:
                player.has_folded = True

        # Shuffle and deal
        self.deck.shuffle()
        for player in self.active_players:
            player.hole_cards = self.deck.deal(2)

        # Post blinds
        self._post_blinds()

        # Set action to first player after BB
        self._set_preflop_action()

    def _post_blinds(self) -> None:
        """Post small and big blinds."""
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)
        self.min_raise = bb

        active_seats = [p.seat for p in self.active_players]
        seats_in_order = [s for s in self.seats_in_order if s in active_seats]

        if len(seats_in_order) < 2:
            return

        # Heads-up: button posts SB, other posts BB
        if len(seats_in_order) == 2:
            sb_seat = self.button_seat if self.button_seat in active_seats else seats_in_order[0]
            bb_seat = [s for s in seats_in_order if s != sb_seat][0]
        else:
            # Normal: first after button is SB, second is BB
            btn_idx = seats_in_order.index(self.button_seat) if self.button_seat in active_seats else -1
            sb_seat = seats_in_order[(btn_idx + 1) % len(seats_in_order)]
            bb_seat = seats_in_order[(btn_idx + 2) % len(seats_in_order)]

        self._post_blind(sb_seat, sb, ActionType.POST_SB)
        self._post_blind(bb_seat, bb, ActionType.POST_BB)

    def _post_blind(self, seat: int, amount: int, action_type: ActionType) -> None:
        """Post a blind from a player."""
        player = self.players[seat]
        actual = min(amount, player.stack)

        player.stack -= actual
        player.bet_this_round = actual
        player.bet_this_hand = actual
        self.pot += actual

        if actual >= amount:
            self.current_bet = max(self.current_bet, actual)
        if player.stack == 0:
            player.is_all_in = True

        self.actions.append(
            HandAction(
                street=self.street,
                seat=seat,
                action=Action(action_type, amount=actual, is_all_in=player.is_all_in),
                pot_after=self.pot,
            )
        )

    def _set_preflop_action(self) -> None:
        """Set action to first player after big blind."""
        active_seats = [p.seat for p in self.players_to_act]
        if not active_seats:
            self._end_betting_round()
            return

        seats_in_order = [s for s in self.seats_in_order if s in active_seats]

        # Find BB position
        bb_actions = [a for a in self.actions if a.action.action_type == ActionType.POST_BB]
        if bb_actions:
            bb_seat = bb_actions[0].seat
            if bb_seat in seats_in_order:
                bb_idx = seats_in_order.index(bb_seat)
                self.action_to = seats_in_order[(bb_idx + 1) % len(seats_in_order)]
                return

        self.action_to = seats_in_order[0] if seats_in_order else None

    def _set_postflop_action(self) -> None:
        """Set action to first player after button for postflop streets."""
        active_seats = [p.seat for p in self.players_to_act]
        if not active_seats:
            self._end_betting_round()
            return

        seats_in_order = [s for s in self.seats_in_order if s in active_seats]
        self.action_to = seats_in_order[0] if seats_in_order else None

    def apply_action(self, seat: int, action: Action) -> tuple[bool, str]:
        """Apply an action from a player.

        Args:
            seat: The seat taking action.
            action: The action to apply.

        Returns:
            Tuple of (success, error_message).
        """
        if self.action_to != seat:
            return False, f"Not {seat}'s turn to act (action is to seat {self.action_to})"

        player = self.players[seat]
        betting = self.get_betting_state()

        is_valid, error = validate_action(action, player.to_state(), betting)
        if not is_valid:
            return False, error

        # Apply the action
        if action.action_type == ActionType.FOLD:
            player.has_folded = True
        elif action.action_type == ActionType.CHECK:
            pass  # No chips move
        elif action.action_type == ActionType.CALL:
            self._apply_bet(player, action.amount, action.is_all_in)
        elif action.action_type in (ActionType.BET, ActionType.RAISE, ActionType.ALL_IN):
            raise_amount = action.amount - player.bet_this_round
            self._apply_bet(player, raise_amount, action.is_all_in)
            self.current_bet = action.amount
            self.min_raise = action.amount - betting.current_bet
            if self.min_raise < betting.big_blind:
                self.min_raise = betting.big_blind
            self.last_raiser = seat
            # Reset has_acted for other players
            for p in self.players_to_act:
                if p.seat != seat:
                    p.has_acted = False

        player.has_acted = True

        self.actions.append(
            HandAction(
                street=self.street,
                seat=seat,
                action=action,
                pot_after=self.pot,
            )
        )

        # Advance action
        self._advance_action()
        return True, ""

    def _apply_bet(self, player: Player, amount: int, is_all_in: bool) -> None:
        """Apply a bet/call from a player."""
        player.stack -= amount
        player.bet_this_round += amount
        player.bet_this_hand += amount
        self.pot += amount
        if is_all_in:
            player.is_all_in = True

    def _advance_action(self) -> None:
        """Advance to the next player to act or end the round."""
        # Check if hand is over (all but one folded)
        if len(self.active_players) == 1:
            self._end_hand_no_showdown()
            return

        # Check if betting round is complete
        players_to_act = self.players_to_act
        if not players_to_act:
            self._end_betting_round()
            return

        # Check if everyone has acted and bets are matched
        all_acted = all(p.has_acted for p in players_to_act)
        bets_matched = all(
            p.bet_this_round == self.current_bet or p.is_all_in
            for p in self.active_players
        )

        if all_acted and bets_matched:
            self._end_betting_round()
            return

        # Find next player to act
        active_seats = [p.seat for p in players_to_act if not p.has_acted or p.bet_this_round < self.current_bet]
        if not active_seats:
            self._end_betting_round()
            return

        current_idx = self.seats_in_order.index(self.action_to)
        for i in range(1, len(self.seats_in_order) + 1):
            next_seat = self.seats_in_order[(current_idx + i) % len(self.seats_in_order)]
            if next_seat in active_seats:
                self.action_to = next_seat
                return

        self._end_betting_round()

    def _end_betting_round(self) -> None:
        """End the current betting round and advance street."""
        # Calculate side pots if needed
        self._calculate_side_pots()

        # Reset for next street
        for player in self.players.values():
            player.reset_for_street()
        self.current_bet = 0
        self.last_raiser = None

        # Advance street
        if self.street == Street.PREFLOP:
            self.street = Street.FLOP
            self.community_cards.extend(self.deck.deal(3))
            self._set_postflop_action()
        elif self.street == Street.FLOP:
            self.street = Street.TURN
            self.community_cards.extend(self.deck.deal(1))
            self._set_postflop_action()
        elif self.street == Street.TURN:
            self.street = Street.RIVER
            self.community_cards.extend(self.deck.deal(1))
            self._set_postflop_action()
        elif self.street == Street.RIVER:
            self._showdown()

        # Check if everyone is all-in (run out the board)
        if len(self.players_to_act) <= 1 and len(self.active_players) > 1:
            if self.street != Street.SHOWDOWN:
                self._run_out_board()

    def _run_out_board(self) -> None:
        """Deal remaining community cards when all players are all-in."""
        while len(self.community_cards) < 5:
            if len(self.community_cards) == 0:
                self.community_cards.extend(self.deck.deal(3))
                self.street = Street.FLOP
            elif len(self.community_cards) == 3:
                self.community_cards.extend(self.deck.deal(1))
                self.street = Street.TURN
            elif len(self.community_cards) == 4:
                self.community_cards.extend(self.deck.deal(1))
                self.street = Street.RIVER

        self._showdown()

    def _calculate_side_pots(self) -> None:
        """Calculate side pots based on all-in players."""
        if not any(p.is_all_in for p in self.active_players):
            return

        # Get all distinct bet levels
        bet_levels = sorted(set(p.bet_this_hand for p in self.active_players if p.bet_this_hand > 0))

        self.side_pots = []
        prev_level = 0

        for level in bet_levels:
            pot_amount = 0
            eligible = set()
            for p in self.active_players:
                contribution = min(p.bet_this_hand, level) - prev_level
                if contribution > 0:
                    pot_amount += contribution
                    if p.bet_this_hand >= level:
                        eligible.add(p.seat)

            if pot_amount > 0:
                self.side_pots.append((pot_amount, eligible))
            prev_level = level

    def _end_hand_no_showdown(self) -> None:
        """End the hand when all but one player folds."""
        winner = self.active_players[0]
        winner.stack += self.pot

        self.hand_complete = True
        self.street = Street.SHOWDOWN

    def _showdown(self) -> None:
        """Determine winner(s) at showdown and award pot(s)."""
        self.street = Street.SHOWDOWN
        self.hand_complete = True

        if len(self.active_players) == 1:
            # Everyone else folded
            winner = self.active_players[0]
            winner.stack += self.pot
            return

        # Evaluate hands
        player_cards = {p.seat: p.hole_cards for p in self.active_players}
        winners, rank = determine_winners(player_cards, self.community_cards)

        # Award pot (simple case - no side pots)
        if not self.side_pots:
            share = self.pot // len(winners)
            remainder = self.pot % len(winners)
            for i, seat in enumerate(winners):
                self.players[seat].stack += share + (1 if i < remainder else 0)
        else:
            # Award each side pot
            for pot_amount, eligible in self.side_pots:
                eligible_winners = [w for w in winners if w in eligible]
                if not eligible_winners:
                    # Find best hand among eligible players
                    eligible_cards = {s: player_cards[s] for s in eligible}
                    eligible_winners, _ = determine_winners(
                        eligible_cards, self.community_cards
                    )

                share = pot_amount // len(eligible_winners)
                remainder = pot_amount % len(eligible_winners)
                for i, seat in enumerate(eligible_winners):
                    self.players[seat].stack += share + (1 if i < remainder else 0)

    def get_hand_result(self) -> HandResult | None:
        """Get the result of the completed hand."""
        if not self.hand_complete:
            return None

        # Determine what to show
        showdown_cards = {}
        pots_awarded = {}

        if len(self.active_players) == 1:
            # No showdown needed
            winner = self.active_players[0]
            return HandResult(
                hand_number=self.hand_number,
                winners=[winner.seat],
                winning_hand="",
                pot=self.pot,
                pots_awarded={winner.seat: self.pot},
                showdown_cards={},
            )

        # Showdown occurred
        player_cards = {p.seat: p.hole_cards for p in self.active_players}
        winners, rank = determine_winners(player_cards, self.community_cards)

        # All active players show at showdown
        showdown_cards = player_cards

        # Calculate winnings (approximate - actual was already distributed)
        total = self.pot
        share = total // len(winners)
        for seat in winners:
            pots_awarded[seat] = share

        return HandResult(
            hand_number=self.hand_number,
            winners=winners,
            winning_hand=rank_to_string(rank),
            pot=total,
            pots_awarded=pots_awarded,
            showdown_cards=showdown_cards,
        )

    def rotate_button(self) -> None:
        """Rotate the dealer button to the next active player."""
        active_seats = sorted(
            s for s, p in self.players.items() if p.stack > 0
        )
        if not active_seats:
            return

        if self.button_seat in active_seats:
            idx = active_seats.index(self.button_seat)
            self.button_seat = active_seats[(idx + 1) % len(active_seats)]
        else:
            # Button was on eliminated player, find next clockwise
            for seat in sorted(self.players.keys()):
                if seat > self.button_seat and seat in active_seats:
                    self.button_seat = seat
                    return
            self.button_seat = active_seats[0]

    def is_hand_complete(self) -> bool:
        """Check if the current hand is complete."""
        return self.hand_complete

    def get_player_observation(self, seat: int) -> dict:
        """Get the game state as observable by a specific player.

        Args:
            seat: The seat number of the observing player.

        Returns:
            Dict containing observable game state.
        """
        player = self.players[seat]
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)

        return {
            "hand_number": self.hand_number,
            "street": self.street.value,
            "my_seat": seat,
            "my_hole_cards": [str(c) for c in player.hole_cards],
            "my_stack": player.stack,
            "my_bet_this_round": player.bet_this_round,
            "community_cards": [str(c) for c in self.community_cards],
            "pot": self.pot,
            "current_bet": self.current_bet,
            "min_raise": self.min_raise,
            "small_blind": sb,
            "big_blind": bb,
            "button_seat": self.button_seat,
            "players": [
                {
                    "seat": p.seat,
                    "name": p.name,
                    "stack": p.stack,
                    "bet_this_round": p.bet_this_round,
                    "is_all_in": p.is_all_in,
                    "has_folded": p.has_folded,
                }
                for p in self.players.values()
            ],
            "actions_this_hand": [
                {
                    "street": a.street.value,
                    "seat": a.seat,
                    "action": str(a.action),
                    "pot_after": a.pot_after,
                }
                for a in self.actions
            ],
            "action_to": self.action_to,
        }
