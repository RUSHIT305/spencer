<div align="center">
  <img src="assets/spencer-mark.svg" width="112" alt="Spencer mark" />
  <h1>Spencer</h1>
  <p><strong>Your coding partner in the terminal.</strong></p>
  <p>Inspect. Edit. Verify. Stay in control.</p>
  <p>
    <a href="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml"><img src="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
    <a href="https://github.com/RUSHIT305/spencer/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-111827.svg" alt="MIT license" /></a>
    <a href="https://github.com/RUSHIT305/spencer/releases"><img src="https://img.shields.io/badge/status-beta-2563eb.svg" alt="Beta status" /></a>
  </p>
</div>

Spencer is a terminal-first coding agent for developers who want an AI pair programmer without leaving their shell, editor, Git workflow, or local machine. Give Spencer a task in plain English. It inspects the repository, proposes focused changes, runs relevant checks, and explains the result.

The default experience is deliberately human-in-the-loop: Spencer can inspect automatically, but file changes and shell commands require approval. The final result remains in your normal Git working tree for review.

> **Current release note:** Spencer is release-ready at `0.2.0`, but this repository is currently private and the package has not yet been published to PyPI. The guaranteed installation path today is the source installation below. Once the first package release is published, the `uv` and `pipx` commands in the distribution section become the shortest install path.

## What Spencer does

| Capability | Spencer behavior |
|---|---|
| Repository understanding | Lists files, searches text, reads relevant files, and checks Git status. |
| Code changes | Replaces UTF-8 text files atomically inside the selected workspace. |
| Verification | Runs focused tests, linters, formatters, and other developer commands with bounded time and output. |
| Developer control | Prompts before writes and shell commands; `--yes` is an explicit trusted-automation switch. |
| Provider flexibility | Connects to configurable HTTP APIs through generic JSON, OpenAI-compatible, Anthropic Messages, or Ollama Chat protocols. |
| Automation | Supports quiet output, JSON results, deterministic step limits, and diagnostics. |

## Installation: the guaranteed path today

The following steps work from the connected GitHub repository on **macOS, Linux, and Windows**. You need Git and Python 3.10 or newer.

### Step 1 — Clone the repository

If the repository is private, make sure your GitHub account has access and that Git authentication is configured.

```bash
git clone https://github.com/RUSHIT305/spencer.git
cd spencer
```

On Windows PowerShell, the same commands work:

```powershell
git clone https://github.com/RUSHIT305/spencer.git
Set-Location spencer
```

### Step 2 — Create an isolated Python environment

On macOS or Linux:

```bash
python3 -m venv .venv
. .venv/bin/activate
```

On Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation scripts, run this once for your user account and then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Step 3 — Install Spencer

Install the checked-out package in editable mode. This gives you the `spencer` command and lets you receive repository updates with Git.

```bash
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
```

On Windows PowerShell, use:

```powershell
py -m pip install --upgrade pip
py -m pip install -e '.[dev]'
```

### Step 4 — Verify the installation

```bash
spencer --version
spencer --doctor
```

You should see `spencer 0.2.0`. The diagnostic output reports the Python runtime, workspace, protocol, model, endpoint, and whether an API key is configured. It does not call the model.

### Step 5 — Connect any API provider

Spencer is provider-neutral. It sends JSON over HTTP and supports four protocol adapters: `generic-json`, `openai-compatible`, `anthropic-messages`, and `ollama-chat`. Choose the adapter that matches your API instead of changing Spencer’s core agent.

macOS or Linux:

```bash
export SPENCER_API_KEY="your-key"
export SPENCER_API_URL="https://your-provider.example/v1/chat/completions"
export SPENCER_API_PROTOCOL="generic-json"
export SPENCER_MODEL="your-model-id"
```

Windows PowerShell:

```powershell
$env:SPENCER_API_KEY = "your-key"
$env:SPENCER_API_URL = "https://your-provider.example/v1/chat/completions"
$env:SPENCER_API_PROTOCOL = "generic-json"
$env:SPENCER_MODEL = "your-model-id"
```

If the API uses a custom authentication header or a raw key, configure it explicitly:

```bash
export SPENCER_API_KEY_HEADER="X-API-Key"
export SPENCER_API_KEY_PREFIX=""
```

For additional request headers:

```bash
export SPENCER_API_HEADERS='{"X-Project":"spencer","X-Region":"global"}'
export SPENCER_REQUEST_FIELDS='{"provider_option":"value"}'
```

Run the diagnostic again. A configured installation should report `api_key: configured`, the selected protocol, and the provider URL.

### Step 6 — Run your first task

Start with a read-only task to understand the workflow:

```bash
spencer "Explain this repository, identify the relevant test command, and do not modify files"
```

Then try a focused change:

```bash
spencer "Add a small validation improvement, run the relevant tests, and summarize the diff"
```

Spencer will show proposed file writes and shell commands. Review each action and answer `y` only when you want it to proceed. When the run finishes, inspect the result with:

```bash
git status
git diff
```

## Distribution installation after PyPI publication

After the first public package release, the shortest installation paths will be:

```bash
uv tool install spencer-agent
# or
pipx install spencer-agent
```

User-level Python is the fallback:

```bash
python3 -m pip install --user --upgrade spencer-agent
```

Windows PowerShell:

```powershell
py -m pip install --user --upgrade spencer-agent
```

