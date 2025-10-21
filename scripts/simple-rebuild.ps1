# Simple script to rebuild project
Write-Host "Rebuilding project..." -ForegroundColor Blue

# Stop server if running
Write-Host "Stopping dev server..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Clear cache and temporary files
Write-Host "Clearing cache..." -ForegroundColor Yellow

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "dist folder cleared" -ForegroundColor Green
}

if (Test-Path "node_modules/.vite") {
    Remove-Item -Recurse -Force "node_modules/.vite"
    Write-Host "Vite cache cleared" -ForegroundColor Green
}

if (Test-Path ".vite") {
    Remove-Item -Recurse -Force ".vite"
    Write-Host ".vite cache cleared" -ForegroundColor Green
}

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Check TypeScript
Write-Host "Checking TypeScript..." -ForegroundColor Yellow
try {
    npx tsc --noEmit
    Write-Host "TypeScript check passed" -ForegroundColor Green
} catch {
    Write-Host "TypeScript errors:" -ForegroundColor Yellow
    npx tsc --noEmit
}

# Build project
Write-Host "Building project..." -ForegroundColor Yellow

# Create dist folder
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

# Copy index.html
Copy-Item "index.html" "dist/" -Force
Write-Host "index.html copied" -ForegroundColor Green

# Compile TypeScript
Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
npx tsc
if ($LASTEXITCODE -eq 0) {
    Write-Host "TypeScript compiled" -ForegroundColor Green
} else {
    Write-Host "TypeScript compilation error!" -ForegroundColor Red
    exit 1
}

# Build with Vite
Write-Host "Building with Vite..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -eq 0) {
    Write-Host "Project built successfully!" -ForegroundColor Green
} else {
    Write-Host "Vite build error!" -ForegroundColor Red
    exit 1
}

# Show build size
if (Test-Path "dist/miniapp") {
    $buildSize = (Get-ChildItem -Path "dist/miniapp" -Recurse | Measure-Object -Property Length -Sum).Sum
    $buildSizeMB = [math]::Round($buildSize / 1MB, 2)
    Write-Host "Build size: $buildSizeMB MB" -ForegroundColor Blue
}

Write-Host "`nRebuild completed successfully!" -ForegroundColor Green
Write-Host "Build is in: dist/" -ForegroundColor Blue
