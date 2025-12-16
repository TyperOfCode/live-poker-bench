"""Poker action definitions and validation."""

from dataclasses import dataclass
from enum import Enum


class ActionType(Enum):
    """Types of poker actions."""

    FOLD = "fold"
    CALL = "call"
    RAISE = "raise"
    CHECK = "check"
    BET = "bet"
    ALL_IN = "all_in"

    # Forced actions
    POST_SB = "post_sb"
    POST_BB = "post_bb"


@dataclass
class Action:
    """A poker action taken by a player."""

    action_type: ActionType
    amount: int = 0
    is_all_in: bool = False

    def __str__(self) -> str:
        if self.action_type == ActionType.FOLD:
            return "fold"
        elif self.action_type in (ActionType.CHECK, ActionType.POST_SB, ActionType.POST_BB):
            return self.action_type.value
        elif self.action_type == ActionType.CALL:
            return f"call {self.amount}" + (" (all-in)" if self.is_all_in else "")
        elif self.action_type in (ActionType.RAISE, ActionType.BET, ActionType.ALL_IN):
            return f"raise to {self.amount}" + (" (all-in)" if self.is_all_in else "")
        return f"{self.action_type.value} {self.amount}"


@dataclass
class PlayerState:
    """Current state of a player for action validation."""

    seat: int
    stack: int
    bet_this_round: int = 0
    has_acted: bool = False
    is_all_in: bool = False
    has_folded: bool = False


@dataclass
class BettingState:
    """Current betting state for action validation."""

    pot: int
    current_bet: int
    min_raise: int
    big_blind: int
    last_raiser_seat: int | None = None
    num_active_players: int = 0


def get_legal_actions(player: PlayerState, betting: BettingState) -> list[Action]:
    """Get all legal actions for a player given the current state.

    Args:
        player: The player's current state.
        betting: The current betting state.

    Returns:
        List of legal Action objects.
    """
    if player.has_folded or player.is_all_in:
        return []

    actions: list[Action] = []
    to_call = betting.current_bet - player.bet_this_round

    # Fold is always legal if there's a bet to call
    if to_call > 0:
        actions.append(Action(ActionType.FOLD))

    # Check/Call
    if to_call == 0:
        actions.append(Action(ActionType.CHECK))
    elif to_call >= player.stack:
        # All-in call
        actions.append(Action(ActionType.CALL, amount=player.stack, is_all_in=True))
    else:
        actions.append(Action(ActionType.CALL, amount=to_call))

    # Raise/Bet
    if player.stack > to_call:
        chips_after_call = player.stack - to_call

        if betting.current_bet == 0:
            # Opening bet - min is BB
            min_bet = betting.big_blind
            if chips_after_call >= min_bet:
                actions.append(
                    Action(ActionType.BET, amount=min_bet)
                )
                # All-in bet if different from min
                if player.stack > min_bet:
                    actions.append(
                        Action(ActionType.ALL_IN, amount=player.stack, is_all_in=True)
                    )
        else:
            # Raise - min raise is current_bet + min_raise
            min_raise_to = betting.current_bet + betting.min_raise
            total_needed = min_raise_to - player.bet_this_round

            if player.stack >= total_needed:
                actions.append(
                    Action(ActionType.RAISE, amount=min_raise_to)
                )
                # All-in raise if different
                max_raise_to = player.stack + player.bet_this_round
                if max_raise_to > min_raise_to:
                    actions.append(
                        Action(ActionType.ALL_IN, amount=max_raise_to, is_all_in=True)
                    )
            elif player.stack > to_call:
                # Can only all-in for less than min raise
                all_in_amount = player.stack + player.bet_this_round
                actions.append(
                    Action(ActionType.ALL_IN, amount=all_in_amount, is_all_in=True)
                )

    return actions


def validate_action(
    action: Action, player: PlayerState, betting: BettingState
) -> tuple[bool, str]:
    """Validate a proposed action.

    Args:
        action: The proposed action.
        player: The player's current state.
        betting: The current betting state.

    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if player.has_folded:
        return False, "Player has already folded"
    if player.is_all_in:
        return False, "Player is already all-in"

    to_call = betting.current_bet - player.bet_this_round

    if action.action_type == ActionType.FOLD:
        if to_call == 0:
            return False, "Cannot fold when there's nothing to call (check instead)"
        return True, ""

    if action.action_type == ActionType.CHECK:
        if to_call > 0:
            return False, f"Cannot check when facing a bet of {to_call}"
        return True, ""

    if action.action_type == ActionType.CALL:
        if to_call == 0:
            return False, "Nothing to call (check instead)"
        expected = min(to_call, player.stack)
        if action.amount != expected:
            return False, f"Call amount must be {expected}, got {action.amount}"
        return True, ""

    if action.action_type in (ActionType.BET, ActionType.RAISE, ActionType.ALL_IN):
        if action.amount > player.stack + player.bet_this_round:
            return False, f"Cannot bet more than stack allows ({player.stack + player.bet_this_round})"

        if action.is_all_in and action.amount == player.stack + player.bet_this_round:
            # All-in is always valid if amount matches stack
            return True, ""

        if betting.current_bet == 0:
            # Opening bet
            if action.amount < betting.big_blind:
                return False, f"Minimum bet is {betting.big_blind}"
        else:
            # Raise
            min_raise_to = betting.current_bet + betting.min_raise
            if action.amount < min_raise_to and not action.is_all_in:
                return False, f"Minimum raise is to {min_raise_to}"

        return True, ""

    return False, f"Unknown action type: {action.action_type}"


def normalize_action(
    action_type: str, amount: int | None, player: PlayerState, betting: BettingState
) -> Action:
    """Normalize an agent's action request to a valid Action.

    Args:
        action_type: String action type ("fold", "call", "raise").
        amount: Amount for raises (ignored for fold/call).
        player: The player's current state.
        betting: The current betting state.

    Returns:
        A normalized Action object.

    Raises:
        ValueError: If the action cannot be normalized.
    """
    action_type = action_type.lower().strip()
    to_call = betting.current_bet - player.bet_this_round

    if action_type == "fold":
        if to_call == 0:
            # Convert fold to check when nothing to call
            return Action(ActionType.CHECK)
        return Action(ActionType.FOLD)

    if action_type == "call":
        if to_call == 0:
            return Action(ActionType.CHECK)
        if to_call >= player.stack:
            return Action(ActionType.CALL, amount=player.stack, is_all_in=True)
        return Action(ActionType.CALL, amount=to_call)

    if action_type == "check":
        if to_call > 0:
            raise ValueError(f"Cannot check when facing bet of {to_call}")
        return Action(ActionType.CHECK)

    if action_type == "raise":
        if amount is None:
            raise ValueError("Raise requires an amount")

        # Clamp amount to player's stack
        max_amount = player.stack + player.bet_this_round
        if amount > max_amount:
            amount = max_amount

        is_all_in = (amount == max_amount)

        if betting.current_bet == 0:
            # It's actually a bet, not a raise
            return Action(ActionType.BET, amount=amount, is_all_in=is_all_in)

        return Action(ActionType.RAISE, amount=amount, is_all_in=is_all_in)

    raise ValueError(f"Unknown action type: {action_type}")
