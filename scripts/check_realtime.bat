@echo off
REM Wrapper Windows para el health-check de tiempo real.
REM Requiere Git Bash o WSL en el PATH (comando `bash`).
set "PROJECT_DIR=%~dp0.."
bash "%~dp0check_realtime.sh"
