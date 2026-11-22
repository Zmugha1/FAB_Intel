<#
.SYNOPSIS
  Tests the FAB Intel desktop app on a Windows dev machine.

.DESCRIPTION
  Checks the tools, pulls the desktop branch, runs every automated check,
  then opens the app in dev mode with a manual test list on screen.
  Uses only synthetic data. Never point this at the client's real database.

.PARAMETER Fresh
  Moves the current dev database aside (nothing is deleted) so the app opens
  at first-run owner setup.

.PARAMETER Restore
  Puts the most recent moved-aside database back, then stops.

.PARAMETER Build
  Also builds the Windows installers (.msi and .exe) after the checks pass.

.PARAMETER NoRun
  Runs the checks only. Does not open the app.

.PARAMETER NoPull
  Skips git fetch and pull. Use it to test local changes.

.EXAMPLE
  .\desktop\scripts\dev-test.ps1 -Fresh
  .\desktop\scripts\dev-test.ps1 -NoRun -Build
  .\desktop\scripts\dev-test.ps1 -Restore
#>
[CmdletBinding()]
param(
  [switch]$Fresh,
  [switch]$Restore,
  [switch]$Build,
  [switch]$NoRun,
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"
$script:failed = @()

function Say($text)  { Write-Host "`n== $text" -ForegroundColor Cyan }
function Pass($text) { Write-Host "  PASS  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  WARN  $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  FAIL  $text" -ForegroundColor Red; $script:failed += $text }

function Step($name, [scriptblock]$block) {
  Write-Host "  ...   $name"
  & $block
  if ($LASTEXITCODE -ne 0) { Fail $name } else { Pass $name }
}

# ---------- Where things are ----------
$desktop = Split-Path -Parent $PSScriptRoot
$repo    = Split-Path -Parent $desktop
$dataDir = Join-Path $env:APPDATA "com.drdata.fabintel"
$dbFile  = Join-Path $dataDir "fab-intel.db"

# ---------- Restore a moved-aside database ----------
if ($Restore) {
  Say "Restore the dev database"
  $latest = Get-ChildItem $dataDir -Filter "fab-intel.db.bak-*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "-(wal|shm)$" } | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { Fail "No moved-aside database found in $dataDir"; exit 1 }
  if (Get-Process -Name "fab-intel" -ErrorAction SilentlyContinue) { Fail "Close FAB Intel first."; exit 1 }
  if (Test-Path $dbFile) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    Move-Item $dbFile "$dbFile.bak-$stamp"
    Write-Host "  Moved the current database to fab-intel.db.bak-$stamp"
  }
  Move-Item $latest.FullName $dbFile
  foreach ($ext in "wal", "shm") {
    $side = "$($latest.FullName)-$ext"
    if (Test-Path $side) { Move-Item $side "$dbFile-$ext" }
  }
  Pass "Restored $($latest.Name)"
  exit 0
}

