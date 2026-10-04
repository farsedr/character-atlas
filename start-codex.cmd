@echo off
"C:\Users\WANG\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" -NoProfile -File "%~dp0scripts\start-codex.ps1"
if errorlevel 1 pause
