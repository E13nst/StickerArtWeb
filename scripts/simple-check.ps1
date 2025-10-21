# Simple script to check app status
Write-Host "Checking app status..." -ForegroundColor Blue

# Check available ports
$ports = @(3000, 3001, 3002, 3003, 3004, 3005)

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        $processId = $connection.OwningProcess
        $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "Port $port is used by $processName (PID: $processId)" -ForegroundColor Green
        
        # Check HTTP availability
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port/miniapp/" -TimeoutSec 5 -ErrorAction Stop
            Write-Host "  HTTP available: $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "  HTTP not available: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Check project structure
Write-Host "`nChecking project structure..." -ForegroundColor Blue

$requiredFiles = @(
    "miniapp/src/App.tsx",
    "miniapp/src/main.tsx",
    "miniapp/src/pages/GalleryPage.tsx",
    "miniapp/src/components/PackCard.tsx",
    "miniapp/src/hooks/useTelegram.ts",
    "package.json",
    "vite.config.ts"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "Found: $file" -ForegroundColor Green
    } else {
        Write-Host "Missing: $file" -ForegroundColor Red
    }
}

# Check dependencies
Write-Host "`nChecking dependencies..." -ForegroundColor Blue

if (Test-Path "node_modules") {
    Write-Host "node_modules exists" -ForegroundColor Green
    
    # Check key packages
    $keyPackages = @("react", "vite", "@twa-dev/sdk", "zustand")
    foreach ($package in $keyPackages) {
        if (Test-Path "node_modules/$package") {
            Write-Host "Package $package is installed" -ForegroundColor Green
        } else {
            Write-Host "Package $package is missing!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "node_modules is missing! Run 'npm install'" -ForegroundColor Red
}

# Check TypeScript
Write-Host "`nChecking TypeScript..." -ForegroundColor Blue
try {
    $tscVersion = npx tsc --version
    Write-Host "TypeScript: $tscVersion" -ForegroundColor Green
} catch {
    Write-Host "TypeScript is not available" -ForegroundColor Red
}

Write-Host "`nCheck completed!" -ForegroundColor Green
