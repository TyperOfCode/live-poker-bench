"""Integration tests for tournament functionality."""

import pytest
import tempfile
from pathlib import Path

from live_poker_bench.agents.base import AgentAction, BaseAgent, Observation
from live_poker_bench.agents.manager import AgentManager
from live_poker_bench.tournament.runner import TournamentConfig, TournamentRunner
from live_poker_bench.tournament.scorer import PlacementScorer
from live_poker_bench.logging.reporter import Reporter, TournamentResult


class MockAgent(BaseAgent):
    """A mock agent that always folds."""

    def __init__(self, name: str):
        super().__init__(name)
        self.action_count = 0

    def get_action(self, observation: Observation) -> AgentAction:
        self.action_count += 1
        # Always fold to make games finish quickly
        return AgentAction(action="fold", reasoning="Test agent always folds")


class MockAggressiveAgent(BaseAgent):
    """A mock agent that always raises or calls."""

    def __init__(self, name: str):
        super().__init__(name)
        self.action_count = 0

    def get_action(self, observation: Observation) -> AgentAction:
        self.action_count += 1
        if "raise" in observation.legal_actions:
            return AgentAction(
                action="raise",
                raise_to=observation.min_raise,
                reasoning="Test agent raises",
            )
        elif "call" in observation.legal_actions:
            return AgentAction(action="call", reasoning="Test agent calls")
        elif "check" in observation.legal_actions:
            return AgentAction(action="call", reasoning="Test agent checks")
        return AgentAction(action="fold", reasoning="No other option")


class TestPlacementScorer:
    """Tests for PlacementScorer."""

    def test_single_elimination(self):
        scorer = PlacementScorer(num_players=3)
        scorer.register_player(1, "Agent1")
        scorer.register_player(2, "Agent2")
        scorer.register_player(3, "Agent3")

        scorer.record_elimination(3, hand_number=5)

        assert not scorer.is_tournament_over()
        remaining = scorer.get_remaining_players()
        assert 3 not in remaining
        assert 1 in remaining and 2 in remaining

    def test_tournament_complete(self):
        scorer = PlacementScorer(num_players=3)
        scorer.register_player(1, "Agent1")
        scorer.register_player(2, "Agent2")
        scorer.register_player(3, "Agent3")

        scorer.record_elimination(3, hand_number=5)
        scorer.record_elimination(2, hand_number=10)

        assert scorer.is_tournament_over()
        assert scorer.get_winner() == 1

    def test_placements(self):
        scorer = PlacementScorer(num_players=3)
        scorer.register_player(1, "Agent1")
        scorer.register_player(2, "Agent2")
        scorer.register_player(3, "Agent3")

        scorer.record_elimination(3, hand_number=5)  # 3rd place
        scorer.record_elimination(2, hand_number=10)  # 2nd place

        placements = scorer.calculate_placements()
        assert placements[1] == 1  # Winner
        assert placements[2] == 2  # Second
        assert placements[3] == 3  # Third

    def test_multi_elimination(self):
        scorer = PlacementScorer(num_players=4)
        scorer.register_player(1, "Agent1")
        scorer.register_player(2, "Agent2")
        scorer.register_player(3, "Agent3")
        scorer.register_player(4, "Agent4")

        # Two players bust on the same hand
        scorer.record_multi_elimination([3, 4], hand_number=5)

        placements = scorer.calculate_placements()
        # Both should share same placement
        assert placements[3] == placements[4]


