@echo off
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set OUT="C:\Users\puipu\.gemini\antigravity-ide\brain\44cf090e-0d10-4c78-8132-f241e1d63bd9\game_screenshot_formed.png"
%CHROME% --headless=new --screenshot=%OUT% --window-size=1280,800 --no-sandbox --disable-gpu --virtual-time-budget=4000 http://localhost:8765
echo Exit code: %ERRORLEVEL%
echo Done. Screenshot saved to %OUT%
