"""Main entry point for LivePokerBench."""

import logging
import os
import sys
from pathlib import Path
from typing import Any

# Suppress litellm verbose output before any imports
os.environ["LITELLM_LOG"] = "ERROR"

from live_poker_bench.agents.manager import AgentManager
from live_poker_bench.config import BenchmarkConfig, get_blind_schedule_config, load_config
from live_poker_bench.engine.blinds import BlindSchedule
from live_poker_bench.logging.progress import ProgressDisplay, create_file_handler
from live_poker_bench.logging.reporter import Reporter, TournamentResult
from live_poker_bench.tournament.runner import TournamentConfig, TournamentRunner


def setup_logging(log_dir: Path, verbose: bool = False) -> None:
    """Configure logging for the benchmark.

    Routes all detailed logs to a file, keeps terminal clean.

    Args:
        log_dir: Directory for log files.
        verbose: If True, also show INFO logs on terminal (for debugging).
    """
    # Ensure log directory exists
    log_dir.mkdir(parents=True, exist_ok=True)

    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    # Clear any existing handlers
    root_logger.handlers.clear()

    # File handler - captures EVERYTHING (DEBUG and above)
    file_handler = create_file_handler(log_dir, level=logging.DEBUG)
    root_logger.addHandler(file_handler)

    # Console handler - only CRITICAL errors (keeps terminal clean)
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.CRITICAL if not verbose else logging.WARNING)
    console_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    root_logger.addHandler(console_handler)

    # Silence noisy third-party loggers - be aggressive with litellm
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    # LiteLLM uses multiple logger names
    for logger_name in ["litellm", "LiteLLM", "litellm.utils", "litellm.llms"]:
        logging.getLogger(logger_name).setLevel(logging.ERROR)
        logging.getLogger(logger_name).handlers = []  # Remove any existing handlers


def run_tournament(
    config: BenchmarkConfig,
    run_number: int,
    log_dir: Path,
    progress: ProgressDisplay | None = None,
) -> TournamentResult:
    """Run a single tournament.

    Args:
        config: The benchmark configuration.
        run_number: The run number (0-indexed).
        log_dir: Directory for this run's logs.
        progress: Optional progress display for updates.

    Returns:
        Tournament result.
    """
    seed = config.tournament.seed_base + run_number

    # Create agent manager from config
    agent_manager = AgentManager.from_config(
        agent_configs=[agent.model_dump() for agent in config.agents],
        global_settings=config.agent_settings.model_dump(),
    )

    # Create tournament config
    tournament_config = TournamentConfig(
        num_players=config.tournament.seats,
        starting_stack=config.tournament.starting_stack,
        blind_schedule=get_blind_schedule_config(config),
        seed=seed,
        log_dir=log_dir,
    )

    # Run tournament
    runner = TournamentRunner(tournament_config, agent_manager, progress=progress)
    runner.save_meta()
    result = runner.run()

    # Update run number
    result.run_number = run_number

    return result


def run_benchmark(config_path: Path | str = "config.json") -> dict[str, Any]:
    """Run the complete benchmark.

    Args:
        config_path: Path to the configuration file.

    Returns:
        Summary results dictionary.
    """
    # Load configuration
    config = load_config(config_path)

    # Create base log directory
    base_log_dir = Path(config.output.log_dir)
    base_log_dir.mkdir(parents=True, exist_ok=True)

    # Setup logging - route detailed logs to file
    setup_logging(base_log_dir, verbose=False)
    logger = logging.getLogger(__name__)

    logger.info(f"Starting LivePokerBench with {config.tournament.num_runs} runs")
    logger.info(f"Players: {[a.name for a in config.agents]}")

    # Create reporter
    reporter = Reporter(base_log_dir)

    # Create progress display
    agent_names = [a.name for a in config.agents]
    progress = ProgressDisplay(
        total_runs=config.tournament.num_runs,
        total_players=config.tournament.seats,
        agent_names=agent_names,
        log_dir=base_log_dir,
    )

    # Start progress display
    progress.start()

    try:
        # Run tournaments
        for run_number in range(config.tournament.num_runs):
            logger.info(f"Starting run {run_number + 1}/{config.tournament.num_runs}")

            # Signal start of run to progress display
            progress.start_run(run_number + 1)

            # Create run-specific log directory
            run_log_dir = base_log_dir / f"tournament_{run_number + 1:03d}"
            run_log_dir.mkdir(parents=True, exist_ok=True)

            # Run tournament
            result = run_tournament(config, run_number, run_log_dir, progress=progress)

            # Save and add result
            reporter.save_run_results(run_number + 1, result)
            reporter.add_result(result)

            # Signal end of run to progress display
            progress.end_run({
                "placements": result.placements,
                "total_hands": result.total_hands,
            })

            logger.info(
                f"Run {run_number + 1} complete: {result.total_hands} hands, "
                f"winner: {[k for k, v in result.placements.items() if v == 1]}"
            )

    finally:
        # Stop progress display
        progress.stop()

    # Generate and save summary
    reporter.save_summary()
    reporter.print_summary()

    return reporter.generate_summary()


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="LivePokerBench - LLM Poker Tournament Benchmark"
    )
    parser.add_argument(
        "--config",
        "-c",
        type=str,
        default="config.json",
        help="Path to configuration file (default: config.json)",
    )
    parser.add_argument(
        "--health",
        action="store_true",
        help="Run health check on configuration and agents",
    )
    parser.add_argument(
        "--health-full",
        action="store_true",
        help="Run full health check including agent connectivity tests",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show warning logs in terminal (debug mode)",
    )

    args = parser.parse_args()

    # Handle health check
    if args.health or args.health_full:
        from live_poker_bench.config_health import run_health_check
        success = run_health_check(
            config_path=args.config,
            verbose=True,
            full=args.health_full,
        )
        sys.exit(0 if success else 1)

    try:
        run_benchmark(args.config)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nBenchmark interrupted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()
