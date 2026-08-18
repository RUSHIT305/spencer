<div align="center">
  <img src="assets/spencer-mark.svg" width="112" alt="Spencer mark" />
  <h1>Spencer</h1>
  <p><strong>Your coding partner in the terminal.</strong></p>
  <p>Inspect. Edit. Verify. Stay in control.</p>
  <p>
    <a href="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml"><img src="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
    <a href="https://img.shields.io/badge/install-npm_only-111827.svg"><img src="https://img.shields.io/badge/install-npm_only-111827.svg" alt="npm-only installation" /></a>
    <a href="https://github.com/RUSHIT305/spencer/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-111827.svg" alt="MIT license" /></a>
    <a href="https://img.shields.io/badge/status-beta-2563eb.svg"><img src="https://img.shields.io/badge/status-beta-2563eb.svg" alt="Beta status" /></a>
  </p>
</div>

Spencer is a **Node.js terminal coding agent** for developers who want an AI pair programmer without leaving the shell, editor, or Git workflow. It is distributed strictly through npm, runs on Node.js 18 or newer, and works on macOS, Linux, Windows, CI runners, and containers.

> **Installation policy:** Spencer is installed with npm only. No Python runtime, Python package manager, virtual environment, provider SDK, or provider-specific installer is required.

The default experience is human-in-the-loop. Spencer can inspect automatically, but file changes and shell commands require approval. The final result remains in the normal Git working tree for review.

## Install Spencer

### Global installation

```bash
npm install --global spencer-agent
spencer --version
```

### One-time execution with npx

```bash
npx spencer-agent --version
npx spencer-agent "Explain this repository without changing files"
```

### Project-local installation

```bash
npm install --save-dev spencer-agent
npx spencer "Run the relevant tests and summarize the result"
```

These commands are the complete installation process for every supported operating system.

## First run

Run diagnostics without contacting a model:

```bash
spencer --doctor
```

Start with a read-only repository task:

```bash
spencer "Inspect this repository and explain its architecture without modifying files"
```

Then try a focused coding task:

```bash
spencer "Fix the failing parser test and run the relevant checks"
```

Spencer displays proposed file writes and shell commands. Approve each action interactively, or use `--yes` only in a trusted workspace or controlled automation job.

## Configure any API at runtime

Spencer does not install or bundle a provider SDK. It sends standard HTTP JSON requests to the endpoint you choose. Configure the API at runtime:

```bash
export SPENCER_API_PROTOCOL="generic-json"
export SPENCER_API_URL="https://your-provider.example/v1/chat/completions"
export SPENCER_API_KEY="your-key"
export SPENCER_MODEL="your-model-id"
```

Windows PowerShell:

```powershell
$env:SPENCER_API_PROTOCOL = "generic-json"
$env:SPENCER_API_URL = "https://your-provider.example/v1/chat/completions"
$env:SPENCER_API_KEY = "your-key"
$env:SPENCER_MODEL = "your-model-id"
```

This is runtime configuration, not installation. Spencer includes built-in adapters for generic JSON, OpenAI-compatible, Anthropic Messages, and Ollama Chat protocols. See [`docs/PROVIDERS.md`](docs/PROVIDERS.md) for examples.

## What Spencer does

| Capability | Spencer behavior |
|---|---|
| Repository understanding | Lists files, searches text, reads relevant files, and checks Git status. |
| Code changes | Replaces UTF-8 text files atomically inside the selected workspace. |
| Verification | Runs focused tests, linters, formatters, and other developer commands with bounded time and output. |
| Developer control | Prompts before writes and shell commands; `--yes` is an explicit trusted-automation switch. |
| Provider flexibility | Connects to configurable HTTP APIs through built-in protocol adapters. |
| Automation | Supports quiet output, JSON results, deterministic step limits, and diagnostics. |

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
| `spencer --doctor` | Check the Node installation and provider configuration without calling the model. |
| `spencer --init` | Create a user configuration template. |
| `spencer --version` | Print the installed version. |
| `spencer --json` | Emit a machine-readable final result. |
| `spencer --quiet` | Suppress progress output. |
| `spencer --yes` | Approve writes and commands automatically; use with care. |

## Configuration

