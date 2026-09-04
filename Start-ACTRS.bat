@echo off
REM If Windows shows "These files can't be opened - Your Internet
REM security settings prevented one or more files from being opened"
REM instead of running this file at all, that's Windows blocking files
REM extracted from a downloaded ZIP (the "Mark of the Web"), not a
REM problem with ACTRS. Right-click Unblock-ACTRS.ps1 in this same
REM folder and choose "Run with PowerShell", then try this file again.
setlocal
cd /d "%~dp0"

title ACTRS Launcher

echo ============================================================
echo  Amenfi Central Terminal Report System (ACTRS)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this computer.
  echo.
  echo ACTRS needs Node.js installed once before it can run. Please:
  echo   1. Go to https://nodejs.org
  echo   2. Download and install the "LTS" version
  echo   3. Double-click this file again
  echo.
  pause
  exit /b 1
)

echo %cd% | findstr /i "onedrive" >nul
if not errorlevel 1 (
  echo NOTE: This folder is inside OneDrive. OneDrive can lock files
  echo while it syncs, which occasionally interrupts the one-time
  echo setup below. If setup keeps failing, the most reliable fix is
  echo to move this whole ACTRS folder to a location outside OneDrive
  echo - for example C:\ACTRS - and run this file from there instead.
  echo.
)

if exist "node_modules\.bin\tsc.cmd" if exist "node_modules\.bin\vite.cmd" goto AFTER_INSTALL

echo First-time setup: installing ACTRS's components...
echo ^(this needs an internet connection the first time only,
echo  and can take a few minutes^)
echo.

set INSTALL_TRIES=0

:TRY_INSTALL
set /a INSTALL_TRIES+=1
call npm install
set INSTALL_FAILED=0
if errorlevel 1 set INSTALL_FAILED=1
if not exist "node_modules\.bin\tsc.cmd" set INSTALL_FAILED=1
if not exist "node_modules\.bin\vite.cmd" set INSTALL_FAILED=1

if "%INSTALL_FAILED%"=="1" (
  if %INSTALL_TRIES% LSS 2 (
    echo.
    echo Setup did not finish correctly - this is usually a brief
    echo internet interruption. Trying again...
    echo.
    goto TRY_INSTALL
  )
  echo.
  echo Setup could not complete after two attempts. This almost
  echo always means the internet connection dropped partway through
  echo downloading ACTRS's components. Please:
  echo   1. Check your internet connection is stable
  echo   2. Double-click this file again
  echo If it keeps failing and this folder is inside OneDrive,
  echo Dropbox, or Google Drive, try moving the whole ACTRS folder
  echo to a plain local folder, e.g. C:\ACTRS, and run it from there.
  echo.
  pause
  exit /b 1
)
echo.

:AFTER_INSTALL

REM Decide whether ACTRS needs (re)building. It's NOT just "build once
REM and never again" - VERSION (bumped every time an updated copy of
REM ACTRS is delivered) is compared against a stamp left inside dist\
REM the last time it was built. A previous version of this launcher
REM only ever checked "does dist\index.html exist", which meant that
REM extracting an updated ACTRS zip over an existing installation kept
REM silently serving the OLD build forever - dist\ isn't part of the
REM delivered zip (it's generated locally), so it survived untouched
REM across every update and none of the fixes in a newer zip ever
REM actually took effect. Comparing versions instead fixes that while
REM still keeping ordinary same-version restarts fast (no rebuild).
set "CURRENT_VERSION=unknown"
if exist "VERSION" set /p CURRENT_VERSION=<VERSION

set "BUILT_VERSION="
if exist "dist\.build-version" set /p BUILT_VERSION=<dist\.build-version

set "NEED_BUILD=0"
if not exist "dist\index.html" set NEED_BUILD=1
if not "%BUILT_VERSION%"=="%CURRENT_VERSION%" set NEED_BUILD=1

if "%NEED_BUILD%"=="0" goto AFTER_BUILD

echo Building ACTRS...
echo.
if exist "dist" rmdir /s /q "dist"
REM Also clear tsc's own incremental-build cache - otherwise tsc can
REM decide nothing changed based on file timestamps alone, which after
REM a fresh zip extraction don't reliably reflect what actually changed.
if exist "tsconfig.app.tsbuildinfo" del /f /q "tsconfig.app.tsbuildinfo"
if exist "tsconfig.node.tsbuildinfo" del /f /q "tsconfig.node.tsbuildinfo"
call npm run build
if not exist "dist\index.html" (
  echo.
  echo Something went wrong while building ACTRS. See the messages
  echo above. This is usually fixed by checking your internet
  echo connection and double-clicking this file again.
  echo.
  pause
  exit /b 1
)
echo %CURRENT_VERSION%> "dist\.build-version"
echo.

:AFTER_BUILD

echo Starting ACTRS...
echo.
echo Your browser will open automatically in a moment.
echo.
echo IMPORTANT: Keep the new "ACTRS Server" window that appears open
echo while you use ACTRS - closing it stops the application. You can
echo minimize it, just don't close it.
echo.

start "ACTRS Server" cmd /c "npx serve -s dist -l 5000"

REM Give the server a moment to start before opening the browser.
timeout /t 3 /nobreak >nul

start "" http://localhost:5000

exit /b 0
