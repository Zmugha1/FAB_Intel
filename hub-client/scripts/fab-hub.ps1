# FAB Intel on the Dr. Data Hub. Builds the setup from the owner's answers file and opens the app.
#
#   cd C:\Users\zumah\Documents\FAB_Intel\hub-client
#   powershell -ExecutionPolicy Bypass -File .\scripts\fab-hub.ps1 -Answers <answers.toml> -Scope <scope.toml> -Fresh
#
# The answers and scope files are client data. Keep them outside this repo. The setup folder they
# build is outside it too.
#
#   -Answers  The My FAB Intel answers file. Needed the first time, and whenever answers change.
#   -Scope    The signed scope. Turns the sold parts on.
#   -Setup    Where the setup is built. Default: %LOCALAPPDATA%\FAB Intel\setup
#   -Fresh    Delete the setup and the dev app data first, then build both again.
#   -Build    Build the installer instead of opening the dev app.
#   -NoRun    Build the setup only.
param(
    [string]$Answers = "",
    [string]$Scope = "",
    [string]$Setup = "",
    [switch]$Fresh,
    [switch]$Build,
    [switch]$NoRun
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $Setup) {
    $Setup = Join-Path $env:LOCALAPPDATA "FAB Intel\setup"
}

function Step([string]$text) {
    Write-Host ""
    Write-Host "== $text" -ForegroundColor Cyan
}

function Need([string]$tool, [string]$hint) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "$tool is not installed. $hint" -ForegroundColor Red
        exit 1
    }
}

Need "git" "Install Git for Windows."
Need "cargo" "Install Rust from rustup.rs."
Need "npm" "Install Node.js 20 or later."

Step "1. The pinned Hub release"
$lock = Get-Content -Raw (Join-Path $root "hub.lock")
$repo = [regex]::Match($lock, 'repo\s*=\s*"([^"]+)"').Groups[1].Value
$commit = [regex]::Match($lock, 'commit\s*=\s*"([^"]+)"').Groups[1].Value
$version = [regex]::Match($lock, 'version\s*=\s*"([^"]+)"').Groups[1].Value
$hub = Join-Path $root ".hub"
if (-not (Test-Path (Join-Path $hub ".git"))) {
    git clone --quiet $repo $hub
    if ($LASTEXITCODE -ne 0) { Write-Host "Could not clone the Hub." -ForegroundColor Red; exit 1 }
}
git -C $hub fetch --quiet origin
git -C $hub checkout --quiet $commit
$head = (git -C $hub rev-parse HEAD).Trim()
if ($head -ne $commit) {
    Write-Host "The Hub checkout is $head, not the pinned $commit." -ForegroundColor Red
    exit 1
}
Write-Host "Hub $version at $($commit.Substring(0, 7))"

Step "2. The Hub's setup compiler"
cargo build --quiet -p hub-validate --manifest-path (Join-Path $hub "Cargo.toml")
if ($LASTEXITCODE -ne 0) { Write-Host "hub-validate did not build." -ForegroundColor Red; exit 1 }
$validate = Join-Path $hub "target\debug\hub-validate.exe"

$dataName = if ($Build) { "com.drdata.fabintel" } else { "com.drdata.fabintel.dev" }
$dataDir = Join-Path $env:APPDATA $dataName

Step "3. The setup, from the answers file"
if ($Fresh) {
    if (Test-Path $Setup) { Remove-Item -Recurse -Force $Setup }
    if (-not $Build -and (Test-Path $dataDir)) { Remove-Item -Recurse -Force $dataDir }
}
if ($Answers) {
    if (-not (Test-Path $Answers)) { Write-Host "No answers file at $Answers" -ForegroundColor Red; exit 1 }
    $parent = Split-Path -Parent $Setup
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $arguments = @("stz-answers", $Setup, "--answers", (Resolve-Path $Answers).Path, "--pack", (Join-Path $root "pack"))
    if ($Scope) {
        if (-not (Test-Path $Scope)) { Write-Host "No scope file at $Scope" -ForegroundColor Red; exit 1 }
        $arguments += @("--scope", (Resolve-Path $Scope).Path)
    }
    & $validate @arguments
    if ($LASTEXITCODE -ne 0) { Write-Host "The setup did not build. The lines above say why." -ForegroundColor Red; exit 1 }
} elseif (-not (Test-Path (Join-Path $Setup "governance.toml"))) {
    Write-Host "No setup at $Setup yet. Run again with -Answers <file> -Scope <file>." -ForegroundColor Red
    exit 1
}
& $validate $Setup | Select-Object -Last 1
if ($LASTEXITCODE -eq 1) { Write-Host "The setup has errors. The lines above say which." -ForegroundColor Red; exit 1 }
Write-Host "Setup: $Setup"

Step "4. Point the app at the setup"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$settings = Join-Path $dataDir "hub.settings.json"
if ($Fresh -or -not (Test-Path $settings)) {
    # No byte order mark: the Hub reads this file as plain JSON.
    $json = @{ config_path = $Setup } | ConvertTo-Json
    [System.IO.File]::WriteAllText($settings, $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "The app will open $Setup"
} else {
    Write-Host "The app keeps the setup it last opened. Use -Fresh to point it here again."
}

if ($NoRun) { exit 0 }

Step "5. Screens"
if (-not (Test-Path (Join-Path $root "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 | Out-Null
} catch {
    Write-Host "Ollama is not running. The quote check works without it. Hub agents and Ask need it." -ForegroundColor Yellow
}

if ($Build) {
    Step "6. Installer"
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
    npx tauri build
    exit $LASTEXITCODE
}

Step "6. FAB Intel (dev)"
Write-Host "The first build takes several minutes."
npx tauri dev
exit $LASTEXITCODE
