@echo off
title Push Updates to GitHub
echo ========================================================
echo    UPDATING COCONUT EXPORT MANAGEMENT TO GITHUB
echo ========================================================
set ELECTRON_RUN_AS_NODE=1
"C:\Users\Admin\AppData\Local\Programs\antigravity\Antigravity.exe" sync_github.js %*
echo.
echo Press any key to close...
pause >nul
