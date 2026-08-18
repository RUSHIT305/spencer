# Contributing to Spencer

Thank you for helping improve Spencer. The project values small, reviewable changes that make the terminal experience safer, faster, and easier to understand.

## Development setup

Use Python 3.10 or newer and create an isolated environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
python -m pytest
```

Keep changes focused. Add or update tests for behavior changes, avoid committing generated artifacts, and run `python -m pytest` before opening a pull request. If a change affects installation or user-visible behavior, update `README.md` and the relevant release notes.

## Pull requests

Describe the user problem, the behavior that changed, and how it was verified. Security-sensitive changes should explain the threat model and the remaining limitations. Do not include API keys, repository contents, or provider responses containing secrets in issues, test fixtures, or logs.

The maintainers use the CI workflow as the merge gate. It tests supported Python versions across Linux, macOS, and Windows, runs the unit suite, smoke-tests the CLI, and validates distribution artifacts.
