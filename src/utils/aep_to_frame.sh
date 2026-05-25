#!/bin/bash
# aep_to_frame.sh — AEP → current-frame PNG
# Usage: aep_to_frame.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>]

set -euo pipefail

SCRIPT_NAME=""
COMP_OVERRIDE=""
FRAME_NUMBER=""

while [ $# -gt 0 ]; do
    case "$1" in
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        --frame) FRAME_NUMBER="$2"; shift 2 ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: aep_to_frame.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ] || [ -z "$FRAME_NUMBER" ]; then
    echo "Usage: aep_to_frame.sh <script_name|path/to/file.aep> --frame <frame_number> [--comp <comp_name>]"
    exit 1
fi

case "$FRAME_NUMBER" in
    ''|*[!0-9]*)
        echo "ERROR: --frame must be a non-negative integer"
        exit 1
        ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/render_common.sh"

AEP_DIR="$ROOT_DIR/output/aep"
OUTPUT_DIR="$ROOT_DIR/output"
LOGS_DIR="$ROOT_DIR/logs"

IFS=$'\t' read -r PROJECT_FILE SCRIPT_NAME <<EOF
$(ae_resolve_project_file_and_name "$ROOT_DIR" "$SCRIPT_NAME")
EOF

OUTPUT_LOG="$LOGS_DIR/${SCRIPT_NAME}_frame.log"
OUTPUT_MOV="$OUTPUT_DIR/${SCRIPT_NAME}_current_frame.mov"
OUTPUT_FRAME="$(ae_frame_preview_path "$ROOT_DIR" "$SCRIPT_NAME")"
AERENDER="$(ae_resolve_aerender)"
COMP_NAME="$(ae_resolve_comp_name "$ROOT_DIR" "$SCRIPT_NAME" "$COMP_OVERRIDE")"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "ERROR: AEP not found: $PROJECT_FILE"
    exit 1
fi

mkdir -p "$OUTPUT_DIR" "$AEP_DIR" "$LOGS_DIR"
rm -f "$OUTPUT_MOV" "$OUTPUT_FRAME"

: > "$OUTPUT_LOG"
{
    echo "script=$SCRIPT_NAME"
    echo "frame=$FRAME_NUMBER"
    echo "aep=$PROJECT_FILE"
    echo "comp=$COMP_NAME"
    echo "aerender=$AERENDER"
    echo "frame_output=$OUTPUT_FRAME"
} >> "$OUTPUT_LOG"

echo "==> AEP → current frame PNG: $COMP_NAME @ frame $FRAME_NUMBER"
"$AERENDER" \
    -project "$PROJECT_FILE" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "$AE_OM_TEMPLATE" \
    -RStemplate "$AE_RS_TEMPLATE" \
    -renderSettings "$AE_RENDER_SETTINGS_FULL" \
    -s "$FRAME_NUMBER" \
    -e "$FRAME_NUMBER" \
    -mfr ON 100 \
    -mem_usage 50 80 \
    -v ERRORS_AND_PROGRESS >> "$OUTPUT_LOG" 2>&1

echo "==> Converting current frame to PNG..."
ffmpeg -i "$OUTPUT_MOV" -frames:v 1 -vf "$AE_FFMPEG_SCALE_FILTER" "$OUTPUT_FRAME" -y >> "$OUTPUT_LOG" 2>&1

rm -f "$OUTPUT_MOV"

echo ""
echo "Done! → $OUTPUT_FRAME"
echo "AEP   → $PROJECT_FILE"
echo "Log   → $OUTPUT_LOG"
