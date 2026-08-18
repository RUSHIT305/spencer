$ErrorActionPreference = "Stop"
$Package = if ($env:SPENCER_PACKAGE) { $env:SPENCER_PACKAGE } else { "spencer-agent" }

Write-Host "Installing $Package..."

if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv tool install --upgrade $Package
} elseif (Get-Command pipx -ErrorAction SilentlyContinue) {
    pipx install --force $Package
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py -m pip install --user --upgrade $Package
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python -m pip install --user --upgrade $Package
} else {
    throw "Python 3.10+ is required. Install Python or uv, then run this script again."
}

Write-Host ""
Write-Host "Spencer is installed. Verify it with: spencer --version"
