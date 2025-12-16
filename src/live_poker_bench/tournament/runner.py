"""Tournament runner for orchestrating complete poker tournaments."""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from live_poker_bench.agents.base import AgentAction, Observation
from live_poker_bench.agents.manager import AgentManager
from live_poker_bench.agents.memory import get_position_name
from live_poker_bench.engine.actions import Action, ActionType
from live_poker_bench.engine.blinds import BlindSchedule
from live_poker_bench.engine.deck import Deck
from live_poker_bench.engine.game import GameState, Player
from live_poker_bench.logging.agent_logger import AgentLogger
from live_poker_bench.logging.hand_logger import HandLogger
from live_poker_bench.logging.reporter import TournamentResult
from live_poker_bench.tournament.scorer import PlacementScorer

if TYPE_CHECKING:
    from live_poker_bench.logging.progress import ProgressDisplay


@dataclass
class TournamentConfig:
    """Configuration for a tournament."""

    num_players: int
    starting_stack: int
    blind_schedule: list[dict[str, Any]]
    seed: int
    log_dir: Path


class TournamentRunner:
    """Runs a single poker tournament."""

    def __init__(
        self,
        config: TournamentConfig,
        agent_manager: AgentManager,
        progress: "ProgressDisplay | None" = None,
    ) -> None:
        """Initialize the tournament runner.

        Args:
            config: Tournament configuration.
            agent_manager: Manager for all agents.
            progress: Optional progress display for live updates.
        """
        self.config = config
        self.agent_manager = agent_manager
        self.progress = progress

        # Initialize components
        self.deck = Deck(seed=config.seed)
        self.blind_schedule = BlindSchedule.from_config(config.blind_schedule)
        self.scorer = PlacementScorer(config.num_players)
        self.hand_logger = HandLogger(config.log_dir)
        self.agent_logger = AgentLogger(config.log_dir)

        # Build seat -> name mapping for progress display
        self.seat_names: dict[int, str] = {}

        # Register agents with scorer and logger
        for seat in agent_manager.get_active_seats():
            agent = agent_manager.get_agent(seat)
            if agent:
                self.scorer.register_player(seat, agent.name)
                self.agent_logger.register_agent(seat, agent.name)
                self.seat_names[seat] = agent.name

        # Game state will be created when tournament starts
        self.game: GameState | None = None
        self.hand_number = 0
        self.button_seat = 1  # Start with seat 1 as button

    def run(self) -> TournamentResult:
        """Run the complete tournament.

        Returns:
            Tournament result with placements and stats.
        """
        # Create initial game state
        players = [
            Player(
                seat=seat,
                name=self.agent_manager.get_agent(seat).name,
                stack=self.config.starting_stack,
            )
            for seat in self.agent_manager.get_active_seats()
        ]

        self.game = GameState(
            players=players,
            deck=self.deck,
            blind_schedule=self.blind_schedule,
            button_seat=self.button_seat,
        )

        # Run hands until tournament is over
        while not self.scorer.is_tournament_over():
            self.hand_number += 1
            self._play_hand()

            # Check for eliminations
            self._check_eliminations()

            # Rotate button
            self.game.rotate_button()

        # Save agent traces
        for seat in self.agent_manager.agents:
            traces = self.agent_manager.get_agent_traces(seat)
            self.agent_logger.add_traces_from_agent(seat, traces)
        self.agent_logger.save()

        # Build result
        placements = self.scorer.get_placements_by_name()
        agent_stats = {
            stats["agent_name"]: stats
            for stats in self.agent_logger.get_all_stats()
        }

        return TournamentResult(
            run_number=0,  # Will be set by multi-run manager
            seed=self.config.seed,
            total_hands=self.hand_number,
            placements=placements,
            agent_stats=agent_stats,
        )

    def _play_hand(self) -> None:
        """Play a single hand."""
        # Start the hand
        self.game.start_hand(self.hand_number)

        # Get hole cards for logging and memory
        hole_cards = {
            seat: tuple(str(c) for c in self.game.players[seat].hole_cards)
            for seat in self.agent_manager.get_active_seats()
            if seat in self.game.players and self.game.players[seat].hole_cards
        }

        # Log hand start
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)
        blind_level = self.blind_schedule.get_level(self.hand_number)

        # Update progress display
        if self.progress:
            active_count = len([
                s for s in self.game.players
                if not self.game.players[s].has_folded
            ])
            self.progress.update_hand(
                hand_number=self.hand_number,
                street="preflop",
                pot_size=self.game.pot,
                players_active=active_count,
                blind_level=blind_level,
                small_blind=sb,
                big_blind=bb,
            )

        self.hand_logger.start_hand(
            hand_number=self.hand_number,
            blind_level=blind_level,
            button_seat=self.game.button_seat,
            small_blind=sb,
            big_blind=bb,
            players=[
                {
                    "seat": p.seat,
                    "name": p.name,
                    "stack_start": p.stack + p.bet_this_hand,
                }
                for p in self.game.players.values()
                if not p.has_folded or p.bet_this_hand > 0
            ],
            hole_cards=hole_cards,
        )

        # Start hand for agent logger (per-hand decision logging)
        self.agent_logger.start_hand(self.hand_number)

        # Notify agents of new hand
        self.agent_manager.start_hand(self.hand_number, hole_cards, self.game.button_seat)

        # Play the hand
        while not self.game.is_hand_complete():
            self._play_action()

        # Get hand result
        result = self.game.get_hand_result()

        # Record showdown cards
        if result and result.showdown_cards:
            for seat, cards in result.showdown_cards.items():
                card_strs = tuple(str(c) for c in cards)
                self.hand_logger.record_showdown(seat, card_strs)
                self.agent_manager.record_showdown(seat, card_strs)

        # Update community cards in log
        self.hand_logger.record_community_cards(
            [str(c) for c in self.game.community_cards]
        )

        # End hand in logger
        self.hand_logger.end_hand(
            winners=result.winners if result else [],
            pot=result.pot if result else self.game.pot,
            pots_awarded=result.pots_awarded if result else {},
        )

        # End hand in agent logger (writes per-hand agent decision file)
        self.agent_logger.end_hand(self.hand_number)

        # End hand for agents
        results = {}
        for seat in self.agent_manager.get_active_seats():
            player = self.game.players.get(seat)
            if player:
                if result and seat in result.winners:
                    agent_result = "won"
                    chips_won = result.pots_awarded.get(seat, 0)
                elif player.has_folded:
                    agent_result = "folded"
                    chips_won = 0
                else:
                    agent_result = "lost"
                    chips_won = 0

                results[seat] = {
                    "result": agent_result,
                    "chips_won": chips_won,
                    "final_stack": player.stack,
                }

        self.agent_manager.end_hand(results, result.pot if result else self.game.pot)

    def _play_action(self) -> None:
        """Get and apply one action from the current player."""
        action_seat = self.game.action_to
        if action_seat is None:
            return

        player = self.game.players[action_seat]
        player_name = self.seat_names.get(action_seat, f"Seat {action_seat}")
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)

        # Capture street BEFORE applying action (apply_action may change it)
        current_street = self.game.street.value

        # Build observation for agent
        obs = self._build_observation(action_seat)

        # Update progress with current street, pot, community cards, and start thinking indicator
        if self.progress:
            self.progress.update_street(self.game.street.value)
            self.progress.update_pot(self.game.pot)
            # Update community cards for display
            self.progress.update_community_cards(
                [str(c) for c in self.game.community_cards]
            )
            # Get hole cards for display (convert Card objects to strings)
            hole_cards = None
            if player.hole_cards:
                hole_cards = (str(player.hole_cards[0]), str(player.hole_cards[1]))
            self.progress.start_thinking(
                player_name=player_name,
                seat=action_seat,
                hole_cards=hole_cards,
                stack=player.stack,
            )

        # Get action from agent
        agent_action = self.agent_manager.get_action(action_seat, obs)

        # Convert to game action
        game_action = self._convert_action(agent_action, player, obs)

        # Apply action
        success, error = self.game.apply_action(action_seat, game_action)

        forced = agent_action.forced
        retries = agent_action.retries

        if not success:
            # If action fails, try appropriate fallback
            to_call = self.game.current_bet - player.bet_this_round
            if to_call == 0:
                # Can't fold when nothing to call - use check instead
                game_action = Action(ActionType.CHECK)
            else:
                game_action = Action(ActionType.FOLD)

            fallback_success, fallback_error = self.game.apply_action(action_seat, game_action)
            if not fallback_success:
                # If fallback also fails, something is seriously wrong - log and skip
                logging.error(
                    f"Fallback action failed for seat {action_seat}: {fallback_error}. "
                    f"Original error: {error}"
                )
                return
            forced = True

        # Log action (only after successful application)
        action_str = str(game_action.action_type.value)

        # Update progress display with action - record in play-by-play
        if self.progress:
            # Get hole cards for display
            hole_cards = None
            if player.hole_cards:
                hole_cards = (str(player.hole_cards[0]), str(player.hole_cards[1]))
            self.progress.record_action(
                player_name=player_name,
                action=action_str,
                amount=game_action.amount,
                thinking_time_ms=agent_action.thinking_time_ms,
                forced=forced,
                retries=retries,
                hole_cards=hole_cards,
            )

        self.hand_logger.record_action(
            street=current_street,
            seat=action_seat,
            action=action_str,
            amount=game_action.amount,
            forced=forced,
            retries=retries,
            thinking_time_ms=agent_action.thinking_time_ms,
        )

        # Log agent decision with full trace (thoughts, tool calls, conversation)
        trace = self.agent_manager.get_last_trace(action_seat)
        if trace:
            self.agent_logger.log_decision(
                seat=action_seat,
                hand_number=self.hand_number,
                street=current_street,
                observation=trace.get("observation", {}),
                messages=trace.get("messages", []),
                tool_calls=trace.get("tool_calls", []),
                llm_responses=trace.get("llm_responses", []),
                final_action=trace.get("final_action", {}),
                thinking_time_ms=trace.get("thinking_time_ms", 0.0),
                retries=trace.get("retries", 0),
                error=trace.get("error"),
            )

        # Record to agent memories
        self.agent_manager.record_action(
            street=current_street,
            seat=action_seat,
            action=action_str,
            amount=game_action.amount,
        )

        # Update community cards if street changed
        self.agent_manager.update_community_cards(
            tuple(str(c) for c in self.game.community_cards)
        )

    def _build_observation(self, seat: int) -> Observation:
        """Build an observation for a player."""
        player = self.game.players[seat]
        sb, bb = self.blind_schedule.get_blinds(self.hand_number)
        active_seats = [s for s in self.game.players if not self.game.players[s].has_folded]

        # Determine legal actions
        legal_actions = ["fold"]
        to_call = self.game.current_bet - player.bet_this_round

        if to_call == 0:
            legal_actions.append("check")
        else:
            legal_actions.append("call")

        # Can raise if we have chips and there's room to raise
        min_raise_to = self.game.current_bet + self.game.min_raise
        if player.stack > to_call and min_raise_to <= player.stack + player.bet_this_round:
            legal_actions.append("raise")

        # Calculate min/max raise
        min_raise = min_raise_to
        max_raise = player.stack + player.bet_this_round  # All-in amount

        position = get_position_name(
            seat,
            self.game.button_seat,
            len(self.game.players),
            active_seats,
        )

        return Observation(
            hand_number=self.hand_number,
            street=self.game.street.value,
            my_seat=seat,
            my_position=position,
            my_hole_cards=tuple(str(c) for c in player.hole_cards),
            my_stack=player.stack,
            community_cards=tuple(str(c) for c in self.game.community_cards),
            pot_size=self.game.pot,
            current_bet=to_call,
            min_raise=min_raise,
            max_raise=max_raise,
            small_blind=sb,
            big_blind=bb,
            button_seat=self.game.button_seat,
            players=[
                {
                    "seat": p.seat,
                    "name": p.name,
                    "stack": p.stack,
                    "is_active": not p.has_folded and p.stack > 0,
                    "is_folded": p.has_folded,
                }
                for p in self.game.players.values()
            ],
            actions_this_hand=[
                {
                    "street": a.street.value,
                    "seat": a.seat,
                    "action": str(a.action.action_type.value),
                    "amount": a.action.amount,
                }
                for a in self.game.actions
            ],
            legal_actions=legal_actions,
        )

    def _convert_action(
        self,
        agent_action: AgentAction,
        player: Player,
        obs: Observation,
    ) -> Action:
        """Convert an agent action to a game action."""
        to_call = self.game.current_bet - player.bet_this_round

        if agent_action.action == "fold":
            return Action(ActionType.FOLD)
        elif agent_action.action == "check":
            return Action(ActionType.CHECK)
        elif agent_action.action == "call":
            if to_call == 0:
                return Action(ActionType.CHECK)
            call_amount = min(to_call, player.stack)
            is_all_in = call_amount >= player.stack
            return Action(ActionType.CALL, amount=call_amount, is_all_in=is_all_in)
        elif agent_action.action == "raise":
            raise_to = agent_action.raise_to or obs.min_raise
            # Clamp to valid range
            raise_to = max(obs.min_raise, min(raise_to, obs.max_raise))
            is_all_in = raise_to >= player.stack + player.bet_this_round

            if self.game.current_bet == 0:
                return Action(ActionType.BET, amount=raise_to, is_all_in=is_all_in)
            else:
                return Action(ActionType.RAISE, amount=raise_to, is_all_in=is_all_in)

        # Default to fold
        return Action(ActionType.FOLD)

    def _check_eliminations(self) -> None:
        """Check for and record player eliminations."""
        eliminated = []
        for seat, player in self.game.players.items():
            if player.stack == 0 and self.agent_manager.is_active(seat):
                eliminated.append(seat)

        if eliminated:
            if len(eliminated) > 1:
                self.scorer.record_multi_elimination(eliminated, self.hand_number)
            else:
                self.scorer.record_elimination(eliminated[0], self.hand_number)

            for seat in eliminated:
                # Update progress display
                if self.progress:
                    player_name = self.seat_names.get(seat, f"Seat {seat}")
                    self.progress.record_elimination(player_name, self.hand_number)

                self.agent_manager.eliminate_seat(seat)

    def save_meta(self) -> None:
        """Save tournament metadata."""
        meta = {
            "seed": self.config.seed,
            "num_players": self.config.num_players,
            "starting_stack": self.config.starting_stack,
            "blind_schedule": self.config.blind_schedule,
        }

        meta_path = self.config.log_dir / "meta.json"
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
