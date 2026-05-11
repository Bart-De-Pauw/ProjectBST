<#
.SYNOPSIS
  Start / stop / monitor Docker Compose stacks for ProjectBST (Windows).

.EXAMPLE
  .\scripts\docker-stack.ps1 dev start --build
  .\scripts\docker-stack.ps1 prod ps
  .\scripts\docker-stack.ps1 dev logs -f api
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("dev", "prod")]
  [string] $Stack,

  [Parameter(Mandatory = $true, Position = 1)]
  [ValidateSet("start", "stop", "ps", "logs", "help")]
  [string] $Action,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ArgsRemaining = @()
)

$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

if ($Action -eq "help") {
  @"
ProjectBST — Docker stack helper (PowerShell)

Usage:
  scripts\docker-stack.ps1 <dev|prod> <command> [args...]

Stacks:
  dev   → infra/docker-compose.dev.yml
  prod  → infra/docker-compose.yml

Commands:
  start [--build]     docker compose up -d [--build]
  stop                docker compose down
  ps                  docker compose ps -a
  logs [args...]      docker compose logs ...

Examples:
  .\scripts\docker-stack.ps1 dev start --build
  .\scripts\docker-stack.ps1 prod stop
  .\scripts\docker-stack.ps1 dev logs -f web
"@ | Write-Output
  exit 0
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$composeFile = if ($Stack -eq "dev") { "infra/docker-compose.dev.yml" } else { "infra/docker-compose.yml" }
if (-not (Test-Path -LiteralPath $composeFile)) {
  Fail "compose file not found: $composeFile (expected under repo root: $RepoRoot)"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "docker not found on PATH"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "cannot reach Docker daemon (is Docker Desktop running?)"
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "'docker compose' not available (need Docker Compose v2)"
}

switch ($Action) {
  "start" {
    $build = $false
    foreach ($a in $ArgsRemaining) {
      if ($a -eq "--build") { $build = $true }
      else { Fail "unknown start flag: $a (only --build is supported)" }
    }
    if ($build) {
      docker compose -f $composeFile up -d --build
    } else {
      docker compose -f $composeFile up -d
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  "stop" {
    if ($ArgsRemaining.Count -gt 0) { Fail "stop takes no extra arguments" }
    docker compose -f $composeFile down
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  "ps" {
    docker compose -f $composeFile ps -a
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  "logs" {
    if ($null -eq $ArgsRemaining -or $ArgsRemaining.Count -eq 0) {
      docker compose -f $composeFile logs
    } else {
      docker compose -f $composeFile logs @ArgsRemaining
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
