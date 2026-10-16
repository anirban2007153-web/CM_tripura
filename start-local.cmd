@echo off
setlocal
cd /d "%~dp0"

start "CleanMap API" /D "%~dp0" "%ComSpec%" /k "npm.cmd run dev:api"
start "CleanMap Web" /D "%~dp0" "%ComSpec%" /k "npm.cmd run dev -- --strictPort"

endlocal

