"""LLM adapter using litellm for unified model access."""

import os
import time
from dataclasses import dataclass, field
from typing import Any

import litellm
from dotenv import load_dotenv


@dataclass
class LLMResponse:
    """Response from an LLM call."""

    content: str | None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    model: str = ""
    latency_ms: float = 0.0
    raw_response: Any = None


@dataclass
class LLMConfig:
    """Configuration for LLM calls."""

    model: str
    temperature: float = 0.7
    max_tokens: int = 1024
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_multiplier: float = 2.0


class LLMAdapter:
    """Wrapper around litellm for unified LLM access via OpenRouter."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        """Initialize the LLM adapter.

        Args:
            config: LLM configuration. If None, uses defaults.
        """
        load_dotenv()

        self.api_key = os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment")

        self.config = config or LLMConfig(model="openrouter/openai/gpt-4o")

        # Configure litellm for OpenRouter
        litellm.drop_params = True  # Drop unsupported params silently

    def call(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Make an LLM call with retry logic.

        Args:
            messages: List of message dicts with role and content.
            tools: Optional list of tool definitions.
            model: Override model for this call.
            temperature: Override temperature for this call.
            max_tokens: Override max_tokens for this call.

        Returns:
            LLMResponse with content, tool calls, and usage stats.
        """
        model = model or self.config.model
        temperature = temperature if temperature is not None else self.config.temperature
        max_tokens = max_tokens or self.config.max_tokens

        last_error: Exception | None = None
        delay = self.config.retry_delay

        for attempt in range(self.config.max_retries):
            try:
                start_time = time.time()

                kwargs: dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "api_key": self.api_key,
                }

                if tools:
                    kwargs["tools"] = tools
                    kwargs["tool_choice"] = "auto"

                response = litellm.completion(**kwargs)
                latency_ms = (time.time() - start_time) * 1000

                # Extract response data
                choice = response.choices[0]
                message = choice.message

                # Extract tool calls if present
                tool_calls = []
                if hasattr(message, "tool_calls") and message.tool_calls:
                    for tc in message.tool_calls:
                        tool_calls.append({
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        })

                # Extract usage
                usage = {}
                if hasattr(response, "usage") and response.usage:
                    usage = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }

                return LLMResponse(
                    content=message.content,
                    tool_calls=tool_calls,
                    usage=usage,
                    model=model,
                    latency_ms=latency_ms,
                    raw_response=response,
                )

            except Exception as e:
                last_error = e
                if attempt < self.config.max_retries - 1:
                    time.sleep(delay)
                    delay *= self.config.retry_multiplier

        raise RuntimeError(f"LLM call failed after {self.config.max_retries} retries: {last_error}")

    def call_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_executor: callable,
        max_turns: int = 5,
        model: str | None = None,
    ) -> tuple[LLMResponse, list[dict[str, Any]]]:
        """Make LLM calls in a loop, executing tools until a final response.

        Args:
            messages: Initial messages.
            tools: Tool definitions.
            tool_executor: Function to execute tool calls, takes (name, args) returns result.
            max_turns: Maximum number of tool call turns.
            model: Override model for this call.

        Returns:
            Tuple of (final LLMResponse, list of all tool call records).
        """
        current_messages = messages.copy()
        all_tool_calls = []

        for _ in range(max_turns):
            response = self.call(current_messages, tools=tools, model=model)

            if not response.tool_calls:
                # No more tool calls, return final response
                return response, all_tool_calls

            # Execute each tool call
            tool_results = []
            for tc in response.tool_calls:
                func = tc["function"]
                name = func["name"]
                args_str = func["arguments"]

                # Parse arguments
                import json
                try:
                    args = json.loads(args_str) if args_str else {}
                except json.JSONDecodeError:
                    args = {}

                # Execute tool
                try:
                    result = tool_executor(name, args)
                    result_str = json.dumps(result)
                except Exception as e:
                    result_str = json.dumps({"error": str(e)})

                tool_results.append({
                    "tool_call_id": tc["id"],
                    "role": "tool",
                    "content": result_str,
                })

                all_tool_calls.append({
                    "tool_name": name,
                    "arguments": args,
                    "result": result_str,
                })

            # Add assistant message with tool calls
            current_messages.append({
                "role": "assistant",
                "content": response.content,
                "tool_calls": response.tool_calls,
            })

            # Add tool results
            current_messages.extend(tool_results)

        # Max turns reached, return last response
        return response, all_tool_calls
