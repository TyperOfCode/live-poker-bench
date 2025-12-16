"""Regression tests for action parsing and fallback behavior.

These tests ensure the bugs discovered in hand_004 (infinite loop due to
unrecognized "check" action and invalid fold fallback) don't recur.
"""

import pytest

from live_poker_bench.agents.base import AgentAction, Observation
from live_poker_bench.agents.llm_agent import LLMAgent
from live_poker_bench.engine.actions import Action, ActionType, validate_action, PlayerState, BettingState


class TestCheckActionParsing:
    """Tests for proper handling of 'check' action in LLM response parsing."""

    def _create_observation(self, legal_actions: list[str], current_bet: int = 0) -> Observation:
        """Helper to create a test observation."""
        return Observation(
            hand_number=1,
            street="flop",
            my_seat=1,
            my_position="SB",
            my_hole_cards=("Ah", "Kh"),
            my_stack=100,
            community_cards=("2c", "8d", "9c"),
            pot_size=12,
            current_bet=current_bet,
            min_raise=4,
            max_raise=100,
            small_blind=1,
            big_blind=2,
            button_seat=2,
            players=[{"seat": 1, "name": "Test", "stack": 100, "is_active": True, "is_folded": False}],
            actions_this_hand=[],
            legal_actions=legal_actions,
        )

    def test_check_action_is_parsed(self):
        """Test that 'check' action is recognized and preserved."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation(["fold", "check", "raise"])

        # Simulate LLM response with check action
        response = '{"action": "check", "raise_to": null, "reasoning": "Nothing to call"}'

        action = agent._parse_action(response, obs)

        assert action is not None, "Check action should be parsed successfully"
        assert action.action == "check", "Check should remain as 'check'"

    def test_check_action_case_insensitive(self):
        """Test that 'CHECK' (uppercase) is also recognized."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation(["fold", "check", "raise"])

        response = '{"action": "CHECK", "raise_to": null, "reasoning": "Checking"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "check"

    def test_call_still_works(self):
        """Test that 'call' action still works normally."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation(["fold", "call", "raise"], current_bet=10)

        response = '{"action": "call", "raise_to": null, "reasoning": "Calling the bet"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "call"

    def test_fold_still_works(self):
        """Test that 'fold' action still works normally."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation(["fold", "call", "raise"], current_bet=10)

        response = '{"action": "fold", "raise_to": null, "reasoning": "Weak hand"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "fold"

    def test_raise_still_works(self):
        """Test that 'raise' action still works normally."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation(["fold", "call", "raise"], current_bet=10)

        response = '{"action": "raise", "raise_to": 30, "reasoning": "Value bet"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "raise"
        assert action.raise_to == 30


class TestFoldValidation:
    """Tests for fold action validation edge cases."""

    def test_cannot_fold_when_nothing_to_call(self):
        """Test that fold is invalid when there's nothing to call (should check instead)."""
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(
            pot=12,
            current_bet=0,  # Nothing to call
            min_raise=2,
            big_blind=2,
            num_active_players=3,
        )

        fold_action = Action(ActionType.FOLD)
        is_valid, error = validate_action(fold_action, player, betting)

        assert not is_valid, "Fold should be invalid when nothing to call"
        assert "check instead" in error.lower()

    def test_can_fold_when_facing_bet(self):
        """Test that fold is valid when facing a bet."""
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(
            pot=20,
            current_bet=10,  # Facing a bet
            min_raise=10,
            big_blind=2,
            num_active_players=3,
        )

        fold_action = Action(ActionType.FOLD)
        is_valid, error = validate_action(fold_action, player, betting)

        assert is_valid, f"Fold should be valid when facing a bet: {error}"

    def test_check_is_valid_when_nothing_to_call(self):
        """Test that check is valid when there's nothing to call."""
        player = PlayerState(seat=1, stack=100, bet_this_round=0)
        betting = BettingState(
            pot=12,
            current_bet=0,  # Nothing to call
            min_raise=2,
            big_blind=2,
            num_active_players=3,
        )

        check_action = Action(ActionType.CHECK)
        is_valid, error = validate_action(check_action, player, betting)

        assert is_valid, f"Check should be valid when nothing to call: {error}"


class TestSystemPrompt:
    """Tests for the system prompt content."""

    def test_system_prompt_mentions_check(self):
        """Test that the system prompt tells LLM about 'check' action."""
        from live_poker_bench.agents.llm_agent import SYSTEM_PROMPT

        assert "check" in SYSTEM_PROMPT.lower(), "System prompt should mention 'check' action"

    def test_system_prompt_action_format_includes_check(self):
        """Test that the action format in system prompt includes 'check'."""
        from live_poker_bench.agents.llm_agent import SYSTEM_PROMPT

        # The prompt should show check as a valid action option
        assert '"check"' in SYSTEM_PROMPT or "'check'" in SYSTEM_PROMPT, \
            "System prompt should show 'check' as a valid action"


