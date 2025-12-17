@echo off
chcp 65001 >nul
echo Starting Chrome with remote debugging...

REM Chrome installation path (user directory)
set "CHROME_PATH=C:\Users\18176\AppData\Local\Google\Chrome\Application\chrome.exe"

REM If Chrome not found in user directory, try standard location
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)

REM If still not found, try x86 location
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

REM Check if Chrome exists
if not exist "%CHROME_PATH%" (
    echo Error: Chrome not found!
    echo Please install Google Chrome or update the CHROME_PATH in this script.
    pause
    exit /b 1
)

echo Using Chrome at: %CHROME_PATH%
"%CHROME_PATH%" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir="%TEMP%\chrome-debug-profile"
echo Chrome started! You can now run your automation scripts.
pause
