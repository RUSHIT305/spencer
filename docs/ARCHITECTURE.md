# Spencer architecture

Spencer is a Node.js command-line application distributed exclusively through npm. The runtime is intentionally local: it reads a selected repository, sends normalized requests to a configured HTTP API, executes approved workspace tools, and returns a final response.

## Runtime layers

```text
npm executable
    │
    ▼
CLI and configuration
    │
    ├── diagnostics and initialization
    ├── approval policy
    └── output formatting
    │
    ▼
Agent loop
    │
    ├── normalized conversation messages
    ├── bounded iteration count
    └── tool-call dispatch
    │
    ├───────────────┬────────────────────┐
    ▼               ▼                    ▼
Provider registry  Workspace tools       Safety controls
    │               │                    │
    ├── generic     ├── list/search/read ├── root containment
    ├── compatible  ├── atomic write     ├── symlink checks
    ├── Messages    ├── Git status       ├── command blocklist
    └── Ollama      └── bounded commands └── time/output limits
```

## Provider contract

The provider layer has two responsibilities. A backend builds a JSON request body from normalized Spencer messages and tools. The same backend normalizes the provider response into a stable `{ choices: [{ message: { content, tool_calls } }] }` shape consumed by the agent. Retries, request timeouts, authentication headers, and HTTP transport stay in Spencer core.

Built-in backends cover generic JSON, OpenAI-compatible, Anthropic Messages, and Ollama Chat APIs. Custom Node backend plugins can register additional request/response contracts without changing the agent or workspace layers.

## Workspace boundary

The workspace object resolves the selected root once and rejects absolute paths, traversal, and symlink escapes. File writes use a temporary file followed by an atomic rename. Reads and command output are bounded. Shell execution inherits the workspace as its current directory and exposes `SPENCER_WORKSPACE` for scripts that need to locate it.

The command policy blocks a small set of obviously destructive patterns. This is defense in depth, not a sandbox. For untrusted repositories, run Spencer inside a container or disposable machine with least privilege.

## Configuration precedence

Runtime settings resolve in this order:

1. Explicit CLI flags.
2. Environment variables.
3. Repository-local `.spencer.toml`.
4. User configuration created by `spencer --init`.
5. Safe defaults.

Secrets are read only at runtime and diagnostics report only whether a key is configured. No credentials are written to the repository by Spencer.

## Distribution

The package is self-contained as an npm artifact. It includes the Node CLI, runtime library, and documentation needed by users and maintainers. It does not require Python, a Python package manager, a provider SDK, or a provider-specific installer.

CI validates the npm package across macOS, Linux, and Windows with Node 18, 20, and 22. Tagged releases publish the package with npm provenance enabled.
