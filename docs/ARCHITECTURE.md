# Spencer architecture

Spencer is a Node.js command-line application distributed exclusively through npm. The npm client never asks users for API credentials or provider settings. It connects to Spencer’s company-managed Gemini gateway, which stores the Gemini credential as a deployment secret.

## Runtime layers

```text
npm executable
    │
    ▼
CLI and local configuration
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

## Managed backend contract

The npm client sends only normalized Spencer messages and tool declarations to the fixed Spencer gateway endpoint. It does not send a user API key, provider URL, model override, custom headers, or arbitrary request fields. The gateway authenticates to Gemini with a deployment secret and translates the request into Gemini `generateContent` format.

The gateway maps Spencer messages into Gemini contents, translates tool declarations into Gemini function declarations, converts Gemini function calls back into Spencer tool calls, and returns a stable normalized response to the client. Retry policy and timeout behavior are applied at the client and gateway boundaries.

The Gemini key must exist only in the backend deployment environment as `GEMINI_API_KEY` or an equivalent secret-manager binding. It must never be committed to source control, embedded in the npm package, printed in diagnostics, or sent from the developer’s terminal.

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
| Workspace and approvals | Developer | npm CLI flags |

## Distribution

The npm artifact includes the Node CLI and managed client. It does not include a Gemini credential. The gateway source is included for company deployment and is not required for npm installation.

CI validates the npm package across macOS, Linux, and Windows with Node 18, 20, and 22. Tagged releases publish the package with npm provenance enabled.
