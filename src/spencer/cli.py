from __future__ import annotations

import argparse
import json
import logging
import platform
import sys
from pathlib import Path
from typing import Any

from . import __version__
from .agent import Agent
from .config import ConfigError, Settings, config_dir, default_config_text
from .provider import ProviderError
from .tools import ToolRegistry
from .workspace import Workspace, WorkspaceError


LOGGER = logging.getLogger("spencer")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="spencer",
        description="A safe, terminal-first coding agent for local repositories.",
        epilog="Example: spencer \"Fix the failing parser test and run the relevant checks\"",
    )
    parser.add_argument("task", nargs="*", help="The coding task Spencer should complete.")
    parser.add_argument("--cwd", default=".", help="Workspace directory; defaults to the current directory.")
    parser.add_argument("--config", type=Path, help="Use a specific TOML configuration file.")
    parser.add_argument("--protocol", choices=["openai-compatible", "generic-json", "anthropic-messages", "ollama-chat"], help="Provider protocol.")
    parser.add_argument("--model", help="Provider model ID; defaults to config or SPENCER_MODEL.")
    parser.add_argument("--api-url", help="Provider HTTP endpoint for chat/tool requests.")
    parser.add_argument("--api-key-header", help="Header receiving the API key (default: Authorization).")
    parser.add_argument("--api-key-prefix", help="Prefix before the API key (default: Bearer; use empty for raw keys).")
    parser.add_argument("--headers", help="Extra request headers as a JSON object.")
    parser.add_argument("--request-fields", help="Extra JSON request fields as an object.")
    parser.add_argument("--api-timeout", type=int, help="Provider request timeout in seconds.")
    parser.add_argument("--max-steps", type=int, help="Maximum model/tool turns (default: 20).")
    parser.add_argument("--timeout", type=int, help="Shell command timeout in seconds (default: 30).")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Automatically approve file writes and shell commands. Use only in a trusted workspace.",
    )
    parser.add_argument("--json", action="store_true", help="Emit the final result as one JSON object.")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress events and print only the final result.")
    parser.add_argument("--verbose", action="store_true", help="Enable diagnostic logging on stderr.")
    parser.add_argument("--init", action="store_true", help="Create a user config template and exit.")
    parser.add_argument("--doctor", action="store_true", help="Check installation, configuration, and provider readiness.")
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


def _event(kind: str, payload: dict[str, Any], *, quiet: bool = False) -> None:
    if quiet:
        return
    if kind == "step":
        print(f"\n[step {payload['step']}/{payload['max_steps']}]")
    elif kind == "tool":
        print(f"[tool] {payload['name']}({payload['arguments']})")
    elif kind == "tool_result":
        print(f"[result]\n{payload['result']}")
    elif kind == "denied":
        print(f"[denied] {payload['name']}")
    elif kind == "tool_error":
        print(f"[tool error] {payload['error']}", file=sys.stderr)


def _init_config() -> int:
    path = config_dir() / "config.toml"
    if path.exists():
        print(f"Config already exists at {path}; leaving it unchanged.")
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(default_config_text(), encoding="utf-8")
    print(f"Created {path}")
    return 0


def _doctor(settings: Settings) -> int:
    checks = {
        "version": __version__,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "workspace": str(settings.workspace),
        "config_file": str(settings.config_file) if settings.config_file else "none",
        "protocol": settings.protocol,
        "model": settings.model,
        "api_url": settings.api_url or "missing",
        "api_key": "configured" if settings.api_key else "missing",
        "api_key_header": settings.api_key_header,
        "configured_header_names": sorted(settings.headers),
        "state_directory": str(settings.state_directory),
    }
    print(json.dumps(checks, indent=2))
    if not settings.api_key:
        print("\nSet SPENCER_API_KEY or OPENAI_API_KEY before starting an agent run.", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING, format="%(levelname)s %(message)s")
    try:
        settings = Settings.from_values(
            Path(args.cwd),
            protocol=args.protocol,
            model=args.model,
            api_url=args.api_url,
            api_key_header=args.api_key_header,
            api_key_prefix=args.api_key_prefix,
            headers=json.loads(args.headers) if args.headers else None,
            request_fields=json.loads(args.request_fields) if args.request_fields else None,
            api_timeout=args.api_timeout,
            max_steps=args.max_steps,
            command_timeout=args.timeout,
            auto_approve=True if args.yes else None,
            config_file=args.config,
        )
        if args.init:
            return _init_config()
        if args.doctor:
            return _doctor(settings)
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

        workspace = Workspace(
            settings.workspace,
            max_output_chars=settings.max_output_chars,
            command_timeout=settings.command_timeout,
        )
        registry = ToolRegistry(workspace)
        approve = (lambda _name, _arguments: True) if settings.auto_approve else _approval_prompt
        quiet = args.quiet or args.json
        agent = Agent(
            settings,
            registry,
            approve=approve,
            on_event=lambda kind, payload: _event(kind, payload, quiet=quiet),
        )
        if not quiet:
            print(f"Spencer workspace: {settings.workspace}")
            print(f"Spencer model: {settings.model}")
        final = agent.run(task)
        if args.json:
            print(json.dumps({"status": "ok", "message": final}, ensure_ascii=False))
        else:
            print(f"\nSpencer: {final}")
        return 0
    except (ConfigError, WorkspaceError, ValueError) as exc:
        print(f"Spencer error: {exc}", file=sys.stderr)
        return 2
    except ProviderError as exc:
        print(f"Spencer provider error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    except Exception as exc:
        LOGGER.exception("unexpected Spencer failure")
        print(f"Spencer error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
