"""Configuration loading and validation using Pydantic."""

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator


class BlindLevelConfig(BaseModel):
    """Configuration for a single blind level."""

    hands: int | None = None  # None means infinite (final level)
    sb: int
    bb: int


class TournamentConfig(BaseModel):
    """Tournament configuration."""

    num_runs: int = Field(default=10, ge=1, description="Number of tournament runs")
    seats: int = Field(default=6, ge=2, le=8, description="Number of players")
    starting_stack: int = Field(default=200, ge=1, description="Starting chips per player")
    blind_schedule: list[BlindLevelConfig] = Field(
        default_factory=lambda: [
            BlindLevelConfig(hands=20, sb=1, bb=2),
            BlindLevelConfig(hands=20, sb=2, bb=4),
            BlindLevelConfig(hands=20, sb=4, bb=8),
            BlindLevelConfig(hands=20, sb=8, bb=16),
            BlindLevelConfig(hands=20, sb=16, bb=32),
            BlindLevelConfig(hands=None, sb=32, bb=64),
        ]
    )
    seed_base: int = Field(default=42, description="Base seed for tournaments")

    @field_validator("blind_schedule")
    @classmethod
    def validate_blind_schedule(cls, v: list[BlindLevelConfig]) -> list[BlindLevelConfig]:
        if not v:
            raise ValueError("Blind schedule cannot be empty")
        if v[-1].hands is not None:
            raise ValueError("Last blind level must have hands=None (infinite)")
        return v


class ReasoningConfig(BaseModel):
    """Configuration for model reasoning/thinking."""

    enabled: bool = Field(default=False, description="Enable reasoning for supported models")
    effort: str | None = Field(
        default=None,
        description="Reasoning effort level: 'low', 'medium', 'high', 'xhigh' (model-dependent)"
    )
    max_tokens: int | None = Field(
        default=None,
        ge=1,
        description="Maximum tokens for reasoning output"
    )
    include_reasoning: bool = Field(
        default=False,
        description="Include reasoning content in response"
    )
    preserve_blocks: bool = Field(
        default=True,
        description="Preserve reasoning_details blocks for multi-turn (required for Gemini)"
    )


class ProviderConfig(BaseModel):
    """Configuration for OpenRouter provider preferences.
    
    See: https://openrouter.ai/docs/api-reference/parameters
    """

    order: list[str] | None = Field(
        default=None,
        description="Ordered list of provider names to prefer (e.g., ['anthropic', 'openai', 'together'])"
    )
    allow_fallbacks: bool | None = Field(
        default=None,
        description="Allow fallback to other providers if preferred ones fail"
    )
    require_parameters: bool | None = Field(
        default=None,
        description="Require all parameters to be supported by provider"
    )
    data_collection: str | None = Field(
        default=None,
        description="Data collection preference: 'allow' or 'deny'"
    )
    only: list[str] | None = Field(
        default=None,
        description="Only use these providers (exclusive list)"
    )
    ignore: list[str] | None = Field(
        default=None,
        description="Never use these providers"
    )
    quantizations: list[str] | None = Field(
        default=None,
        description="Allowed quantization levels (e.g., ['bf16', 'fp8'])"
    )


class AgentConfig(BaseModel):
    """Configuration for a single agent."""

    name: str
    model: str = Field(default="openrouter/openai/gpt-4o")
    reasoning: ReasoningConfig | None = Field(
        default=None,
        description="Per-agent reasoning config (overrides global)"
    )
    provider: ProviderConfig | None = Field(
        default=None,
        description="OpenRouter provider preferences for this agent"
    )


class AgentSettingsConfig(BaseModel):
    """Global settings for agents."""

    max_retries: int = Field(default=3, ge=1, description="Max retries for invalid actions")
    retry_on_invalid: bool = Field(default=True)
    reasoning: ReasoningConfig | None = Field(
        default=None,
        description="Default reasoning config (fallback if agent doesn't specify)"
    )


class OutputConfig(BaseModel):
    """Output configuration."""

    log_dir: str = Field(default="./logs")
    verbose: bool = Field(default=True)


class BenchmarkConfig(BaseModel):
    """Complete benchmark configuration."""

    tournament: TournamentConfig = Field(default_factory=TournamentConfig)
    agents: list[AgentConfig] = Field(default_factory=list)
    agent_settings: AgentSettingsConfig = Field(default_factory=AgentSettingsConfig)
    output: OutputConfig = Field(default_factory=OutputConfig)

    @field_validator("agents")
    @classmethod
    def validate_agents(cls, v: list[AgentConfig], info) -> list[AgentConfig]:
        # Allow empty agents list for validation, but will fail at runtime
        return v

    def validate_agent_count(self) -> None:
        """Validate that agent count matches tournament seats."""
        if len(self.agents) != self.tournament.seats:
            raise ValueError(
                f"Number of agents ({len(self.agents)}) must match "
                f"tournament seats ({self.tournament.seats})"
            )


def load_config(config_path: Path | str) -> BenchmarkConfig:
    """Load configuration from a JSON file.

    Args:
        config_path: Path to the config.json file.

    Returns:
        Validated BenchmarkConfig object.

    Raises:
        FileNotFoundError: If config file doesn't exist.
        ValueError: If configuration is invalid.
    """
    config_path = Path(config_path)

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path) as f:
        data = json.load(f)

    config = BenchmarkConfig.model_validate(data)
    config.validate_agent_count()

    return config


def get_blind_schedule_config(config: BenchmarkConfig) -> list[dict[str, Any]]:
    """Convert blind schedule config to format expected by BlindSchedule.

    Args:
        config: The benchmark configuration.

    Returns:
        List of dicts with 'hands', 'sb', 'bb' keys.
    """
    return [
        {"hands": level.hands, "sb": level.sb, "bb": level.bb}
        for level in config.tournament.blind_schedule
    ]
