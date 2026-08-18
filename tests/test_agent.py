from pathlib import Path
from types import SimpleNamespace

from spencer.agent import Agent
from spencer.config import Settings
from spencer.tools import ToolRegistry
from spencer.workspace import Workspace


class FakeProvider:
    def __init__(self) -> None:
        self.calls = 0

    def complete(self, **_kwargs):
        self.calls += 1
        if self.calls == 1:
            call = SimpleNamespace(
                id="call-1",
                function=SimpleNamespace(
                    name="write_file",
                    arguments='{"path":"hello.txt","content":"hello\\n"}',
                ),
            )
            message = SimpleNamespace(content=None, tool_calls=[call])
        else:
            message = SimpleNamespace(content="Implemented and verified.", tool_calls=[])
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def test_agent_executes_approved_tool_and_returns_final_text(tmp_path: Path) -> None:
    settings = Settings.from_values(tmp_path, max_steps=3)
    workspace = Workspace(tmp_path)
    provider = FakeProvider()
    agent = Agent(
        settings,
        ToolRegistry(workspace),
        provider=provider,
        approve=lambda _name, _arguments: True,
    )

    result = agent.run("Create hello.txt.")

    assert result == "Implemented and verified."
    assert (tmp_path / "hello.txt").read_text() == "hello\n"
    assert provider.calls == 2
