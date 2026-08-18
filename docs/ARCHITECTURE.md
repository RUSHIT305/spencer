# Spencer architecture

Spencer is a cross-platform terminal coding agent distributed as standalone native executables. The user-facing installers do not require npm, Node.js, Python, provider SDKs, or API credentials. Each release contains a platform and architecture-specific executable downloaded from GitHub Releases and verified with a published SHA-256 checksum.

## Runtime layers

```text
Standalone Spencer executable
    │
    ▼
CLI and local runtime
    │
    ├── workspace and safety flags only
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
    ├───────────────────┬────────────────────┐
    ▼                   ▼                    ▼
Managed Gemini client  Workspace tools       Safety controls
    │                   │                    │
    ▼                   ├── list/search/read ├── root containment
Company gateway        ├── atomic write     ├── symlink checks
    │                   ├── Git status       ├── command blocklist
    ▼                   └── bounded commands └── time/output limits
Google Gemini API
```

## Distribution and installation

Release builds use Node’s Single Executable Application mechanism. Spencer’s CommonJS modules are bundled into one entry script, injected into a matching Node runtime binary, and emitted as a native executable. GitHub-hosted runners build the artifacts on their target operating systems. Current release targets are Linux x64, macOS x64, macOS arm64, and Windows x64. Additional architectures will be added only when they have a matching build runner and release smoke test.

The Unix installer is a Bash script. It detects the operating system and architecture, downloads the matching release artifact, verifies `SHA256SUMS`, installs it under a per-user directory, and updates the user shell profile. The Windows installer is a native PowerShell script that performs the same steps under `%LOCALAPPDATA%\Spencer\bin` and updates the user `PATH` without requiring administrator privileges.

The installed executable uses the current working directory as its default workspace. Running `cd project && spencer` starts an interactive prompt, while direct task arguments remain available for automation.

## Managed backend contract

The standalone client sends only normalized Spencer messages and tool declarations to the fixed Spencer gateway endpoint. It does not send a user API key, provider URL, model override, custom headers, or arbitrary request fields. The gateway authenticates to Gemini with a deployment secret and translates the request into Gemini `generateContent` format.

The gateway maps Spencer messages into Gemini contents, translates tool declarations into Gemini function declarations, converts Gemini function calls back into Spencer tool calls, and returns a stable normalized response to the client. Retry policy and timeout behavior are applied at the client and gateway boundaries.

The Gemini key must exist only in the backend deployment environment as `GEMINI_API_KEY` or an equivalent secret-manager binding. It must never be committed to source control, embedded in a release executable, printed in diagnostics, or sent from the developer’s terminal.

## Workspace boundary

The workspace object resolves the selected root once and rejects absolute paths, traversal, and symlink escapes. File writes use a temporary file followed by an atomic rename. Reads and command output are bounded. Shell execution inherits the workspace as its current directory and exposes `SPENCER_WORKSPACE` for scripts that need to locate it.

The command policy blocks a small set of obviously destructive patterns. This is defense in depth, not a sandbox. For untrusted repositories, run Spencer inside a container or disposable machine with least privilege.

## Configuration boundary

Users control only local execution behavior: workspace path, step limit, shell timeout, approval mode, JSON output, and quiet output. Backend settings are deployment-owned:

| Setting | Owner | Location |
|---|---|---|
| Gemini credential | Spencer operations | Backend secret manager or deployment environment |
| Gemini model | Spencer operations | Gateway deployment configuration |
| Gemini endpoint | Spencer operations | Gateway source and deployment |
| Rate limits and policy | Spencer operations | Gateway and service platform |
| Workspace and approvals | Developer | Spencer command options |

## Verification and release boundary

Source checks run on Node.js development environments, while release workflows build and smoke-test native artifacts on the supported operating systems. Each release publishes binaries, checksums, release notes, and installer-compatible asset names through GitHub Releases. The installer never trusts an unchecked binary and never requires a package-registry credential on the user’s machine.
