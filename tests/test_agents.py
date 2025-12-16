"""Unit tests for agent components."""

import pytest

from live_poker_bench.agents.memory import AgentMemory, HandRecord, get_position_name
from live_poker_bench.agents.tools import (
    recall_opponent_actions,
    recall_my_hands,
    search_observations,
    execute_tool,
)
from live_poker_bench.agents.base import AgentAction, Observation


class TestAgentMemory:
    """Tests for AgentMemory class."""

    def test_create_memory(self):
        memory = AgentMemory("TestAgent", seat=1)
        assert memory.agent_name == "TestAgent"
        assert memory.seat == 1
        assert len(memory.hands) == 0

    def test_start_hand(self):
        memory = AgentMemory("TestAgent", seat=1)
        memory.start_hand(
            hand_number=1,
            hole_cards=("Ah", "Kh"),
            position="BTN",
        )
        assert memory._current_hand is not None
        assert memory._current_hand.hand_number == 1
        assert memory._current_hand.my_hole_cards == ("Ah", "Kh")

    def test_record_action(self):
        memory = AgentMemory("TestAgent", seat=1)
        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.record_action(
            street="preflop",
            seat=2,
            player_name="Opponent",
            action="raise",
            amount=10,
        )
        assert len(memory._current_hand.actions) == 1
        assert memory._current_hand.actions[0].action == "raise"

    def test_end_hand(self):
        memory = AgentMemory("TestAgent", seat=1)
        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.end_hand(
            result="won",
            chips_won=50,
            pot_size=50,
            final_stack=150,
        )
        assert len(memory.hands) == 1
        assert memory.hands[0].result == "won"
        assert memory._current_hand is None

    def test_get_hand(self):
        memory = AgentMemory("TestAgent", seat=1)
        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.end_hand("won", 50, 50, 150)

        hand = memory.get_hand(1)
        assert hand is not None
        assert hand.hand_number == 1

    def test_get_winning_hands(self):
        memory = AgentMemory("TestAgent", seat=1)

        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.end_hand("won", 50, 50, 150)

        memory.start_hand(2, ("2d", "3c"), "SB")
        memory.end_hand("lost", 0, 100, 100)

        winning = memory.get_winning_hands()
        assert len(winning) == 1
        assert winning[0].hand_number == 1

    def test_search_observations(self):
        memory = AgentMemory("TestAgent", seat=1)

        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.record_action("preflop", 2, "Opponent", "raise", 10)
        memory.end_hand("won", 50, 50, 150)

        memory.start_hand(2, ("2d", "3c"), "SB")
        memory.end_hand("folded", 0, 10, 98)

        results = memory.search_observations("Ah")
        assert len(results) == 1
        assert results[0].hand_number == 1

        results = memory.search_observations("raise")
        assert len(results) == 1

        results = memory.search_observations("folded")
        assert len(results) == 1
        assert results[0].hand_number == 2


class TestPositionName:
    """Tests for position naming."""

    def test_button_position(self):
        pos = get_position_name(1, button_seat=1, num_players=6, active_seats=[1, 2, 3, 4, 5, 6])
        assert pos == "BTN"

    def test_small_blind_position(self):
        pos = get_position_name(2, button_seat=1, num_players=6, active_seats=[1, 2, 3, 4, 5, 6])
        assert pos == "SB"

    def test_big_blind_position(self):
        pos = get_position_name(3, button_seat=1, num_players=6, active_seats=[1, 2, 3, 4, 5, 6])
        assert pos == "BB"

    def test_heads_up_button_is_sb(self):
        # In heads up, button posts SB and is BTN
        pos = get_position_name(1, button_seat=1, num_players=2, active_seats=[1, 2])
        assert pos == "BTN"
        pos = get_position_name(2, button_seat=1, num_players=2, active_seats=[1, 2])
        assert pos == "BB"


