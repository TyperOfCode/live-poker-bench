# LivePokerBench

A poker tournament benchmark for evaluating LLM agents on strategic reasoning and decision-making in No-Limit Texas Hold'em.

## What is this?

LivePokerBench runs multi-table poker tournaments where LLM agents compete against each other. Each agent receives game observations, can use memory tools to recall past hands and opponent tendencies, and must make betting decisions. The benchmark measures strategic reasoning, opponent modeling, and adaptation over time.

Key features:
- **Seeded reproducibility** - Same seed produces identical card deals
- **Agent memory** - LLMs can query past hands and opponent actions
- **Multi-turn tool use** - Agents can call memory tools before deciding
- **Detailed logging** - Full hand histories and reasoning traces
- **Multi-run tournaments** - Statistical significance through repeated runs

## Quickstart

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) package manager
- OpenRouter API key

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd live-poker-bench

# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

### Running a Benchmark

```bash
# Run with default config
uv run python -m live_poker_bench

# Run with custom config
uv run python -m live_poker_bench --config my_config.json
```

### Configuration

Edit `config.json` to customize the benchmark:

```json
{
  "tournament": {
    "num_runs": 10,
    "seats": 6,
    "starting_stack": 200,
    "blind_schedule": [
      { "hands": 20, "sb": 1, "bb": 2 },
      { "hands": 20, "sb": 2, "bb": 4 },
      { "hands": null, "sb": 32, "bb": 64 }
    ],
    "seed_base": 42
  },
  "agents": [
    { "name": "GPT-4o", "model": "openrouter/openai/gpt-4o" },
    { "name": "Claude-3.5", "model": "openrouter/anthropic/claude-3.5-sonnet" }
  ],
  "output": {
    "log_dir": "./logs",
    "verbose": true
  }
}
```

## Development

### Setup

```bash
# Install with dev dependencies
uv sync

# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=live_poker_bench
```

### Project Structure

```
src/live_poker_bench/
├── engine/          # Poker game engine
│   ├── deck.py      # Seeded deck with shuffle/deal
│   ├── evaluator.py # Hand evaluation using treys
│   ├── blinds.py    # Blind schedule management
│   ├── actions.py   # Action types and validation
│   └── game.py      # Game state machine
├── agents/          # LLM agent system
│   ├── base.py      # BaseAgent interface
│   ├── memory.py    # Agent memory for past hands
│   ├── tools.py     # Memory query tools
│   ├── llm_agent.py # LLM-backed agent implementation
│   └── manager.py   # Agent lifecycle management
├── llm/             # LLM integration
│   └── adapter.py   # litellm wrapper with retry logic
├── tournament/      # Tournament orchestration
│   ├── runner.py    # Single tournament runner
│   ├── manager.py   # Multi-run manager
│   └── scorer.py    # Placement scoring
├── logging/         # Output and logging
│   ├── hand_logger.py   # JSON hand histories
│   ├── agent_logger.py  # Reasoning traces
│   └── reporter.py      # Summary reports
├── config/          # Configuration
│   └── config.py    # Pydantic config models
└── main.py          # CLI entry point
```

### Running Tests

```bash
# All tests
uv run pytest

# Specific test file
uv run pytest tests/test_engine.py

# With verbose output
uv run pytest -v

# Stop on first failure
uv run pytest -x
```

## Output

After running, logs are saved to the configured `log_dir`:

```
logs/
├── tournament_001/
│   ├── meta.json           # Tournament config
│   ├── hands/
│   │   ├── hand_001.json   # Individual hand logs
│   │   └── ...
│   └── agents/
│       └── traces.json     # Agent reasoning traces
├── tournament_002/
│   └── ...
├── run_001_results.json    # Per-run results
├── run_002_results.json
└── summary.json            # Aggregate statistics
```

## License

MIT
