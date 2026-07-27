@echo off
REM 로컬 정적 서버 실행 (빌드 없음 · ES 모듈이라 file:// 로는 동작하지 않는다)
REM python -> py -> python3 순으로 있는 것을 쓴다.

cd /d "%~dp0"

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

echo Python을 찾지 못했습니다. https://www.python.org/downloads/ 에서 설치한 뒤 다시 실행하세요.
pause
