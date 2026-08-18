from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

from .workspace import Workspace, WorkspaceError

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List visible repository files under a relative directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory, usually '.'."},
                    "depth": {"type": "integer", "minimum": 0, "maximum": 6},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search UTF-8 text files for a case-insensitive string.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "path": {"type": "string", "description": "Relative directory, usually '.'."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a UTF-8 text file with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "start_line": {"type": "integer", "minimum": 1},
                    "end_line": {"type": "integer", "minimum": 1},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": (
                "Create or replace a UTF-8 text file. Use only when a file change is needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "Show the current Git branch and short working-tree status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": (
                "Run a shell command from the workspace root. Prefer focused checks and tests."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "timeout": {"type": "integer", "minimum": 1, "maximum": 300},
                },
                "required": ["command"],
            },
        },
    },
]


@dataclass
class ToolRegistry:
    workspace: Workspace

    def execute(self, name: str, arguments: dict[str, Any]) -> str:
        handlers: dict[str, Callable[..., str]] = {
            "list_files": self.workspace.list_files,
            "search_files": self.workspace.search_files,
            "read_file": self.workspace.read_file,
            "write_file": self.workspace.write_file,
            "git_status": self.workspace.git_status,
            "run_command": self.workspace.run_command,
        }
        if name not in handlers:
            raise WorkspaceError(f"Unknown tool: {name}")
        try:
            return handlers[name](**arguments)
        except TypeError as exc:
            raise WorkspaceError(f"Invalid arguments for {name}: {exc}") from exc

    @staticmethod
    def arguments(raw_arguments: str | None) -> dict[str, Any]:
        if not raw_arguments:
            return {}
        value = json.loads(raw_arguments)
        if not isinstance(value, dict):
            raise WorkspaceError("Tool arguments must be a JSON object.")
        return value
