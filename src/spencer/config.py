from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Runtime settings loaded from CLI flags and environment variables."""

    workspace: Path
    model: str
    api_base: str | None
    max_steps: int
    command_timeout: int
    auto_approve: bool
    max_output_chars: int

    @classmethod
    def from_values(
        cls,
        workspace: Path,
        *,
        model: str | None = None,
        max_steps: int = 20,
        command_timeout: int = 30,
        auto_approve: bool = False,
        max_output_chars: int = 12_000,
    ) -> "Settings":
        return cls(
            workspace=workspace.resolve(),
            model=model or os.getenv("SPENCER_MODEL", "gpt-5-mini"),
            api_base=os.getenv("SPENCER_API_BASE") or os.getenv("OPENAI_API_BASE"),
            max_steps=max_steps,
            command_timeout=command_timeout,
            auto_approve=auto_approve,
            max_output_chars=max_output_chars,
        )
