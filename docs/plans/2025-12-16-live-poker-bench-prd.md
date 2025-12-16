# LivePokerBench — Product Requirements Document

## 1. Overview

**LivePokerBench** is a reproducible benchmark where up to 8 AI agents (LLMs) compete in fixed-format No-Limit Texas Hold'em poker tournaments. It measures multi-agent decision-making under imperfect information by scoring tournament placement across multiple runs.

### One-liner

A poker tournament benchmark for evaluating LLM agents on strategic reasoning, adaptation, and decision-making under uncertainty.

### Primary Goal

**Dev-loop-first**: Enable fast iteration cycles to develop and improve poker-playing agents. Reproducibility and visual polish are secondary concerns that can be layered on later.

### Success Criteria

- Run a complete 6-agent tournament in a reasonable time (model-dependent)
- Swap agents/models with a config change
- Full verbose logging of every action, reasoning trace, and tool call
- Aggregate results across K tournament runs for variance control

### Non-Goals (MVP)

- Web UI or visual replay
- Real-time streaming of game state
- GTO solver integration or equity calculators as agent tools
- Multi-table tournaments
- Cash game format

---

## 2. Tournament Format

### Game Type

- **No-Limit Texas Hold'em**
- Single-table only (no multi-table)

### Players

- **Default:** 6-max (6 agents)
- **Supported:** 2–8 agents

### Starting Stacks

- **100 Big Blinds** effective per player

### Blind Structure

Blinds increase by hand count (not time) to ensure deterministic convergence:

| Level | Hands | SB / BB |
|------:|------:|--------:|
| 1     | 20    | 1 / 2   |
| 2     | 20    | 2 / 4   |
| 3     | 20    | 4 / 8   |
| 4     | 20    | 8 / 16  |
| 5     | 20    | 16 / 32 |
| 6     | ∞     | 32 / 64 |

Level 6 continues indefinitely until one player remains.

### Deck & Seeding

- Deck is seeded per tournament run for reproducibility
- Different seeds across K runs for variance control
- Deterministic button rotation (Seat 1 starts as dealer, rotates left)

### Win Condition

- Last agent with chips wins
- No rebuys or add-ons

### Benchmark Standard

- **K = 10** tournament runs (different seeds)
- Primary score: **average placement percentile** across K runs

---

## 3. Agent Architecture

### Overview

Each seat is controlled by an **Agent** backed by a selectable **Model**. Agents operate under imperfect information — they only see what a real player at their seat would legally observe.

### Agent Decision Flow

1. Agent receives **observation** (current game state from their perspective)
2. Agent may invoke **memory tools** across multiple LLM calls to recall past information
3. Agent outputs a **final action** (fold, call, or raise)

### Multi-Turn Agentic Workflow

Agents can make multiple LLM calls per decision point, using tools to query their memory before acting. This allows for genuine reasoning and recall without hard-coding poker logic.

### Available Tools

Memory tools only — no calculators or solvers:

| Tool | Description |
|------|-------------|
| `recall_opponent_actions` | Query past actions by a specific opponent (bets, raises, folds, showdowns) |
| `recall_my_hands` | Retrieve history of agent's own hands and outcomes |
| `search_observations` | Free-text search across the agent's observation history |

### Action Output Format

```json
{
  "action": "fold" | "call" | "raise",
  "raise_to": 48,
  "reasoning": "BTN has been 3-betting wide, value 4-bet here"
}
```

### Invalid Action Handling

1. If action is invalid, agent receives error feedback and may retry
2. **Maximum 3 retries** per decision point
3. After 3 failed retries, agent is forced to **fold**
4. All retries and failures are logged

---

## 4. Perspective Memory

### Core Principle

Agents retain only what they could have legally observed from their seat. This enforces true imperfect information — no agent can access another's hole cards (unless shown at showdown), the deck state, or other agents' private reasoning.

### What Agents Can Remember

| Information | Stored | Notes |
|-------------|--------|-------|
| Own hole cards | ✓ | Every hand |
| Community cards | ✓ | As revealed (flop, turn, river) |
| Own actions | ✓ | Full history |
| Opponent actions | ✓ | Bets, raises, calls, folds — all public |
| Showdown hole cards | ✓ | Only cards actually revealed at showdown |
| Pot sizes | ✓ | At each decision point |
| Stack sizes | ✓ | All players, public info |
| Blind levels | ✓ | Current and progression |

### What Agents Cannot Access

