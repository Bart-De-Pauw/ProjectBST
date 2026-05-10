param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrations = Join-Path $here "migrations"

Get-ChildItem -Path $migrations -Filter "*.sql" | Sort-Object Name | ForEach-Object {
  Write-Host "Applying $($_.Name)"
  psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $_.FullName
}

