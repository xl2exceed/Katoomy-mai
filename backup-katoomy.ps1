$backupFolder = "C:\Users\patte\Dropbox\DatabaseBackups"
New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupFile = "$backupFolder\katoomy_backup_$timestamp.sql"

npx supabase db dump > $backupFile

Write-Host "Backup created: $backupFile"