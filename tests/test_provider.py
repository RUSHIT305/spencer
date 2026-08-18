import json
from pathlib import Path
from urllib.error import URLError

import pytest

from spencer.config import Settings
from spencer.provider import HTTPProvider, ProviderError


class FlakyTransport:
    def __init__(self, failures: int) -> None:
        self.failures = failures
        self.calls = 0
        self.last_request = None

    def __call__(self, request, _timeout):
        self.calls += 1
        self.last_request = request
        if self.calls <= self.failures:
            raise URLError("temporary provider failure")
        return {
            "choices": [
                {
                    "message": {
                        "content": "ok",
                        "tool_calls": [],
                    }
                }
            ]
        }


def test_provider_retries_and_normalizes_generic_json(tmp_path: Path) -> None:
    settings = Settings.from_values(
        tmp_path,
        protocol="generic-json",
        model="example-model",
        api_url="https://provider.example/chat",
        api_key="test-key",
        headers={"X-Workspace": "spencer"},
        request_fields={"provider_option": "value"},
    )
    transport = FlakyTransport(failures=1)
    provider = HTTPProvider(settings, transport=transport, retries=1)

    response = provider.complete(model=settings.model, messages=[], tools=[])

    assert response.choices[0].message.content == "ok"
    assert transport.calls == 2
    assert transport.last_request.headers["Authorization"] == "Bearer test-key"
    assert transport.last_request.headers["X-workspace"] == "spencer"
    payload = json.loads(transport.last_request.data)
    assert payload["model"] == "example-model"
    assert payload["provider_option"] == "value"


def test_provider_reports_terminal_failure(tmp_path: Path) -> None:
    settings = Settings.from_values(
        tmp_path,
        protocol="generic-json",
        model="example-model",
        api_url="https://provider.example/chat",
    )
    provider = HTTPProvider(settings, transport=FlakyTransport(failures=2), retries=1)

    with pytest.raises(ProviderError, match="after 2 attempts"):
        provider.complete(model=settings.model, messages=[], tools=[])


def test_anthropic_messages_are_normalized(tmp_path: Path) -> None:
    settings = Settings.from_values(
        tmp_path,
        protocol="anthropic-messages",
        model="example-model",
        api_url="https://provider.example/messages",
    )
    provider = HTTPProvider(
        settings,
        transport=lambda _request, _timeout: {
            "content": [
                {"type": "text", "text": "done"},
                {"type": "tool_use", "id": "t1", "name": "list_files", "input": {"depth": 1}},
            ]
        },
        retries=0,
    )

    response = provider.complete(model=settings.model, messages=[], tools=[])

    assert response.choices[0].message.content == "done"
    assert response.choices[0].message.tool_calls[0].function.name == "list_files"
    assert response.choices[0].message.tool_calls[0].function.arguments == '{"depth": 1}'


def test_anthropic_tool_followup_preserves_tool_use_blocks(tmp_path: Path) -> None:
    settings = Settings.from_values(
        tmp_path,
        protocol="anthropic-messages",
        model="example-model",
        api_url="https://provider.example/messages",
    )
    captured = {}

    def transport(request, _timeout):
        captured["payload"] = json.loads(request.data)
        return {"content": [{"type": "text", "text": "done"}]}

    provider = HTTPProvider(settings, transport=transport, retries=0)
    provider.complete(
        model=settings.model,
        messages=[
            {"role": "system", "content": "You are Spencer."},
            {"role": "user", "content": "List files."},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call-1",
                        "function": {"name": "list_files", "arguments": '{"depth": 1}'},
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "call-1", "content": "README.md"},
        ],
        tools=[],
    )

    assistant_content = captured["payload"]["messages"][1]["content"]
    assert assistant_content[0]["type"] == "tool_use"
    assert assistant_content[0]["name"] == "list_files"
    assert captured["payload"]["messages"][2]["content"][0]["type"] == "tool_result"
