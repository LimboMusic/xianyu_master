@echo off
echo Starting Chrome with remote debugging...
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir="%TEMP%\chrome-debug-profile"
echo Chrome started! You can now run your automation scripts.
pause




