$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = 'C:\Users\WANG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$taskBridge = Join-Path $PSScriptRoot 'codex-connector.mjs'
$taskRunning = $false
try { $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4379/' -TimeoutSec 2; $taskRunning = $taskResponse.Content.Contains('Codex 本机连接已启动') } catch {}
if (-not $taskRunning) {
    Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskBridge + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden
    for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
        Start-Sleep -Milliseconds 500
        try { $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4379/' -TimeoutSec 1; if ($taskResponse.Content.Contains('Codex 本机连接已启动')) { $taskRunning = $true; break } } catch {}
    }
}
if (-not $taskRunning) { throw '连接程序启动失败，请确认已安装并登录 Codex。' }
Start-Process 'http://127.0.0.1:4379/'
