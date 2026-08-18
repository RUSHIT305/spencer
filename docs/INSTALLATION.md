# Install Spencer

Spencer is distributed as a standalone executable. Users do not need npm, Node.js, Python, provider SDKs, model runtimes, or API keys.

## macOS and Linux

Run the installer from a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/RUSHIT305/spencer/master/install.sh | bash
```

The installer detects the operating system and CPU architecture, downloads the matching Spencer release binary from GitHub, verifies its SHA-256 checksum, installs it under `~/.spencer/bin`, and adds that directory to the user shell profile. Open a new terminal if the installer asks you to refresh `PATH`.

## Windows PowerShell

Run PowerShell as a normal user and execute:

```powershell
irm https://raw.githubusercontent.com/RUSHIT305/spencer/master/install.ps1 | iex
```

The installer downloads the matching Windows executable, verifies its SHA-256 checksum, installs it under `%LOCALAPPDATA%\Spencer\bin`, and adds that directory to the user `PATH`. Open a new PowerShell window after installation.

## Start Spencer

Change into the project Spencer should work on and run the command with no extra setup:

```text
cd /path/to/your/project
spencer
```

On Windows PowerShell, use a real path on your machine, for example:

```powershell
Set-Location C:\Users\Anuj\Documents\my-project
spencer
```

Spencer prompts:

```text
What would you like Spencer to work on?
```

Enter a request such as `Fix the failing tests and run the relevant checks`. Spencer uses the current directory as the workspace and asks for approval before file writes and shell commands.

## Diagnostics

```text
spencer --doctor
spencer --version
spencer --help
```

The diagnostics report the executable version, platform, workspace, managed backend, and whether user API configuration is disabled. Credentials are never stored in the executable or on the user’s machine.

## Installer controls

The installers support optional environment variables for controlled deployments:

| Variable | Purpose |
|---|---|
| `SPENCER_VERSION` | Install a specific release instead of the latest release. |
| `SPENCER_INSTALL_DIR` | Override the per-user installation directory. |
| `SPENCER_SHELL_PROFILE` | Override the Unix shell profile updated by `install.sh`. |

For example:

```bash
curl -fsSL https://raw.githubusercontent.com/RUSHIT305/spencer/master/install.sh | SPENCER_VERSION=0.6.0 bash
```

## Security and updates

The installer downloads only from the Spencer GitHub release and verifies the published checksum before replacing the executable. Releases are built on GitHub-hosted runners and are published with platform and architecture names. To update Spencer, run the same installer again. To remove it on macOS/Linux, delete `~/.spencer`; on Windows, remove `%LOCALAPPDATA%\Spencer` and its user `PATH` entry.

No local API configuration file is supported. The managed Gemini service, model, endpoint, authentication, retry policy, and service safety controls are owned by Spencer’s deployment.