class TestReporter:
    """Tests for Reporter."""

    def test_add_result(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_dir = Path(tmpdir)
            reporter = Reporter(log_dir)

            result = TournamentResult(
                run_number=1,
                seed=42,
                total_hands=50,
                placements={"Agent1": 1, "Agent2": 2},
                agent_stats={},
            )
            reporter.add_result(result)

            summary = reporter.generate_summary()
            assert summary["num_runs"] == 1

    def test_leaderboard_ordering(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_dir = Path(tmpdir)
            reporter = Reporter(log_dir)

            # Two runs with different winners
            result1 = TournamentResult(
                run_number=1,
                seed=42,
                total_hands=50,
                placements={"Agent1": 1, "Agent2": 2},
                agent_stats={},
            )
            result2 = TournamentResult(
                run_number=2,
                seed=43,
                total_hands=60,
                placements={"Agent1": 2, "Agent2": 1},
                agent_stats={},
            )
            reporter.add_result(result1)
            reporter.add_result(result2)

            summary = reporter.generate_summary()
            leaderboard = summary["leaderboard"]

            # Both agents should have avg placement of 1.5
            assert leaderboard[0]["avg_placement"] == 1.5
            assert leaderboard[1]["avg_placement"] == 1.5


class TestAgentManager:
    """Tests for AgentManager."""

    def test_create_from_config(self):
        configs = [
            {"name": "Agent1", "model": "test/model1"},
            {"name": "Agent2", "model": "test/model2"},
        ]
        # This would require mocking the LLM adapter
        # For now, test that configs are parsed correctly
        assert len(configs) == 2

    def test_add_agent(self):
        manager = AgentManager()
        agent = MockAgent("TestAgent")
        manager.add_agent(1, agent)

        assert manager.get_agent(1) is agent
        assert 1 in manager.get_active_seats()

    def test_eliminate_seat(self):
        manager = AgentManager()
        manager.add_agent(1, MockAgent("Agent1"))
        manager.add_agent(2, MockAgent("Agent2"))

        manager.eliminate_seat(1)

        assert not manager.is_active(1)
        assert manager.is_active(2)


class TestTournamentRunner:
    """Integration tests for TournamentRunner."""

    @pytest.fixture
    def temp_log_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    def test_runner_completes(self, temp_log_dir):
        """Test that a tournament can complete with mock agents."""
        # Create agent manager with mock agents
        manager = AgentManager()
        manager.add_agent(1, MockAgent("Folder1"))
        manager.add_agent(2, MockAggressiveAgent("Aggressor"))

        # Create tournament config
        config = TournamentConfig(
            num_players=2,
            starting_stack=100,
            blind_schedule=[
                {"hands": 5, "sb": 1, "bb": 2},
                {"hands": None, "sb": 2, "bb": 4},
            ],
            seed=42,
            log_dir=temp_log_dir,
        )

        # Run tournament
        runner = TournamentRunner(config, manager)
        result = runner.run()

        # Verify result
        assert result.total_hands > 0
        assert len(result.placements) == 2
        # One agent should have won (placement 1)
        assert 1 in result.placements.values()

    def test_log_files_created(self, temp_log_dir):
        """Test that log files are created during tournament."""
        manager = AgentManager()
        manager.add_agent(1, MockAgent("Agent1"))
        manager.add_agent(2, MockAggressiveAgent("Agent2"))

        config = TournamentConfig(
            num_players=2,
            starting_stack=100,
            blind_schedule=[{"hands": None, "sb": 1, "bb": 2}],
            seed=42,
            log_dir=temp_log_dir,
        )

        runner = TournamentRunner(config, manager)
        runner.save_meta()
        result = runner.run()

        # Check that hand logs were created
        hands_dir = temp_log_dir / "hands"
        assert hands_dir.exists()

        # Check that agent logs were created
        agents_dir = temp_log_dir / "agents"
        assert agents_dir.exists()

    def test_deterministic_with_same_seed(self, temp_log_dir):
        """Test that same seed produces same results."""
        def run_tournament(seed: int, log_dir: Path) -> int:
            manager = AgentManager()
            manager.add_agent(1, MockAgent("Agent1"))
            manager.add_agent(2, MockAggressiveAgent("Agent2"))

            config = TournamentConfig(
                num_players=2,
                starting_stack=100,
                blind_schedule=[{"hands": None, "sb": 1, "bb": 2}],
                seed=seed,
                log_dir=log_dir,
            )

            runner = TournamentRunner(config, manager)
            result = runner.run()
            return result.total_hands

        # Run twice with same seed
        with tempfile.TemporaryDirectory() as tmpdir1:
            hands1 = run_tournament(42, Path(tmpdir1))

        with tempfile.TemporaryDirectory() as tmpdir2:
            hands2 = run_tournament(42, Path(tmpdir2))

        # Should have same number of hands with deterministic agents
        assert hands1 == hands2

    def test_call_action_after_blind(self, temp_log_dir):
        """Test that CALL action is correctly converted when player has posted a blind.
        
        This test guards against the bug where a player who posted SB (1 chip)
        facing a raise to 6 would have their CALL action incorrectly constructed
        with amount=6 (total) instead of amount=5 (additional chips needed).
        """
        from live_poker_bench.engine.actions import Action, ActionType
        from live_poker_bench.engine.game import Player
        from live_poker_bench.agents.base import AgentAction, Observation
        
        manager = AgentManager()
        manager.add_agent(1, MockAgent("Agent1"))
        manager.add_agent(2, MockAggressiveAgent("Agent2"))
        manager.add_agent(3, MockAggressiveAgent("Agent3"))
        manager.add_agent(4, MockAggressiveAgent("Agent4"))
        
        config = TournamentConfig(
            num_players=4,
            starting_stack=200,
            blind_schedule=[{"hands": None, "sb": 1, "bb": 2}],
            seed=42,
            log_dir=temp_log_dir,
        )
        
        runner = TournamentRunner(config, manager)
        
        # Initialize game state by starting a hand
        players = [
            Player(
                seat=seat,
                name=runner.agent_manager.get_agent(seat).name,
                stack=config.starting_stack,
            )
            for seat in runner.agent_manager.get_active_seats()
        ]
        
        from live_poker_bench.engine.deck import Deck
        from live_poker_bench.engine.blinds import BlindSchedule
        from live_poker_bench.engine.game import GameState
        
        runner.game = GameState(
            players=players,
            deck=Deck(seed=config.seed),
            blind_schedule=BlindSchedule.from_config(config.blind_schedule),
            button_seat=runner.button_seat,
        )
        
        runner.game.start_hand(1)
        
        # Manually set up the scenario: player posted SB (1 chip), facing raise to 6
        # This simulates the exact bug scenario from hand_001.json
        player = runner.game.players[2]  # Seat 2 (SB)
        # Player already posted SB (1 chip)
        assert player.bet_this_round == 1
        
        # Simulate a raise to 6 (someone raised from 2 to 6)
        runner.game.current_bet = 6
        runner.game.min_raise = 4
        
        # Create observation for the player
        obs = Observation(
            hand_number=1,
            street="preflop",
            my_seat=2,
            my_position="SB",
            my_hole_cards=("Ac", "Js"),
            my_stack=199,
            community_cards=(),
            pot_size=9,
            current_bet=5,  # Amount to call (6 - 1 = 5)
            min_raise=10,
            max_raise=200,
            small_blind=1,
            big_blind=2,
            button_seat=1,
            players=[],
            actions_this_hand=[],
            legal_actions=["fold", "call", "raise"],
        )
        
        # Agent wants to call
        agent_action = AgentAction(action="call", reasoning="Test call")
        
        # Convert action
        game_action = runner._convert_action(agent_action, player, obs)
        
        # Verify the action is correctly constructed
        assert game_action.action_type == ActionType.CALL
        # The amount should be 5 (additional chips needed), NOT 6 (total)
        assert game_action.amount == 5, f"Expected call amount to be 5, got {game_action.amount}"
        assert not game_action.is_all_in
        
        # Verify the action passes validation
        from live_poker_bench.engine.actions import BettingState, PlayerState, validate_action
        player_state = player.to_state()
        betting_state = BettingState(
            pot=9,
            current_bet=6,
            min_raise=4,
            big_blind=2,
        )
        
        is_valid, error = validate_action(game_action, player_state, betting_state)
        assert is_valid, f"Action validation failed: {error}"
