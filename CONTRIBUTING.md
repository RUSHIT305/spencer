# Contributing to Spencer

Thank you for helping improve Spencer. The project values small, reviewable changes that make the terminal experience safer, faster, and easier to understand.

## Development setup

Use the Node.js development toolchain for source checks and release builds:

```bash
npm ci
npm test
npm run check
npm run build:binary -- --output dist/spencer
```

Keep changes focused. Add or update Node tests for behavior changes, avoid committing generated binaries, and run the complete source and standalone-build gate before opening a pull request. If a change affects installation or user-visible behavior, update `README.md`, `docs/INSTALLATION.md`, and the changelog.

The managed Gemini gateway is a deployment-owned service. Do not add credentials to local files, tests, fixtures, logs, npm packages, pull requests, or GitHub Actions output. Gateway tests must use deterministic mocks; live Gemini calls belong only in protected deployment environments.

## Pull requests

Describe the user problem, the behavior that changed, and how it was verified. Security-sensitive changes should explain the threat model and remaining limitations. Do not include API keys, repository contents, or backend responses containing secrets in issues, test fixtures, or logs.

The maintainers use the CI workflow as the merge gate. It tests Node 18, 20, and 22 across Linux, macOS, and Windows, runs the complete Node suite, parses the PowerShell installer, validates the managed gateway syntax, and builds a standalone Linux executable.