The repository includes ready-to-use installers at [`scripts/install.sh`](scripts/install.sh) and [`scripts/install.ps1`](scripts/install.ps1). The complete matrix is documented in [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Daily usage

Run Spencer from the repository it should modify:

```bash
spencer "Fix the failing parser test"
```

Target a different repository:

```bash
spencer --cwd /path/to/repository "Refactor the configuration loader without changing its public API"
```

Constrain a run:

```bash
spencer --max-steps 12 --timeout 60 "Update the parser and run its focused tests"
```

Use trusted automation only when the workspace and command policy are understood:

```bash
spencer --yes --quiet --json "Run the unit tests and report the result"
```

| Command | Purpose |
|---|---|
| `spencer --help` | Show all available options. |
| `spencer --doctor` | Check installation and provider configuration without calling the model. |
| `spencer --init` | Create a user configuration template. |
| `spencer --version` | Print the installed version. |
| `spencer --json` | Emit a machine-readable final result. |
| `spencer --quiet` | Suppress progress output. |
| `spencer --yes` | Approve writes and commands automatically; use with care. |

## Configuration

Spencer resolves settings in this order: command-line flags, environment variables, a repository-local `.spencer.toml`, and a user configuration file. Create the user template with:

```bash
spencer --init
```

A repository-local configuration can be committed when the team agrees on the defaults:

```toml
[agent]
protocol = "generic-json"
model = "your-model-id"
api_url = "https://your-provider.example/v1/chat/completions"
api_key_header = "Authorization"
api_key_prefix = "Bearer"
headers = { "X-Project" = "spencer" }
request_fields = { "provider_option" = "value" }
api_timeout = 120
content_path = "choices.0.message.content"
tool_calls_path = "choices.0.message.tool_calls"
max_steps = 20
command_timeout = 30
auto_approve = false
max_output_chars = 12000
```

The available environment variables are `SPENCER_API_KEY`, `SPENCER_API_URL`, `SPENCER_API_PROTOCOL`, `SPENCER_API_KEY_HEADER`, `SPENCER_API_KEY_PREFIX`, `SPENCER_API_HEADERS`, `SPENCER_REQUEST_FIELDS`, `SPENCER_API_TIMEOUT`, `SPENCER_CONTENT_PATH`, `SPENCER_TOOL_CALLS_PATH`, `SPENCER_MODEL`, `SPENCER_MAX_STEPS`, `SPENCER_COMMAND_TIMEOUT`, `SPENCER_AUTO_APPROVE`, and `SPENCER_MAX_OUTPUT_CHARS`.

### Supported API protocols

| Protocol | Use it for | Response mapping |
|---|---|---|
| `generic-json` | A custom HTTP API that returns JSON. | Configure `content_path` and `tool_calls_path` for the response shape. |
| `openai-compatible` | An API that follows the common chat-completions tool format. | Uses `choices.0.message.content` and `choices.0.message.tool_calls`. |
| `anthropic-messages` | An API that follows the Messages and tool-use format. | Spencer converts text blocks and tool-use blocks into its internal format. |
| `ollama-chat` | An Ollama Chat API endpoint. | Uses `message.content` and `message.tool_calls`. |

For a custom response shape, the dotted paths make the adapter configurable without writing a new integration. See the complete provider cookbook in [`docs/PROVIDERS.md`](docs/PROVIDERS.md) and the installation matrix in [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Safety model

Spencer treats the selected workspace as a hard boundary. Absolute paths, traversal attempts, and symlink escapes are rejected. Text reads and writes have configurable size limits. Writes are atomic and preserve existing file permissions.

Shell commands run from the workspace root with a timeout, bounded output, and a `SPENCER_WORKSPACE` environment variable. Several obviously destructive patterns are blocked, including `sudo`, recursive deletion from filesystem root, hard Git resets, forced Git clean operations, fork-bomb syntax, and system power commands.

These are defense-in-depth controls, not a replacement for a container, VM, or operating-system sandbox when working with untrusted code. Run Spencer with the least privilege necessary and review the resulting Git diff.

## Project structure

```text
spencer/
├── assets/                 Brand assets
├── docs/                   Installation, provider, and architecture guides
├── scripts/                Unix and PowerShell installers
├── src/spencer/
│   ├── agent.py            Model/tool orchestration loop
│   ├── cli.py              Terminal interface and diagnostics
│   ├── config.py           Layered cross-platform configuration
│   ├── provider.py         Provider retries and API compatibility
│   ├── tools.py            Model-facing tool definitions
│   └── workspace.py        Repository operations and safety checks
├── tests/                  Unit and integration-style tests
├── .github/                CI, release, ownership, and issue workflows
├── CONTRIBUTING.md         Contributor workflow
├── SECURITY.md             Vulnerability reporting policy
└── pyproject.toml          Package and build configuration
```

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the engineering boundaries and [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for the full installation matrix.

## Development

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
python -m pytest
python -m spencer.cli --version
```

GitHub Actions tests Linux, macOS, and Windows across Python 3.10–3.13, validates the command-line smoke test, builds the wheel and source distribution, and checks package metadata. Tagged releases use the PyPI trusted-publishing workflow.

## Contributing and support

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Report security issues privately according to [`SECURITY.md`](SECURITY.md). For product issues, include the output of `spencer --doctor` after removing keys, tokens, repository contents, and personal data.

## License

Spencer is released under the [MIT License](LICENSE).
