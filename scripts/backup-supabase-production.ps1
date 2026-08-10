param(
  [string]$BackupDirectory = "backups\2026-08-10-pre-rework"
)

$ErrorActionPreference = "Stop"
$workspacePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$backupPath = [System.IO.Path]::GetFullPath((Join-Path $workspacePath $BackupDirectory))
$pgBinPath = [System.IO.Path]::GetFullPath((Join-Path $workspacePath "backups\tools\pgsql\bin"))

if (-not $backupPath.StartsWith($workspacePath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Le dossier de sauvegarde doit rester dans le workspace."
}

$pgDump = Join-Path $pgBinPath "pg_dump.exe"
$pgDumpAll = Join-Path $pgBinPath "pg_dumpall.exe"
$psql = Join-Path $pgBinPath "psql.exe"
foreach ($tool in @($pgDump, $pgDumpAll, $psql)) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "Outil PostgreSQL manquant : $tool"
  }
}

New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
$completeMarker = Join-Path $backupPath "database-backup.complete"
$failedMarker = Join-Path $backupPath "database-backup.failed"

Write-Host "Sauvegarde Supabase de DevisAndMore" -ForegroundColor Cyan
Write-Host "Le mot de passe ne sera ni affiché ni enregistré dans un script."
$securePassword = Read-Host "Mot de passe PostgreSQL du projet" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:PGHOST = "aws-0-eu-west-1.pooler.supabase.com"
  $env:PGPORT = "5432"
  $env:PGUSER = "postgres.gfvdvqvprrebgfzwsstc"
  $env:PGDATABASE = "postgres"

  $databaseBackup = Join-Path $backupPath "database-public-auth-storage.backup"
  $rolesBackup = Join-Path $backupPath "roles.sql"
  $preflightOutput = Join-Path $backupPath "preflight-schema.txt"
  $manifestOutput = Join-Path $backupPath "protected-account-before.csv"

  Write-Host "1/4 Export de public, auth et storage..."
  & $pgDump --format=custom --no-owner --no-acl --schema=public --schema=auth --schema=storage --file=$databaseBackup postgres
  if ($LASTEXITCODE -ne 0) { throw "pg_dump a échoué." }

  Write-Host "2/4 Export des rôles..."
  & $pgDumpAll --roles-only --file=$rolesBackup
  if ($LASTEXITCODE -ne 0) { throw "pg_dumpall a échoué." }

  Write-Host "3/4 Inventaire du schéma..."
  & $psql --no-psqlrc --set ON_ERROR_STOP=1 --file=(Join-Path $workspacePath "supabase\verification\preflight_schema.sql") --output=$preflightOutput
  if ($LASTEXITCODE -ne 0) { throw "Le preflight SQL a échoué." }

  Write-Host "4/4 Inventaire du compte protégé..."
  & $psql --no-psqlrc --set ON_ERROR_STOP=1 --csv --file=(Join-Path $workspacePath "supabase\verification\protected_account_manifest.sql") --output=$manifestOutput
  if ($LASTEXITCODE -ne 0) { throw "L'inventaire du compte protégé a échoué." }

  $hashes = @($databaseBackup, $rolesBackup, $preflightOutput, $manifestOutput) |
    ForEach-Object { Get-FileHash -LiteralPath $_ -Algorithm SHA256 } |
    Select-Object Path, Hash
  $hashes | Export-Csv -LiteralPath (Join-Path $backupPath "database-sha256.csv") -NoTypeInformation -Encoding utf8

  "completed" | Set-Content -LiteralPath $completeMarker -Encoding utf8
  Write-Host "Sauvegarde terminée avec succès." -ForegroundColor Green
}
catch {
  $_.Exception.Message | Set-Content -LiteralPath $failedMarker -Encoding utf8
  Write-Host "Échec : $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

Read-Host "Appuie sur Entrée pour fermer cette fenêtre"
