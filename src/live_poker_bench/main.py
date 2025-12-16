"""Main entry point for LivePokerBench."""

import logging
import sys
from pathlib import Path
from typing import Any

from live_poker_bench.agents.manager import AgentManager
from live_poker_bench.config import BenchmarkConfig, get_blind_schedule_config, load_config
from live_poker_bench.engine.blinds import BlindSchedule
from live_poker_bench.logging.reporter import Reporter, TournamentResult
from live_poker_bench.tournament.runner import TournamentConfig, TournamentRunner


def setup_logging(verbose: bool = True) -> None:
    """Configure logging for the benchmark."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def run_tournament(
    config: BenchmarkConfig,
    run_number: int,
    log_dir: Path,
) -> TournamentResult:
    """Run a single tournament.

    Args:
        config: The benchmark configuration.
        run_number: The run number (0-indexed).
        log_dir: Directory for this run's logs.

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
    runner = TournamentRunner(tournament_config, agent_manager)
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

    # Setup logging
    setup_logging(config.output.verbose)
    logger = logging.getLogger(__name__)

    logger.info(f"Starting LivePokerBench with {config.tournament.num_runs} runs")
    logger.info(f"Players: {[a.name for a in config.agents]}")

    # Create base log directory
    base_log_dir = Path(config.output.log_dir)
    base_log_dir.mkdir(parents=True, exist_ok=True)

    # Create reporter
    reporter = Reporter(base_log_dir)

    # Run tournaments
    for run_number in range(config.tournament.num_runs):
        logger.info(f"Starting run {run_number + 1}/{config.tournament.num_runs}")

        # Create run-specific log directory
        run_log_dir = base_log_dir / f"tournament_{run_number + 1:03d}"
        run_log_dir.mkdir(parents=True, exist_ok=True)

        # Run tournament
        result = run_tournament(config, run_number, run_log_dir)

        # Save and add result
        reporter.save_run_results(run_number + 1, result)
        reporter.add_result(result)

        logger.info(
            f"Run {run_number + 1} complete: {result.total_hands} hands, "
            f"winner: {[k for k, v in result.placements.items() if v == 1]}"
        )

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
