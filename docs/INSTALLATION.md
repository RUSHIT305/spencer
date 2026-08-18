# Install Spencer

Spencer is a Node.js command-line application. **npm is the only installation method.** No Python runtime, Python package manager, virtual environment, provider SDK, or provider-specific installer is required.

## Requirements

Install Node.js 18 or newer. Then install Spencer with npm:

```bash
npm install --global spencer-agent
spencer --version
```

For a one-time run without a global install:

```bash
npx spencer-agent --version
npx spencer-agent "Explain this repository without changing files"
```

For a project-local developer dependency:

```bash
npm install --save-dev spencer-agent
npx spencer "Run the relevant tests and summarize the result"
```

The same commands work in macOS, Linux, Windows PowerShell, Windows Command Prompt, CI runners, and containerized Node environments.

## Configure an API at runtime

Spencer does not install a provider or provider SDK. It sends standard HTTP JSON requests to the API endpoint you choose. Configure the endpoint, model, and credentials as environment variables or in Spencer’s generated configuration file.

```bash
spencer --init
```

Set the runtime values for your provider:

```bash
export SPENCER_API_PROTOCOL="generic-json"
export SPENCER_API_URL="https://your-provider.example/v1/chat/completions"
export SPENCER_API_KEY="your-key"
export SPENCER_MODEL="your-model-id"
```

Windows PowerShell:

```powershell
$env:SPENCER_API_PROTOCOL = "generic-json"
$env:SPENCER_API_URL = "https://your-provider.example/v1/chat/completions"
$env:SPENCER_API_KEY = "your-key"
$env:SPENCER_MODEL = "your-model-id"
```

These are **runtime settings**, not installation steps. Spencer supports generic JSON, OpenAI-compatible, Anthropic Messages, and Ollama Chat protocols without installing any provider package.

## Verify the installation

Run diagnostics without contacting a model:

```bash
spencer --doctor
```

A healthy result shows the Spencer version, Node version, platform, workspace, selected protocol, model, endpoint status, and available built-in backends. API keys are reported only as `configured` or `missing`; their values are never printed.

## Run Spencer

Start with a read-only task:

```bash
spencer "Inspect the repository and explain its architecture without changing files"
```

Then run a task that may propose changes:

```bash
spencer "Fix the failing test and run the relevant checks"
```

Spencer asks for approval before file writes and shell commands. Use `--yes` only in a trusted workspace or controlled CI job.

## Troubleshooting

If `spencer` is not found after a global installation, open a new terminal so npm’s global binary directory is available on `PATH`. Check the npm global prefix with `npm prefix --global`.

If an API request fails, run `spencer --doctor`, confirm the endpoint and model values, and inspect the selected protocol. Do not install a provider SDK; Spencer’s HTTP backend is built in.
