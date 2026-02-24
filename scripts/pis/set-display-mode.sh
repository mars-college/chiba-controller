#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat <<'USAGE'
Usage:
  ./scripts/pis/set-display-mode.sh <node-id> [options]

Options:
  --mode <preset>            Display preset: native|2160p30|1440p60|1080p60|900p60|720p60
  --host <host-or-ip>        Target host/ip (default: <node-id>)
  --ssh-user <user>          SSH user (default: pi)
  --ssh-port <port>          SSH port (default: 22)
  --ssh-password <password>  SSH password (default: $CHIBA3_SSH_PASSWORD)
  --output <name>            Optional output override (e.g. HDMI-1)
  --restart-display-manager  Restart lightdm/display-manager after writing mode
  --dry-run                  Print command and exit
USAGE
  exit 1
fi

NODE_ID="$1"
shift

MODE_PRESET="1080p60"
TARGET_HOST=""
SSH_USER="pi"
SSH_PORT="22"
SSH_PASSWORD="${CHIBA3_SSH_PASSWORD:-}"
OUTPUT_OVERRIDE=""
RESTART_DISPLAY_MANAGER=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE_PRESET="$2"
      shift 2
      ;;
    --host)
      TARGET_HOST="$2"
      shift 2
      ;;
    --ssh-user)
      SSH_USER="$2"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT="$2"
      shift 2
      ;;
    --ssh-password)
      SSH_PASSWORD="$2"
      shift 2
      ;;
    --output)
      OUTPUT_OVERRIDE="$2"
      shift 2
      ;;
    --restart-display-manager)
      RESTART_DISPLAY_MANAGER=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET_HOST" ]]; then
  TARGET_HOST="$NODE_ID"
fi

case "$MODE_PRESET" in
  native)
    MODE_EXPR="native"
    ;;
  2160p30)
    MODE_EXPR="3840x2160@30"
    ;;
  1440p60)
    MODE_EXPR="2560x1440@60"
    ;;
  1080p60)
    MODE_EXPR="1920x1080@60"
    ;;
  900p60)
    MODE_EXPR="1600x900@60"
    ;;
  720p60)
    MODE_EXPR="1280x720@60"
    ;;
  *)
    echo "Unsupported mode preset: $MODE_PRESET" >&2
    exit 1
    ;;
esac

