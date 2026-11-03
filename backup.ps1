# =============================================================================
# Automated Nightly PostgreSQL Backup for Meeting Room Booking
# Retains backups for 14 days and purges older archives.
# =============================================================================

$ErrorActionPreference = "Continue"

$BackupDir = "C:\inetpub\meeting-room-system\backups"
$LogFile = "C:\inetpub\meeting-room-system\logs\backup.log"
$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$DumpFile = "$BackupDir\meeting_room_backup_$DateStr.sql"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$Timestamp] Starting database backup to $DumpFile..." | Out-File -FilePath $LogFile -Append

try {
    # Run pg_dump
    $env:PGPASSWORD = "StrongDatabaseSecret2026!"
    pg_dump -U meeting_admin -h localhost -d meeting_room_db -F p -f $DumpFile

    if (Test-Path $DumpFile) {
        $FileSize = (Get-Item $DumpFile).Length / 1KB
        "[$Timestamp] Backup SUCCESS! File size: ${FileSize} KB" | Out-File -FilePath $LogFile -Append
    } else {
        "[$Timestamp] Backup WARNING: Dump file not created." | Out-File -FilePath $LogFile -Append
    }
} catch {
    "[$Timestamp] Backup FAILED: $_" | Out-File -FilePath $LogFile -Append
}

# Retention Policy: Clean up backups older than 14 days
Get-ChildItem -Path $BackupDir -Filter "meeting_room_backup_*.sql" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-14)
} | ForEach-Object {
    "[$Timestamp] Deleting expired backup: $($_.Name)" | Out-File -FilePath $LogFile -Append
    Remove-Item $_.FullName -Force
}
