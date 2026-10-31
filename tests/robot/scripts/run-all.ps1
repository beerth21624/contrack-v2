<#
.SYNOPSIS
  One-shot run of the whole Robot suite (smoke first, then everything in parallel) against the E2E servers.

.DESCRIPTION
  Expects the E2E web app on http://localhost:3200 and API on http://localhost:4200 (see tests/robot/README.md).
  -Fresh wipes and re-seeds the contrack_e2e database first (only that database; refuses any other).
  Results: tests/robot/results/<timestamp>/ (report.html, log.html, output.xml, xunit.xml).

.EXAMPLE
  powershell -File tests/robot/scripts/run-all.ps1 -Processes 4
#>
param(
    [int]$Processes = 4,
    [switch]$Fresh,
    [string]$Include = ''
)
$ErrorActionPreference = 'Stop'
$robotDir = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent (Split-Path -Parent $robotDir)
$py = Join-Path $robotDir '.venv\Scripts'
$env:PYTHONUTF8 = '1'
$env:Path = "$py;C:\Program Files\nodejs;" + $env:Path
Set-Location $robotDir

foreach ($url in @('http://localhost:4200/health', 'http://localhost:3200/journey')) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 $url | Out-Null }
    catch { throw "Server not reachable: $url (start the E2E servers first, see README.md)" }
}

if ($Fresh) {
    & "$py\python.exe" -c "import sys; sys.path.insert(0, 'libraries'); from ContrackDb import ContrackDb; ContrackDb().reset_e2e_database()"
    Push-Location (Join-Path $repo 'backend')
    node --env-file=../tests/robot/env/backend.e2e.env dist/backend/src/cli/seed-demo.js
    Pop-Location
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path 'results' $stamp
$inc = @()
if ($Include -ne '') { $inc = @('--include', $Include) }

& "$py\robot.exe" -d "$out\smoke" --console dotted -i smoke suites/00_smoke.robot
if ($LASTEXITCODE -ne 0) { throw 'Smoke failed: fix the environment before running the rest.' }

& "$py\pabot.exe" --processes $Processes -d $out --xunit xunit.xml @inc suites
$code = $LASTEXITCODE
Write-Host "Report: $(Resolve-Path $out)\report.html  (exit $code)"
exit $code
