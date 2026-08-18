# Spencer

> **Your coding partner in the terminal.** Spencer turns a plain-English task into a focused inspect–edit–verify loop inside the repository you already work in.

Spencer is a terminal-first coding agent for developers who want the speed of an AI pair programmer without leaving their shell, editor, Git workflow, or local machine. It can understand an unfamiliar repository, make targeted changes, run the relevant checks, and explain exactly what it did. The default mode is intentionally human-in-the-loop: inspection is automatic, while file changes and shell commands require approval.

## Why Spencer

Modern coding agents often force a choice between convenience and control. Spencer is designed around a different contract: **bring your own repository, provider, and approval policy**. There is no required hosted workspace and no hidden background process. The agent operates in a constrained workspace, surfaces every write and command, and leaves the final diff in your Git working tree for review.

| Product principle | Spencer behavior |
|---|---|
| Terminal-native | One command, works from an existing shell and repository. |
| Control by default | Reads are automatic; writes and commands are approval-gated unless `--yes` is explicitly selected. |
| Provider-flexible | Uses an OpenAI-compatible API and supports configurable model IDs and endpoints. |
| Repository-scoped | Relative paths are resolved against the workspace and attempts to escape are rejected. |
| Verifiable | Spencer is instructed to run focused checks and never claim a test passed without output. |
| Automation-ready | JSON output, deterministic limits, diagnostics, and non-interactive operation support CI and scripts. |

## Install in under a minute

The recommended installation is an isolated CLI tool through `uv` or `pipx`.

```bash
uv tool install spencer-agent
# or
pipx install spencer-agent
```

If neither tool is available, install into the current user’s Python environment:

```bash
python3 -m pip install --user --upgrade spencer-agent
```

On Windows PowerShell, use the same Python command or run the repository installer:

```powershell
py -m pip install --user --upgrade spencer-agent
# or, from a checked-out repository
.\scripts\install.ps1
```

On macOS or Linux, the repository installer automatically prefers `uv`, then `pipx`, then user-level Python:

```bash
./scripts/install.sh
```

Verify the installation:

```bash
spencer --version
spencer --doctor
```

The package requires Python 3.10 or newer and exposes one executable, `spencer`.

## First run

Set an API key for an OpenAI-compatible provider. The standard OpenAI variable is supported, as is Spencer’s provider-neutral alias:

```bash
export SPENCER_API_KEY="your-key"
# OPENAI_API_KEY is also supported
```

Then run Spencer from the repository it should modify:

```bash
spencer "Add input validation to the user registration flow and run the relevant tests"
```

Target another repository without changing directories:

```bash
spencer --cwd /path/to/repository "Fix the failing parser test"
```

Spencer starts by inspecting the workspace. When it proposes a file write or command, it shows the action and asks for approval. Review the preview, approve the useful actions, and inspect the resulting Git diff when the run finishes.

## Operating modes

The interactive mode is the default and is best for daily development. For trusted, disposable, or already-sandboxed workspaces, `--yes` approves writes and commands automatically. For automation, combine `--quiet` and `--json` so the process emits one machine-readable result.

```bash
# Interactive development
spencer "Refactor the configuration loader without changing its public API"

# Constrained run
spencer --max-steps 12 --timeout 60 "Update the parser and run its focused tests"

# Trusted automation
spencer --yes --cwd ./sample-project "Run the formatter and fix the reported issues"

# CI-friendly output
spencer --yes --quiet --json "Run the unit tests and report the result"
```

## Configuration

Spencer accepts settings from four layers, in descending precedence: command-line flags, environment variables, a workspace file at `.spencer.toml`, and a user file at the platform configuration directory. Create the user template with:

```bash
spencer --init
```

The user configuration is stored under `$XDG_CONFIG_HOME/spencer/config.toml` on Unix-like systems and `%APPDATA%\Spencer\config.toml` on Windows. A workspace-local `.spencer.toml` is useful for repository-specific defaults and can be committed when the team agrees on the policy.

