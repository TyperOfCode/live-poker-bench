"""Memory query tools for LLM agents.

These are the only tools agents can use to query their memory.
"""

from typing import Any

from live_poker_bench.agents.memory import AgentMemory, HandRecord


def _format_hand_summary(hand: HandRecord) -> dict[str, Any]:
    """Format a hand record for LLM consumption."""
    return {
        "hand_number": hand.hand_number,
        "position": hand.my_position,
        "hole_cards": list(hand.my_hole_cards),
        "community_cards": list(hand.community_cards),
        "result": hand.result,
        "chips_won": hand.chips_won,
        "pot_size": hand.pot_size,
        "num_actions": len(hand.actions),
    }


def _format_action(action: Any) -> dict[str, Any]:
    """Format an action record for LLM consumption."""
    return {
        "street": action.street,
        "seat": action.seat,
        "player": action.player_name,
        "action": action.action,
        "amount": action.amount,
    }


def recall_opponent_actions(
    memory: AgentMemory,
    opponent_seat: int | None = None,
    opponent_name: str | None = None,
    street: str | None = None,
    action_type: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Query past actions by a specific opponent.

    Args:
        memory: The agent's memory.
        opponent_seat: Filter by opponent's seat number.
        opponent_name: Filter by opponent's name.
        street: Filter by street (preflop, flop, turn, river).
        action_type: Filter by action type (fold, call, raise, check, bet).
        limit: Maximum number of actions to return.

    Returns:
        Dictionary with opponent action history.
    """
    actions = []

    for hand in memory.hands:
        for action in hand.actions:
            # Skip own actions
            if action.seat == memory.seat:
                continue

            # Apply filters
            if opponent_seat is not None and action.seat != opponent_seat:
                continue
            if opponent_name is not None and action.player_name.lower() != opponent_name.lower():
                continue
            if street is not None and action.street.lower() != street.lower():
                continue
            if action_type is not None and action.action.lower() != action_type.lower():
                continue

            actions.append({
                "hand_number": hand.hand_number,
                **_format_action(action),
            })

    # Get most recent actions first
    actions = actions[-limit:]

    # Also include showdown info for this opponent
    showdowns = []
    if opponent_seat is not None:
        for hand in memory.get_showdowns_by_opponent(opponent_seat):
            cards = hand.showdown_cards.get(opponent_seat)
            if cards:
                showdowns.append({
                    "hand_number": hand.hand_number,
                    "cards": list(cards),
                    "community_cards": list(hand.community_cards),
                })

    return {
        "total_actions_found": len(actions),
        "actions": actions,
        "showdowns": showdowns[-5:] if showdowns else [],
    }


def recall_my_hands(
    memory: AgentMemory,
    result: str | None = None,
    position: str | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """Retrieve history of agent's own hands and outcomes.

    Args:
        memory: The agent's memory.
        result: Filter by result (won, lost, folded, split).
        position: Filter by position (BTN, SB, BB, UTG, etc.).
        limit: Maximum number of hands to return.

    Returns:
        Dictionary with agent's hand history.
    """
    hands = memory.hands.copy()

    # Apply filters
    if result is not None:
        hands = [h for h in hands if h.result.lower() == result.lower()]
    if position is not None:
        hands = [h for h in hands if h.my_position.lower() == position.lower()]

    # Get most recent hands
    hands = hands[-limit:]

    # Calculate stats
    total_hands = len(memory.hands)
    wins = len([h for h in memory.hands if h.result == "won"])
    folds = len([h for h in memory.hands if h.result == "folded"])

    return {
        "total_hands_played": total_hands,
        "wins": wins,
        "folds": folds,
        "win_rate": wins / total_hands if total_hands > 0 else 0,
        "hands": [
            {
                **_format_hand_summary(h),
                "actions": [_format_action(a) for a in h.actions if a.seat == memory.seat],
            }
            for h in hands
        ],
    }


def search_observations(
    memory: AgentMemory,
    query: str,
    limit: int = 10,
) -> dict[str, Any]:
    """Free-text search across the agent's observation history.

    Args:
        memory: The agent's memory.
        query: Search query string.
        limit: Maximum number of results to return.

    Returns:
        Dictionary with matching hands.
    """
    results = memory.search_observations(query)
    results = results[-limit:]

    return {
        "query": query,
        "matches_found": len(results),
        "hands": [
            {
                **_format_hand_summary(h),
                "all_actions": [_format_action(a) for a in h.actions],
                "showdown_cards": {
                    str(k): list(v) for k, v in h.showdown_cards.items()
                },
            }
            for h in results
        ],
    }


# Tool definitions for LLM consumption (OpenAI function calling format)
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "recall_opponent_actions",
            "description": "Query past actions by opponents. Use this to recall betting patterns, raises, folds, and showdown information for specific opponents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "opponent_seat": {
                        "type": "integer",
                        "description": "Filter by opponent's seat number (1-8)",
                    },
                    "opponent_name": {
                        "type": "string",
                        "description": "Filter by opponent's name",
                    },
                    "street": {
                        "type": "string",
                        "enum": ["preflop", "flop", "turn", "river"],
                        "description": "Filter by betting street",
                    },
                    "action_type": {
                        "type": "string",
                        "enum": ["fold", "call", "raise", "check", "bet"],
                        "description": "Filter by action type",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of actions to return (default: 20)",
                        "default": 20,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recall_my_hands",
            "description": "Retrieve your own hand history and outcomes. Use this to review your past plays, results, and patterns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "result": {
                        "type": "string",
                        "enum": ["won", "lost", "folded", "split"],
                        "description": "Filter by hand result",
                    },
                    "position": {
                        "type": "string",
                        "description": "Filter by position (BTN, SB, BB, UTG, MP, CO)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of hands to return (default: 10)",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_observations",
            "description": "Free-text search across your observation history. Use this to find hands involving specific cards, actions, or outcomes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (e.g., 'AA', 'all-in', 'river raise')",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 10)",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        },
    },
]


def execute_tool(
    tool_name: str,
    memory: AgentMemory,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    """Execute a tool call and return the result.

    Args:
        tool_name: Name of the tool to execute.
        memory: The agent's memory.
        arguments: Tool arguments.

    Returns:
        Tool execution result.

    Raises:
        ValueError: If tool name is unknown.
    """
    if tool_name == "recall_opponent_actions":
        return recall_opponent_actions(memory, **arguments)
    elif tool_name == "recall_my_hands":
        return recall_my_hands(memory, **arguments)
    elif tool_name == "search_observations":
        return search_observations(memory, **arguments)
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
