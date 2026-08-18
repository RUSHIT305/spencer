# Install Spencer

Spencer is a Python command-line application. The supported runtime is Python 3.10 or newer. Choose one installation path below, then verify the command before starting your first run.

## Option A: `uv` — recommended

`uv` installs Spencer into an isolated tool environment and keeps the `spencer` executable available without modifying a project virtual environment.

### macOS and Linux

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# Restart your terminal, then:
uv tool install spencer-agent
spencer --version
```

### Windows PowerShell

```powershell
winget install --id=astral-sh.uv -e
# Restart PowerShell, then:
uv tool install spencer-agent
spencer --version
```

## Option B: `pipx`

`pipx` is also an isolated installation method.

### macOS and Linux

```bash
python3 -m pip install --user pipx
python3 -m pipx ensurepath
# Restart your terminal, then:
pipx install spencer-agent
spencer --version
```

### Windows PowerShell

```powershell
py -m pip install --user pipx
py -m pipx ensurepath
# Restart PowerShell, then:
pipx install spencer-agent
spencer --version
```

## Option C: user-level Python installation

Use this option when `uv` and `pipx` are not available.

### macOS and Linux

```bash
python3 -m pip install --user --upgrade spencer-agent
spencer --version
```

### Windows PowerShell

```powershell
py -m pip install --user --upgrade spencer-agent
spencer --version
```

If the command is not found after a user-level installation, add Python’s user `bin` or `Scripts` directory to `PATH`, then restart the terminal.

## Option D: install from a source checkout

This path is intended for contributors or developers testing unreleased changes.

```bash
git clone https://github.com/RUSHIT305/spencer.git
cd spencer
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
spencer --version
```

On Windows PowerShell:

```powershell
git clone https://github.com/RUSHIT305/spencer.git
Set-Location spencer
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -e '.[dev]'
spencer --version
```

## Configure any API provider

Spencer is provider-neutral. It sends standard JSON over HTTP and normalizes one of four protocols: `generic-json`, `openai-compatible`, `anthropic-messages`, or `ollama-chat`. The default configuration template uses `generic-json`; choose the adapter that matches your provider.

Create a user configuration template:

```bash
spencer --init
```

Then set the credentials in the same terminal session where Spencer will run:

```bash
export SPENCER_API_KEY="your-key"
export SPENCER_API_URL="https://your-provider.example/v1/chat/completions"
export SPENCER_MODEL="your-model-id"
export SPENCER_API_PROTOCOL="generic-json"
```

PowerShell:

```powershell
$env:SPENCER_API_KEY = "your-key"
$env:SPENCER_API_URL = "https://your-provider.example/v1/chat/completions"
$env:SPENCER_MODEL = "your-model-id"
$env:SPENCER_API_PROTOCOL = "generic-json"
```

For providers that require a different authentication header or raw key format:

```bash
export SPENCER_API_KEY_HEADER="X-API-Key"
export SPENCER_API_KEY_PREFIX=""
```

For additional headers, pass a JSON object:

```bash
export SPENCER_API_HEADERS='{"X-Custom-Header":"value","X-Project":"spencer"}'
export SPENCER_REQUEST_FIELDS='{"provider_option":"value"}'
```

The same values can be stored in `.spencer.toml`:

```toml
[agent]
protocol = "generic-json"
model = "your-model-id"
api_url = "https://your-provider.example/v1/chat/completions"
api_key_header = "Authorization"
api_key_prefix = "Bearer"
api_timeout = 120
content_path = "choices.0.message.content"
tool_calls_path = "choices.0.message.tool_calls"
headers = { "X-Custom-Header" = "value" }
request_fields = { "provider_option" = "value" }
```

The `content_path` and `tool_calls_path` fields let a custom JSON API map its response into Spencer’s normalized agent response. See the provider section in the main README for the supported payload shapes.

## Verify the installation

Run the diagnostic command from the repository you want Spencer to inspect:

```bash
spencer --doctor
```

A healthy result shows the Spencer version, Python version, workspace, selected protocol, model, provider URL, and `api_key: configured`. The diagnostic command does not call the model.

## First task

```bash
spencer "Explain this repository, identify the relevant test command, and do not modify files"
```

When Spencer proposes a write or shell command, review the prompt before approving it. After an approved coding task, inspect the resulting diff with Git.
