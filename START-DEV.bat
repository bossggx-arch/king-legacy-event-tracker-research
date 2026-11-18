@echo off
chcp 65001 >nul
title King Legacy Global Event Tracker (DEV)
pushd "%~dp0"
echo Starting King Legacy Global Event Tracker in Development mode...
node start-tracker.mjs --dev
if errorlevel 1 (
  echo.
  echo Failed to start dev server. Press any key to close...
  pause >nul
)
popd
