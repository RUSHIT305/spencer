# Security Policy

## Scope

Spencer executes model-proposed shell commands and writes files in a local workspace. The project treats this capability as high impact and applies workspace containment, approval gates, command timeouts, output limits, and a small destructive-command denylist.

These measures are defense-in-depth. Spencer is not a substitute for a container, VM, OS sandbox, or least-privilege account when operating on untrusted repositories.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use the repository’s private security-advisory channel or contact the maintainers privately with a concise description, affected version, reproduction steps, and impact assessment. Remove API keys, tokens, proprietary source, and personal data from all reports.

Maintainers should acknowledge a report, reproduce it in an isolated environment, assess affected versions, and publish a remediation note once a fix is available. Do not run proof-of-concept payloads against production systems or repositories you do not own.

## Supported versions

Security fixes are prioritized for the latest tagged release and the default branch. Users should keep Spencer updated through their chosen isolated tool manager and run `spencer --doctor` after upgrades.