- Folded hole cards (theirs or opponents')
- Deck composition or upcoming cards
- Other agents' memory or reasoning traces
- Hands they weren't dealt into (if eliminated and observing)

### Memory Structure

Structured, queryable data per agent:

```
AgentMemory:
  hands: List[HandRecord]

HandRecord:
  hand_number: int
  my_position: str
  my_hole_cards: tuple
  community_cards: tuple
  actions: List[Action]  # all players' public actions
  showdown_cards: dict   # player -> cards (only if shown)
  result: str            # won/lost/folded
  chips_won: int
```

Memory tools query this structure, not raw text logs.

---

## 5. System Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    Tournament Runner                     │
│  - Loads config (JSON)                                  │
│  - Runs K tournaments with different seeds              │
│  - Aggregates results into final report                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Poker Engine                          │
│  - NLHE rules enforcement                               │
│  - Betting round management                             │
│  - Blind posting & rotation                             │
│  - Showdown logic (uses treys for hand eval)            │
│  - Seeded deck shuffle                                  │
│  - Emits per-agent observations                         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Agent Manager                         │
│  - Instantiates agents from config                      │
│  - Routes observations to correct agent                 │
│  - Manages agent memory (per-seat)                      │
│  - Handles tool calls and retries                       │
│  - Collects actions and validates                       │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    LLM Adapter (litellm)                 │
│  - Unified interface via litellm                        │
│  - OpenRouter as provider (OPENROUTER_API_KEY)          │
│  - Supports any model string                            │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Custom poker engine** with `treys` for hand evaluation only
- **litellm** for model abstraction, OpenRouter as default provider
- **Structured memory** per agent, queryable via tools
- **Config-driven** — all settings in a single JSON file

---

## 6. Configuration

All tournament settings are defined in a single JSON config file.

### Example Config

```json
{
  "tournament": {
    "num_runs": 10,
    "seats": 6,
    "starting_stack": 200,
    "blind_schedule": [
      { "hands": 20, "sb": 1, "bb": 2 },
      { "hands": 20, "sb": 2, "bb": 4 },
      { "hands": 20, "sb": 4, "bb": 8 },
      { "hands": 20, "sb": 8, "bb": 16 },
      { "hands": 20, "sb": 16, "bb": 32 },
      { "hands": null, "sb": 32, "bb": 64 }
    ],
    "seed_base": 42
  },
  "agents": [
    { "name": "GPT-4o", "model": "openrouter/openai/gpt-4o" },
    { "name": "Claude-3.5", "model": "openrouter/anthropic/claude-3.5-sonnet" },
    { "name": "Llama-3-70B", "model": "openrouter/meta-llama/llama-3-70b-instruct" },
    { "name": "Gemini-Pro", "model": "openrouter/google/gemini-pro-1.5" },
    { "name": "Mixtral", "model": "openrouter/mistralai/mixtral-8x22b-instruct" },
    { "name": "Qwen-72B", "model": "openrouter/qwen/qwen-2-72b-instruct" }
  ],
  "agent_settings": {
    "max_retries": 3,
    "retry_on_invalid": true
  },
  "output": {
    "log_dir": "./logs",
    "verbose": true
  }
}
```

### Config Fields

| Field | Description |
|-------|-------------|
| `tournament.num_runs` | Number of tournaments (K) for averaging |
| `tournament.seats` | Players at the table (2–8) |
| `tournament.starting_stack` | Chips per player (in BB = starting_stack / 2) |
| `tournament.seed_base` | Base seed; each run uses `seed_base + run_number` |
| `agents` | List of agent definitions with name and model string |
| `agent_settings.max_retries` | Retries before forced fold |
| `output.verbose` | Full traces always (true for MVP) |

---

## 7. Output & Logging

Full verbose logging is always enabled. Every action, reasoning trace, and tool call is captured.

### Log Structure

```
logs/
├── tournament_001/
│   ├── meta.json              # Config, seed, timestamps
│   ├── hands/
│   │   ├── hand_001.json      # Full hand history
│   │   ├── hand_002.json
│   │   └── ...
│   ├── agents/
│   │   ├── seat_1_gpt4o.json  # Agent's full reasoning traces
│   │   ├── seat_2_claude.json
│   │   └── ...
│   └── results.json           # Final placements, chip counts
├── tournament_002/
│   └── ...
└── summary.json               # Aggregate results across all runs
```

### Hand Log Contents (`hand_001.json`)

```json
{
  "hand_number": 1,
  "blind_level": 1,
  "button_seat": 1,
  "players": [
    { "seat": 1, "name": "GPT-4o", "stack_start": 200 }
  ],
  "hole_cards": { "seat_1": ["Ah", "Kd"], "...": "..." },
  "community_cards": ["Qs", "Jd", "2c", "7h", "3s"],
  "actions": [
    { "street": "preflop", "seat": 3, "action": "raise", "amount": 6 },
    { "street": "preflop", "seat": 1, "action": "call", "amount": 6 }
  ],
  "showdown": { "seat_1": ["Ah", "Kd"], "seat_3": ["Qd", "Qc"] },
  "winner": 3,
  "pot": 24
}
```

### Agent Trace Contents (`seat_1_gpt4o.json`)

Each decision point logs:

- Observation sent to agent
- Tool calls made (with arguments and responses)
- Raw LLM responses
- Final action and reasoning
- Retry attempts (if any)

### Summary Report (`summary.json`)

```json
{
  "num_runs": 10,
  "leaderboard": [
    { "name": "Claude-3.5", "avg_placement": 1.8, "wins": 4 },
    { "name": "GPT-4o", "avg_placement": 2.1, "wins": 3 }
  ],
  "telemetry": {
    "total_hands": 847,
    "avg_hands_per_tournament": 84.7,
    "invalid_action_rate": { "GPT-4o": 0.02, "Claude-3.5": 0.01 }
  }
}
```

---

## 8. Project Structure

```
live-poker-bench/
├── pyproject.toml
├── README.md
├── .env                         # OPENROUTER_API_KEY
├── config.json                  # Tournament configuration
│
├── src/
│   └── live_poker_bench/
│       ├── __init__.py
│       ├── main.py              # Entry point: load config, run tournament
│       │
│       ├── engine/
│       │   ├── __init__.py
│       │   ├── game.py          # Game state, betting rounds, hand flow
│       │   ├── deck.py          # Seeded deck, shuffle, deal
│       │   ├── evaluator.py     # Hand evaluation (wraps treys)
│       │   ├── actions.py       # Action validation, legal moves
│       │   └── blinds.py        # Blind schedule management
│       │
│       ├── agents/
│       │   ├── __init__.py
│       │   ├── base.py          # BaseAgent interface
│       │   ├── llm_agent.py     # LLM-backed agent with tool loop
│       │   ├── memory.py        # Structured AgentMemory
│       │   └── tools.py         # Memory tool definitions
│       │
│       ├── llm/
│       │   ├── __init__.py
│       │   └── adapter.py       # litellm wrapper, retry logic
│       │
│       ├── tournament/
│       │   ├── __init__.py
│       │   ├── runner.py        # Run K tournaments, manage seeds
│       │   └── scorer.py        # Placement scoring, aggregation
│       │
│       └── logging/
│           ├── __init__.py
│           ├── hand_logger.py   # Per-hand JSON logs
│           ├── agent_logger.py  # Agent trace logs
│           └── reporter.py      # Summary report generation
│
├── logs/                        # Output directory (gitignored)
│
└── tests/
    ├── test_engine.py
    ├── test_agents.py
    └── test_tournament.py
```

### Dependencies (pyproject.toml)

```toml
dependencies = [
    "litellm",
    "treys",
    "python-dotenv",
    "pydantic",       # Config & data validation
]
```

---

## 9. MVP Deliverables

The minimum viable product includes:

### Core Functionality

- [ ] **Poker Engine** — NLHE rules, seeded deck, blind schedule, showdown with `treys`
- [ ] **Agent Framework** — BaseAgent, LLM-backed agent with multi-turn tool loop
- [ ] **Memory System** — Structured per-agent memory with query tools
- [ ] **Tournament Runner** — Load config, run K tournaments, aggregate results
- [ ] **Logging** — Full verbose logs (hands, agent traces, summary report)

### Configuration

- [ ] JSON config file for all settings
- [ ] `.env` support for `OPENROUTER_API_KEY`

### CLI

- [ ] Single command: `python -m live_poker_bench` (reads `config.json`)

---

## 10. Future Work (Post-MVP)

Not in scope for v1, but natural extensions:

| Feature | Description |
|---------|-------------|
| **Seat rotation** | Rotate seat assignments across K runs to eliminate positional bias |
| **Memory limits** | Cap or summarize memory to prevent context overflow |
| **Python API** | Programmatic tournament setup for notebooks/scripts |
| **CLI args** | Override config values from command line |
| **Visual replay** | HTML/web viewer for hand histories |
| **More tools** | Pot odds calculator, equity estimation (opt-in) |
| **Custom agents** | Plugin system for non-LLM agents (rule-based, RL) |
| **Multi-table** | Support for larger tournament fields |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Late blind levels become push/fold** | Reduced strategic depth, less differentiation between agents | Levels 1–3 are 20 hands each; can increase to 30 if needed post-MVP |
| **Single-run placement is noisy** | Poker variance obscures true skill | K=10 tournament averaging; report confidence intervals |
| **LLM latency varies by model** | Slow models bottleneck tournament | No hard time limits; log per-decision latency for analysis |
| **Context overflow with long games** | Agent memory exceeds model context | Structured memory keeps prompts lean; future: summarization |
| **Invalid action spam** | Broken agent stalls game | 3 retries then forced fold; logged for debugging |
| **Cost accumulation** | Multi-turn agents × many hands × K runs | Track token usage in logs; cheap models for testing |
| **Model API failures** | Tournament crashes mid-run | Retry logic in LLM adapter; graceful error logging |

---

## 12. Open Questions

Decisions deferred to implementation or future iterations:

1. **Prompt engineering** — Exact format for observations and system prompts (iterate during dev)
2. **Memory query syntax** — How agents phrase tool calls (natural language vs structured)
3. **Chip display** — Absolute chips vs BB notation in observations
4. **Tie-breaking** — How to score when multiple agents bust on the same hand
