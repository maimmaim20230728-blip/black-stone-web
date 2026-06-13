@echo off
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set OUT="C:\Users\puipu\.gemini\antigravity-ide\brain\44cf090e-0d10-4c78-8132-f241e1d63bd9\game_screenshot_initial.png"
%CHROME% --headless=new --screenshot=%OUT% --window-size=1280,800 --timeout=8000 --no-sandbox --disable-gpu http://localhost:8765
echo Done. Screenshot saved to %OUT%
