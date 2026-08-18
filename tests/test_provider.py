from pathlib import Path
from types import SimpleNamespace

import pytest

from spencer.config import Settings
from spencer.provider import ChatProvider, ProviderError


class FlakyCompletions:
    def __init__(self, failures: int) -> None:
        self.failures = failures
        self.calls = 0

    def create(self, **_kwargs):
        self.calls += 1
        if self.calls <= self.failures:
            raise RuntimeError("temporary provider failure")
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok", tool_calls=[]))])


class FakeClient:
    def __init__(self, failures: int) -> None:
        self.chat = SimpleNamespace(completions=FlakyCompletions(failures))


def test_provider_retries_transient_failure(tmp_path: Path) -> None:
    settings = Settings.from_values(tmp_path, model="gpt-5-mini")
    client = FakeClient(failures=1)
    provider = ChatProvider(settings, client=client, retries=1)

    response = provider.complete(model=settings.model, messages=[], tools=[])

    assert response.choices[0].message.content == "ok"
    assert client.chat.completions.calls == 2


def test_provider_reports_terminal_failure(tmp_path: Path) -> None:
    settings = Settings.from_values(tmp_path, model="gpt-5-mini")
    provider = ChatProvider(settings, client=FakeClient(failures=2), retries=1)

    with pytest.raises(ProviderError, match="after 2 attempts"):
        provider.complete(model=settings.model, messages=[], tools=[])