if [[ -n "$SSH_PASSWORD" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "CHIBA3_SSH_PASSWORD/--ssh-password set, but sshpass is not installed." >&2
  echo "Install sshpass (e.g. 'brew install hudochenkov/sshpass/sshpass')." >&2
  exit 1
fi

ssh_cmd() {
  if [[ -n "$SSH_PASSWORD" ]]; then
    SSHPASS="$SSH_PASSWORD" sshpass -e ssh \
      -o StrictHostKeyChecking=accept-new \
      -o PreferredAuthentications=password \
      -o PubkeyAuthentication=no \
      -p "$SSH_PORT" \
      "$@"
    return
  fi
  ssh -o StrictHostKeyChecking=accept-new -p "$SSH_PORT" "$@"
}

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run:"
  echo "  nodeId=${NODE_ID}"
  echo "  host=${TARGET_HOST}"
  echo "  ssh=${SSH_USER}@${TARGET_HOST}:${SSH_PORT}"
  echo "  modePreset=${MODE_PRESET}"
  echo "  modeExpr=${MODE_EXPR}"
  if [[ -n "$OUTPUT_OVERRIDE" ]]; then
    echo "  output=${OUTPUT_OVERRIDE}"
  fi
  echo "  restartDisplayManager=${RESTART_DISPLAY_MANAGER}"
  exit 0
fi

SSH_TARGET="${SSH_USER}@${TARGET_HOST}"
echo "Setting display mode for ${NODE_ID} (${SSH_TARGET})..."
echo "Resolved: preset=${MODE_PRESET} mode=${MODE_EXPR} output=${OUTPUT_OVERRIDE:-auto}"

REMOTE_OUTPUT_OVERRIDE="${OUTPUT_OVERRIDE}"
if [[ -z "${REMOTE_OUTPUT_OVERRIDE}" ]]; then
  REMOTE_OUTPUT_OVERRIDE="__AUTO__"
fi

ssh_cmd "$SSH_TARGET" bash -s -- \
  "$MODE_EXPR" \
  "$REMOTE_OUTPUT_OVERRIDE" \
  "$SSH_USER" \
  "$RESTART_DISPLAY_MANAGER" <<'REMOTE_SCRIPT'
set -euo pipefail

MODE_EXPR="${1:-native}"
OUTPUT_OVERRIDE="${2:-__AUTO__}"
DISPLAY_USER="${3:-pi}"
RESTART_DISPLAY_MANAGER="${4:-0}"

if [[ "${OUTPUT_OVERRIDE}" == "__AUTO__" ]]; then
  OUTPUT_OVERRIDE=""
fi

tmp_env="$(mktemp)"
{
  printf 'CHIBA3_DISPLAY_MODE=%q\n' "${MODE_EXPR}"
  printf 'CHIBA3_DISPLAY_OUTPUT=%q\n' "${OUTPUT_OVERRIDE}"
  printf 'CHIBA3_DISPLAY_USER=%q\n' "${DISPLAY_USER}"
} > "${tmp_env}"
sudo install -m 0644 "${tmp_env}" /etc/default/cable3-display-mode
rm -f "${tmp_env}"

sudo tee /usr/local/bin/cable3-apply-display-mode.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

MODE_EXPR="native"
OUTPUT_OVERRIDE=""
DISPLAY_USER="pi"

if [[ -f /etc/default/cable3-display-mode ]]; then
  # shellcheck disable=SC1091
  source /etc/default/cable3-display-mode
fi

MODE_EXPR="${CHIBA3_DISPLAY_MODE:-$MODE_EXPR}"
OUTPUT_OVERRIDE="${CHIBA3_DISPLAY_OUTPUT:-$OUTPUT_OVERRIDE}"
DISPLAY_USER="${CHIBA3_DISPLAY_USER:-$DISPLAY_USER}"

detect_output_from_sysfs() {
  local status_path=""
  local connector=""
  for status_path in /sys/class/drm/card*-*/status; do
    [[ -f "${status_path}" ]] || continue
    if [[ "$(cat "${status_path}" 2>/dev/null || true)" != "connected" ]]; then
      continue
    fi
    connector="$(basename "$(dirname "${status_path}")")"
    connector="${connector#card*-}"
    if [[ -n "${connector}" ]]; then
      echo "${connector}"
      return 0
    fi
  done
  return 1
}

apply_with_wlr_randr() {
  if ! command -v wlr-randr >/dev/null 2>&1; then
    return 1
  fi

  local uid=""
  uid="$(id -u "${DISPLAY_USER}" 2>/dev/null || true)"
  [[ -n "${uid}" ]] || return 1
  local runtime_dir="/run/user/${uid}"
  [[ -d "${runtime_dir}" ]] || return 1

  local wayland_display="${WAYLAND_DISPLAY:-}"
  if [[ -z "${wayland_display}" ]]; then
    local first_socket=""
    first_socket="$(ls "${runtime_dir}"/wayland-* 2>/dev/null | head -n1 || true)"
    [[ -n "${first_socket}" ]] || return 1
    wayland_display="$(basename "${first_socket}")"
  fi

  local output="${OUTPUT_OVERRIDE}"
  if [[ -z "${output}" ]]; then
    output="$(detect_output_from_sysfs || true)"
  fi
  if [[ -z "${output}" ]]; then
    output="$(
      sudo -u "${DISPLAY_USER}" \
        XDG_RUNTIME_DIR="${runtime_dir}" \
        WAYLAND_DISPLAY="${wayland_display}" \
        wlr-randr 2>/dev/null | awk 'NR==1{print $1; exit}'
    )"
  fi
  [[ -n "${output}" ]] || return 1

  local target_expr="${MODE_EXPR}"
  if [[ "${target_expr}" == "native" ]]; then
    target_expr="$(
      sudo -u "${DISPLAY_USER}" \
        XDG_RUNTIME_DIR="${runtime_dir}" \
        WAYLAND_DISPLAY="${wayland_display}" \
        wlr-randr 2>/dev/null | awk -v out="${output}" '
          $1==out { in_output=1; in_modes=0; next }
          in_output && /Modes:/ { in_modes=1; next }
          in_output && in_modes && $1 ~ /^[0-9]+x[0-9]+$/ {
            mode=$1
            hz=$3
            if (first == "") first=mode "@" hz
            if (index($0, "preferred") > 0) { print mode "@" hz; exit }
          }
          in_output && $1 ~ /^[A-Za-z0-9-]+$/ && $1 != out { in_output=0; in_modes=0 }
          END { if (first != "") print first }
        '
    )"
  fi
  [[ -n "${target_expr}" ]] || return 1

  local mode="${target_expr%@*}"
  local rate="${target_expr#*@}"
  local mode_arg="${mode}"
  if [[ -n "${rate}" && "${rate}" != "${target_expr}" ]]; then
    mode_arg="${mode}@${rate}"
  fi

  sudo -u "${DISPLAY_USER}" \
    XDG_RUNTIME_DIR="${runtime_dir}" \
    WAYLAND_DISPLAY="${wayland_display}" \
    wlr-randr --output "${output}" --mode "${mode_arg}"

  echo "applied_method=wayland"
  echo "applied_output=${output}"
  sudo -u "${DISPLAY_USER}" \
    XDG_RUNTIME_DIR="${runtime_dir}" \
    WAYLAND_DISPLAY="${wayland_display}" \
    wlr-randr | awk -v out="${output}" '
      $1==out { print; in_output=1; in_modes=0; next }
      in_output && /Modes:/ { in_modes=1; print; next }
      in_output && in_modes && $1 ~ /^[0-9]+x[0-9]+$/ {
        if (index($0, "current") > 0 || index($0, "preferred") > 0) print
      }
      in_output && $1 ~ /^[A-Za-z0-9-]+$/ && $1 != out { exit }
    '
  return 0
}

