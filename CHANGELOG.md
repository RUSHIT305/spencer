# Changelog

All notable changes to Spencer are documented here.

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
