# =============================================================================
# Automated Windows Server Installer for Meeting Room Booking
# Target IP: 192.168.50.143 | Port: 80
# =============================================================================

$ErrorActionPreference = "Stop"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Meeting Room Booking - Windows Server Automated Setup     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$AppDir = "C:\inetpub\meeting-room-system"
$LogDir = "$AppDir\logs"
$BackupDir = "$AppDir\backups"

# 1. Ensure Directories Exist
Write-Host "[1/6] Setting up application directories..." -ForegroundColor Yellow
if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

# 2. Verify Node.js is installed
Write-Host "[2/6] Verifying Node.js environment..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "Found Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js LTS v20+ first."
}

# 3. Install NPM Dependencies
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Yellow
Set-Location $AppDir
npm install --omit=dev

# 4. Build Next.js Application
Write-Host "[4/6] Building production Next.js bundle..." -ForegroundColor Yellow
npm run build

# 5. Configure Windows Firewall Rule for Port 80
Write-Host "[5/6] Configuring Windows Firewall for Port 80..." -ForegroundColor Yellow
try {
    Remove-NetFirewallRule -DisplayName "Meeting Room Booking (Port 80)" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Meeting Room Booking (Port 80)" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 80 `
        -Action Allow | Out-Null
    Write-Host "Inbound Port 80 allowed successfully." -ForegroundColor Green
} catch {
    Write-Warning "Could not configure firewall rule automatically. Ensure Port 80 is open."
}

# 6. Verification
Write-Host "[6/6] Installation Complete!" -ForegroundColor Green
Write-Host "Run 'npm run create-admin' to create the receptionist account." -ForegroundColor Cyan
Write-Host "Application is ready to run at http://192.168.50.143" -ForegroundColor Green
