# InfraWatch — Start Script
# Launches Flask backend (port 5000) and Vite frontend (port 5173)

# Ensure Node.js is on PATH for this session
$env:Path = "C:\Program Files\nodejs;" + $env:Path

Write-Host "`n  ⬡ InfraWatch — Urban Infrastructure Monitor" -ForegroundColor Cyan
Write-Host "  Starting backend and frontend servers...`n" -ForegroundColor DarkGray

# Kill any previous instances
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Start Flask backend
$backend = Start-Process -NoNewWindow -PassThru -FilePath "python" -ArgumentList "app.py" -WorkingDirectory "$PSScriptRoot\backend"
Write-Host "  [✓] Flask backend starting on http://localhost:5000" -ForegroundColor Green

# Wait for Flask to be ready
Start-Sleep -Seconds 2

# Start Vite frontend
$frontend = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "$PSScriptRoot\frontend"
Write-Host "  [✓] Vite frontend starting on https://localhost:5173" -ForegroundColor Green

Write-Host "`n  Open https://localhost:5173 in your browser.`n" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop both servers.`n" -ForegroundColor DarkGray

try {
    Wait-Process -Id $backend.Id
}
finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    Write-Host "`n  Servers stopped." -ForegroundColor Red
}