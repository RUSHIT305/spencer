from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

from .config import Settings


LOGGER = logging.getLogger("spencer.provider")


class ProviderError(RuntimeError):
    """Raised when Spencer cannot complete a provider request."""


class RetryableProviderError(ProviderError):
    """Raised for provider failures that are safe to retry."""


@dataclass(frozen=True)
class ProviderToolFunction:
    name: str
    arguments: str


@dataclass(frozen=True)
class ProviderToolCall:
    id: str
    function: ProviderToolFunction


@dataclass(frozen=True)
class ProviderMessage:
    content: str | None
    tool_calls: list[ProviderToolCall]


@dataclass(frozen=True)
class ProviderChoice:
    message: ProviderMessage


@dataclass(frozen=True)
class ProviderResponse:
    choices: list[ProviderChoice]


Transport = Callable[[urllib.request.Request, int], dict[str, Any]]


class HTTPProvider:
    """Provider-neutral HTTP client with configurable protocol normalization."""

    def __init__(self, settings: Settings, *, transport: Transport | None = None, retries: int = 2):
        self.settings = settings
        self.retries = max(0, retries)
        self.transport = transport or self._request_json

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
        payload = self._build_payload(model=model, messages=messages, tools=tools)
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
                response = self._normalize_response(raw)
                LOGGER.debug("provider request succeeded in %.2fs", time.monotonic() - started)
                return response
            except Exception as exc:
                last_error = exc
                retryable = isinstance(exc, (RetryableProviderError, urllib.error.URLError, TimeoutError))
                if not retryable or attempt >= self.retries:
                    break
                delay = 2**attempt
                LOGGER.warning("provider request failed (%s); retrying in %ss", type(exc).__name__, delay)
                time.sleep(delay)
        raise ProviderError(f"Provider request failed after {self.retries + 1} attempts: {last_error}") from last_error

    def _build_payload(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        protocol = self.settings.protocol
        if protocol == "anthropic-messages":
            system = "\n\n".join(
                str(message["content"])
                for message in messages
                if message.get("role") == "system"
            )
            anthropic_messages = []
            for message in messages:
                role = message.get("role")
                if role == "system":
                    continue
                if role == "tool":
                    anthropic_messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "tool_result",
                                    "tool_use_id": message.get("tool_call_id", "unknown"),
                                    "content": str(message.get("content", "")),
                                }
                            ],
                        }
                    )
                elif role == "assistant" and message.get("tool_calls"):
                    blocks = []
                    if message.get("content"):
                        blocks.append({"type": "text", "text": message["content"]})
                    for call in message["tool_calls"]:
                        function = call.get("function", {})
                        try:
                            tool_input = json.loads(function.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            tool_input = {}
                        blocks.append(
                            {
                                "type": "tool_use",
                                "id": call.get("id", "unknown"),
                                "name": function.get("name", ""),
                                "input": tool_input,
                            }
                        )
                    anthropic_messages.append({"role": "assistant", "content": blocks})
                else:
                    anthropic_messages.append({"role": "user" if role == "user" else "assistant", "content": message.get("content", "")})
            payload = {
                **self.settings.request_fields,
                "model": model,
                "system": system,
                "messages": anthropic_messages,
                "max_tokens": 4_500,
                "tools": [
                    {
                        "name": tool["function"]["name"],
                        "description": tool["function"].get("description", ""),
                        "input_schema": tool["function"].get("parameters", {}),
                    }
                    for tool in tools
                ],
            }
            return payload
        if protocol == "ollama-chat":
            return {**self.settings.request_fields, "model": model, "messages": messages, "tools": tools, "stream": False}
        return {
            **self.settings.request_fields,
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        }

    def _normalize_response(self, data: dict[str, Any]) -> ProviderResponse:
        if self.settings.protocol == "anthropic-messages":
            return self._normalize_anthropic(data)
        if self.settings.protocol == "ollama-chat":
            message = data.get("message", {})
            return ProviderResponse([ProviderChoice(self._message_from_mapping(message))])

        message_data = _value_at_path(data, self.settings.content_path.rsplit(".", 1)[0], {})
        if not isinstance(message_data, dict):
            message_data = {}
        content = _value_at_path(data, self.settings.content_path)
        if content is not None and not isinstance(content, str):
            content = str(content)
        raw_tool_calls = _value_at_path(data, self.settings.tool_calls_path, [])
        if not isinstance(raw_tool_calls, list):
            raw_tool_calls = []
        tool_calls = [self._tool_call_from_mapping(item, index) for index, item in enumerate(raw_tool_calls)]
        if not content and not tool_calls and "error" in data:
            raise ProviderError(f"Provider returned an error: {data['error']}")
        return ProviderResponse([ProviderChoice(ProviderMessage(content=content, tool_calls=tool_calls))])

    def _normalize_anthropic(self, data: dict[str, Any]) -> ProviderResponse:
        content_parts = data.get("content", [])
        text_parts = [part.get("text", "") for part in content_parts if part.get("type") == "text"]
        tool_calls = []
        for part in content_parts:
            if part.get("type") == "tool_use":
                tool_calls.append(
                    ProviderToolCall(
                        id=str(part.get("id", f"tool-{len(tool_calls)}")),
                        function=ProviderToolFunction(
                            name=str(part.get("name", "")),
                            arguments=json.dumps(part.get("input", {})),
                        ),
                    )
                )
        return ProviderResponse([ProviderChoice(ProviderMessage("\n".join(text_parts) or None, tool_calls))])

    def _message_from_mapping(self, message: Any) -> ProviderMessage:
        if not isinstance(message, dict):
            return ProviderMessage(None, [])
        content = message.get("content")
        if content is not None and not isinstance(content, str):
            content = str(content)
        raw_tool_calls = message.get("tool_calls", [])
        if not isinstance(raw_tool_calls, list):
            raw_tool_calls = []
        return ProviderMessage(
            content=content,
            tool_calls=[self._tool_call_from_mapping(item, index) for index, item in enumerate(raw_tool_calls)],
        )

    @staticmethod
    def _tool_call_from_mapping(item: Any, index: int) -> ProviderToolCall:
        if not isinstance(item, dict):
            return ProviderToolCall(f"tool-{index}", ProviderToolFunction("", "{}"))
        function = item.get("function", item)
        if not isinstance(function, dict):
            function = {}
        arguments = function.get("arguments", function.get("input", {}))
        if not isinstance(arguments, str):
            arguments = json.dumps(arguments)
        return ProviderToolCall(
            id=str(item.get("id", f"tool-{index}")),
            function=ProviderToolFunction(str(function.get("name", item.get("name", ""))), arguments),
        )

    @staticmethod
    def _request_json(request: urllib.request.Request, timeout: int) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:1_000]
            error_type = RetryableProviderError if exc.code == 429 or exc.code >= 500 else ProviderError
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


def _value_at_path(data: Any, path: str, default: Any = None) -> Any:
    current = data
    for component in path.split("."):
        if isinstance(current, list) and component.isdigit():
            index = int(component)
            if index >= len(current):
                return default
            current = current[index]
        elif isinstance(current, dict) and component in current:
            current = current[component]
        else:
            return default
    return current
