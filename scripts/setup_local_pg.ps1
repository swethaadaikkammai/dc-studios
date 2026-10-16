$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$pgData = 'C:\Users\srira\.gemini\antigravity\scratch\vit-dance-studio-booking\pgdata'
$port = 5433
$dbName = 'vit_dance_booking'
$logFile = "$pgData\server.log"

Write-Host "Configuring Local PostgreSQL for VIT Dance Studio Booking..."

if (-not (Test-Path "$pgData\PG_VERSION")) {
    Write-Host "Initializing new PostgreSQL cluster in $pgData..."
    & "$pgBin\initdb.exe" -D $pgData -U postgres -A trust -E UTF8
    
    # Update postgresql.conf port
    $confFile = "$pgData\postgresql.conf"
    Add-Content -Path $confFile -Value "`nport = $port`nlisten_addresses = 'localhost'`n"
}

# Check if PostgreSQL is already running on port 5433
$status = & "$pgBin\pg_ctl.exe" -D $pgData status 2>&1
if ($status -match "is running") {
    Write-Host "PostgreSQL is already running."
} else {
    Write-Host "Starting PostgreSQL on port $port..."
    & "$pgBin\pg_ctl.exe" -D $pgData -l $logFile -o "-p $port" start
    Start-Sleep -Seconds 2
}

# Create database if not exists
$checkDb = & "$pgBin\psql.exe" -U postgres -p $port -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
if ($checkDb.Trim() -ne "1") {
    Write-Host "Creating database $dbName..."
    & "$pgBin\psql.exe" -U postgres -p $port -h localhost -d postgres -c "CREATE DATABASE $dbName;"
}

# Create extension btree_gist for range exclusion constraints
Write-Host "Ensuring btree_gist extension is installed..."
& "$pgBin\psql.exe" -U postgres -p $port -h localhost -d $dbName -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

Write-Host "Database $dbName is ready on localhost:$port!"