apply_with_xrandr() {
  if ! command -v xrandr >/dev/null 2>&1; then
    return 1
  fi

  local output="${OUTPUT_OVERRIDE}"
  if [[ -z "${output}" ]]; then
    output="$(xrandr --query 2>/dev/null | awk '/ connected/{print $1; exit}')"
  fi
  if [[ -z "${output}" ]]; then
    output="$(detect_output_from_sysfs || true)"
  fi
  [[ -n "${output}" ]] || return 1

  local applied=0
  if [[ "${MODE_EXPR}" == "native" ]]; then
    if xrandr --output "${output}" --auto; then
      applied=1
    fi
  else
    local mode="${MODE_EXPR%@*}"
    local rate="${MODE_EXPR#*@}"
    if [[ "${mode}" == "${MODE_EXPR}" || -z "${rate}" ]]; then
      if xrandr --output "${output}" --mode "${mode}"; then
        applied=1
      fi
    else
      if xrandr --output "${output}" --mode "${mode}" --rate "${rate}"; then
        applied=1
      elif xrandr --output "${output}" --mode "${mode}"; then
        applied=1
      fi
    fi
  fi

  if [[ "${applied}" -ne 1 ]]; then
    echo "requested_mode_apply_failed mode=${MODE_EXPR}; trying --auto" >&2
    if xrandr --output "${output}" --auto; then
      applied=1
    fi
  fi
  [[ "${applied}" -eq 1 ]] || return 1

  echo "applied_method=x11"
  echo "applied_output=${output}"
  xrandr --query | awk '/ connected/{print; getline; print}'
  return 0
}

if apply_with_wlr_randr; then
  exit 0
fi

if apply_with_xrandr; then
  exit 0
fi

echo "display_mode_apply_failed: no supported display control path succeeded" >&2
exit 1
EOF
sudo chmod 0755 /usr/local/bin/cable3-apply-display-mode.sh

sudo install -d -m 0755 /etc/xdg/autostart
sudo tee /etc/xdg/autostart/cable3-display-mode.desktop >/dev/null <<'EOF'
[Desktop Entry]
Type=Application
Name=Cable3 Display Mode
Comment=Apply persistent display mode for cable nodes
Exec=/usr/local/bin/cable3-apply-display-mode.sh
NoDisplay=true
X-GNOME-Autostart-enabled=true
EOF

sudo install -d -m 0755 /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/50-cable3-display-mode.conf >/dev/null <<'EOF'
[Seat:*]
display-setup-script=/bin/sh -lc '/usr/local/bin/cable3-apply-display-mode.sh || true'
EOF

sudo systemctl set-default graphical.target >/dev/null 2>&1 || true
if systemctl list-unit-files --type=service | awk '{print $1}' | grep -qx 'lightdm.service'; then
  sudo systemctl enable --now lightdm >/dev/null 2>&1 || true
elif systemctl list-unit-files --type=service | awk '{print $1}' | grep -qx 'display-manager.service'; then
  sudo systemctl enable --now display-manager >/dev/null 2>&1 || true
fi

if [[ "${RESTART_DISPLAY_MANAGER}" == "1" ]]; then
  if systemctl is-active --quiet lightdm; then
    sudo systemctl restart lightdm >/dev/null 2>&1 || true
  elif systemctl is-active --quiet display-manager; then
    sudo systemctl restart display-manager >/dev/null 2>&1 || true
  fi
  sleep 1
fi

if systemctl is-active --quiet lightdm || systemctl is-active --quiet display-manager; then
  display_uid="$(id -u "${DISPLAY_USER}" 2>/dev/null || true)"
  if [[ -n "${display_uid}" ]]; then
    if [[ -f "/home/${DISPLAY_USER}/.Xauthority" ]]; then
      sudo -u "${DISPLAY_USER}" \
        XDG_RUNTIME_DIR="/run/user/${display_uid}" \
        DISPLAY=:0 \
        XAUTHORITY="/home/${DISPLAY_USER}/.Xauthority" \
        /usr/local/bin/cable3-apply-display-mode.sh || true
    fi
    sudo -u "${DISPLAY_USER}" \
      XDG_RUNTIME_DIR="/run/user/${display_uid}" \
      /usr/local/bin/cable3-apply-display-mode.sh || true
  fi
else
  echo "display_manager_inactive_mode_saved_for_next_graphical_start"
fi
REMOTE_SCRIPT

echo "Done. Display mode applied."
