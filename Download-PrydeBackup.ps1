# ============================================
# Pryde Social - Automated Backup Downloader
# ============================================
# This script automatically downloads the latest backup from your Render server
# and saves it to your PC with automatic cleanup of old backups.
#
# Author: Pryde Backup System
# Version: 1.0
# ============================================

# Configuration
$RENDER_API_URL = "https://your-render-app.onrender.com/api/backup/download"
$BACKUP_API_KEY = "your-secure-backup-api-key-change-this"
$BACKUP_FOLDER = "$env:USERPROFILE\Documents\PrydeBackups"
$MAX_BACKUPS = 4  # Keep last 4 backups

# ============================================
# DO NOT EDIT BELOW THIS LINE
# ============================================

# Create backup folder if it doesn't exist
if (-not (Test-Path $BACKUP_FOLDER)) {
    New-Item -ItemType Directory -Path $BACKUP_FOLDER -Force | Out-Null
    Write-Host "✅ Created backup folder: $BACKUP_FOLDER" -ForegroundColor Green
}

# Generate filename with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$filename = "pryde-backup-$timestamp.json"
$filepath = Join-Path $BACKUP_FOLDER $filename

Write-Host ""
Write-Host "🔄 Downloading Pryde Social Backup..." -ForegroundColor Cyan
Write-Host "📅 Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "📁 Saving to: $filepath" -ForegroundColor Gray
Write-Host ""

try {
    # Download backup with API key authentication
    $headers = @{
        "X-API-Key" = $BACKUP_API_KEY
    }
    
    # Download the backup file
    Invoke-WebRequest -Uri $RENDER_API_URL -Headers $headers -OutFile $filepath -ErrorAction Stop
    
    # Get file size
    $fileSize = (Get-Item $filepath).Length
    $fileSizeKB = [math]::Round($fileSize / 1KB, 2)
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    
    if ($fileSizeMB -gt 1) {
        Write-Host "✅ Backup downloaded successfully! ($fileSizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "✅ Backup downloaded successfully! ($fileSizeKB KB)" -ForegroundColor Green
    }
    
    Write-Host "📁 Saved to: $filepath" -ForegroundColor Green
    
    # Cleanup old backups (keep last $MAX_BACKUPS)
    Write-Host ""
    Write-Host "🗑️  Cleaning up old backups..." -ForegroundColor Yellow
    
    $backupFiles = Get-ChildItem -Path $BACKUP_FOLDER -Filter "pryde-backup-*.json" | 
                   Sort-Object LastWriteTime -Descending
    
    $totalBackups = $backupFiles.Count
    Write-Host "📊 Total backups: $totalBackups" -ForegroundColor Gray
    
    if ($totalBackups -gt $MAX_BACKUPS) {
        $filesToDelete = $backupFiles | Select-Object -Skip $MAX_BACKUPS
        
        foreach ($file in $filesToDelete) {
            Remove-Item $file.FullName -Force
            Write-Host "   🗑️  Deleted old backup: $($file.Name)" -ForegroundColor DarkGray
        }
        
        $deletedCount = $filesToDelete.Count
        Write-Host "✅ Cleaned up $deletedCount old backup(s)" -ForegroundColor Green
    } else {
        Write-Host "✅ No cleanup needed (keeping last $MAX_BACKUPS backups)" -ForegroundColor Green
    }
    
    # Show remaining backups
    Write-Host ""
    Write-Host "📋 Current backups:" -ForegroundColor Cyan
    $currentBackups = Get-ChildItem -Path $BACKUP_FOLDER -Filter "pryde-backup-*.json" | 
                      Sort-Object LastWriteTime -Descending
    
    foreach ($backup in $currentBackups) {
        $size = [math]::Round($backup.Length / 1KB, 2)
        $date = $backup.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        Write-Host "   📄 $($backup.Name) - $size KB - $date" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "✅ Backup process completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Log success
    $logFile = Join-Path $BACKUP_FOLDER "backup-log.txt"
    $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - SUCCESS - Downloaded $filename ($fileSizeKB KB)"
    Add-Content -Path $logFile -Value $logEntry
    
} catch {
    Write-Host ""
    Write-Host "❌ Error downloading backup!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Log error
    $logFile = Join-Path $BACKUP_FOLDER "backup-log.txt"
    $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - ERROR - $($_.Exception.Message)"
    Add-Content -Path $logFile -Value $logEntry
    
    # Check common issues
    Write-Host "🔍 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check if RENDER_API_URL is correct" -ForegroundColor Gray
    Write-Host "   2. Verify BACKUP_API_KEY matches your server" -ForegroundColor Gray
    Write-Host "   3. Ensure your Render app is running" -ForegroundColor Gray
    Write-Host "   4. Check your internet connection" -ForegroundColor Gray
    Write-Host ""
    
    exit 1
}

# Keep window open if run manually (not from Task Scheduler)
if ($Host.Name -eq "ConsoleHost") {
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

