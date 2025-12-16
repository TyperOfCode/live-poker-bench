"""Rich terminal progress display for tournament runs."""

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskID,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)
from rich.table import Table
from rich.text import Text


@dataclass
class ActionRecord:
    """Record of a single action with timing."""

    player_name: str
    action: str
    amount: int | None = None
    thinking_time_ms: float = 0.0
    forced: bool = False
    retries: int = 0
    street: str = "preflop"
    hole_cards: tuple[str, str] | None = None


@dataclass
class ThinkingState:
    """State for tracking who is currently thinking."""

    player_name: str
    seat: int
    start_time: float
    street: str = "preflop"
    hole_cards: tuple[str, str] | None = None
    stack: int = 0


@dataclass
class HandStats:
    """Statistics for the current hand."""

    hand_number: int = 0
    street: str = "preflop"
    pot_size: int = 0
    players_active: int = 0
    actions: list[ActionRecord] = field(default_factory=list)
    community_cards: list[str] = field(default_factory=list)


@dataclass
class TournamentProgress:
    """Progress tracking for a tournament run."""

    run_number: int
    total_runs: int
    hands_played: int = 0
    players_remaining: int = 0
    total_players: int = 0
    current_blind_level: int = 1
    small_blind: int = 0
    big_blind: int = 0
    eliminations: list[tuple[str, int]] = field(default_factory=list)  # (name, hand_number)
    hand_stats: HandStats = field(default_factory=HandStats)
    thinking: ThinkingState | None = None


