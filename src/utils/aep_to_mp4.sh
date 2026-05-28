#!/bin/bash
# aep_to_mp4.sh — AEP → MP4
# Usage: aep_to_mp4.sh <script_name> [--backup]
# Reads output/aep/<script_name>.aep, renders comp named after last addComp() in JSX.

set -euo pipefail

SCRIPT_NAME=""
BACKUP=0
COMP_OVERRIDE=""
PREVIEW=0
OUTPUT_STEM=""
while [ $# -gt 0 ]; do
    case "$1" in
        --backup|-b) BACKUP=1; shift ;;
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        --preview|-p) PREVIEW=1; shift ;;
        --output-stem) OUTPUT_STEM="$2"; shift 2 ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: aep_to_mp4.sh <script_name> [--comp <comp_name>] [--preview] [--backup] [--output-stem <name>]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: aep_to_mp4.sh <script_name|path/to/file.aep> [--comp <comp_name>] [--preview] [--backup] [--output-stem <name>]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/render_common.sh"

AEP_DIR="$ROOT_DIR/output/aep"
OUTPUT_DIR="$ROOT_DIR/output"
LOGS_DIR="$ROOT_DIR/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

IFS=$'\t' read -r PROJECT_FILE SCRIPT_NAME <<EOF
$(ae_resolve_project_file_and_name "$ROOT_DIR" "$SCRIPT_NAME")
EOF

if [ -z "$OUTPUT_STEM" ]; then
    OUTPUT_STEM="$SCRIPT_NAME"
fi

OUTPUT_MOV="$OUTPUT_DIR/${OUTPUT_STEM}.mov"
OUTPUT_MP4="$OUTPUT_DIR/${OUTPUT_STEM}.mp4"
OUTPUT_LOG="$LOGS_DIR/${OUTPUT_STEM}.log"
OUTPUT_LAST="$OUTPUT_DIR/${OUTPUT_STEM}_last.mp4"
OUTPUT_REF="$OUTPUT_DIR/${OUTPUT_STEM}_ref.mp4"
OUTPUT_FRAME_PREVIEW="$(ae_frame_preview_path "$ROOT_DIR" "$OUTPUT_STEM")"
BACKUP_PROJECT_FILE="$AEP_DIR/${SCRIPT_NAME}_${TIMESTAMP}.aep"
BACKUP_OUTPUT_MP4="$OUTPUT_DIR/${OUTPUT_STEM}_${TIMESTAMP}.mp4"
BACKUP_OUTPUT_LOG="$LOGS_DIR/${OUTPUT_STEM}_${TIMESTAMP}.log"

AERENDER="$(ae_resolve_aerender)"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "ERROR: AEP not found: $PROJECT_FILE"; exit 1
fi

mkdir -p "$OUTPUT_DIR" "$AEP_DIR" "$LOGS_DIR"
rm -f "$OUTPUT_MOV"

: > "$OUTPUT_LOG"
{
    echo "script=$SCRIPT_NAME"
    echo "backup=$BACKUP"
    echo "timestamp=$TIMESTAMP"
    echo "aep=$PROJECT_FILE"
    echo "aerender=$AERENDER"
} >> "$OUTPUT_LOG"

COMP_NAME="$(ae_resolve_comp_name "$ROOT_DIR" "$SCRIPT_NAME" "$COMP_OVERRIDE")"

_t0=$(python3 -c "import time; print(int(time.time()*1000))")
if [ "$PREVIEW" -eq 1 ]; then
    echo "==> AEP → MP4 (preview: quarter res, half fps): $COMP_NAME"
    RENDER_SETTINGS="$AE_RENDER_SETTINGS_PREVIEW"
    FRAME_STEP="-i 2"
else
    echo "==> AEP → MP4: $COMP_NAME"
    RENDER_SETTINGS="$AE_RENDER_SETTINGS_FULL"
    FRAME_STEP=""
fi
"$AERENDER" \
    -project "$PROJECT_FILE" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "$AE_OM_TEMPLATE" \
    -RStemplate "$AE_RS_TEMPLATE" \
    -renderSettings "$RENDER_SETTINGS" \
    $FRAME_STEP \
    -mfr ON 100 \
    -mem_usage 50 80 \
    -v ERRORS_AND_PROGRESS >> "$OUTPUT_LOG" 2>&1
_t1=$(python3 -c "import time; print(int(time.time()*1000))"); echo "[timing] aerender: $((_t1 - _t0))ms"

echo "==> Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" "${AE_FFMPEG_MP4_ARGS[@]}" "$OUTPUT_MP4" -y >> "$OUTPUT_LOG" 2>&1
_t2=$(python3 -c "import time; print(int(time.time()*1000))"); echo "[timing] ffmpeg mov→mp4: $((_t2 - _t1))ms"

rm -f "$OUTPUT_MOV"
cp "$OUTPUT_MP4" "$OUTPUT_LAST"
rm -f "$OUTPUT_MP4"
rm -f "$OUTPUT_FRAME_PREVIEW"
_t3=$(python3 -c "import time; print(int(time.time()*1000))"); echo "[timing] copy+cleanup: $((_t3 - _t2))ms"

ae_cleanup_script_outputs "$OUTPUT_DIR" "$AEP_DIR" "$LOGS_DIR" "$SCRIPT_NAME"

if [ "$BACKUP" -eq 1 ]; then
    cp "$PROJECT_FILE" "$BACKUP_PROJECT_FILE"
    cp "$OUTPUT_LAST" "$BACKUP_OUTPUT_MP4"
    cp "$OUTPUT_LOG" "$BACKUP_OUTPUT_LOG"
fi

echo ""
echo "Done! → $OUTPUT_LAST"
echo "AEP   → $PROJECT_FILE"
echo "Log   → $OUTPUT_LOG"
if [ -f "$OUTPUT_REF" ]; then
    echo "Ref   → $OUTPUT_REF"
fi
if [ "$BACKUP" -eq 1 ]; then
    echo "Backup AEP → $BACKUP_PROJECT_FILE"
    echo "Backup MP4 → $BACKUP_OUTPUT_MP4"
fi
