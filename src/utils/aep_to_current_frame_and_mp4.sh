#!/bin/bash
# aep_to_current_frame_and_mp4.sh — AEP → current-frame PNG → MP4
# Usage: aep_to_current_frame_and_mp4.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>] [--preview] [--backup]

set -euo pipefail

SCRIPT_NAME=""
COMP_OVERRIDE=""
FRAME_NUMBER=""
BACKUP=0
PREVIEW=0
CURRENT_STAGE=""

trap 'code=$?; if [ $code -ne 0 ]; then echo "JOB_STAGE: error"; if [ -n "$CURRENT_STAGE" ]; then echo "JOB_ERROR_STAGE: $CURRENT_STAGE"; fi; fi' EXIT

while [ $# -gt 0 ]; do
    case "$1" in
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        --frame) FRAME_NUMBER="$2"; shift 2 ;;
        --backup|-b) BACKUP=1; shift ;;
        --preview|-p) PREVIEW=1; shift ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: aep_to_current_frame_and_mp4.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>] [--preview] [--backup]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ] || [ -z "$FRAME_NUMBER" ]; then
    echo "Usage: aep_to_current_frame_and_mp4.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>] [--preview] [--backup]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

CURRENT_STAGE="frame_rendering"
echo "JOB_STAGE: frame_rendering"
if [ -n "$COMP_OVERRIDE" ]; then
    "$ROOT_DIR/src/utils/aep_to_frame.sh" "$SCRIPT_NAME" --frame "$FRAME_NUMBER" --comp "$COMP_OVERRIDE"
else
    "$ROOT_DIR/src/utils/aep_to_frame.sh" "$SCRIPT_NAME" --frame "$FRAME_NUMBER"
fi

echo "JOB_FRAME_READY: 1"

CURRENT_STAGE="video_rendering"
echo "JOB_STAGE: video_rendering"

MP4_ARGS=("$SCRIPT_NAME")
if [ -n "$COMP_OVERRIDE" ]; then
    MP4_ARGS+=(--comp "$COMP_OVERRIDE")
fi
if [ "$PREVIEW" -eq 1 ]; then
    MP4_ARGS+=(--preview)
fi
if [ "$BACKUP" -eq 1 ]; then
    MP4_ARGS+=(--backup)
fi

"$ROOT_DIR/src/utils/aep_to_mp4.sh" "${MP4_ARGS[@]}"

CURRENT_STAGE="done"
echo "JOB_STAGE: done"
