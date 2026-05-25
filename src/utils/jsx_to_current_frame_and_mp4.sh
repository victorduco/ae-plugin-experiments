#!/bin/bash
# jsx_to_current_frame_and_mp4.sh — JSX → AEP → current-frame PNG → MP4
# Usage: jsx_to_current_frame_and_mp4.sh <script_name> --frame <frame_number> [--wait-ae] [--comp <comp_name>] [--preview] [--backup]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

SCRIPT_NAME=""
WAIT_AE=0
COMP_OVERRIDE=""
FRAME_NUMBER=""
BACKUP=0
PREVIEW=0
CURRENT_STAGE=""

trap 'code=$?; if [ $code -ne 0 ]; then echo "JOB_STAGE: error"; if [ -n "$CURRENT_STAGE" ]; then echo "JOB_ERROR_STAGE: $CURRENT_STAGE"; fi; fi' EXIT

while [ $# -gt 0 ]; do
    case "$1" in
        --wait-ae) WAIT_AE=1; shift ;;
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        --frame) FRAME_NUMBER="$2"; shift 2 ;;
        --backup|-b) BACKUP=1; shift ;;
        --preview|-p) PREVIEW=1; shift ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: jsx_to_current_frame_and_mp4.sh <script_name> --frame <frame_number> [--wait-ae] [--comp <comp_name>] [--preview] [--backup]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ] || [ -z "$FRAME_NUMBER" ]; then
    echo "Usage: jsx_to_current_frame_and_mp4.sh <script_name> --frame <frame_number> [--wait-ae] [--comp <comp_name>] [--preview] [--backup]"
    exit 1
fi

CURRENT_STAGE="build"
echo "JOB_STAGE: build"
if [ "$WAIT_AE" -eq 1 ]; then
    "$ROOT_DIR/src/utils/jsx_to_aep.sh" "$SCRIPT_NAME" --wait-ae
else
    "$ROOT_DIR/src/utils/jsx_to_aep.sh" "$SCRIPT_NAME"
fi

CURRENT_STAGE="frame_rendering"
ARGS=("$SCRIPT_NAME" --frame "$FRAME_NUMBER")
if [ -n "$COMP_OVERRIDE" ]; then
    ARGS+=(--comp "$COMP_OVERRIDE")
fi
if [ "$PREVIEW" -eq 1 ]; then
    ARGS+=(--preview)
fi
if [ "$BACKUP" -eq 1 ]; then
    ARGS+=(--backup)
fi

"$ROOT_DIR/src/utils/aep_to_current_frame_and_mp4.sh" "${ARGS[@]}"

CURRENT_STAGE="done"
