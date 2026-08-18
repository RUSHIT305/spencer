# Changelog

All notable changes to Spencer are documented here.

## [0.5.1] — 2026-08-18

### Added

- Running `spencer` without a task in an interactive terminal now prompts for the coding task and uses the current directory as the workspace.
- Updated the primary npm installation and daily-use documentation to make the `cd project && spencer` workflow explicit.

## [0.5.0] — 2026-08-18

### Changed

- Removed user-facing API configuration, provider selection, custom endpoints, model overrides, and provider plugin setup.
- Added a company-managed Gemini gateway with server-side credential handling.
- Added a Node-native Gemini client that sends only normalized agent requests to the managed gateway.
- Added gateway tests for Gemini function declarations, function calls, function results, and response normalization.
- Updated installation and product documentation so npm installation is the only user setup step.

## [0.4.0] — 2026-08-18

### Added

- Cross-platform npm package named `spencer-agent` with a global `spencer` executable.
- Node-native Spencer runtime with no Python prerequisite.
- `npx spencer-agent` and project-local npm installation support.
- Cross-platform Node runtime support on Node.js 18, 20, and 22.
- npm package manifest checks, wrapper tests, clean tarball installation tests, and Node.js CI across macOS, Linux, and Windows.
- Tagged npm publishing with provenance enabled in the release workflow.
- npm-only documentation and CI/CD with alternate Python and provider installation paths removed.

## [0.3.0] — 2026-08-18

### Added

- Pluggable backend registry with built-in generic JSON, OpenAI-compatible, Anthropic Messages, and Ollama Chat adapters.
- Third-party backend discovery through the `spencer.backends` Python entry-point group.
- Local-model support through the Ollama Chat backend.
- CLI diagnostics listing available provider backends.
- Automated CLI, provider, backend, safety, configuration, and agent-loop tests.
- Ruff and Mypy quality gates in CI.
- Clean-wheel installation smoke tests and build-provenance attestation in the release workflow.

## [0.2.0] — 2026-08-18

### Added

- Provider-neutral HTTP API support through `generic-json`, `openai-compatible`, `anthropic-messages`, and `ollama-chat` protocols.
- Configurable API URL, model, API-key header, API-key prefix, custom headers, request timeout, and response JSON paths.
- Standard-library HTTP transport with no required vendor SDK dependency.

## [0.1.0] — 2026-08-18

### Added

- Terminal-first coding-agent loop using OpenAI-compatible function tools.
- Repository inspection through file listing, text search, line-numbered reads, and Git status.
- Approval-gated file writes and shell commands with explicit `--yes` automation mode.
- Workspace path containment, symlink escape protection, atomic writes, file-size limits, command timeouts, output truncation, and destructive-command checks.
- Layered TOML, environment, and CLI configuration with `spencer --init` and `spencer --doctor`.
- JSON and quiet modes for scripts and CI.
- Provider retries with model-family-specific request handling.
- Cross-platform Unix and PowerShell installers.
- GitHub Actions CI across Linux, macOS, Windows, and supported Python versions.
- PyPI-ready wheel and source-distribution release workflow.

### Verification

The release baseline passes the local test suite and the GitHub Actions cross-platform matrix. Distribution artifacts pass package metadata validation.
