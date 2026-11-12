@echo off
chcp 65001 >nul
setlocal EnableExtensions
title CIM Campus Assistant - Launcher

set "SITE=%~dp0"
if "%SITE:~-1%"=="\" set "SITE=%SITE:~0,-1%"
set "BRIDGE=%USERPROFILE%\workbuddy-to-dsh"
set "CF=%USERPROFILE%\.cloudflared\cloudflared.exe"
set "URLFILE=%TEMP%\cim-tunnel-url.txt"

echo.
echo   ==========================================
echo     CIM Campus Assistant - Launcher
echo   ==========================================
echo.

set "NODE_DIR="
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" set "NODE_DIR=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6"
if not defined NODE_DIR if exist "%LOCALAPPDATA%\Temp\cim-node\node-v24.18.0-win-x64\node.exe" set "NODE_DIR=%LOCALAPPDATA%\Temp\cim-node\node-v24.18.0-win-x64"
if defined NODE_DIR set "NODE=%NODE_DIR%\node.exe"
if not defined NODE (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE=node"
)
if not defined NODE goto :no_node
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"

set "NPM=%USERPROFILE%\.npm-cli\package\bin\npm-cli.js"
if not exist "%NPM%" set "NPM="

if not exist "%CF%" goto :no_cf

rem ---------- 1. bridge :8790 ----------
call :port_open 8790
if errorlevel 1 (
  echo   [1/3] starting WorkBuddy bridge on 8790...
  start "WorkBuddy Bridge 8790" /D "%BRIDGE%" cmd /k ""%NODE%" dashboard\server.mjs"
) else (
  echo   [1/3] bridge already running on 8790.
)

echo         waiting for bridge...
call :wait_port 8790 60
if errorlevel 1 goto :bridge_failed

rem ---------- 2. site :3000 ----------
call :port_open 3000
if errorlevel 1 (
  if not defined NPM goto :no_npm
  if not exist "%SITE%\.next\BUILD_ID" (
    echo   [2/3] building site, first build takes about a minute...
    call "%NODE%" "%NPM%" run build
    if errorlevel 1 goto :site_failed
  )
  echo   [2/3] starting site on 3000...
  start "CIM Site 3000" /D "%SITE%" cmd /k ""%NODE%" "%SITE%\node_modules\next\dist\bin\next" start -p 3000"
) else (
  echo   [2/3] site already running on 3000.
)

echo         waiting for site...
call :wait_port 3000 90
if errorlevel 1 goto :site_failed

rem ---------- 3. public tunnel ----------
echo         checking public tunnel...
"%NODE%" "%SITE%\scripts\tunnel-url.mjs" --probe > "%URLFILE%" 2>nul
set "URL="
set /p URL=<"%URLFILE%"
if defined URL (
  echo   [3/3] tunnel already running.
  goto :tunnel_ready
)

echo   [3/3] starting Cloudflare tunnel...
echo         no tunnel yet, waiting 6 seconds in case one is starting...
ping -n 7 127.0.0.1 >nul
"%NODE%" "%SITE%\scripts\tunnel-url.mjs" --probe > "%URLFILE%" 2>nul
set "URL="
set /p URL=<"%URLFILE%"
if defined URL (
  echo   [3/3] tunnel already running.
  goto :tunnel_ready
)
taskkill /F /IM cloudflared.exe >nul 2>&1
call :wait_cf_gone
set "TLOG=%SITE%\tunnel.log"
del "%TLOG%" >nul 2>&1
if exist "%TLOG%" set "TLOG=%SITE%\tunnel-new.log"
start "Cloudflare Tunnel" /D "%SITE%" cmd /k ""%CF%" tunnel --url http://127.0.0.1:3000 --protocol http2 --metrics 127.0.0.1:20250 --logfile "%TLOG%""
echo         waiting for public URL, up to 120 seconds...
"%NODE%" "%SITE%\scripts\tunnel-url.mjs" --log "%TLOG%" > "%URLFILE%" 2>nul
set "URL="
set /p URL=<"%URLFILE%"

:tunnel_ready
if not defined URL goto :no_url
"%NODE%" "%SITE%\scripts\launcher-status.mjs" "%URL%"
goto :done

:no_url
"%NODE%" "%SITE%\scripts\launcher-status.mjs"

:done
echo.
pause
goto :eof

rem ---------- helpers ----------
:wait_cf_gone
set /a _cf=0
:cf_loop
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | findstr /I "cloudflared.exe" >nul
if errorlevel 1 exit /b 0
set /a _cf+=1
if %_cf% GEQ 10 exit /b 1
ping -n 2 127.0.0.1 >nul
goto :cf_loop

:port_open
netstat -ano | findstr /C:":%1 " | findstr /I "LISTENING" >nul
exit /b %errorlevel%

:wait_port
set /a _tries=0
:wait_loop
call :port_open %1
if not errorlevel 1 exit /b 0
set /a _tries+=1
if %_tries% GEQ %2 exit /b 1
ping -n 2 127.0.0.1 >nul
goto :wait_loop

:bridge_failed
"%NODE%" "%SITE%\scripts\launcher-status.mjs" --error bridge
pause
exit /b 1

:site_failed
"%NODE%" "%SITE%\scripts\launcher-status.mjs" --error site
pause
exit /b 1

:no_node
echo   [!] Node.js not found. Install it first: https://nodejs.org/
echo.
pause
exit /b 1

:no_npm
echo   [!] npm not found. Install Node.js first: https://nodejs.org/
echo.
pause
exit /b 1

:no_cf
"%NODE%" "%SITE%\scripts\launcher-status.mjs" --error cloudflared
pause
exit /b 1
