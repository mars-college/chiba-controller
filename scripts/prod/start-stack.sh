#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ACTION="start"
COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
ENV_FILE="${REPO_DIR}/.env.prod"
PROJECT_NAME="${CHIBA3_COMPOSE_PROJECT:-chiba-controller-prod}"
TMUX_SESSION="${CHIBA3_TMUX_SESSION:-chiba-controller-prod}"
USE_TMUX=0
WITH_NODE=0
WITH_MCP=0
BUILD=1
PULL=0
DETACH=1
LOG_TAIL=200

usage() {
  cat <<EOF
Usage:
  $0 [start|stop|restart|import-registries|status|logs] [options]

Options:
  --env-file PATH        Compose env file (default: ${ENV_FILE})
  --compose-file PATH    Compose file (default: ${COMPOSE_FILE})
  --project-name NAME    Compose project name (default: ${PROJECT_NAME})
  --with-node            Include profile: node
  --with-mcp             Include profile: mcp
  --tmux                 Run the action inside a tmux session
  --session NAME         tmux session name (default: ${TMUX_SESSION})
  --no-build             Skip --build on start/restart
  --build                Force --build on start/restart (default)
  --pull                 Pull images before start/restart
  --foreground           Keep docker compose attached (no -d)
  --tail N               Number of log lines for logs action (default: ${LOG_TAIL})
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|stop|restart|import-registries|status|logs)
      ACTION="$1"
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --env-file=*)
      ENV_FILE="${1#*=}"
      shift
      ;;
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --compose-file=*)
      COMPOSE_FILE="${1#*=}"
      shift
      ;;
    --project-name)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --project-name=*)
      PROJECT_NAME="${1#*=}"
      shift
      ;;
    --with-node)
      WITH_NODE=1
      shift
      ;;
    --with-mcp)
      WITH_MCP=1
      shift
      ;;
    --tmux)
      USE_TMUX=1
      shift
      ;;
    --session)
      TMUX_SESSION="$2"
      shift 2
      ;;
    --session=*)
      TMUX_SESSION="${1#*=}"
      shift
      ;;
    --no-build)
      BUILD=0
      shift
      ;;
    --build)
      BUILD=1
      shift
      ;;
    --pull)
      PULL=1
      shift
      ;;
    --foreground)
      DETACH=0
      shift
      ;;
    --tail)
      LOG_TAIL="$2"
      shift 2
      ;;
    --tail=*)
      LOG_TAIL="${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH." >&2
  exit 1
fi

DOCKER_CMD=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    DOCKER_CMD=(sudo -E docker)
    echo "Docker socket is not accessible for this user; using sudo docker."
  else
    echo "Cannot access Docker daemon (permission denied on /var/run/docker.sock)." >&2
    echo "Install sudo or grant this user Docker group access." >&2
    exit 1
  fi
fi

if ! "${DOCKER_CMD[@]}" compose version >/dev/null 2>&1; then
  echo "docker compose (plugin) is required but not available." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  echo "Create it from ${REPO_DIR}/.env.prod.example first." >&2
  exit 1
fi

PROFILE_ARGS=()
if [[ "${WITH_NODE}" -eq 1 ]]; then
  PROFILE_ARGS+=(--profile node)
fi
if [[ "${WITH_MCP}" -eq 1 ]]; then
  PROFILE_ARGS+=(--profile mcp)
fi

compose_cmd() {
  "${DOCKER_CMD[@]}" compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "${PROFILE_ARGS[@]}" \
    "$@"
}

