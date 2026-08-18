from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class WorkspaceError(RuntimeError):
    """Raised when a requested repository operation is unsafe or invalid."""


class Workspace:
    """A constrained view of one repository directory."""

    def __init__(
        self,
        root: Path,
        *,
        max_output_chars: int = 12_000,
        max_file_chars: int = 500_000,
        command_timeout: int = 30,
    ):
        self.root = root.resolve()
        self.max_output_chars = max_output_chars
        self.max_file_chars = max_file_chars
        self.command_timeout = command_timeout
        if not self.root.is_dir():
            raise WorkspaceError(f"Workspace does not exist or is not a directory: {self.root}")

    def _safe_path(self, relative_path: str) -> Path:
        candidate = Path(relative_path)
        if candidate.is_absolute():
            raise WorkspaceError("Absolute paths are not allowed; use a path relative to the workspace.")
        resolved = (self.root / candidate).resolve()
        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise WorkspaceError("Path escapes the workspace.") from exc
        return resolved

    def list_files(self, path: str = ".", depth: int = 2) -> str:
        base = self._safe_path(path)
        if not base.exists():
            raise WorkspaceError(f"Path does not exist: {path}")
        if base.is_file():
            return str(base.relative_to(self.root))

        ignored = {".git", ".venv", "venv", "node_modules", "__pycache__", ".mypy_cache"}
        results: list[str] = []
        base_depth = len(base.relative_to(self.root).parts)
        for current, dirs, files in os.walk(base, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in ignored and not d.startswith("."))
            files = sorted(f for f in files if not f.startswith("."))
            current_path = Path(current)
            current_depth = len(current_path.relative_to(self.root).parts) - base_depth
            if current_depth > depth:
                dirs[:] = []
                continue
            for filename in files:
                results.append(str((current_path / filename).relative_to(self.root)))
                if len(results) >= 200:
                    results.append("... (truncated at 200 files)")
                    return "\n".join(results)
        return "\n".join(results) or "(no visible files)"

    def search_files(self, query: str, path: str = ".") -> str:
        if not query:
            raise WorkspaceError("Search query cannot be empty.")
        base = self._safe_path(path)
        matches: list[str] = []
        ignored = {".git", ".venv", "venv", "node_modules", "__pycache__"}
        for current, dirs, files in os.walk(base, followlinks=False):
            dirs[:] = [d for d in dirs if d not in ignored]
            for filename in files:
                file_path = Path(current) / filename
                try:
                    if file_path.stat().st_size > self.max_file_chars:
                        continue
                    text = file_path.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
                for line_number, line in enumerate(text.splitlines(), 1):
                    if query.lower() in line.lower():
                        matches.append(f"{file_path.relative_to(self.root)}:{line_number}: {line[:240]}")
                        if len(matches) >= 100:
                            return "\n".join(matches) + "\n... (truncated at 100 matches)"
        return "\n".join(matches) or "(no matches)"

    def read_file(self, path: str, start_line: int = 1, end_line: int | None = None) -> str:
        file_path = self._safe_path(path)
        if not file_path.is_file():
            raise WorkspaceError(f"Not a file: {path}")
        try:
            if file_path.stat().st_size > self.max_file_chars:
                raise WorkspaceError(f"File is larger than the configured limit: {path}")
            lines = file_path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError as exc:
            raise WorkspaceError(f"File is not UTF-8 text: {path}") from exc
        if start_line < 1:
            raise WorkspaceError("start_line must be at least 1.")
        selected = lines[start_line - 1 : end_line]
        result = "\n".join(f"{index}: {line}" for index, line in enumerate(selected, start_line))
        return self._truncate(result)

    def write_file(self, path: str, content: str) -> str:
        if len(content) > self.max_file_chars:
            raise WorkspaceError(f"Content is larger than the configured limit: {path}")
        file_path = self._safe_path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        original_mode = file_path.stat().st_mode if file_path.exists() else None
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=file_path.parent, prefix=f".{file_path.name}.", delete=False
            ) as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
                temporary_path = Path(handle.name)
            if original_mode is not None:
                os.chmod(temporary_path, original_mode)
            os.replace(temporary_path, file_path)
        except OSError as exc:
            raise WorkspaceError(f"Unable to write {path}: {exc}") from exc
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)
        return f"Wrote {len(content.splitlines())} lines to {file_path.relative_to(self.root)}."

    def git_status(self) -> str:
        completed = subprocess.run(
            ["git", "status", "--short", "--branch"],
            cwd=self.root,
            text=True,
            capture_output=True,
            timeout=self.command_timeout,
            check=False,
        )
        if completed.returncode != 0:
            return "Not a Git repository or Git status unavailable."
        return self._truncate(completed.stdout.strip() or "Working tree clean.")

    def run_command(self, command: str, timeout: int | None = None) -> str:
        reason = self._blocked_command_reason(command)
        if reason:
            raise WorkspaceError(f"Command blocked by Spencer safety policy: {reason}")
        try:
            executable = os.getenv("COMSPEC") if os.name == "nt" else os.getenv("SHELL", "/bin/sh")
            completed = subprocess.run(
                command,
                cwd=self.root,
                shell=True,
                executable=executable,
                text=True,
                capture_output=True,
                timeout=timeout or self.command_timeout,
                check=False,
                env={**os.environ, "SPENCER_WORKSPACE": str(self.root)},
            )
        except subprocess.TimeoutExpired as exc:
            output = (exc.stdout or "") + (exc.stderr or "")
            return self._truncate(f"Command timed out after {timeout or self.command_timeout}s.\n{output}")
        output = (completed.stdout or "") + (completed.stderr or "")
        return self._truncate(f"exit_code={completed.returncode}\n{output.strip()}")

    @staticmethod
    def _blocked_command_reason(command: str) -> str | None:
        normalized = re.sub(r"\s+", " ", command.strip().lower())
        patterns: list[tuple[str, str]] = [
            (r"(^|[;&|])\s*sudo\b", "sudo is not allowed inside the agent loop"),
            (r"rm\s+-[^\n]*r[^\n]*f\s+/(?:\s|$)", "recursive deletion from filesystem root is not allowed"),
            (r"git\s+reset\s+--hard", "destructive Git resets require manual execution"),
            (r"git\s+clean\s+-[^\n]*f", "destructive Git clean requires manual execution"),
            (r":\(\)\s*\{", "fork-bomb patterns are not allowed"),
            (r"\b(shutdown|reboot|poweroff)\b", "system power commands are not allowed"),
        ]
        for pattern, reason in patterns:
            if re.search(pattern, normalized):
                return reason
        return None

    def _truncate(self, text: str) -> str:
        if len(text) <= self.max_output_chars:
            return text
        return text[: self.max_output_chars] + "\n... (output truncated)"

    def snapshot(self) -> dict[str, Any]:
        return {
            "workspace": str(self.root),
            "files": self.list_files(depth=2),
            "git_status": self.git_status(),
        }
