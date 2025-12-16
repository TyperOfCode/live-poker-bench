"""Summary report generation for tournament results."""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TournamentResult:
    """Result from a single tournament run."""

    run_number: int
    seed: int
    total_hands: int
    placements: dict[str, int]  # agent_name -> placement (1 = winner)
    agent_stats: dict[str, dict[str, Any]] = field(default_factory=dict)


class Reporter:
    """Generates summary reports across tournament runs."""

    def __init__(self, log_dir: Path) -> None:
        """Initialize the reporter.

        Args:
            log_dir: Base log directory.
        """
        self.log_dir = log_dir
        self.results: list[TournamentResult] = []

    def add_result(self, result: TournamentResult) -> None:
        """Add a tournament result.

        Args:
            result: The tournament result.
        """
        self.results.append(result)

    def generate_summary(self) -> dict[str, Any]:
        """Generate the summary report.

        Returns:
            Summary report dictionary.
        """
        if not self.results:
            return {"error": "No results to summarize"}

        # Collect all agent names
        all_agents: set[str] = set()
        for result in self.results:
            all_agents.update(result.placements.keys())

        # Calculate statistics per agent
        agent_stats: dict[str, dict[str, Any]] = {}
        for agent_name in all_agents:
            placements = []
            wins = 0
            total_hands_involved = 0
            total_retries = 0
            total_decisions = 0

            for result in self.results:
                placement = result.placements.get(agent_name)
                if placement is not None:
                    placements.append(placement)
                    if placement == 1:
                        wins += 1

                stats = result.agent_stats.get(agent_name, {})
                total_retries += stats.get("total_retries", 0)
                total_decisions += stats.get("total_decisions", 0)

            avg_placement = sum(placements) / len(placements) if placements else 0

            agent_stats[agent_name] = {
                "avg_placement": round(avg_placement, 2),
                "wins": wins,
                "placements": placements,
                "invalid_action_rate": (
                    round(total_retries / total_decisions, 4)
                    if total_decisions > 0
                    else 0
                ),
            }

        # Build leaderboard sorted by average placement
        leaderboard = sorted(
            [
                {
                    "name": name,
                    "avg_placement": stats["avg_placement"],
                    "wins": stats["wins"],
                }
                for name, stats in agent_stats.items()
            ],
            key=lambda x: x["avg_placement"],
        )

        # Calculate overall telemetry
        total_hands = sum(r.total_hands for r in self.results)
        avg_hands = total_hands / len(self.results) if self.results else 0

        invalid_rates = {
            name: stats["invalid_action_rate"]
            for name, stats in agent_stats.items()
        }

        summary = {
            "num_runs": len(self.results),
            "leaderboard": leaderboard,
            "agent_details": agent_stats,
            "telemetry": {
                "total_hands": total_hands,
                "avg_hands_per_tournament": round(avg_hands, 1),
                "invalid_action_rate": invalid_rates,
            },
        }

        return summary

    def save_summary(self) -> Path:
        """Save the summary report to file.

        Returns:
            Path to the saved summary file.
        """
        summary = self.generate_summary()
        filepath = self.log_dir / "summary.json"

        with open(filepath, "w") as f:
            json.dump(summary, f, indent=2)

        return filepath

    def save_run_results(self, run_number: int, result: TournamentResult) -> Path:
        """Save results for a single run.

        Args:
            run_number: The run number.
            result: The tournament result.

        Returns:
            Path to the saved results file.
        """
        run_dir = self.log_dir / f"tournament_{run_number:03d}"
        run_dir.mkdir(parents=True, exist_ok=True)

        results_data = {
            "run_number": result.run_number,
            "seed": result.seed,
            "total_hands": result.total_hands,
            "placements": result.placements,
            "agent_stats": result.agent_stats,
        }

        filepath = run_dir / "results.json"
        with open(filepath, "w") as f:
            json.dump(results_data, f, indent=2)

        return filepath

    def print_summary(self) -> None:
        """Print a human-readable summary to stdout."""
        summary = self.generate_summary()

        print("\n" + "=" * 60)
        print("TOURNAMENT SUMMARY")
        print("=" * 60)
        print(f"\nTotal runs: {summary['num_runs']}")
        print(f"Total hands played: {summary['telemetry']['total_hands']}")
        print(f"Avg hands per tournament: {summary['telemetry']['avg_hands_per_tournament']}")

        print("\n--- LEADERBOARD ---")
        for i, entry in enumerate(summary["leaderboard"], 1):
            print(f"{i}. {entry['name']}: avg placement {entry['avg_placement']}, wins: {entry['wins']}")

        print("\n--- INVALID ACTION RATES ---")
        for name, rate in summary["telemetry"]["invalid_action_rate"].items():
            print(f"  {name}: {rate * 100:.2f}%")

        print("=" * 60 + "\n")
