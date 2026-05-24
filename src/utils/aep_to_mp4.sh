#!/bin/bash
# aep_to_mp4.sh — AEP → MP4
# Usage: aep_to_mp4.sh <script_name> [--backup]
# Reads output/aep/<script_name>.aep, renders comp named after last addComp() in JSX.

set -euo pipefail

SCRIPT_NAME=""
BACKUP=0
COMP_OVERRIDE=""
while [ $# -gt 0 ]; do
    case "$1" in
        --backup|-b) BACKUP=1; shift ;;
        --comp) COMP_OVERRIDE="$2"; shift 2 ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                echo "ERROR: Unknown argument: $1"
                echo "Usage: aep_to_mp4.sh <script_name> [--comp <comp_name>] [--backup]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: aep_to_mp4.sh <script_name|path/to/file.aep> [--comp <comp_name>] [--backup]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

AEP_DIR="$ROOT_DIR/output/aep"
OUTPUT_DIR="$ROOT_DIR/output"
LOGS_DIR="$ROOT_DIR/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Accept either a bare script name or a full path to an .aep file
if [[ "$SCRIPT_NAME" == *.aep ]]; then
    PROJECT_FILE="$(cd "$(dirname "$SCRIPT_NAME")" && pwd)/$(basename "$SCRIPT_NAME")"
    SCRIPT_NAME="$(basename "${SCRIPT_NAME%.aep}")"
else
    PROJECT_FILE="$AEP_DIR/${SCRIPT_NAME}.aep"
fi
OUTPUT_MOV="$OUTPUT_DIR/${SCRIPT_NAME}.mov"
OUTPUT_MP4="$OUTPUT_DIR/${SCRIPT_NAME}.mp4"
OUTPUT_LOG="$LOGS_DIR/${SCRIPT_NAME}.log"
OUTPUT_LAST="$OUTPUT_DIR/${SCRIPT_NAME}_last.mp4"
OUTPUT_REF="$OUTPUT_DIR/${SCRIPT_NAME}_ref.mp4"
BACKUP_PROJECT_FILE="$AEP_DIR/${SCRIPT_NAME}_${TIMESTAMP}.aep"
BACKUP_OUTPUT_MP4="$OUTPUT_DIR/${SCRIPT_NAME}_${TIMESTAMP}.mp4"
BACKUP_OUTPUT_LOG="$LOGS_DIR/${SCRIPT_NAME}_${TIMESTAMP}.log"

AERENDER="/Applications/Adobe After Effects 2026/aerender"
if [ ! -f "$AERENDER" ]; then
    AERENDER="/Applications/Adobe After Effects 2025/aerender"
fi
if [ ! -f "$AERENDER" ]; then
    echo "ERROR: aerender not found"; exit 1
fi

if [ ! -f "$PROJECT_FILE" ]; then
    echo "ERROR: AEP not found: $PROJECT_FILE"; exit 1
fi

mkdir -p "$OUTPUT_DIR" "$AEP_DIR" "$LOGS_DIR"
rm -f "$OUTPUT_MOV"

cleanup_script_outputs() {
    find "$OUTPUT_DIR" -maxdepth 1 -type f \( \
        -name "${SCRIPT_NAME}_*.mp4" -o \
        -name "${SCRIPT_NAME}_*.mov" \
    \) \
    ! -name "${SCRIPT_NAME}_last.mp4" \
    ! -name "${SCRIPT_NAME}_ref.mp4" \
    -delete
    find "$AEP_DIR" -maxdepth 1 -type f \
        -name "${SCRIPT_NAME}_*.aep" \
        -delete
    find "$LOGS_DIR" -maxdepth 1 -type f \
        -name "${SCRIPT_NAME}_*.log" \
        -delete
}

: > "$OUTPUT_LOG"
{
    echo "script=$SCRIPT_NAME"
    echo "backup=$BACKUP"
    echo "timestamp=$TIMESTAMP"
    echo "aep=$PROJECT_FILE"
    echo "aerender=$AERENDER"
} >> "$OUTPUT_LOG"

# Determine comp name: explicit --comp flag, then JSX, then script name
COMP_NAME="$COMP_OVERRIDE"
if [ -z "$COMP_NAME" ]; then
    JSX_FILE="$ROOT_DIR/src/scripts/${SCRIPT_NAME}.jsx"
    if [ ! -f "$JSX_FILE" ]; then
        JSX_FILE="$ROOT_DIR/output/jsx/${SCRIPT_NAME}.jsx"
    fi
    if [ -f "$JSX_FILE" ]; then
        COMP_NAME=$(grep -o 'addComp("[^"]*"' "$JSX_FILE" | tail -1 | sed 's/addComp("//;s/"//')
    fi
fi
if [ -z "$COMP_NAME" ]; then
    COMP_NAME="$SCRIPT_NAME"
fi

echo "==> AEP → MP4: $COMP_NAME"
"$AERENDER" \
    -project "$PROJECT_FILE" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS >> "$OUTPUT_LOG" 2>&1

echo "==> Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUTPUT_MP4" -y >> "$OUTPUT_LOG" 2>&1

rm -f "$OUTPUT_MOV"
cp "$OUTPUT_MP4" "$OUTPUT_LAST"
rm -f "$OUTPUT_MP4"

cleanup_script_outputs

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
