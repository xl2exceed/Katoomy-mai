# backup-supabase-nightly.ps1
# Run from your project root (same folder you run `npx supabase ...`)

$ErrorActionPreference = "Stop"

# Timestamp like 2026-03-04_2130
$ts = Get-Date -Format "yyyy-MM-dd_HHmm"

# Where backups will go
$backupDir = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Output files
$schemaFile = Join-Path $backupDir "katoomy_${ts}_schema.sql"
$dataFile   = Join-Path $backupDir "katoomy_${ts}_data.sql"
$rolesFile  = Join-Path $backupDir "katoomy_${ts}_roles.sql"

Write-Host "== Supabase nightly backup started: $ts =="

# 1) Schema (tables, functions, triggers, policies, etc.)
Write-Host "Dumping schema -> $schemaFile"
npx supabase db dump --schema-only | Out-File -Encoding utf8 $schemaFile

# 2) Data (table rows)
Write-Host "Dumping data -> $dataFile"
npx supabase db dump --data-only | Out-File -Encoding utf8 $dataFile

# 3) Roles/privileges (important for restoring permissions)
Write-Host "Dumping roles -> $rolesFile"
npx supabase db dump --role-only | Out-File -Encoding utf8 $rolesFile

# ---- Verification checks ----
function Assert-NonEmptyFile($path) {
  if (!(Test-Path $path)) { throw "Missing backup file: $path" }
  $size = (Get-Item $path).Length
  if ($size -lt 1024) { throw "Backup file too small (<1KB), likely failed: $path (size=$size bytes)" }
}

Assert-NonEmptyFile $schemaFile
Assert-NonEmptyFile $dataFile
Assert-NonEmptyFile $rolesFile

# Sanity checks for expected content
$schemaHasDDL = Select-String -Path $schemaFile -Pattern "CREATE TABLE" -SimpleMatch -Quiet
if (-not $schemaHasDDL) { throw "Schema backup missing CREATE TABLE statements: $schemaFile" }

$dataHasInserts = Select-String -Path $dataFile -Pattern "INSERT INTO" -SimpleMatch -Quiet
if (-not $dataHasInserts) { Write-Warning "Data backup has no INSERT INTO lines. If your DB is truly empty, that's fine; otherwise investigate." }

Write-Host "✅ Backups created:"
Write-Host "  Schema: $schemaFile"
Write-Host "  Data:   $dataFile"
Write-Host "  Roles:  $rolesFile"
Write-Host "== Supabase nightly backup completed =="