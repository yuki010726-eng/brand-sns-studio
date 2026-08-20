@echo off
REM Run the local Node server required by the style collection API.

cd /d "%~dp0"

where node >nul 2>&1 && (
  echo [brand-sns-studio] http://localhost:5610
  echo [blog-research] enabled
  node server.mjs
  goto :eof
)

echo [ERROR] Node.js is required for the style collection feature.
echo Install Node.js, then run serve.cmd again.
pause
