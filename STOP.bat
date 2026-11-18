@echo off
chcp 65001 >nul
title Stop King Legacy Global Event Tracker
echo Stopping any King Legacy Tracker server on port 3000...
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Stopping PID %%a...
  taskkill /F /PID %%a >nul 2>&1
)
echo Done.
ping -n 2 127.0.0.1 >nul