class TestMemoryTools:
    """Tests for memory query tools."""

    def _setup_memory_with_hands(self) -> AgentMemory:
        """Create a memory with some test hands."""
        memory = AgentMemory("TestAgent", seat=1)

        # Hand 1: Won
        memory.start_hand(1, ("Ah", "Kh"), "BTN")
        memory.record_action("preflop", 2, "Opponent1", "raise", 6)
        memory.record_action("preflop", 1, "TestAgent", "call", 6)
        memory.record_showdown(2, ("Qd", "Qc"))
        memory.update_community_cards(("As", "Kd", "2c", "7h", "3s"))
        memory.end_hand("won", 12, 12, 112)

        # Hand 2: Folded
        memory.start_hand(2, ("2d", "7c"), "SB")
        memory.record_action("preflop", 3, "Opponent2", "raise", 10)
        memory.record_action("preflop", 1, "TestAgent", "fold", None)
        memory.end_hand("folded", 0, 10, 111)

        # Hand 3: Lost
        memory.start_hand(3, ("Jh", "Jd"), "BB")
        memory.record_action("preflop", 2, "Opponent1", "raise", 8)
        memory.record_action("preflop", 1, "TestAgent", "call", 8)
        memory.record_showdown(2, ("Ah", "Ad"))
        memory.update_community_cards(("Ks", "Qd", "2c", "5h", "9s"))
        memory.end_hand("lost", 0, 16, 103)

        return memory

    def test_recall_opponent_actions(self):
        memory = self._setup_memory_with_hands()

        result = recall_opponent_actions(memory, opponent_seat=2)
        assert result["total_actions_found"] > 0

    def test_recall_opponent_actions_with_filter(self):
        memory = self._setup_memory_with_hands()

        result = recall_opponent_actions(memory, opponent_seat=2, action_type="raise")
        # All actions from seat 2 should be raises
        for action in result["actions"]:
            assert "raise" in action["action"].lower()

    def test_recall_my_hands(self):
        memory = self._setup_memory_with_hands()

        result = recall_my_hands(memory)
        assert result["total_hands_played"] == 3

    def test_recall_my_hands_filter_by_result(self):
        memory = self._setup_memory_with_hands()

        result = recall_my_hands(memory, result="won")
        assert len(result["hands"]) == 1
        assert result["hands"][0]["result"] == "won"

    def test_search_observations(self):
        memory = self._setup_memory_with_hands()

        result = search_observations(memory, query="Ah")
        assert result["matches_found"] > 0

    def test_execute_tool_unknown(self):
        memory = AgentMemory("TestAgent", seat=1)

        with pytest.raises(ValueError, match="Unknown tool"):
            execute_tool("unknown_tool", memory, {})


class TestObservation:
    """Tests for Observation dataclass."""

    def test_observation_to_dict(self):
        obs = Observation(
            hand_number=1,
            street="preflop",
            my_seat=1,
            my_position="BTN",
            my_hole_cards=("Ah", "Kh"),
            my_stack=100,
            community_cards=(),
            pot_size=3,
            current_bet=2,
            min_raise=4,
            max_raise=100,
            small_blind=1,
            big_blind=2,
            button_seat=1,
            players=[{"seat": 1, "name": "Test", "stack": 100, "is_active": True, "is_folded": False}],
            actions_this_hand=[],
            legal_actions=["fold", "call", "raise"],
        )

        d = obs.to_dict()
        assert d["hand_number"] == 1
        assert d["my_hole_cards"] == ["Ah", "Kh"]
        assert d["legal_actions"] == ["fold", "call", "raise"]


class TestAgentAction:
    """Tests for AgentAction dataclass."""

    def test_action_to_dict(self):
        action = AgentAction(
            action="raise",
            raise_to=50,
            reasoning="Value betting strong hand",
        )

        d = action.to_dict()
        assert d["action"] == "raise"
        assert d["raise_to"] == 50
        assert "Value betting" in d["reasoning"]

    def test_fold_action(self):
        action = AgentAction(action="fold", reasoning="Weak hand")
        assert action.action == "fold"
        assert action.raise_to is None