list_named_service_containers() {
  compose_cmd config | awk '
    /^services:[[:space:]]*$/ { in_services=1; next }
    in_services && /^[^[:space:]]/ { in_services=0 }
    in_services {
      if ($0 ~ /^  [A-Za-z0-9_.-]+:[[:space:]]*$/) {
        service=$0
        sub(/^  /, "", service)
        sub(/:[[:space:]]*$/, "", service)
        next
      }
      if (service != "" && $0 ~ /^[[:space:]]+container_name:[[:space:]]*/) {
        name=$0
        sub(/^[[:space:]]+container_name:[[:space:]]*/, "", name)
        gsub(/"/, "", name)
        print service "\t" name
      }
    }
  '
}

cleanup_conflicting_named_containers() {
  local service
  local container_name
  local existing_id
  local label_project
  local label_service
  local removed=0

  while IFS=$'\t' read -r service container_name; do
    [[ -z "${service}" || -z "${container_name}" ]] && continue
    existing_id="$("${DOCKER_CMD[@]}" ps -a --filter "name=^/${container_name}$" --format '{{.ID}}' | head -n 1)"
    [[ -z "${existing_id}" ]] && continue

    label_project="$("${DOCKER_CMD[@]}" inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "${container_name}" 2>/dev/null || true)"
    label_service="$("${DOCKER_CMD[@]}" inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "${container_name}" 2>/dev/null || true)"

    if [[ "${label_project}" == "${PROJECT_NAME}" && "${label_service}" == "${service}" ]]; then
      continue
    fi

    echo "Removing conflicting container '${container_name}' (found project='${label_project:-none}' service='${label_service:-none}', expected project='${PROJECT_NAME}' service='${service}')."
    "${DOCKER_CMD[@]}" rm -f "${container_name}" >/dev/null
    removed=1
  done < <(list_named_service_containers)

  if [[ "${removed}" -eq 1 ]]; then
    echo "Conflicting named containers removed."
  fi
}

if [[ "${USE_TMUX}" -eq 1 ]]; then
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux requested but not installed." >&2
    exit 1
  fi
  if [[ "${ACTION}" == "start" && "${DETACH}" -eq 1 ]]; then
    # In tmux mode, keep compose attached so the session remains useful.
    DETACH=0
  fi
  if [[ "${DOCKER_CMD[*]}" == "sudo -E docker" ]]; then
    echo "Refreshing sudo credentials before launching tmux..."
    sudo -v
  fi
  if tmux has-session -t "${TMUX_SESSION}" 2>/dev/null; then
    echo "tmux session already exists: ${TMUX_SESSION}" >&2
    echo "Attach with: tmux attach -t ${TMUX_SESSION}" >&2
    exit 1
  fi
  cmd=(
    "$0" "${ACTION}"
    --env-file "${ENV_FILE}"
    --compose-file "${COMPOSE_FILE}"
    --project-name "${PROJECT_NAME}"
  )
  if [[ "${WITH_NODE}" -eq 1 ]]; then
    cmd+=(--with-node)
  fi
  if [[ "${WITH_MCP}" -eq 1 ]]; then
    cmd+=(--with-mcp)
  fi
  if [[ "${BUILD}" -eq 0 ]]; then
    cmd+=(--no-build)
  fi
  if [[ "${PULL}" -eq 1 ]]; then
    cmd+=(--pull)
  fi
  if [[ "${DETACH}" -eq 0 ]]; then
    cmd+=(--foreground)
  fi
  if [[ "${ACTION}" == "logs" ]]; then
    cmd+=(--tail "${LOG_TAIL}")
  fi

  cmd_str="$(printf "%q " "${cmd[@]}")"
  tmux new-session -d -s "${TMUX_SESSION}" "cd ${REPO_DIR} && ${cmd_str}"
  echo "Started in tmux session: ${TMUX_SESSION}"
  echo "Attach with: tmux attach -t ${TMUX_SESSION}"
  exit 0
fi

case "${ACTION}" in
  start)
    if [[ "${PULL}" -eq 1 ]]; then
      compose_cmd pull
    fi
    cleanup_conflicting_named_containers
    up_args=(up --remove-orphans)
    if [[ "${DETACH}" -eq 1 ]]; then
      up_args+=(-d)
    fi
    if [[ "${BUILD}" -eq 1 ]]; then
      up_args+=(--build)
    fi
    compose_cmd "${up_args[@]}"
    compose_cmd ps
    ;;
  stop)
    compose_cmd down --remove-orphans
    ;;
  restart)
    compose_cmd down --remove-orphans
    if [[ "${PULL}" -eq 1 ]]; then
      compose_cmd pull
    fi
    cleanup_conflicting_named_containers
    echo "Running DB migrations..."
    compose_cmd run --rm db-migrate
    up_args=(up --remove-orphans)
    if [[ "${DETACH}" -eq 1 ]]; then
      up_args+=(-d)
    fi
    if [[ "${BUILD}" -eq 1 ]]; then
      up_args+=(--build)
    fi
    compose_cmd "${up_args[@]}"
    compose_cmd ps
    ;;
  import-registries)
    echo "Running DB migrations..."
    compose_cmd run --rm db-migrate
    echo "Importing registries from compose config..."
    compose_cmd run --rm db-import-registries
    ;;
  status)
    compose_cmd ps
    ;;
  logs)
    compose_cmd logs -f --tail "${LOG_TAIL}"
    ;;
  *)
    echo "Unsupported action: ${ACTION}" >&2
    exit 1
    ;;
esac
