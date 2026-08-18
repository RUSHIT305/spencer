from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 compatibility.
    import tomli as tomllib  # type: ignore[no-redef]


SUPPORTED_PROTOCOLS = {"openai-compatible", "generic-json", "anthropic-messages", "ollama-chat"}


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


def _headers_from(value: Any) -> dict[str, str]:
    if value in (None, ""):
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ConfigError(
                "headers must be a JSON object when provided through the environment"
            ) from exc
    if not isinstance(value, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in value.items()
    ):
        raise ConfigError("headers must be a string-to-string object")
    return dict(value)


def _request_fields_from(value: Any) -> dict[str, Any]:
    if value in (None, ""):
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ConfigError(
                "request_fields must be a JSON object when provided through the environment"
            ) from exc
    if not isinstance(value, dict):
        raise ConfigError("request_fields must be a JSON object")
    return dict(value)


@dataclass(frozen=True)
class Settings:
    """Validated runtime settings with explicit provider-neutral precedence."""

    workspace: Path
    protocol: str
    model: str
    api_url: str | None
    api_key: str | None
    api_key_header: str
    api_key_prefix: str
    headers: dict[str, str] = field(default_factory=dict)
    request_fields: dict[str, Any] = field(default_factory=dict)
    api_timeout: int = 120
    content_path: str = "choices.0.message.content"
    tool_calls_path: str = "choices.0.message.tool_calls"
    max_steps: int = 20
    command_timeout: int = 30
    auto_approve: bool = False
    max_output_chars: int = 12_000
    config_file: Path | None = None
    state_directory: Path = field(default_factory=state_dir)

    @classmethod
    def from_values(
        cls,
        workspace: Path,
        *,
        protocol: str | None = None,
        model: str | None = None,
        api_url: str | None = None,
        api_key: str | None = None,
        api_key_header: str | None = None,
        api_key_prefix: str | None = None,
        headers: dict[str, str] | None = None,
        request_fields: dict[str, Any] | None = None,
        api_timeout: int | None = None,
        content_path: str | None = None,
        tool_calls_path: str | None = None,
        max_steps: int | None = None,
        command_timeout: int | None = None,
        auto_approve: bool | None = None,
        max_output_chars: int | None = None,
        config_file: Path | None = None,
    ) -> "Settings":
        workspace = workspace.expanduser().resolve()
        if not workspace.is_dir():
            raise ConfigError(f"Workspace does not exist or is not a directory: {workspace}")

        if config_file is not None:
            explicit_config = config_file.expanduser()
            if not explicit_config.is_file():
                raise ConfigError(f"Configuration file does not exist: {explicit_config}")
        else:
            explicit_config = None
        candidates = [explicit_config, workspace / ".spencer.toml", config_dir() / "config.toml"]
        selected_config = next((path for path in candidates if path and path.is_file()), None)
        file_values = _read_toml(selected_config) if selected_config else {}

        resolved_protocol = (
            protocol
            or os.getenv("SPENCER_API_PROTOCOL")
            or _get(file_values, "protocol", "generic-json")
        )
        resolved_model = (
            model or os.getenv("SPENCER_MODEL") or _get(file_values, "model", "default")
        )
        resolved_url = (
            api_url
            or os.getenv("SPENCER_API_URL")
            or os.getenv("SPENCER_API_BASE")
            or _get(file_values, "api_url", _get(file_values, "api_base", None))
        )
        resolved_key_header = (
            api_key_header
            or os.getenv("SPENCER_API_KEY_HEADER")
            or _get(file_values, "api_key_header", "Authorization")
        )
        resolved_key_prefix = (
            api_key_prefix
            if api_key_prefix is not None
            else os.getenv("SPENCER_API_KEY_PREFIX", _get(file_values, "api_key_prefix", "Bearer"))
        )
        resolved_headers = (
            headers
            or _headers_from(os.getenv("SPENCER_API_HEADERS"))
            or _headers_from(_get(file_values, "headers", {}))
        )
        resolved_request_fields = (
            request_fields
            or _request_fields_from(os.getenv("SPENCER_REQUEST_FIELDS"))
            or _request_fields_from(_get(file_values, "request_fields", {}))
        )
        resolved_api_timeout = (
            api_timeout
            if api_timeout is not None
            else int(os.getenv("SPENCER_API_TIMEOUT", _get(file_values, "api_timeout", 120)))
        )
        resolved_content_path = (
            content_path
            or os.getenv("SPENCER_CONTENT_PATH")
            or _get(file_values, "content_path", "choices.0.message.content")
        )
        resolved_tool_calls_path = (
            tool_calls_path
            or os.getenv("SPENCER_TOOL_CALLS_PATH")
            or _get(file_values, "tool_calls_path", "choices.0.message.tool_calls")
        )
        resolved_max_steps = (
            max_steps
            if max_steps is not None
            else int(os.getenv("SPENCER_MAX_STEPS", _get(file_values, "max_steps", 20)))
        )
        resolved_timeout = (
            command_timeout
            if command_timeout is not None
            else int(os.getenv("SPENCER_COMMAND_TIMEOUT", _get(file_values, "command_timeout", 30)))
        )
        resolved_auto = (
            auto_approve
            if auto_approve is not None
            else os.getenv(
                "SPENCER_AUTO_APPROVE", str(_get(file_values, "auto_approve", False))
            ).lower()
            in {"1", "true", "yes", "on"}
        )
        resolved_output = (
            max_output_chars
            if max_output_chars is not None
            else int(
                os.getenv("SPENCER_MAX_OUTPUT_CHARS", _get(file_values, "max_output_chars", 12_000))
            )
        )

        if not isinstance(resolved_protocol, str) or not resolved_protocol.strip():
            raise ConfigError("protocol must be a non-empty backend name")
        if not isinstance(resolved_model, str) or not resolved_model.strip():
            raise ConfigError("model must be a non-empty string")
        if not isinstance(resolved_key_header, str) or not resolved_key_header.strip():
            raise ConfigError("api_key_header must be a non-empty string")
        if not isinstance(resolved_content_path, str) or not resolved_content_path.strip():
            raise ConfigError("content_path must be a non-empty dotted path")
        if not isinstance(resolved_tool_calls_path, str) or not resolved_tool_calls_path.strip():
            raise ConfigError("tool_calls_path must be a non-empty dotted path")
        if resolved_api_timeout < 1 or resolved_api_timeout > 900:
            raise ConfigError("api_timeout must be between 1 and 900 seconds")
        if resolved_max_steps < 1 or resolved_max_steps > 100:
            raise ConfigError("max_steps must be between 1 and 100")
        if resolved_timeout < 1 or resolved_timeout > 900:
            raise ConfigError("command_timeout must be between 1 and 900 seconds")
        if resolved_output < 1_000 or resolved_output > 1_000_000:
            raise ConfigError("max_output_chars must be between 1,000 and 1,000,000")

        return cls(
            workspace=workspace,
            protocol=resolved_protocol,
            model=resolved_model.strip(),
            api_url=resolved_url,
            api_key=api_key or os.getenv("SPENCER_API_KEY") or os.getenv("OPENAI_API_KEY"),
            api_key_header=resolved_key_header.strip(),
            api_key_prefix=str(resolved_key_prefix),
            headers=resolved_headers,
            request_fields=resolved_request_fields,
            api_timeout=resolved_api_timeout,
            content_path=resolved_content_path,
            tool_calls_path=resolved_tool_calls_path,
            max_steps=resolved_max_steps,
            command_timeout=resolved_timeout,
            auto_approve=bool(resolved_auto),
            max_output_chars=resolved_output,
            config_file=selected_config,
            state_directory=state_dir(),
        )


def default_config_text() -> str:
    return """# Spencer configuration. CLI flags override environment and file values.
[agent]
# Supported protocols: openai-compatible, generic-json, anthropic-messages, ollama-chat
protocol = "generic-json"
model = "your-model-id"
api_url = "https://your-provider.example/v1/chat/completions"
api_key_header = "Authorization"
api_key_prefix = "Bearer"
# headers = { "X-Custom-Header" = "value" }
# request_fields = { "provider_option" = "value" }
api_timeout = 120
# Dotted response paths used by generic-json APIs.
content_path = "choices.0.message.content"
tool_calls_path = "choices.0.message.tool_calls"
max_steps = 20
command_timeout = 30
auto_approve = false
max_output_chars = 12000
"""