Spencer resolves settings in this order: command-line flags, environment variables, a repository-local `.spencer.toml`, and a user configuration file created by `spencer --init`.

```toml
[agent]
protocol = "generic-json"
model = "your-model-id"
api_url = "https://your-provider.example/v1/chat/completions"
api_key_header = "Authorization"
api_key_prefix = "Bearer"
headers = { "X-Project" = "spencer" }
request_fields = { "provider_option" = "value" }
api_timeout_ms = 120000
content_path = "choices.0.message.content"
tool_calls_path = "choices.0.message.tool_calls"
max_steps = 20
command_timeout_ms = 30000
auto_approve = false
max_output_chars = 12000
```

Available environment variables include `SPENCER_API_KEY`, `SPENCER_API_URL`, `SPENCER_API_PROTOCOL`, `SPENCER_API_KEY_HEADER`, `SPENCER_API_KEY_PREFIX`, `SPENCER_API_HEADERS`, `SPENCER_REQUEST_FIELDS`, `SPENCER_API_TIMEOUT_MS`, `SPENCER_CONTENT_PATH`, `SPENCER_TOOL_CALLS_PATH`, `SPENCER_MODEL`, `SPENCER_MAX_STEPS`, `SPENCER_COMMAND_TIMEOUT_MS`, `SPENCER_AUTO_APPROVE`, and `SPENCER_MAX_OUTPUT_CHARS`.

## Built-in protocols

| Protocol | Use it for | Response mapping |
|---|---|---|
| `generic-json` | A custom HTTP API that returns JSON. | Configure `content_path` and `tool_calls_path`. |
| `openai-compatible` | An API following the common chat-completions tool format. | Uses `choices.0.message.content` and `choices.0.message.tool_calls`. |
| `anthropic-messages` | An API following the Messages and tool-use format. | Converts text blocks and tool-use blocks into Spencer’s normalized format. |
| `ollama-chat` | An Ollama Chat HTTP endpoint. | Uses `message.content` and `message.tool_calls`. |

For a different request or response contract, add a Node backend plugin. See [`docs/PLUGINS.md`](docs/PLUGINS.md).

## Safety model

Spencer treats the selected workspace as a hard boundary. Absolute paths, traversal attempts, and symlink escapes are rejected. Text reads and writes have configurable size limits. Writes are atomic and preserve existing file permissions.

Shell commands run from the workspace root with a timeout, bounded output, and a `SPENCER_WORKSPACE` environment variable. Obviously destructive patterns are blocked, including `sudo`, recursive deletion from filesystem root, hard Git resets, forced Git clean operations, fork-bomb syntax, and system power commands.

These are defense-in-depth controls, not a replacement for a container, VM, or operating-system sandbox when working with untrusted code. Run Spencer with the least privilege necessary and review the resulting Git diff.

## Project structure

```text
spencer/
├── assets/                 Brand assets
├── bin/spencer.js          npm executable
├── lib/
│   ├── agent.js            Agent/tool orchestration loop
│   ├── cli.js              Terminal interface and diagnostics
│   ├── config.js           Layered runtime configuration
│   ├── provider.js         HTTP provider registry and adapters
│   ├── tools.js            Model-facing tool definitions
│   └── workspace.js        Repository operations and safety checks
├── docs/                   npm, provider, plugin, and architecture guides
├── test/                   Node.js automated tests
├── .github/                CI, release, ownership, and issue workflows
├── package.json            npm package and executable metadata
├── package-lock.json       Reproducible npm metadata
├── CONTRIBUTING.md         Contributor workflow
└── SECURITY.md             Vulnerability reporting policy
```

Read [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for the single npm installation path and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for engineering boundaries.

## Development

Clone the public repository and install the project with npm:

```bash
git clone https://github.com/RUSHIT305/spencer.git
cd spencer
npm install
npm test
npm run check
```

GitHub Actions runs the Node test suite across macOS, Linux, and Windows with Node 18, 20, and 22. It also validates package contents and the npm executable on every supported platform. Tagged releases publish the npm package with provenance enabled.

## Contributing and support

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Report security issues privately according to [`SECURITY.md`](SECURITY.md). For product issues, include the output of `spencer --doctor` after removing keys, tokens, repository contents, and personal data.
