# =============================================================================
# Health & Service Monitor for Meeting Room Booking
# Checks Windows Services, HTTP Port 80, Port 3000, and restarts if down.
# =============================================================================

$LogFile = "C:\inetpub\meeting-room-system\logs\health_monitor.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log-Message ($msg) {
    "[$Timestamp] $msg" | Out-File -FilePath $LogFile -Append
    Write-Host "[$Timestamp] $msg"
}

# 1. Check Next.js Port 3000
try {
    $res3000 = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($res3000.StatusCode -eq 200) {
        Log-Message "Next.js App (Port 3000): HEALTHY (HTTP 200)"
    } else {
        Log-Message "Next.js App (Port 3000): UNHEALTHY (HTTP $($res3000.StatusCode))"
    }
} catch {
    Log-Message "Next.js App (Port 3000): DOWN. Attempting restart via NSSM..."
    try {
        Restart-Service MeetingRoomApp -Force -ErrorAction SilentlyContinue
    } catch {
        Log-Message "Failed to restart MeetingRoomApp service: $_"
    }
}

# 2. Check Port 80 Reverse Proxy
try {
    $res80 = Invoke-WebRequest -Uri "http://127.0.0.1/api/health" -UseBasicParsing -TimeoutSec 5
    if ($res80.StatusCode -eq 200) {
        Log-Message "Reverse Proxy (Port 80): HEALTHY"
    } else {
        Log-Message "Reverse Proxy (Port 80): HTTP $($res80.StatusCode)"
    }
} catch {
    Log-Message "Reverse Proxy (Port 80): Not responding or proxy down."
}
