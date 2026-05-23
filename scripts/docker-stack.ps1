<#
.SYNOPSIS
  Start / stop / monitor Docker Compose stacks for ProjectBST (Windows).

.EXAMPLE
  .\scripts\docker-stack.ps1 help
  .\scripts\docker-stack.ps1 dev start --build
  .\scripts\docker-stack.ps1 prod status
  .\scripts\docker-stack.ps1 dev logs -f api
#>
param(
  [Parameter(Position = 0)]
  [string] $Stack = "",

  [Parameter(Position = 1)]
  [string] $Action = "",

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ArgsRemaining = @()
)

$ErrorActionPreference = "Stop"

function Show-Help {
  @"
ProjectBST — Docker stack helper (PowerShell)

Usage:
  scripts\docker-stack.ps1 help
  scripts\docker-stack.ps1 <dev|prod> <command> [args...]

Stacks:
  dev   → infra/docker-compose.dev.yml
  prod  → infra/docker-compose.yml

Commands:
  start [--build]     docker compose up -d [--build]
  stop                docker compose down
  ps, status          docker compose ps -a
  logs [args...]      docker compose logs ...

Examples:
  .\scripts\docker-stack.ps1 help
  .\scripts\docker-stack.ps1 dev start --build
  .\scripts\docker-stack.ps1 prod stop
  .\scripts\docker-stack.ps1 dev status
  .\scripts\docker-stack.ps1 dev logs -f web
"@ | Write-Output
}

function Fail([string]$msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

function Set-BuildMetadataEnv {
  if (-not $env:GIT_COMMIT) {
    try {
      $env:GIT_COMMIT = (git.exe -C $RepoRoot rev-parse --short HEAD 2>$null).Trim()
    } catch {
      $env:GIT_COMMIT = "dev"
    }
    if ([string]::IsNullOrWhiteSpace($env:GIT_COMMIT)) {
      $env:GIT_COMMIT = "dev"
    }
  }
  if (-not $env:BUILD_TIME) {
    $env:BUILD_TIME = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }
}

if ($Stack -in @("-h", "--help", "help") -and [string]::IsNullOrEmpty($Action)) {
  Show-Help
  exit 0
}

if ($Action -in @("-h", "--help", "help")) {
  Show-Help
  exit 0
}

if ([string]::IsNullOrEmpty($Stack) -or [string]::IsNullOrEmpty($Action)) {
  Show-Help
  Fail "missing stack or command (see help above)"
}

if ($Stack -notin @("dev", "prod")) {
  Fail "stack must be 'dev' or 'prod', got: $Stack"
}

if ($Action -eq "status") {
  $Action = "ps"
}

if ($Action -notin @("start", "stop", "ps", "logs")) {
  Fail "unknown command: $Action (use start|stop|ps|status|logs)"
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
      Set-BuildMetadataEnv
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
