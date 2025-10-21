# Simple script to start dev server
Write-Host "Starting dev server..." -ForegroundColor Blue

# Stop existing processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Check dependencies
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start dev server
Write-Host "Starting Vite dev server..." -ForegroundColor Yellow
npm run dev
