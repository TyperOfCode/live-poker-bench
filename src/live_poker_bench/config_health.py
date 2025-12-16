"""Health check for benchmark configuration and agent connectivity."""

import os
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


class HealthStatus(Enum):
    """Health check status."""
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"
    SKIP = "skip"


@dataclass
class CheckResult:
    """Result of a single health check."""
    name: str
    status: HealthStatus
    message: str
    details: dict[str, Any] = field(default_factory=dict)
    duration_ms: float = 0.0


@dataclass
class HealthReport:
    """Complete health report."""
    results: list[CheckResult] = field(default_factory=list)
    overall_status: HealthStatus = HealthStatus.PASS

    def add(self, result: CheckResult) -> None:
        """Add a check result and update overall status."""
        self.results.append(result)
        if result.status == HealthStatus.FAIL:
            self.overall_status = HealthStatus.FAIL
        elif result.status == HealthStatus.WARN and self.overall_status == HealthStatus.PASS:
            self.overall_status = HealthStatus.WARN

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.status == HealthStatus.PASS)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == HealthStatus.FAIL)

    @property
    def warnings(self) -> int:
        return sum(1 for r in self.results if r.status == HealthStatus.WARN)


class HealthChecker:
    """Runs health checks on the benchmark configuration."""

    # ANSI color codes
    COLORS = {
        HealthStatus.PASS: "\033[92m",  # Green
        HealthStatus.FAIL: "\033[91m",  # Red
        HealthStatus.WARN: "\033[93m",  # Yellow
        HealthStatus.SKIP: "\033[90m",  # Gray
    }
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    def __init__(self, config_path: Path | str = "config.json", verbose: bool = True):
        """Initialize the health checker.

        Args:
            config_path: Path to configuration file.
            verbose: Whether to print detailed output.
        """
        self.config_path = Path(config_path)
        self.verbose = verbose
        self.report = HealthReport()
        self.config = None

    def _status_icon(self, status: HealthStatus) -> str:
        """Get status icon."""
        icons = {
            HealthStatus.PASS: "✓",
            HealthStatus.FAIL: "✗",
            HealthStatus.WARN: "⚠",
            HealthStatus.SKIP: "○",
        }
        return icons.get(status, "?")

    def _print_result(self, result: CheckResult) -> None:
        """Print a single check result."""
        if not self.verbose:
            return

        color = self.COLORS.get(result.status, "")
        icon = self._status_icon(result.status)
        status_text = result.status.value.upper()

        print(f"  {color}{icon}{self.RESET} {result.name}: {color}{status_text}{self.RESET}")
        if result.message:
            print(f"    {self.DIM}{result.message}{self.RESET}")
        if result.duration_ms > 0:
            print(f"    {self.DIM}({result.duration_ms:.0f}ms){self.RESET}")

    def _print_header(self, title: str) -> None:
        """Print a section header."""
        if self.verbose:
            print(f"\n{self.BOLD}━━━ {title} ━━━{self.RESET}")

    def check_config_file(self) -> CheckResult:
        """Check that config file exists and is valid JSON."""
        start = time.time()
        try:
            if not self.config_path.exists():
                return CheckResult(
                    name="Config File",
                    status=HealthStatus.FAIL,
                    message=f"Config file not found: {self.config_path}",
                    duration_ms=(time.time() - start) * 1000,
                )

            import json
            with open(self.config_path) as f:
                json.load(f)

            return CheckResult(
                name="Config File",
                status=HealthStatus.PASS,
                message=f"Found at {self.config_path}",
                duration_ms=(time.time() - start) * 1000,
            )
        except json.JSONDecodeError as e:
            return CheckResult(
                name="Config File",
                status=HealthStatus.FAIL,
                message=f"Invalid JSON: {e}",
                duration_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return CheckResult(
                name="Config File",
                status=HealthStatus.FAIL,
                message=str(e),
                duration_ms=(time.time() - start) * 1000,
            )

    def check_config_schema(self) -> CheckResult:
        """Validate config against Pydantic schema."""
        start = time.time()
        try:
            from live_poker_bench.config import load_config
            self.config = load_config(self.config_path)

            return CheckResult(
                name="Config Schema",
                status=HealthStatus.PASS,
                message=f"{len(self.config.agents)} agents, {self.config.tournament.seats} seats",
                duration_ms=(time.time() - start) * 1000,
            )
        except ValueError as e:
            return CheckResult(
                name="Config Schema",
                status=HealthStatus.FAIL,
                message=str(e),
                duration_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return CheckResult(
                name="Config Schema",
                status=HealthStatus.FAIL,
                message=str(e),
                duration_ms=(time.time() - start) * 1000,
            )

    def check_api_key(self) -> CheckResult:
        """Check that OPENROUTER_API_KEY is set."""
        start = time.time()
        load_dotenv()

        api_key = os.getenv("OPENROUTER_API_KEY")

        if not api_key:
            return CheckResult(
                name="API Key",
                status=HealthStatus.FAIL,
                message="OPENROUTER_API_KEY not found in environment",
                duration_ms=(time.time() - start) * 1000,
            )

        # Mask key for display
        masked = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else "***"

        return CheckResult(
            name="API Key",
            status=HealthStatus.PASS,
            message=f"Found: {masked}",
            duration_ms=(time.time() - start) * 1000,
        )

    def check_dependencies(self) -> CheckResult:
        """Check that required packages are installed."""
        start = time.time()
        missing = []
        installed = []

        packages = [
            ("litellm", "litellm"),
            ("pydantic", "pydantic"),
            ("dotenv", "python-dotenv"),
        ]

        for import_name, pip_name in packages:
            try:
                __import__(import_name)
                installed.append(pip_name)
            except ImportError:
                missing.append(pip_name)

        if missing:
            return CheckResult(
                name="Dependencies",
                status=HealthStatus.FAIL,
                message=f"Missing: {', '.join(missing)}",
                details={"missing": missing, "installed": installed},
                duration_ms=(time.time() - start) * 1000,
            )

        return CheckResult(
            name="Dependencies",
            status=HealthStatus.PASS,
            message=f"All {len(installed)} required packages found",
            duration_ms=(time.time() - start) * 1000,
        )

    def check_agent_connectivity(
        self,
        agent_name: str,
        model: str,
        reasoning_enabled: bool = False,
        provider_config: dict[str, Any] | None = None,
    ) -> CheckResult:
        """Test connectivity to a single agent's model.

        Args:
            agent_name: Display name of the agent.
            model: Model identifier (e.g., "openrouter/openai/gpt-4o").
            reasoning_enabled: Whether reasoning is enabled for this agent.
            provider_config: Optional provider preferences dict.

        Returns:
            CheckResult with connectivity status.
        """
        start = time.time()

        try:
            from live_poker_bench.llm.adapter import (
                LLMAdapter,
                LLMConfig,
                ProviderSettings,
                ReasoningSettings,
            )

            # Create adapter with appropriate config
            # For thinking models, we need to pass reasoning settings
            reasoning = ReasoningSettings(
                enabled=reasoning_enabled,
                include_reasoning=reasoning_enabled,
            ) if reasoning_enabled else ReasoningSettings()

            # Build provider settings if provided
            provider = None
            if provider_config:
                provider = ProviderSettings(
                    order=provider_config.get("order"),
                    allow_fallbacks=provider_config.get("allow_fallbacks"),
                    require_parameters=provider_config.get("require_parameters"),
                    data_collection=provider_config.get("data_collection"),
                    only=provider_config.get("only"),
                    ignore=provider_config.get("ignore"),
                    quantizations=provider_config.get("quantizations"),
                )

            config = LLMConfig(
                model=model,
                max_tokens=100,  # Slightly higher for reasoning models
                max_retries=1,
                retry_delay=0.5,
                reasoning=reasoning,
                provider=provider,
            )
            adapter = LLMAdapter(config)

            # Simple test prompt
            test_messages = [
                {"role": "user", "content": "Reply with exactly: HEALTH_CHECK_OK"}
            ]

            response = adapter.call(test_messages)
            duration_ms = (time.time() - start) * 1000

            # Check both content and reasoning_content for thinking models
            response_text = response.content or response.reasoning_content

            if response_text:
                preview = response_text[:50] + "..." if len(response_text) > 50 else response_text
                # Note if response was in reasoning_content
                content_type = "reasoning" if not response.content and response.reasoning_content else "content"
                
                # Build message with provider info if available
                msg = f"Model {model} responding"
                if response.provider_name:
                    msg += f" (served by {response.provider_name})"
                
                details: dict[str, Any] = {
                    "model": model,
                    "tokens": response.usage.get("total_tokens", 0),
                    "response_preview": preview,
                    "content_type": content_type,
                }
                if response.provider_name:
                    details["served_by"] = response.provider_name
                if provider_config:
                    details["provider_config"] = provider_config
                
                # Check if provider preference was honored (if specified)
                status = HealthStatus.PASS
                if provider_config and response.provider_name:
                    requested = provider_config.get("order") or provider_config.get("only") or []
                    if requested and response.provider_name.lower() not in [p.lower() for p in requested]:
                        status = HealthStatus.WARN
                        msg += f" (requested: {requested})"
                
                return CheckResult(
                    name=f"Agent: {agent_name}",
                    status=status,
                    message=msg,
                    details=details,
                    duration_ms=duration_ms,
                )
            else:
                return CheckResult(
                    name=f"Agent: {agent_name}",
                    status=HealthStatus.WARN,
                    message=f"Empty response from {model}",
                    details={"model": model, "raw_content": response.content, "raw_reasoning": response.reasoning_content},
                    duration_ms=duration_ms,
                )

        except Exception as e:
            return CheckResult(
                name=f"Agent: {agent_name}",
                status=HealthStatus.FAIL,
                message=f"Failed: {str(e)[:100]}",
                details={"model": model, "error": str(e)},
                duration_ms=(time.time() - start) * 1000,
            )

    def check_log_directory(self) -> CheckResult:
        """Check that log directory is writable."""
        start = time.time()

        if self.config is None:
            return CheckResult(
                name="Log Directory",
                status=HealthStatus.SKIP,
                message="Config not loaded",
                duration_ms=(time.time() - start) * 1000,
            )

        log_dir = Path(self.config.output.log_dir)

        try:
            # Try to create directory and write a test file
            log_dir.mkdir(parents=True, exist_ok=True)
            test_file = log_dir / ".health_check_test"
            test_file.write_text("test")
            test_file.unlink()

            return CheckResult(
                name="Log Directory",
                status=HealthStatus.PASS,
                message=f"Writable: {log_dir}",
                duration_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return CheckResult(
                name="Log Directory",
                status=HealthStatus.FAIL,
                message=f"Cannot write to {log_dir}: {e}",
                duration_ms=(time.time() - start) * 1000,
            )

    def check_blind_schedule(self) -> CheckResult:
        """Validate blind schedule configuration."""
        start = time.time()

        if self.config is None:
            return CheckResult(
                name="Blind Schedule",
                status=HealthStatus.SKIP,
                message="Config not loaded",
                duration_ms=(time.time() - start) * 1000,
            )

        schedule = self.config.tournament.blind_schedule
        issues = []

        # Check for increasing blinds
        prev_bb = 0
        for i, level in enumerate(schedule):
            if level.bb <= prev_bb:
                issues.append(f"Level {i+1} BB ({level.bb}) not greater than previous ({prev_bb})")
            prev_bb = level.bb

        # Check last level has infinite hands
        if schedule[-1].hands is not None:
            issues.append("Last level must have hands=null (infinite)")

        if issues:
            return CheckResult(
                name="Blind Schedule",
                status=HealthStatus.WARN,
                message="; ".join(issues),
                duration_ms=(time.time() - start) * 1000,
            )

        total_hands = sum(l.hands or 0 for l in schedule[:-1])
        return CheckResult(
            name="Blind Schedule",
            status=HealthStatus.PASS,
            message=f"{len(schedule)} levels, {total_hands}+ hands before final level",
            duration_ms=(time.time() - start) * 1000,
        )

    def check_reasoning_config(self) -> CheckResult:
        """Validate reasoning configuration for agents.

        Checks:
        - Valid effort levels
        - Gemini models require preserve_blocks=true for multi-turn
        - Warns about models that may not support reasoning
        """
        start = time.time()

        if self.config is None:
            return CheckResult(
                name="Reasoning Config",
                status=HealthStatus.SKIP,
                message="Config not loaded",
                duration_ms=(time.time() - start) * 1000,
            )

        issues = []
        warnings = []
        agents_with_reasoning = 0
        valid_efforts = {"low", "medium", "high", "xhigh", None}

        # Models that require preserve_blocks for multi-turn reasoning
        # See: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#preserving-reasoning-blocks
        gemini_patterns = ["google/gemini", "gemini-"]

        for agent in self.config.agents:
            reasoning = agent.reasoning
            if reasoning is None:
                continue

            if reasoning.enabled:
                agents_with_reasoning += 1

                # Check effort level is valid
                if reasoning.effort not in valid_efforts:
                    issues.append(
                        f"{agent.name}: invalid effort '{reasoning.effort}' "
                        f"(valid: low, medium, high, xhigh)"
                    )

                # Check Gemini models have preserve_blocks enabled
                model_lower = agent.model.lower()
                is_gemini = any(pattern in model_lower for pattern in gemini_patterns)
                if is_gemini and not reasoning.preserve_blocks:
                    warnings.append(
                        f"{agent.name}: Gemini models require preserve_blocks=true for multi-turn reasoning"
                    )

        if issues:
            return CheckResult(
                name="Reasoning Config",
                status=HealthStatus.FAIL,
                message="; ".join(issues),
                duration_ms=(time.time() - start) * 1000,
            )

        if warnings:
            return CheckResult(
                name="Reasoning Config",
                status=HealthStatus.WARN,
                message="; ".join(warnings),
                duration_ms=(time.time() - start) * 1000,
            )

        if agents_with_reasoning == 0:
            return CheckResult(
                name="Reasoning Config",
                status=HealthStatus.PASS,
                message="No agents have reasoning enabled",
                duration_ms=(time.time() - start) * 1000,
            )

        return CheckResult(
            name="Reasoning Config",
            status=HealthStatus.PASS,
            message=f"{agents_with_reasoning} agent(s) with reasoning enabled",
            duration_ms=(time.time() - start) * 1000,
        )

    def check_provider_config(self) -> CheckResult:
        """Validate provider configuration for agents.

        Checks:
        - Valid provider names
        - Conflicting settings (order + only)
        - Data collection values
        """
        start = time.time()

        if self.config is None:
            return CheckResult(
                name="Provider Config",
                status=HealthStatus.SKIP,
                message="Config not loaded",
                duration_ms=(time.time() - start) * 1000,
            )

        issues = []
        warnings = []
        agents_with_provider = 0

        # Known OpenRouter provider names (lowercase for comparison)
        known_providers = {
            "openai", "anthropic", "google", "google-vertex", "together",
            "deepinfra", "groq", "fireworks", "lepton", "mancer", "novita",
            "mistral", "perplexity", "replicate", "aws-bedrock", "azure",
            "cohere", "ai21", "anyscale", "cloudflare", "deepseek", "hyperbolic",
            "infermatic", "lambda", "lynn", "neversleep", "parasail", "featherless",
        }

        valid_data_collection = {"allow", "deny"}

        for agent in self.config.agents:
            provider = agent.provider
            if provider is None:
                continue

            agents_with_provider += 1

            # Check for conflicting settings
            if provider.order and provider.only:
                warnings.append(
                    f"{agent.name}: both 'order' and 'only' specified - 'only' takes precedence"
                )

            # Validate data_collection value
            if provider.data_collection and provider.data_collection not in valid_data_collection:
                issues.append(
                    f"{agent.name}: invalid data_collection '{provider.data_collection}' "
                    f"(valid: allow, deny)"
                )

            # Check provider names (warn if unknown, might just be new)
            all_providers = (provider.order or []) + (provider.only or []) + (provider.ignore or [])
            for p in all_providers:
                if p.lower() not in known_providers:
                    warnings.append(
                        f"{agent.name}: unknown provider '{p}' (may be valid, just not in known list)"
                    )

        if issues:
            return CheckResult(
                name="Provider Config",
                status=HealthStatus.FAIL,
                message="; ".join(issues),
                duration_ms=(time.time() - start) * 1000,
            )

        if warnings:
            return CheckResult(
                name="Provider Config",
                status=HealthStatus.WARN,
                message="; ".join(warnings[:2]),  # Limit to first 2 warnings
                details={"all_warnings": warnings},
                duration_ms=(time.time() - start) * 1000,
            )

        if agents_with_provider == 0:
            return CheckResult(
                name="Provider Config",
                status=HealthStatus.PASS,
                message="No agents have provider preferences configured",
                duration_ms=(time.time() - start) * 1000,
            )

        return CheckResult(
            name="Provider Config",
            status=HealthStatus.PASS,
            message=f"{agents_with_provider} agent(s) with provider preferences",
            duration_ms=(time.time() - start) * 1000,
        )

    def run_all(self, skip_connectivity: bool = False) -> HealthReport:
        """Run all health checks.

        Args:
            skip_connectivity: Skip slow connectivity tests.

        Returns:
            Complete health report.
        """
        self.report = HealthReport()

        # Section: Configuration
        self._print_header("Configuration")

        result = self.check_config_file()
        self.report.add(result)
        self._print_result(result)

        if result.status == HealthStatus.FAIL:
            # Can't continue without config file
            return self.report

        result = self.check_config_schema()
        self.report.add(result)
        self._print_result(result)

        if result.status == HealthStatus.FAIL:
            # Can't continue without valid config
            return self.report

        result = self.check_blind_schedule()
        self.report.add(result)
        self._print_result(result)

        result = self.check_reasoning_config()
        self.report.add(result)
        self._print_result(result)

        result = self.check_provider_config()
        self.report.add(result)
        self._print_result(result)

        result = self.check_log_directory()
        self.report.add(result)
        self._print_result(result)

        # Section: Environment
        self._print_header("Environment")

        result = self.check_dependencies()
        self.report.add(result)
        self._print_result(result)

        result = self.check_api_key()
        self.report.add(result)
        self._print_result(result)

        # Section: Agent Connectivity
        if not skip_connectivity and self.config and result.status == HealthStatus.PASS:
            self._print_header("Agent Connectivity")

            if self.verbose:
                print(f"  {self.DIM}Testing {len(self.config.agents)} agents (this may take a moment)...{self.RESET}")

            for agent in self.config.agents:
                # Pass reasoning_enabled to help with thinking models
                reasoning_enabled = (
                    agent.reasoning is not None and agent.reasoning.enabled
                )
                # Pass provider config if specified
                provider_config = None
                if agent.provider is not None:
                    provider_config = agent.provider.model_dump(exclude_none=True)
                result = self.check_agent_connectivity(
                    agent.name,
                    agent.model,
                    reasoning_enabled=reasoning_enabled,
                    provider_config=provider_config,
                )
                self.report.add(result)
                self._print_result(result)
        elif skip_connectivity:
            self._print_header("Agent Connectivity")
            if self.verbose:
                print(f"  {self.DIM}Skipped (use --full to test connectivity){self.RESET}")

        return self.report

    def print_summary(self) -> None:
        """Print a summary of the health check."""
        if not self.verbose:
            return

        print(f"\n{self.BOLD}━━━ Summary ━━━{self.RESET}")

        color = self.COLORS.get(self.report.overall_status, "")
        status_text = self.report.overall_status.value.upper()

        print(f"  Overall: {color}{self.BOLD}{status_text}{self.RESET}")
        print(f"  {self.COLORS[HealthStatus.PASS]}✓{self.RESET} Passed: {self.report.passed}")
        if self.report.warnings > 0:
            print(f"  {self.COLORS[HealthStatus.WARN]}⚠{self.RESET} Warnings: {self.report.warnings}")
        if self.report.failed > 0:
            print(f"  {self.COLORS[HealthStatus.FAIL]}✗{self.RESET} Failed: {self.report.failed}")

        print()


def run_health_check(
    config_path: Path | str = "config.json",
    verbose: bool = True,
    full: bool = False,
) -> bool:
    """Run health checks and return success status.

    Args:
        config_path: Path to configuration file.
        verbose: Whether to print detailed output.
        full: Run full checks including slow connectivity tests.

    Returns:
        True if all checks passed, False otherwise.
    """
    if verbose:
        print(f"\n{'━' * 40}")
        print("  🏥 LivePokerBench Health Check")
        print(f"{'━' * 40}")

    checker = HealthChecker(config_path, verbose=verbose)
    report = checker.run_all(skip_connectivity=not full)
    checker.print_summary()

    return report.overall_status != HealthStatus.FAIL


def main() -> None:
    """CLI entry point for health check."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Check LivePokerBench configuration health"
    )
    parser.add_argument(
        "--config", "-c",
        type=str,
        default="config.json",
        help="Path to configuration file (default: config.json)",
    )
    parser.add_argument(
        "--full", "-f",
        action="store_true",
        help="Run full checks including agent connectivity tests",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress output, only return exit code",
    )

    args = parser.parse_args()

    success = run_health_check(
        config_path=args.config,
        verbose=not args.quiet,
        full=args.full,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

