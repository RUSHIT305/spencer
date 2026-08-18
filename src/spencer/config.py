from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 compatibility.
    import tomli as tomllib  # type: ignore[no-redef]


class ConfigError(RuntimeError):
    """Raised when Spencer configuration cannot be loaded or validated."""


def config_dir() -> Path:
    if sys.platform == "win32":
        return Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / "Spencer"
    return Path(os.getenv("XDG_CONFIG_HOME", Path.home() / ".config")) / "spencer"


def state_dir() -> Path:
    if sys.platform == "win32":
        return Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Spencer"
    return Path(os.getenv("XDG_STATE_HOME", Path.home() / ".local" / "state")) / "spencer"


def _read_toml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise ConfigError(f"Unable to read configuration at {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"Configuration at {path} must contain a TOML table.")
    return data


def _get(config: dict[str, Any], key: str, default: Any) -> Any:
    agent = config.get("agent", config)
    if not isinstance(agent, dict):
        return default
    return agent.get(key, default)


@dataclass(frozen=True)
class Settings:
    """Validated runtime settings with explicit precedence."""

    workspace: Path
    model: str
    api_base: str | None
    api_key: str | None
    max_steps: int
    command_timeout: int
    auto_approve: bool
    max_output_chars: int
    config_file: Path | None
    state_directory: Path

    @classmethod
    def from_values(
        cls,
        workspace: Path,
        *,
        model: str | None = None,
        api_base: str | None = None,
        max_steps: int | None = None,
        command_timeout: int | None = None,
        auto_approve: bool | None = None,
        max_output_chars: int | None = None,
        config_file: Path | None = None,
    ) -> "Settings":
        workspace = workspace.expanduser().resolve()
        if not workspace.is_dir():
            raise ConfigError(f"Workspace does not exist or is not a directory: {workspace}")

        explicit_config = config_file.expanduser() if config_file else None
        candidates = [
            explicit_config,
            workspace / ".spencer.toml",
            config_dir() / "config.toml",
        ]
        selected_config = next((path for path in candidates if path and path.is_file()), None)
        file_values = _read_toml(selected_config) if selected_config else {}

        resolved_model = model or os.getenv("SPENCER_MODEL") or _get(file_values, "model", "gpt-5-mini")
        resolved_api_base = api_base or os.getenv("SPENCER_API_BASE") or _get(file_values, "api_base", None)
        resolved_max_steps = max_steps if max_steps is not None else int(
            os.getenv("SPENCER_MAX_STEPS", _get(file_values, "max_steps", 20))
        )
        resolved_timeout = command_timeout if command_timeout is not None else int(
            os.getenv("SPENCER_COMMAND_TIMEOUT", _get(file_values, "command_timeout", 30))
        )
        resolved_auto = (
            auto_approve
            if auto_approve is not None
            else os.getenv("SPENCER_AUTO_APPROVE", str(_get(file_values, "auto_approve", False))).lower()
            in {"1", "true", "yes", "on"}
        )
        resolved_output = max_output_chars if max_output_chars is not None else int(
            os.getenv("SPENCER_MAX_OUTPUT_CHARS", _get(file_values, "max_output_chars", 12_000))
        )

        if not isinstance(resolved_model, str) or not resolved_model.strip():
            raise ConfigError("model must be a non-empty string")
        if resolved_max_steps < 1 or resolved_max_steps > 100:
            raise ConfigError("max_steps must be between 1 and 100")
        if resolved_timeout < 1 or resolved_timeout > 900:
            raise ConfigError("command_timeout must be between 1 and 900 seconds")
        if resolved_output < 1_000 or resolved_output > 1_000_000:
            raise ConfigError("max_output_chars must be between 1,000 and 1,000,000")

        return cls(
            workspace=workspace,
            model=resolved_model.strip(),
            api_base=resolved_api_base,
            api_key=os.getenv("SPENCER_API_KEY") or os.getenv("OPENAI_API_KEY"),
            max_steps=resolved_max_steps,
            command_timeout=resolved_timeout,
            auto_approve=bool(resolved_auto),
            max_output_chars=resolved_output,
            config_file=selected_config,
            state_directory=state_dir(),
        )


def default_config_text() -> str:
    return '''# Spencer configuration. CLI flags override environment and file values.
[agent]
model = "gpt-5-mini"
# api_base = "https://api.openai.com/v1"
max_steps = 20
command_timeout = 30
auto_approve = false
max_output_chars = 12000
'''