# ---------- 1. Tools ----------
Say "1. Tools"
foreach ($tool in "git", "node", "npm", "cargo", "rustc") {
  $found = Get-Command $tool -ErrorAction SilentlyContinue
  if ($found) { Pass "$tool found" } else { Fail "$tool is not installed or not on PATH" }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
  $nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
  if ($nodeMajor -ge 20) { Pass "Node $nodeMajor" } else { Fail "Node 20 or newer needed. Found $nodeMajor." }
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if ((Test-Path $vswhere) -and (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)) {
  Pass "Visual Studio C++ build tools"
} else {
  Fail "Visual Studio C++ build tools missing. Install 'Desktop development with C++' from the Visual Studio Build Tools installer."
}

$wv2Keys = @(
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
  "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
  "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
if ($wv2Keys | Where-Object { Test-Path $_ }) { Pass "WebView2 runtime" } else { Warn "WebView2 runtime not found. Windows 11 has it; on Windows 10 install it from Microsoft." }

if ($script:failed.Count -gt 0) {
  Write-Host "`nFix the tools above, then run this script again." -ForegroundColor Red
  exit 1
}

# ---------- 2. Code ----------
Say "2. Code"
Set-Location $repo
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "desktop") { Fail "You are on '$branch'. Run: git switch desktop"; exit 1 }
if (-not $NoPull) {
  $dirty = git status --porcelain
  if ($dirty) { Warn "You have local changes. Pull skipped. Use -NoPull to silence this." }
  else { Step "git pull" { git pull --ff-only origin desktop } }
}
Write-Host "  Commit $((git rev-parse --short HEAD).Trim())"

# ---------- 3. Automated checks ----------
Say "3. Automated checks"
Set-Location $desktop
Step "npm ci"                   { npm ci --no-audit --no-fund }
Step "Rust core tests"          { cargo test -p fab-core }
Step "Screen tests (vitest)"    { npx vitest run }
Step "Type check (tsc)"         { npx tsc --noEmit -p . }
Step "Frontend build"           { npm run build }
Step "Desktop shell compiles"   { cargo check -p fab-intel }

Write-Host "  ...   No em dashes in source"
$dash = [char]0x2014
$hits = Get-ChildItem -Recurse -File -Path "src", "core\src", "src-tauri\src" -Include *.ts, *.tsx, *.rs, *.css |
  Select-String -SimpleMatch $dash
if ($hits) { $hits | ForEach-Object { Write-Host "        $($_.Path):$($_.LineNumber)" }; Fail "Em dashes found" } else { Pass "No em dashes in source" }

if ($script:failed.Count -gt 0) {
  Write-Host "`nChecks failed: $($script:failed -join '; ')" -ForegroundColor Red
  exit 1
}

# ---------- 4. Installers ----------
if ($Build) {
  Say "4. Windows installers"
  Step "tauri build" { npm run tauri build }
  $bundle = Join-Path $desktop "target\release\bundle"
  Get-ChildItem $bundle -Recurse -Include *.msi, *.exe -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "  $($_.FullName)  ($([math]::Round($_.Length / 1MB, 1)) MB)" }
  if ($script:failed.Count -gt 0) { exit 1 }
}

if ($NoRun) {
  Write-Host "`nAll checks passed." -ForegroundColor Green
  exit 0
}

# ---------- 5. Fresh start ----------
if ($Fresh) {
  Say "5. Fresh start"
  if (Get-Process -Name "fab-intel" -ErrorAction SilentlyContinue) { Fail "Close FAB Intel first."; exit 1 }
  if (Test-Path $dbFile) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    foreach ($suffix in "", "-wal", "-shm") {
      if (Test-Path "$dbFile$suffix") { Move-Item "$dbFile$suffix" "$dataDir\fab-intel.db.bak-$stamp$suffix" }
    }
    Pass "Old database moved to $dataDir\fab-intel.db.bak-$stamp. Run with -Restore to bring it back."
  } else {
    Pass "No database yet. The app opens at owner setup."
  }
}

# ---------- 6. Manual test list ----------
Say "6. Manual tests (the app opens next; close it when done)"
@"
  Use made-up names and passwords only.

  A. First run and sign-in
     1. Create the owner. A password under 10 characters is refused.
     2. Sign out. Five wrong passwords lock the sign-in for 5 minutes.

  B. Questions for you (Rules page)
     3. Morning Brief shows two Setup gaps that start with "Answer:".
     4. Rules page: Questions for you shows 2 not answered.
     5. Type 5.5 and Save rate. Pill turns Answered. Rules table shows 5.5%.
     6. Click "I do not charge sales tax". Quotes then add 0 tax.
     7. Set the rate back to any number you like.
     8. Pick "No" for staff seeing costs. Card says All answered.
     9. Morning Brief: both "Answer:" gaps are gone.
    10. Decision log lists each answer.

  C. Tooltips
    11. Hover each "?" on Rules, Quotes, Invoices, Projects, Contacts, Brief and ROI.
    12. Tab to a "?" with the keyboard. The text opens. Escape closes it.
    13. In a quote line table scrolled sideways, the text is not cut off.

  D. Costs hidden from staff
    14. Load sample data. Add a staff user for F&B Merch only.
    15. Sign in as staff. Quotes: no Unit cost column, no Margin card or column.
    16. Staff drafts a quote with prices only, ticks the checklist, submits.
    17. Sign in as owner. Quote waits for you. Click Check costs, enter costs,
        Save costs, then Approve.
    18. Owner picks "Yes" for staff seeing costs. Staff sees costs and margin again.

  E. Clean up
    19. Remove sample data. Only sample rows go.
    20. Footer shows the version and build.
"@ | Write-Host

Say "Opening FAB Intel in dev mode"
npm run tauri dev
