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

## Configure a provider

Spencer needs an API key for an OpenAI-compatible provider. Set one of these variables in the same terminal session where Spencer will run:

```bash
export SPENCER_API_KEY="your-key"
# OPENAI_API_KEY is also supported
```

PowerShell:

```powershell
$env:SPENCER_API_KEY = "your-key"
```

If you use a compatible gateway, configure its endpoint as well:

```bash
export SPENCER_API_BASE="https://your-provider.example/v1"
export SPENCER_MODEL="your-model-id"
```

## Verify the installation

Run the diagnostic command from the repository you want Spencer to inspect:

```bash
spencer --doctor
```

A healthy result shows the Spencer version, Python version, workspace, selected model, provider endpoint, and `api_key: configured`. The diagnostic command does not call the model.

## First task

```bash
spencer "Explain this repository, identify the relevant test command, and do not modify files"
```

When Spencer proposes a write or shell command, review the prompt before approving it. After an approved coding task, inspect the resulting diff with Git.
