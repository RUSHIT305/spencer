from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from . import __version__
from .agent import Agent
from .config import Settings
from .tools import ToolRegistry
from .workspace import Workspace, WorkspaceError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="spencer",
        description="A safe, terminal-first coding agent for local repositories.",
    )
    parser.add_argument("task", nargs="*", help="The coding task Spencer should complete.")
    parser.add_argument("--cwd", default=".", help="Workspace directory; defaults to the current directory.")
    parser.add_argument("--model", help="Model ID; defaults to SPENCER_MODEL or gpt-5-mini.")
    parser.add_argument("--max-steps", type=int, default=20, help="Maximum model/tool turns.")
    parser.add_argument("--timeout", type=int, default=30, help="Shell command timeout in seconds.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Automatically approve file writes and shell commands. Use only in a trusted workspace.",
    )
    parser.add_argument("--version", action="version", version=f"spencer {__version__}")
    return parser


def _approval_prompt(name: str, arguments: dict[str, Any]) -> bool:
    if name == "write_file":
        content = str(arguments.get("content", ""))
        preview = content[:600].replace("\n", "\\n")
        print(f"\nSpencer wants to replace {arguments.get('path', '<unknown>')}.")
        print(f"Preview: {preview}{'…' if len(content) > 600 else ''}")
    elif name == "run_command":
        print(f"\nSpencer wants to run: {arguments.get('command', '<unknown>')}")
    else:
        return True
    try:
        answer = input("Approve? [y/N] ").strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}


def _event(kind: str, payload: dict[str, Any]) -> None:
    if kind == "step":
        print(f"\n[step {payload['step']}/{payload['max_steps']}]")
    elif kind == "tool":
        print(f"[tool] {payload['name']}({payload['arguments']})")
    elif kind == "tool_result":
        result = str(payload["result"])
        print(f"[result]\n{result}")
    elif kind == "denied":
        print(f"[denied] {payload['name']}")
    elif kind == "tool_error":
        print(f"[tool error] {payload['error']}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    task = " ".join(args.task).strip()
    if not task:
        try:
            task = input("What should Spencer build? ").strip()
        except EOFError:
            print("A coding task is required.", file=sys.stderr)
            return 2
    if not task:
        print("A coding task is required.", file=sys.stderr)
        return 2
    try:
        settings = Settings.from_values(
            Path(args.cwd),
            model=args.model,
            max_steps=args.max_steps,
            command_timeout=args.timeout,
            auto_approve=args.yes,
        )
        workspace = Workspace(
            settings.workspace,
            max_output_chars=settings.max_output_chars,
            command_timeout=settings.command_timeout,
        )
        registry = ToolRegistry(workspace)
        approve = (lambda _name, _arguments: True) if settings.auto_approve else _approval_prompt
        agent = Agent(settings, registry, approve=approve, on_event=_event)
        print(f"Spencer workspace: {settings.workspace}")
        print(f"Spencer model: {settings.model}")
        final = agent.run(task)
        print(f"\nSpencer: {final}")
        return 0
    except (WorkspaceError, ValueError) as exc:
        print(f"Spencer error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Spencer provider error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