```toml
[agent]
model = "gpt-5-mini"
api_base = "https://api.openai.com/v1"
max_steps = 20
command_timeout = 30
auto_approve = false
max_output_chars = 12000
```

The most useful environment variables are `SPENCER_API_KEY`, `OPENAI_API_KEY`, `SPENCER_API_BASE`, `SPENCER_MODEL`, `SPENCER_MAX_STEPS`, `SPENCER_COMMAND_TIMEOUT`, `SPENCER_AUTO_APPROVE`, and `SPENCER_MAX_OUTPUT_CHARS`.

## Trust and safety model

Spencer is designed to reduce accidental damage, not to replace operating-system isolation. Treat `--yes` as a powerful switch and run Spencer with the least privilege necessary.

The workspace root is a hard boundary. Absolute paths and paths that resolve outside the workspace are rejected, including symlink escapes. Text reads and writes have configurable size limits. Writes are atomic: Spencer writes a temporary file in the destination directory, flushes it, and replaces the destination only after the write is complete. Existing file permissions are preserved.

Shell commands execute from the workspace root with a timeout, bounded output, and a `SPENCER_WORKSPACE` environment variable. Spencer blocks several obviously destructive patterns, including `sudo`, recursive deletion from filesystem root, hard Git resets, forced Git clean operations, fork-bomb syntax, and system power commands. These checks are intentionally conservative but are not a security boundary. For untrusted repositories or high-impact tasks, use a container, VM, or OS-level sandbox as an additional layer.

## Supported tools

| Tool | Purpose | Approval required |
|---|---|---:|
| `list_files` | Understand repository shape without hidden dependency directories. | No |
| `search_files` | Find text across UTF-8 files with bounded results. | No |
| `read_file` | Read relevant files with line numbers. | No |
| `write_file` | Create or replace a repository text file atomically. | Yes |
| `git_status` | Inspect branch and working-tree state. | No |
| `run_command` | Execute a focused repository check or development command. | Yes |

## Provider compatibility

Spencer uses standard chat-completions messages with function tools through the OpenAI Python SDK. Any compatible endpoint that supports tool calling can be configured with `SPENCER_API_BASE` or `--api-base`. The model is configurable with `SPENCER_MODEL` or `--model`; the default is `gpt-5-mini`.

Spencer selects the appropriate output-token parameter for GPT, Claude, and Gemini model families. Provider requests retry transient failures with bounded exponential backoff and return a clear error if all attempts fail. Debug logging is opt-in with `--verbose`; Spencer does not transmit telemetry or repository content to a separate analytics service.

## Troubleshooting

If `spencer` is not found after a user-level installation, activate the executable directory reported by `pipx`, `uv tool dir --bin`, or Python’s user base. On Unix-like systems this is commonly `~/.local/bin`; on Windows it is commonly the Python user `Scripts` directory.

If `spencer --doctor` reports a missing API key, set `SPENCER_API_KEY` or `OPENAI_API_KEY` in the same shell session that starts Spencer. If a compatible gateway is used, set `SPENCER_API_BASE` to its API base URL and confirm that the selected model supports function calling.

If a run reaches its step limit, rerun with a narrower task or increase `--max-steps`. If a command times out, increase `--timeout` for that run rather than removing the limit globally.

## Development

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
python -m pytest
python -m spencer.cli --version
```

The repository is organized around small, testable boundaries. `workspace.py` owns repository operations and safety checks, `tools.py` defines the model-facing contract, `provider.py` owns API retries and model-family request details, `agent.py` owns the tool loop, `config.py` owns layered settings, and `cli.py` owns the terminal experience.

Tagged releases are built by GitHub Actions and can be published through PyPI trusted publishing. The release workflow expects the repository to be connected to a PyPI project and configured with the corresponding trusted-publisher relationship.

## Roadmap

Spencer’s next product milestones are streaming responses, patch-native editing with reviewable diffs, optional container execution, repository-aware context indexing, and team policy files for approval rules. The core promise remains unchanged: a fast coding partner that stays in the terminal and keeps the developer in control.
