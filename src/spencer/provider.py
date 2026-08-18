from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from importlib import metadata
from typing import Any, Callable, cast

from .backends import (
    BUILTIN_BACKENDS,
    Backend,
    ProviderResponse,
)
from .config import Settings

LOGGER = logging.getLogger("spencer.provider")


class ProviderError(RuntimeError):
    """Raised when Spencer cannot complete a provider request."""


class RetryableProviderError(ProviderError):
    """Raised for provider failures that are safe to retry."""


Transport = Callable[[urllib.request.Request, int], dict[str, Any]]
BackendFactory = Callable[[Settings], Backend]


_BACKEND_REGISTRY: dict[str, BackendFactory] = {
    name: cast(BackendFactory, factory) for name, factory in BUILTIN_BACKENDS.items()
}
_PLUGINS_LOADED = False


def register_backend(name: str, factory: BackendFactory) -> None:
    """Register a custom backend for the current process."""
    if not name or not name.strip():
        raise ValueError("Backend name cannot be empty")
    _BACKEND_REGISTRY[name.strip()] = factory


def available_backends() -> list[str]:
    _load_entry_point_backends()
    return sorted(_BACKEND_REGISTRY)


def _load_entry_point_backends() -> None:
    global _PLUGINS_LOADED
    if _PLUGINS_LOADED:
        return
    _PLUGINS_LOADED = True
    try:
        entry_points: Any = metadata.entry_points()
        if hasattr(entry_points, "select"):
            entry_points = entry_points.select(group="spencer.backends")
        else:
            entry_points = entry_points.get("spencer.backends", [])
        for entry_point in entry_points:
            try:
                factory = entry_point.load()
                register_backend(entry_point.name, factory)
            except Exception as exc:
                LOGGER.warning("Unable to load Spencer backend %s: %s", entry_point.name, exc)
    except Exception as exc:
        LOGGER.debug("Backend entry-point discovery unavailable: %s", exc)


def backend_for(settings: Settings) -> Backend:
    _load_entry_point_backends()
    factory = _BACKEND_REGISTRY.get(settings.protocol)
    if factory is None:
        available = ", ".join(available_backends())
        raise ProviderError(
            f"Unknown provider protocol '{settings.protocol}'. Available backends: {available}"
        )
    return factory(settings)


class HTTPProvider:
    """Provider-neutral HTTP client with pluggable protocol backends."""

    def __init__(
        self,
        settings: Settings,
        *,
        transport: Transport | None = None,
        backend: Backend | None = None,
        retries: int = 2,
    ):
        self.settings = settings
        self.retries = max(0, retries)
        self.transport = transport or self._request_json
        self.backend = backend or backend_for(settings)

    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> ProviderResponse:
        if not self.settings.api_url:
            raise ProviderError(
                "No API URL configured. Set SPENCER_API_URL or configure api_url in .spencer.toml."
            )
        payload = self.backend.build_payload(model=model, messages=messages, tools=tools)
        headers = {"Content-Type": "application/json", **self.settings.headers}
        if self.settings.api_key and self.settings.api_key_header not in headers:
            value = self.settings.api_key
            if self.settings.api_key_prefix:
                value = f"{self.settings.api_key_prefix} {value}"
            headers[self.settings.api_key_header] = value
        request = urllib.request.Request(
            self.settings.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                started = time.monotonic()
                raw = self.transport(request, self.settings.api_timeout)
                response = self.backend.normalize_response(raw)
                LOGGER.debug("provider request succeeded in %.2fs", time.monotonic() - started)
                return response
            except Exception as exc:
                last_error = exc
                retryable = isinstance(
                    exc, (RetryableProviderError, urllib.error.URLError, TimeoutError)
                )
                if not retryable or attempt >= self.retries:
                    break
                delay = 2**attempt
                LOGGER.warning(
                    "provider request failed (%s); retrying in %ss", type(exc).__name__, delay
                )
                time.sleep(delay)
        raise ProviderError(
            f"Provider request failed after {self.retries + 1} attempts: {last_error}"
        ) from last_error

    @staticmethod
    def _request_json(request: urllib.request.Request, timeout: int) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:1_000]
            error_type = (
                RetryableProviderError if exc.code == 429 or exc.code >= 500 else ProviderError
            )
            raise error_type(f"HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RetryableProviderError(f"Network error: {exc.reason}") from exc
        try:
            value = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProviderError("Provider returned a non-JSON response") from exc
        if not isinstance(value, dict):
            raise ProviderError("Provider response must be a JSON object")
        return value


# Backwards-compatible name for integrations that imported the prototype class.
ChatProvider = HTTPProvider