class ProgressDisplay:
    """Beautiful terminal progress display for the benchmark."""

    def __init__(
        self,
        total_runs: int,
        total_players: int,
        agent_names: list[str],
        log_dir: Path,
    ) -> None:
        """Initialize the progress display.

        Args:
            total_runs: Total number of tournament runs.
            total_players: Number of players per tournament.
            agent_names: List of agent names.
            log_dir: Directory where detailed logs are written.
        """
        self.total_runs = total_runs
        self.total_players = total_players
        self.agent_names = agent_names
        self.log_dir = log_dir
        self.console = Console()

        # Track statistics
        self.start_time = time.time()
        self.run_times: list[float] = []
        self.current_progress = TournamentProgress(
            run_number=0,
            total_runs=total_runs,
            total_players=total_players,
            players_remaining=total_players,
        )

        # Win tracking across runs
        self.wins: dict[str, int] = {name: 0 for name in agent_names}
        self.placements: dict[str, list[int]] = {name: [] for name in agent_names}

        # Progress bars
        self.progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(bar_width=40),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            TextColumn("•"),
            TimeRemainingColumn(),
            console=self.console,
            expand=False,
        )

        self.overall_task: TaskID | None = None
        self.run_task: TaskID | None = None
        self.live: Live | None = None

    def _format_time(self, seconds: float) -> str:
        """Format seconds into human-readable time."""
        if seconds < 60:
            return f"{seconds:.0f}s"
        elif seconds < 3600:
            mins = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{mins}m {secs}s"
        else:
            hours = int(seconds // 3600)
            mins = int((seconds % 3600) // 60)
            return f"{hours}h {mins}m"

    def _format_ms(self, ms: float) -> str:
        """Format milliseconds into readable time."""
        if ms < 1000:
            return f"{ms:.0f}ms"
        elif ms < 60000:
            return f"{ms / 1000:.1f}s"
        else:
            mins = int(ms // 60000)
            secs = (ms % 60000) / 1000
            return f"{mins}m {secs:.0f}s"

    def _calculate_eta(self) -> str:
        """Calculate estimated time remaining."""
        if not self.run_times:
            return "calculating..."

        avg_run_time = sum(self.run_times) / len(self.run_times)
        runs_remaining = self.total_runs - len(self.run_times)

        if runs_remaining <= 0:
            return "finishing..."

        eta_seconds = avg_run_time * runs_remaining
        return self._format_time(eta_seconds)

    def _create_header(self) -> Panel:
        """Create the header panel."""
        elapsed = time.time() - self.start_time
        eta = self._calculate_eta()

        header_text = Text()
        header_text.append("♠ ♥ ", style="red bold")
        header_text.append("LIVE POKER BENCH", style="bold white")
        header_text.append(" ♦ ♣", style="red bold")
        header_text.append("\n\n")
        header_text.append(f"Runtime: ", style="dim")
        header_text.append(self._format_time(elapsed), style="cyan bold")
        header_text.append("  •  ", style="dim")
        header_text.append(f"ETA: ", style="dim")
        header_text.append(eta, style="green bold")
        header_text.append("  •  ", style="dim")
        header_text.append(f"Logs: ", style="dim")
        header_text.append(str(self.log_dir), style="yellow")

        return Panel(
            header_text,
            border_style="bright_blue",
            padding=(0, 2),
        )

    def _format_card(self, card: str) -> Text:
        """Format a card with suit colors."""
        if len(card) < 2:
            return Text(card)
        
        rank = card[:-1]
        suit = card[-1].lower()
        
        # Color suits: hearts/diamonds red, spades/clubs white
        suit_symbols = {"h": "♥", "d": "♦", "s": "♠", "c": "♣"}
        suit_colors = {"h": "red", "d": "red", "s": "white", "c": "white"}
        
        text = Text()
        text.append(rank, style="bold white")
        text.append(suit_symbols.get(suit, suit), style=suit_colors.get(suit, "white"))
        return text

    def _create_thinking_indicator(self) -> Panel | None:
        """Create the thinking indicator panel."""
        thinking = self.current_progress.thinking
        if not thinking:
            return None

        elapsed_ms = (time.time() - thinking.start_time) * 1000
        elapsed_str = self._format_ms(elapsed_ms)

        text = Text()
        text.append("🤔 ", style="yellow")
        text.append(thinking.player_name, style="bold cyan")
        
        # Show hole cards if available
        if thinking.hole_cards:
            text.append("  [", style="dim")
            text.append_text(self._format_card(thinking.hole_cards[0]))
            text.append(" ", style="dim")
            text.append_text(self._format_card(thinking.hole_cards[1]))
            text.append("]", style="dim")
        
        # Show stack
        if thinking.stack > 0:
            text.append(f"  ${thinking.stack}", style="green")
        
        text.append("  is thinking...", style="dim")
        text.append(f"  [{elapsed_str}]", style="yellow bold")

        return Panel(
            text,
            border_style="yellow",
            padding=(0, 1),
        )

    def _create_hand_actions(self) -> Panel | None:
        """Create the play-by-play actions panel."""
        actions = self.current_progress.hand_stats.actions
        if not actions:
            return None

        # Group actions by street
        streets: dict[str, list[ActionRecord]] = {}
        for action in actions:
            if action.street not in streets:
                streets[action.street] = []
            streets[action.street].append(action)

        text = Text()
        street_order = ["preflop", "flop", "turn", "river", "showdown"]
        
        for street in street_order:
            if street not in streets:
                continue
            
            # Street header
            text.append(f"─── {street.upper()} ", style="dim magenta")
            text.append("─" * (40 - len(street)), style="dim")
            text.append("\n")
            
            for action in streets[street]:
                # Timing
                time_str = self._format_ms(action.thinking_time_ms)
                text.append(f"  [{time_str:>6}] ", style="dim")
                
                # Player name
                text.append(f"{action.player_name}", style="cyan")
                
                # Show hole cards if available
                if action.hole_cards:
                    text.append(" [", style="dim")
                    text.append_text(self._format_card(action.hole_cards[0]))
                    text.append(" ", style="dim")
                    text.append_text(self._format_card(action.hole_cards[1]))
                    text.append("]", style="dim")
                
                text.append(": ", style="cyan")
                
                # Action with styling
                action_style = "green" if action.action in ("call", "check") else \
                              "red" if action.action == "fold" else \
                              "yellow bold" if action.action in ("raise", "bet") else "white"
                
                action_text = action.action
                if action.amount and action.action in ("raise", "bet", "call"):
                    action_text = f"{action.action} {action.amount}"
                
                text.append(action_text, style=action_style)
                
                # Forced fold indicator
                if action.forced:
                    text.append(" ⚠️ FORCED", style="red bold")
                    if action.retries > 0:
                        text.append(f" ({action.retries} retries)", style="dim red")
                
                text.append("\n")

        return Panel(
            text,
            title=f"[bold]Hand #{self.current_progress.hand_stats.hand_number} Actions",
            border_style="blue",
            padding=(0, 1),
        )

    def _create_tournament_status(self) -> Panel:
        """Create the current tournament status panel."""
        p = self.current_progress

        # Tournament info
        status_text = Text()
        status_text.append(f"Tournament {p.run_number}/{p.total_runs}", style="bold cyan")
        status_text.append(f"  •  Hand #{p.hand_stats.hand_number}", style="white")
        status_text.append(f"  •  ", style="dim")
        status_text.append(f"Blinds: {p.small_blind}/{p.big_blind}", style="yellow")
        status_text.append(f" (Level {p.current_blind_level})", style="dim")
        status_text.append("\n")

        # Current state
        status_text.append(f"Players: {p.players_remaining}/{p.total_players}", style="green")
        status_text.append(f"  •  Street: ", style="dim")
        status_text.append(p.hand_stats.street.upper(), style="magenta bold")
        status_text.append(f"  •  Pot: ", style="dim")
        status_text.append(f"{p.hand_stats.pot_size}", style="yellow bold")

        # Community cards (board)
        if p.hand_stats.community_cards:
            status_text.append("\n")
            status_text.append("Board: ", style="dim")
            for i, card in enumerate(p.hand_stats.community_cards):
                if i > 0:
                    status_text.append(" ", style="dim")
                status_text.append_text(self._format_card(card))

        return Panel(
            status_text,
            title="[bold]Current Game",
            border_style="green",
            padding=(0, 1),
        )

    def _create_leaderboard(self) -> Table:
        """Create the leaderboard table."""
        table = Table(
            title="Leaderboard",
            show_header=True,
            header_style="bold magenta",
            border_style="bright_black",
            padding=(0, 1),
        )

        table.add_column("#", style="dim", width=3)
        table.add_column("Agent", style="cyan", min_width=20)
        table.add_column("Wins", justify="center", style="green")
        table.add_column("Avg Place", justify="center", style="yellow")
        table.add_column("Last", justify="center", style="dim")

        # Sort by wins, then average placement
        sorted_agents = sorted(
            self.agent_names,
            key=lambda n: (-self.wins[n], sum(self.placements.get(n, [999])) / max(len(self.placements.get(n, [1])), 1)),
        )

        for i, name in enumerate(sorted_agents, 1):
            wins = self.wins[name]
            places = self.placements.get(name, [])
            avg = f"{sum(places) / len(places):.1f}" if places else "-"
            last = str(places[-1]) if places else "-"

            # Highlight top performer
            rank_style = "bold gold1" if i == 1 and wins > 0 else "dim"

            table.add_row(
                str(i),
                name,
                str(wins),
                avg,
                last,
                style=rank_style if i == 1 and wins > 0 else None,
            )

        return table

    def _create_eliminations(self) -> Panel | None:
        """Create panel showing recent eliminations."""
        elims = self.current_progress.eliminations[-5:]  # Last 5
        if not elims:
            return None

        elim_text = Text()
        for name, hand in reversed(elims):
            elim_text.append("✗ ", style="red")
            elim_text.append(name, style="strike dim")
            elim_text.append(f" (hand {hand})\n", style="dim")

        return Panel(
            elim_text,
            title="[bold red]Eliminations",
            border_style="red",
            padding=(0, 1),
        )

    def _create_display(self) -> Group:
        """Create the complete display layout."""
        components = [
            self._create_header(),
            self.progress,
            self._create_tournament_status(),
        ]

        # Add thinking indicator if someone is thinking
        thinking_panel = self._create_thinking_indicator()
        if thinking_panel:
            components.append(thinking_panel)

        # Add hand actions panel
        actions_panel = self._create_hand_actions()
        if actions_panel:
            components.append(actions_panel)

        elim_panel = self._create_eliminations()
        if elim_panel:
            components.append(elim_panel)

        if any(self.placements.values()):
            components.append(self._create_leaderboard())

        return Group(*components)

    def start(self) -> None:
        """Start the live display."""
        self.start_time = time.time()
        self.overall_task = self.progress.add_task(
            "Overall Progress",
            total=self.total_runs,
        )
        self.live = Live(
            self._create_display(),
            console=self.console,
            refresh_per_second=4,
            transient=False,
        )
        self.live.start()

    def stop(self) -> None:
        """Stop the live display."""
        if self.live:
            self.live.stop()

    def refresh(self) -> None:
        """Refresh the display."""
        if self.live:
            self.live.update(self._create_display())

    def start_run(self, run_number: int) -> None:
        """Signal the start of a new tournament run."""
        self.current_progress = TournamentProgress(
            run_number=run_number,
            total_runs=self.total_runs,
            total_players=self.total_players,
            players_remaining=self.total_players,
        )
        self.refresh()

    def end_run(self, result: dict[str, Any]) -> None:
        """Signal the end of a tournament run.

        Args:
            result: Result dict with placements and stats.
        """
        # Record run time
        run_elapsed = time.time() - self.start_time
        if self.run_times:
            run_elapsed = run_elapsed - sum(self.run_times)
        self.run_times.append(run_elapsed)

        # Update wins and placements
        placements = result.get("placements", {})
        for name, place in placements.items():
            if name in self.placements:
                self.placements[name].append(place)
                if place == 1:
                    self.wins[name] += 1

        # Update progress bar
        if self.overall_task is not None:
            self.progress.advance(self.overall_task)

        self.refresh()

    def update_hand(
        self,
        hand_number: int,
        street: str = "preflop",
        pot_size: int = 0,
        players_active: int = 0,
        blind_level: int = 1,
        small_blind: int = 0,
        big_blind: int = 0,
    ) -> None:
        """Update the current hand information - resets actions for new hand."""
        # Clear actions when starting a new hand
        self.current_progress.hand_stats = HandStats(
            hand_number=hand_number,
            street=street,
            pot_size=pot_size,
            players_active=players_active,
            actions=[],
        )
        self.current_progress.hands_played = hand_number
        self.current_progress.current_blind_level = blind_level
        self.current_progress.small_blind = small_blind
        self.current_progress.big_blind = big_blind
        self.current_progress.thinking = None
        self.refresh()

    def start_thinking(
        self,
        player_name: str,
        seat: int,
        hole_cards: tuple[str, str] | None = None,
        stack: int = 0,
    ) -> None:
        """Signal that a player has started thinking."""
        self.current_progress.thinking = ThinkingState(
            player_name=player_name,
            seat=seat,
            start_time=time.time(),
            street=self.current_progress.hand_stats.street,
            hole_cards=hole_cards,
            stack=stack,
        )
        self.refresh()

    def end_thinking(self) -> float:
        """Signal that a player has finished thinking. Returns thinking time in ms."""
        thinking_time_ms = 0.0
        if self.current_progress.thinking:
            thinking_time_ms = (time.time() - self.current_progress.thinking.start_time) * 1000
            self.current_progress.thinking = None
        return thinking_time_ms

    def record_action(
        self,
        player_name: str,
        action: str,
        amount: int | None = None,
        thinking_time_ms: float = 0.0,
        forced: bool = False,
        retries: int = 0,
        hole_cards: tuple[str, str] | None = None,
    ) -> None:
        """Record an action for the play-by-play display."""
        action_record = ActionRecord(
            player_name=player_name,
            action=action,
            amount=amount,
            thinking_time_ms=thinking_time_ms,
            forced=forced,
            retries=retries,
            street=self.current_progress.hand_stats.street,
            hole_cards=hole_cards,
        )
        self.current_progress.hand_stats.actions.append(action_record)
        self.current_progress.thinking = None  # Clear thinking state
        self.refresh()

    def update_action(self, player_name: str, action: str, amount: int | None = None) -> None:
        """Legacy method - update the current action being taken."""
        # This is now handled by record_action, kept for compatibility
        pass

    def record_elimination(self, player_name: str, hand_number: int) -> None:
        """Record a player elimination."""
        self.current_progress.eliminations.append((player_name, hand_number))
        self.current_progress.players_remaining -= 1
        self.refresh()

    def update_pot(self, pot_size: int) -> None:
        """Update the pot size."""
        self.current_progress.hand_stats.pot_size = pot_size
        self.refresh()

    def update_street(self, street: str) -> None:
        """Update the current street."""
        self.current_progress.hand_stats.street = street
        self.refresh()

    def update_community_cards(self, cards: list[str]) -> None:
        """Update the community cards (board)."""
        self.current_progress.hand_stats.community_cards = cards
        self.refresh()


def create_file_handler(log_dir: Path, level: int = 10) -> logging.FileHandler:
    """Create a file handler for detailed logs.

    Args:
        log_dir: Directory for log files.
        level: Logging level (default DEBUG=10).

    Returns:
        Configured FileHandler.
    """
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "benchmark.log"

    handler = logging.FileHandler(log_file, mode="w")
    handler.setLevel(level)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    return handler
