import os
from pathlib import Path

import pytest

from spencer.workspace import Workspace, WorkspaceError


def test_file_round_trip_and_line_numbers(tmp_path: Path) -> None:
    workspace = Workspace(tmp_path)
    workspace.write_file("src/example.py", "one\ntwo\nthree\n")
    assert workspace.read_file("src/example.py", start_line=2, end_line=3) == "2: two\n3: three"
    assert "src/example.py" in workspace.list_files()


def test_path_cannot_escape_workspace(tmp_path: Path) -> None:
    workspace = Workspace(tmp_path)
    with pytest.raises(WorkspaceError, match="escapes"):
        workspace.read_file("../outside.txt")


def test_dangerous_commands_are_blocked(tmp_path: Path) -> None:
    workspace = Workspace(tmp_path)
    with pytest.raises(WorkspaceError, match="blocked"):
        workspace.run_command("git reset --hard HEAD")
    with pytest.raises(WorkspaceError, match="blocked"):
        workspace.run_command("sudo whoami")


def test_command_runs_in_workspace(tmp_path: Path) -> None:
    workspace = Workspace(tmp_path)
    command = "echo %SPENCER_WORKSPACE%" if os.name == "nt" else "printf '%s' \"$SPENCER_WORKSPACE\""
    result = workspace.run_command(command)
    assert str(tmp_path.resolve()) in result
