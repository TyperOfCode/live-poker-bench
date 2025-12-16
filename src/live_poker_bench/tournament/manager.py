"""Multi-run tournament manager for running K tournaments with different seeds."""

from pathlib import Path
from typing import Any

from live_poker_bench.agents.manager import AgentManager
from live_poker_bench.logging.reporter import Reporter, TournamentResult
from live_poker_bench.tournament.runner import TournamentConfig, TournamentRunner


class MultiRunManager:
    """Manages multiple tournament runs for variance control."""

    def __init__(
        self,
        num_runs: int,
        seed_base: int,
        starting_stack: int,
        blind_schedule: list[dict[str, Any]],
        agent_configs: list[dict[str, Any]],
        log_dir: Path,
        agent_settings: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the multi-run manager.

        Args:
            num_runs: Number of tournament runs (K).
            seed_base: Base seed; each run uses seed_base + run_number.
            starting_stack: Starting chips per player.
            blind_schedule: Blind schedule configuration.
            agent_configs: List of agent configurations.
            log_dir: Base directory for all logs.
            agent_settings: Global agent settings including reasoning config.
        """
        self.num_runs = num_runs
        self.seed_base = seed_base
        self.starting_stack = starting_stack
        self.blind_schedule = blind_schedule
        self.agent_configs = agent_configs
        self.agent_settings = agent_settings or {}
        self.log_dir = log_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self.reporter = Reporter(log_dir)
        self.results: list[TournamentResult] = []

    def run_all(self) -> dict[str, Any]:
        """Run all K tournaments and return summary.

        Returns:
            Summary report dictionary.
        """
        for run_number in range(1, self.num_runs + 1):
            print(f"\n{'='*60}")
            print(f"Starting Tournament Run {run_number}/{self.num_runs}")
            print(f"{'='*60}")

            result = self._run_single(run_number)
            self.results.append(result)
            self.reporter.add_result(result)

            # Save per-run results
            self.reporter.save_run_results(run_number, result)

            # Print quick summary
            print(f"\nRun {run_number} complete - {result.total_hands} hands played")
            print("Placements:")
            for name, placement in sorted(result.placements.items(), key=lambda x: x[1]):
                print(f"  {placement}. {name}")

        # Generate and save final summary
        summary = self.reporter.generate_summary()
        self.reporter.save_summary()
        self.reporter.print_summary()

        return summary

    def _run_single(self, run_number: int) -> TournamentResult:
        """Run a single tournament.

        Args:
            run_number: The run number (1-indexed).

        Returns:
            Tournament result.
        """
        seed = self.seed_base + run_number
        run_dir = self.log_dir / f"tournament_{run_number:03d}"
        run_dir.mkdir(parents=True, exist_ok=True)

        # Create fresh agent manager for this run
        agent_manager = AgentManager.from_config(
            agent_configs=self.agent_configs,
            global_settings=self.agent_settings,
        )

        # Create tournament config
        config = TournamentConfig(
            num_players=len(self.agent_configs),
            starting_stack=self.starting_stack,
            blind_schedule=self.blind_schedule,
            seed=seed,
            log_dir=run_dir,
        )

        # Run tournament
        runner = TournamentRunner(config, agent_manager)
        runner.save_meta()
        result = runner.run()

        # Update run number
        result.run_number = run_number

        return result

    def run_single(self, run_number: int) -> TournamentResult:
        """Run a single tournament (public interface).

        Args:
            run_number: The run number (1-indexed).

        Returns:
            Tournament result.
        """
        result = self._run_single(run_number)
        self.results.append(result)
        self.reporter.add_result(result)
        self.reporter.save_run_results(run_number, result)
        return result

    def get_current_standings(self) -> dict[str, Any]:
        """Get current standings based on completed runs.

        Returns:
            Summary of results so far.
        """
        return self.reporter.generate_summary()
