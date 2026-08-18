from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol

from .config import Settings


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


class Backend(Protocol):
    """Protocol implemented by every provider backend."""

    def build_payload(
        self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]: ...

    def normalize_response(self, data: dict[str, Any]) -> ProviderResponse: ...


class GenericJSONBackend:
    """Default backend for custom JSON APIs with configurable response paths."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def build_payload(
        self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        return {
            **self.settings.request_fields,
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        }

    def normalize_response(self, data: dict[str, Any]) -> ProviderResponse:
        content = _value_at_path(data, self.settings.content_path)
        if content is not None and not isinstance(content, str):
            content = str(content)
        raw_tool_calls = _value_at_path(data, self.settings.tool_calls_path, [])
        if not isinstance(raw_tool_calls, list):
            raw_tool_calls = []
        tool_calls = [
            _tool_call_from_mapping(item, index) for index, item in enumerate(raw_tool_calls)
        ]
        if not content and not tool_calls and "error" in data:
            raise ValueError(f"Provider returned an error: {data['error']}")
        return ProviderResponse([ProviderChoice(ProviderMessage(content, tool_calls))])


class OpenAICompatibleBackend(GenericJSONBackend):
    """Compatibility backend for the common chat-completions tool format."""


class AnthropicMessagesBackend:
    """Backend for Anthropic-style Messages content blocks and tool use."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def build_payload(
        self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        system = "\n\n".join(
            str(message["content"]) for message in messages if message.get("role") == "system"
        )
        converted: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role")
            if role == "system":
                continue
            if role == "tool":
                converted.append(
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
                blocks: list[dict[str, Any]] = []
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
                converted.append({"role": "assistant", "content": blocks})
            else:
                converted.append(
                    {
                        "role": "user" if role == "user" else "assistant",
                        "content": message.get("content", ""),
                    }
                )
        return {
            **self.settings.request_fields,
            "model": model,
            "system": system,
            "messages": converted,
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

    def normalize_response(self, data: dict[str, Any]) -> ProviderResponse:
        content_parts = data.get("content", [])
        text_parts = [part.get("text", "") for part in content_parts if part.get("type") == "text"]
        tool_calls: list[ProviderToolCall] = []
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
        return ProviderResponse(
            [ProviderChoice(ProviderMessage("\n".join(text_parts) or None, tool_calls))]
        )


class OllamaChatBackend:
    """Backend for Ollama's local chat endpoint."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def build_payload(
        self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        return {
            **self.settings.request_fields,
            "model": model,
            "messages": messages,
            "tools": tools,
            "stream": False,
        }

    def normalize_response(self, data: dict[str, Any]) -> ProviderResponse:
        message = data.get("message", {})
        return ProviderResponse([ProviderChoice(_message_from_mapping(message))])


BUILTIN_BACKENDS = {
    "generic-json": GenericJSONBackend,
    "openai-compatible": OpenAICompatibleBackend,
    "anthropic-messages": AnthropicMessagesBackend,
    "ollama-chat": OllamaChatBackend,
}


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


def _message_from_mapping(message: Any) -> ProviderMessage:
    if not isinstance(message, dict):
        return ProviderMessage(None, [])
    content = message.get("content")
    if content is not None and not isinstance(content, str):
        content = str(content)
    raw_tool_calls = message.get("tool_calls", [])
    if not isinstance(raw_tool_calls, list):
        raw_tool_calls = []
    return ProviderMessage(
        content, [_tool_call_from_mapping(item, index) for index, item in enumerate(raw_tool_calls)]
    )
