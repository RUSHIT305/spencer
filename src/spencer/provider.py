from __future__ import annotations

import logging
import time
from typing import Any

from openai import OpenAI

from .config import Settings


LOGGER = logging.getLogger("spencer.provider")


class ProviderError(RuntimeError):
    """Raised when Spencer cannot complete a model request."""


class ChatProvider:
    """Small OpenAI-compatible provider wrapper with bounded retries."""

    def __init__(self, settings: Settings, *, client: Any | None = None, retries: int = 2):
        self.settings = settings
        self.retries = max(0, retries)
        client_kwargs: dict[str, Any] = {}
        if settings.api_base:
            client_kwargs["base_url"] = settings.api_base
        if settings.api_key:
            client_kwargs["api_key"] = settings.api_key
        self.client = client or OpenAI(**client_kwargs)

    def complete(self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> Any:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        }
        model_lower = model.lower()
        if model_lower.startswith("gpt-5"):
            kwargs["max_completion_tokens"] = 4_000
        elif model_lower.startswith("claude"):
            kwargs["max_tokens"] = 4_500
            if model_lower.startswith("claude-sonnet-4-6") or model_lower.startswith("claude-opus-4-6"):
                kwargs["extra_body"] = {"thinking": {"type": "enabled", "budget_tokens": 2_048}}
        else:
            kwargs["max_tokens"] = 4_000

        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                started = time.monotonic()
                response = self.client.chat.completions.create(**kwargs)
                LOGGER.debug("provider request succeeded in %.2fs", time.monotonic() - started)
                return response
            except Exception as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
                delay = 2**attempt
                LOGGER.warning("provider request failed (%s); retrying in %ss", type(exc).__name__, delay)
                time.sleep(delay)
        raise ProviderError(f"Model request failed after {self.retries + 1} attempts: {last_error}") from last_error
