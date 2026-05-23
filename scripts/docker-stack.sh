#!/usr/bin/env bash
# Start / stop / monitor Docker Compose stacks for ProjectBST.
# Usage: ./scripts/docker-stack.sh <dev|prod> <start|stop|ps|logs> [extra args...]
# Examples:
#   ./scripts/docker-stack.sh dev start --build
#   ./scripts/docker-stack.sh prod ps
#   ./scripts/docker-stack.sh dev logs -f api
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

usage() {
  cat <<'EOF'
ProjectBST — Docker stack helper

Usage:
  scripts/docker-stack.sh <dev|prod> <command> [args...]

Stacks:
  dev   → infra/docker-compose.dev.yml (db + api + web dev)
  prod  → infra/docker-compose.yml (LAN / prod-ish)

Commands:
  start [--build]     Bring stack up (-d). Pass --build to rebuild images.
  stop                docker compose down
  ps, status          docker compose ps -a
  logs [args...]      docker compose logs (e.g. -f, --tail=100, service names)

Examples:
  scripts/docker-stack.sh dev start --build
  scripts/docker-stack.sh prod stop
  scripts/docker-stack.sh dev ps
  scripts/docker-stack.sh dev logs -f web
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 1
fi

STACK="$1"
ACTION="$2"
shift 2

case "${STACK}" in
  dev)  COMPOSE_FILE="infra/docker-compose.dev.yml" ;;
  prod) COMPOSE_FILE="infra/docker-compose.yml" ;;
  *)
    echo "error: stack must be 'dev' or 'prod', got: ${STACK}" >&2
    exit 1
    ;;
esac

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "error: compose file not found: ${COMPOSE_FILE} (run from repo root?)" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker not found on PATH" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: cannot reach Docker daemon (is Docker Desktop / dockerd running?)" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "error: 'docker compose' not available (need Docker Compose v2 plugin)" >&2
  exit 1
fi

DC=(docker compose -f "${COMPOSE_FILE}")

case "${ACTION}" in
  start)
    extra=()
    for a in "$@"; do
      if [[ "${a}" == "--build" ]]; then
        extra+=(--build)
      else
        echo "error: unknown start flag: ${a} (only --build is supported)" >&2
        exit 1
      fi
    done
    exec "${DC[@]}" up -d "${extra[@]}"
    ;;
  stop)
    if [[ $# -gt 0 ]]; then
      echo "error: stop takes no extra arguments" >&2
      exit 1
    fi
    exec "${DC[@]}" down
    ;;
  ps|status)
    exec "${DC[@]}" ps -a
    ;;
  logs)
    exec "${DC[@]}" logs "$@"
    ;;
  *)
    echo "error: unknown command: ${ACTION} (use start|stop|ps|status|logs)" >&2
    exit 1
    ;;
esac
