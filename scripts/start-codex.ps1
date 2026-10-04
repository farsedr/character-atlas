$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$taskNode = if ($taskCommand) { $taskCommand.Source } else { $null }
if (-not $taskNode) {
 $taskCandidates = @((Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'), (Join-Path $env:ProgramFiles 'nodejs/node.exe'))
 foreach ($taskCandidate in $taskCandidates) { if (Test-Path -LiteralPath $taskCandidate) { $taskNode = $taskCandidate; break } }
}
if (-not $taskNode) { Start-Process 'https://nodejs.org/en/download'; throw 'Install Node.js 22 or newer, then start again.' }
$taskVersion = & $taskNode --version
$taskMajor = [int]($taskVersion.TrimStart('v').Split('.')[0])
if ([int]$taskMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
$taskBridge = Join-Path $PSScriptRoot 'codex-connector.mjs'
$taskRunning = $false
try { $taskResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4379/' -TimeoutSec 2; $taskRunning = $taskResponse.Content.Contains('atlas-local-connector-v3') } catch {}
if (-not $taskRunning) {
 Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskBridge + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden
 for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
  Start-Sleep -Milliseconds 500
  try { $taskResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4379/' -TimeoutSec 1; if ($taskResponse.Content.Contains('atlas-local-connector-v3')) { $taskRunning = $true; break } } catch {}
 }
}
if (-not $taskRunning) { throw 'Connector failed to start. Close older connector processes and retry.' }
Start-Process 'http://127.0.0.1:4379/'