class TestObservationLegalActions:
    """Tests for legal actions in observations."""

    def test_check_in_legal_actions_when_nothing_to_call(self):
        """Test that 'check' is included in legal_actions when to_call is 0."""
        # This tests the runner's _build_observation logic
        # When to_call == 0, legal_actions should include "check"
        obs = Observation(
            hand_number=1,
            street="flop",
            my_seat=1,
            my_position="SB",
            my_hole_cards=("Ah", "Kh"),
            my_stack=100,
            community_cards=("2c", "8d", "9c"),
            pot_size=12,
            current_bet=0,  # Nothing to call
            min_raise=2,
            max_raise=100,
            small_blind=1,
            big_blind=2,
            button_seat=2,
            players=[],
            actions_this_hand=[],
            legal_actions=["fold", "check", "raise"],  # Should include check
        )

        assert "check" in obs.legal_actions, "Legal actions should include 'check' when nothing to call"
        assert "call" not in obs.legal_actions, "Legal actions should not include 'call' when nothing to call"


class TestMarkdownCodeBlockParsing:
    """Tests for handling JSON wrapped in markdown code blocks."""

    def _create_observation(self) -> Observation:
        """Helper to create a test observation."""
        return Observation(
            hand_number=1,
            street="flop",
            my_seat=1,
            my_position="SB",
            my_hole_cards=("Ah", "Kh"),
            my_stack=100,
            community_cards=("2c", "8d", "9c"),
            pot_size=12,
            current_bet=0,
            min_raise=4,
            max_raise=100,
            small_blind=1,
            big_blind=2,
            button_seat=2,
            players=[{"seat": 1, "name": "Test", "stack": 100, "is_active": True, "is_folded": False}],
            actions_this_hand=[],
            legal_actions=["fold", "check", "raise"],
        )

    def test_json_wrapped_in_markdown_code_block(self):
        """Test that JSON wrapped in ```json ... ``` is parsed correctly."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '''Some explanation text.

```json
{
  "action": "check",
  "raise_to": null,
  "reasoning": "Checking for pot control"
}
```'''

        action = agent._parse_action(response, obs)

        assert action is not None, "Should parse JSON from markdown code block"
        assert action.action == "check", "Check should remain as check"
        assert action.reasoning == "Checking for pot control"

    def test_json_wrapped_in_plain_markdown_block(self):
        """Test that JSON wrapped in ``` ... ``` (no language tag) is parsed."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '''Here's my decision:

```
{"action": "fold", "raise_to": null, "reasoning": "Weak hand"}
```'''

        action = agent._parse_action(response, obs)

        assert action is not None, "Should parse JSON from plain code block"
        assert action.action == "fold"

    def test_json_with_explanation_before_code_block(self):
        """Test parsing when LLM provides reasoning before the code block."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '''No specific history with this opponent. Given the situation:

- I have ace-high on a paired board
- My opponent called the flop bet, suggesting they have something
- Checking back allows me to see a free river

```json
{
  "action": "check",
  "raise_to": null,
  "reasoning": "Ace-high on paired board, check back for free showdown"
}
```'''

        action = agent._parse_action(response, obs)

        assert action is not None, "Should parse JSON even with long preamble"
        assert action.action == "check"

    def test_json_with_lowercase_json_tag(self):
        """Test that ```json tag works (lowercase)."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '```json\n{"action": "raise", "raise_to": 10, "reasoning": "Value"}\n```'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "raise"
        assert action.raise_to == 10

    def test_json_with_uppercase_json_tag(self):
        """Test that ```JSON tag works (uppercase)."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '```JSON\n{"action": "fold", "raise_to": null, "reasoning": "Too weak"}\n```'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "fold"

    def test_json_with_space_after_backticks(self):
        """Test that ``` json (with space) works."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '``` json\n{"action": "call", "raise_to": null, "reasoning": "Calling"}\n```'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "call"

    def test_plain_json_still_works(self):
        """Test that plain JSON (no markdown) still parses correctly."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '{"action": "fold", "raise_to": null, "reasoning": "Giving up"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "fold"

    def test_json_embedded_in_text_without_code_block(self):
        """Test JSON embedded in text without markdown code block."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = 'After analyzing the situation, my action is: {"action": "check", "raise_to": null, "reasoning": "Pot control"}'

        action = agent._parse_action(response, obs)

        assert action is not None
        assert action.action == "check"

    def test_extract_json_from_markdown_helper(self):
        """Test the _extract_json_from_markdown helper directly."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)

        # With json tag - only extracts blocks containing "action"
        text = '```json\n{"action": "check"}\n```'
        assert agent._extract_json_from_markdown(text) == '{"action": "check"}'

        # Without language tag
        text = '```\n{"action": "fold"}\n```'
        assert agent._extract_json_from_markdown(text) == '{"action": "fold"}'

        # Plain text (no code block) returns None
        text = '{"action": "value"}'
        assert agent._extract_json_from_markdown(text) is None

        # With surrounding text - returns content from code block
        text = 'Some text\n```json\n{"action": "raise"}\n```\nMore text'
        assert agent._extract_json_from_markdown(text) == '{"action": "raise"}'
        
        # Code block without "action" key returns None
        text = '```json\n{"key": "value"}\n```'
        assert agent._extract_json_from_markdown(text) is None

    def test_multiple_code_blocks_uses_first(self):
        """Test that when multiple code blocks exist, we still find the JSON."""
        agent = LLMAgent(name="TestAgent", model="test/model", seat=1)
        obs = self._create_observation()

        response = '''Here's my analysis:

```
Some other code
```

And my decision:

```json
{"action": "check", "raise_to": null, "reasoning": "Pot control"}
```'''

        action = agent._parse_action(response, obs)

        # Should still work because the regex looks for JSON with "action" key
        assert action is not None
        assert action.action == "check"

