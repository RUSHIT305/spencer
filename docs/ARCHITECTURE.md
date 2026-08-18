# Spencer Architecture

Spencer is intentionally split into small boundaries so the product can evolve without turning the terminal experience into a monolith.

| Boundary | Responsibility |
|---|---|
| `cli.py` | Parses commands, renders progress, handles approval prompts, and exposes diagnostics. |
| `config.py` | Resolves settings from CLI flags, environment variables, workspace TOML, and user TOML. |
| `provider.py` | Adapts the OpenAI-compatible API, applies model-family request details, and retries transient failures. |
| `agent.py` | Runs the model/tool conversation and enforces the step budget. |
| `tools.py` | Publishes the explicit model-facing tool contract and dispatches approved operations. |
| `workspace.py` | Owns path containment, text I/O, atomic writes, Git status, and bounded shell execution. |

The runtime flow is straightforward. The CLI resolves a workspace and settings, builds a constrained workspace object, and starts the agent. The agent sends a task plus an initial repository snapshot to the provider. When the model requests a tool, Spencer validates the arguments, asks for approval when the tool can mutate state, executes it inside the workspace, and returns the bounded result to the model. The loop stops at a final model response or the configured step limit.

> Spencer’s safety model is defense-in-depth, not a substitute for a container, VM, or operating-system sandbox when the repository or command is untrusted.

## Product boundaries

Spencer does not run a background daemon, collect hidden telemetry, or require a hosted workspace. It operates on the developer’s machine and leaves changes in the developer’s normal Git working tree. Future execution backends can add stronger isolation without changing the provider or CLI contracts.
