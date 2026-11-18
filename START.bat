@echo off
chcp 65001 >nul
title King Legacy Global Event Tracker
pushd "%~dp0"
echo Starting King Legacy Global Event Tracker...
node start-tracker.mjs
if errorlevel 1 (
  echo.
  echo Failed to start server. Press any key to close...
  pause >nul
)
popd
