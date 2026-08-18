<div align="center">
  <img src="assets/spencer-mark.svg" width="112" alt="Spencer mark" />
  <h1>Spencer</h1>
  <p><strong>Your coding partner in the terminal.</strong></p>
  <p>Inspect. Edit. Verify. Stay in control.</p>
  <p>
    <a href="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml"><img src="https://github.com/RUSHIT305/spencer/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
    <a href="https://img.shields.io/badge/install-npm_only-111827.svg"><img src="https://img.shields.io/badge/install-npm_only-111827.svg" alt="npm-only installation" /></a>
    <a href="https://img.shields.io/badge/backend-managed_Gemini-4285F4.svg"><img src="https://img.shields.io/badge/backend-managed_Gemini-4285F4.svg" alt="Managed Gemini backend" /></a>
    <a href="https://github.com/RUSHIT305/spencer/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-111827.svg" alt="MIT license" /></a>
  </p>
</div>

Spencer is a **Node.js terminal coding agent** for developers who want an AI pair programmer without leaving the shell, editor, or Git workflow. It is distributed through npm and works on macOS, Linux, Windows, CI runners, and containers.

> **Zero provider setup:** Spencer uses a company-managed Gemini backend. Users do not install Python, provider SDKs, model runtimes, or API keys, and they do not configure endpoints or model IDs.

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

These are the complete installation steps on every supported operating system.

## First run

Run diagnostics without contacting the managed backend:

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

## Managed Gemini backend

Spencer connects automatically to the company-managed Gemini service. The npm client contains no Gemini credential. The backend gateway holds its Gemini credential as a deployment secret and translates Spencer’s tool loop to Gemini’s `generateContent` API.

Users do not set API keys, provider URLs, protocol names, model IDs, custom headers, or request fields. There is no API configuration file. `spencer --init` simply confirms that the managed backend is ready automatically.

This architecture keeps credentials out of developer machines, shell history, repository files, npm packages, and public GitHub content. It also gives the Spencer team one place to apply rate limits, model upgrades, safety policies, and service monitoring.

## What Spencer does

| Capability | Spencer behavior |
|---|---|
| Repository understanding | Lists files, searches text, reads relevant files, and checks Git status. |
| Code changes | Replaces UTF-8 text files atomically inside the selected workspace. |
| Verification | Runs focused tests, linters, formatters, and other developer commands with bounded time and output. |
| Developer control | Prompts before writes and shell commands; `--yes` is an explicit trusted-automation switch. |
| Managed intelligence | Uses Spencer’s managed Gemini backend with no user provider setup. |
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
| `spencer --help` | Show available workspace and safety options. |
| `spencer --doctor` | Check the Node installation and managed-backend status without calling the model. |
| `spencer --init` | Confirm that no API configuration file is required. |
| `spencer --version` | Print the installed version. |
| `spencer --json` | Emit a machine-readable final result. |
| `spencer --quiet` | Suppress progress output. |
| `spencer --yes` | Approve writes and commands automatically; use with care. |

## Configuration policy

Spencer intentionally has no user-facing API configuration. The only supported runtime controls are workspace and execution-safety settings:

```text
--cwd PATH
--max-steps N
--timeout SECONDS
--yes
--json
--quiet
```

The managed backend, Gemini model, endpoint, authentication, retries, and service policy are controlled by Spencer’s deployment—not by npm users.

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
│   ├── config.js           Managed runtime configuration
│   ├── gemini.js           Managed backend client
│   ├── tools.js            Model-facing tool definitions
│   └── workspace.js        Repository operations and safety checks
├── server/
│   └── gemini-gateway.js   Company-managed Gemini gateway
├── docs/                   Installation and architecture guides
├── test/                   Node.js automated tests
├── .github/                CI, release, ownership, and issue workflows
├── package.json            npm package and executable metadata
├── package-lock.json       Reproducible npm metadata
├── CONTRIBUTING.md         Contributor workflow
└── SECURITY.md             Vulnerability reporting policy
```

Read [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for the single npm installation path and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the managed service boundary.

## Development

Clone the public repository and install the project with npm:

```bash
git clone https://github.com/RUSHIT305/spencer.git
cd spencer
npm install
npm test
npm run check
```

GitHub Actions runs the Node test suite across macOS, Linux, and Windows with Node 18, 20, and 22. It validates the npm package and executable on every supported platform. Tagged releases publish the npm package with provenance enabled.

## Contributing and support

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Report security issues privately according to [`SECURITY.md`](SECURITY.md). Never include credentials, private repository contents, or backend URLs in issues or pull requests.
