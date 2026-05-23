#!/bin/bash
set -euo pipefail

# Usage: render-open.sh <aep_path> <comp_name> <output_name>
# Renders an already-built .aep file (stages 2+3 only, no JSX build step)

AEP_PATH="${1:-}"
COMP_NAME="${2:-}"
OUTPUT_NAME="${3:-}"

if [ -z "$AEP_PATH" ] || [ -z "$COMP_NAME" ] || [ -z "$OUTPUT_NAME" ]; then
    echo "Usage: render-open.sh <aep_path> <comp_name> <output_name>"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output"
OUTPUT_MOV="$OUTPUT_DIR/${OUTPUT_NAME}.mov"
OUTPUT_LAST="$OUTPUT_DIR/${OUTPUT_NAME}_last.mp4"
OUTPUT_LOG="$OUTPUT_DIR/${OUTPUT_NAME}.log"

AERENDER="/Applications/Adobe After Effects 2026/aerender"
if [ ! -f "$AERENDER" ]; then
    AERENDER="/Applications/Adobe After Effects 2025/aerender"
fi
if [ ! -f "$AERENDER" ]; then
    echo "ERROR: aerender not found"; exit 1
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_MOV"

: > "$OUTPUT_LOG"
{
    echo "aep=$AEP_PATH"
    echo "comp=$COMP_NAME"
    echo "output_name=$OUTPUT_NAME"
    echo "aerender=$AERENDER"
} >> "$OUTPUT_LOG"

echo "==> [1/2] Rendering $COMP_NAME from $AEP_PATH..."
"$AERENDER" \
    -project "$AEP_PATH" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS >> "$OUTPUT_LOG" 2>&1

echo "==> [2/2] Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUTPUT_LAST" -y >> "$OUTPUT_LOG" 2>&1

rm -f "$OUTPUT_MOV"

echo ""
echo "Done! → $OUTPUT_LAST"
