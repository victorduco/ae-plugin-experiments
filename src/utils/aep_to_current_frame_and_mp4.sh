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
OUTPUT_STEM=""

while [ $# -gt 0 ]; do
    case "$1" in
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        --frame) FRAME_NUMBER="$2"; shift 2 ;;
        --backup|-b) BACKUP=1; shift ;;
        --preview|-p) PREVIEW=1; shift ;;
        --output-stem) OUTPUT_STEM="$2"; shift 2 ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: aep_to_current_frame_and_mp4.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>] [--preview] [--backup] [--output-stem <name>]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ] || [ -z "$FRAME_NUMBER" ]; then
    echo "Usage: aep_to_current_frame_and_mp4.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>] [--preview] [--backup] [--output-stem <name>]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/render_common.sh"

IFS=$'\t' read -r _PROJECT_FILE RESOLVED_SCRIPT_NAME <<EOF
$(ae_resolve_project_file_and_name "$ROOT_DIR" "$SCRIPT_NAME")
EOF

if [ -z "$OUTPUT_STEM" ]; then
    OUTPUT_STEM="$RESOLVED_SCRIPT_NAME"
fi

STATUS_FILE="$(ae_render_status_path "$ROOT_DIR" "$OUTPUT_STEM")"
FRAME_PATH="/output/${OUTPUT_STEM}_current_frame.png"

trap 'code=$?; if [ $code -ne 0 ]; then ae_write_render_status "$STATUS_FILE" "error" "error" false "$FRAME_PATH" "$OUTPUT_STEM" "${CURRENT_STAGE:-error}"; echo "JOB_STAGE: error"; if [ -n "$CURRENT_STAGE" ]; then echo "JOB_ERROR_STAGE: $CURRENT_STAGE"; fi; fi' EXIT

CURRENT_STAGE="frame_rendering"
ae_write_render_status "$STATUS_FILE" "running" "$CURRENT_STAGE" false "$FRAME_PATH" "$OUTPUT_STEM"
echo "JOB_STAGE: frame_rendering"
FRAME_ARGS=("$SCRIPT_NAME" --frame "$FRAME_NUMBER")
if [ -n "$COMP_OVERRIDE" ]; then
    FRAME_ARGS+=(--comp "$COMP_OVERRIDE")
fi
if [ -n "$OUTPUT_STEM" ]; then
    FRAME_ARGS+=(--output-stem "$OUTPUT_STEM")
fi
"$ROOT_DIR/src/utils/aep_to_frame.sh" "${FRAME_ARGS[@]}"

echo "JOB_FRAME_READY: 1"

CURRENT_STAGE="video_rendering"
ae_write_render_status "$STATUS_FILE" "running" "$CURRENT_STAGE" true "$FRAME_PATH" "$OUTPUT_STEM"
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
if [ -n "$OUTPUT_STEM" ]; then
    MP4_ARGS+=(--output-stem "$OUTPUT_STEM")
fi

"$ROOT_DIR/src/utils/aep_to_mp4.sh" "${MP4_ARGS[@]}"

CURRENT_STAGE="done"
ae_write_render_status "$STATUS_FILE" "done" "$CURRENT_STAGE" false "" "$OUTPUT_STEM"
echo "JOB_STAGE: done"
