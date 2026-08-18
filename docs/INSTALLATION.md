# Install Spencer

Spencer is a Node.js command-line application. **npm is the only installation method.** The AI backend is managed by Spencer, so users do not install Python, a provider SDK, a model runtime, or an API key.

## Install

Install Spencer globally:

```bash
npm install --global spencer-agent
spencer --version
```

Or run it once with `npx`:

```bash
npx spencer-agent --version
npx spencer-agent "Explain this repository without changing files"
```

Or install it in a project:

```bash
npm install --save-dev spencer-agent
npx spencer "Run the relevant tests and summarize the result"
```

The same commands work on macOS, Linux, Windows PowerShell, Windows Command Prompt, CI runners, and containerized Node environments.

## Verify

Run diagnostics without contacting the AI backend:

```bash
spencer --doctor
```

A healthy result shows the Spencer version, Node version, platform, workspace, managed backend, managed model, and `userApiConfiguration: false`. Credentials are never displayed because they are held by Spencer’s backend service.

## Run Spencer

Start with a read-only task:

```bash
spencer "Inspect this repository and explain its architecture without modifying files"
```

Then run a focused coding task:

```bash
spencer "Fix the failing test and run the relevant checks"
```

Spencer asks for approval before file writes and shell commands. Use `--yes` only in a trusted workspace or controlled automation job.

## What users do not configure

Users do not set API keys, provider URLs, model IDs, protocol names, custom headers, request fields, or provider SDKs. Spencer’s npm client connects to the company-managed Gemini gateway, and the gateway stores the Gemini credential as a deployment secret.

If the managed backend is temporarily unavailable, Spencer reports an actionable service error. Users should not add a local API key or modify provider settings to work around it.

## Troubleshooting

If `spencer` is not found after a global installation, open a new terminal so npm’s global binary directory is available on `PATH`. Check the npm global prefix with `npm prefix --global`.

If the backend is unavailable, run `spencer --doctor` and check the public service-status channel or Spencer release notes. Do not add credentials to shell profiles, repository files, `.spencer.toml`, GitHub issues, or pull requests.
