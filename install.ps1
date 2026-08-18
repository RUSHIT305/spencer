$ErrorActionPreference = 'Stop'

$Repository = 'RUSHIT305/spencer'
$InstallDir = if ($env:SPENCER_INSTALL_DIR) { $env:SPENCER_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Spencer\bin' }
$Version = $env:SPENCER_VERSION

function Stop-WithError([string]$Message) {
  Write-Error "Spencer installer error: $Message"
  exit 1
}

try {
  if (-not $Version) {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers @{ 'User-Agent' = 'Spencer-Installer' }
    $Version = $release.tag_name.TrimStart('v')
  }

  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  switch ($architecture) {
    'x64' { $architecture = 'x64' }
    default { Stop-WithError "Windows $architecture releases are not available yet; use a Windows x64 environment." }
  }

  $asset = "spencer-$Version-windows-$architecture.exe"
  $releaseBase = if ($env:SPENCER_RELEASE_BASE_URL) { $env:SPENCER_RELEASE_BASE_URL.TrimEnd('/') } else { "https://github.com/$Repository/releases/download" }
  $releaseUrl = "$releaseBase/v$Version"
  $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("spencer-install-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
  try {
    $binaryPath = Join-Path $tempDir $asset
    $sumsPath = Join-Path $tempDir 'SHA256SUMS'
    Write-Host "Downloading Spencer $Version for Windows $architecture..."
    Invoke-WebRequest -Uri "$releaseUrl/$asset" -OutFile $binaryPath -UseBasicParsing
    Invoke-WebRequest -Uri "$releaseUrl/SHA256SUMS" -OutFile $sumsPath -UseBasicParsing

    $checksumLine = Get-Content $sumsPath | Where-Object { $_ -match "\s\*?$([regex]::Escape($asset))$" } | Select-Object -First 1
    if (-not $checksumLine) { Stop-WithError "checksum entry missing for $asset" }
    $expected = ($checksumLine -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Path $binaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { Stop-WithError "checksum verification failed for $asset" }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $target = Join-Path $InstallDir 'spencer.exe'
    Copy-Item -Path $binaryPath -Destination $target -Force

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathParts = @()
    if ($userPath) { $pathParts = $userPath -split ';' | Where-Object { $_ } }
    if ($pathParts -notcontains $InstallDir) {
      [Environment]::SetEnvironmentVariable('Path', (($pathParts + $InstallDir) -join ';'), 'User')
      $env:Path = "$InstallDir;$env:Path"
      $pathNote = 'Open a new PowerShell window so PATH changes are loaded.'
    } else {
      $pathNote = 'PATH already contains the Spencer install directory.'
    }

    Write-Host ""
    Write-Host "Spencer $Version installed at $target"
    Write-Host $pathNote
    Write-Host 'Then run: Set-Location C:\path\to\your\project; spencer'
  } finally {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
} catch {
  Stop-WithError $_.Exception.Message
}
