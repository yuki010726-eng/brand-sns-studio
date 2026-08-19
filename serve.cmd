@echo off
REM 로컬 서버 실행. Node가 있으면 블로그 수집·PDF 기능까지 함께 켠다.
REM Node가 없을 때만 기존 Python 정적 서버로 돌아간다.

cd /d "%~dp0"

where node >nul 2>&1 && (
  echo [brand-sns-studio] http://localhost:5610
  echo [blog-research] enabled
  node server.mjs
  goto :eof
)

where python >nul 2>&1 && (
  echo [brand-sns-studio] http://localhost:5610
  python -m http.server 5610
  goto :eof
)

where py >nul 2>&1 && (
  echo [brand-sns-studio] http://localhost:5610
  py -m http.server 5610
  goto :eof
)

where python3 >nul 2>&1 && (
  echo [brand-sns-studio] http://localhost:5610
  python3 -m http.server 5610
  goto :eof
)

echo Node.js 또는 Python을 찾지 못했습니다. Node.js를 설치한 뒤 다시 실행하세요.
pause
