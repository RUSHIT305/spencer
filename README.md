# Spencer

Spencer is a terminal-first coding agent for local repositories. It uses an OpenAI-compatible chat-completions provider to inspect a workspace, plan changes, edit files, run focused checks, and summarize the result. The default experience is deliberately cautious: inspection tools run automatically, while file replacement and shell execution require an explicit approval. Trusted automation can opt into `--yes`.

## What is included

| Capability | Spencer behavior |
|---|---|
| Repository inspection | Lists files, searches text, reads line-numbered files, and reports Git status. |
| Editing | Replaces complete UTF-8 text files within the workspace only. |
| Verification | Runs shell commands from the workspace root with bounded time and output. |
| Safety | Rejects workspace escapes, several destructive command patterns, and unapproved writes or commands. |
| Provider | Uses the OpenAI Python SDK against any compatible endpoint. |
| Configuration | Supports model, endpoint, workspace, step, timeout, and approval settings from CLI flags or environment variables. |

## Installation

Spencer requires Python 3.10 or newer. From this repository:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e .
```

Set an API key for the compatible provider:

```bash
export OPENAI_API_KEY="your-key"
```

The default model is `gpt-5-mini`. Override it with `SPENCER_MODEL` or `--model`. If the provider is not the default OpenAI endpoint, set `SPENCER_API_BASE` to its chat-completions base URL.

## Usage

Run Spencer from the repository it should modify:

```bash
spencer "Add input validation to the user registration flow and run the relevant tests"
```

You can target another repository without changing directories:

```bash
spencer --cwd /path/to/repository "Fix the failing parser test"
```

Useful controls are available for constrained or automated runs:

```bash
spencer --max-steps 12 --timeout 60 "Refactor the configuration loader"
spencer --yes "Run the formatter and fix the reported issues"
```

`--yes` approves all file writes and shell commands issued by the model. Use it only in a trusted workspace, preferably with a clean Git working tree and a reviewable diff.

## Safety model

Spencer treats the workspace root as a hard boundary. Absolute paths and paths that resolve outside the repository are rejected. Shell commands run with the workspace as their current directory, receive `SPENCER_WORKSPACE`, have a timeout, and have their output truncated. Obvious high-risk patterns such as `sudo`, recursive deletion from filesystem root, destructive hard resets, destructive Git clean operations, system power commands, and fork-bomb syntax are rejected before execution.

These controls are guardrails rather than a security boundary. Spencer should still be run with least-privilege credentials, and users should review proposed changes and command output.

## Provider compatibility

Spencer sends standard chat-completions messages with function tools. The provider must support tool calling. Spencer selects the appropriate token parameter for GPT, Claude, and Gemini model families so that reasoning-enabled models do not accidentally consume the visible output budget.

## Development

Run the test suite after installing the development dependency:

```bash
python -m pip install -e '.[dev]'
pytest
```

The core modules are intentionally small. `workspace.py` owns repository operations and safety checks, `tools.py` defines the model-facing contract, `agent.py` owns the provider/tool loop, and `cli.py` owns the interactive terminal experience.
