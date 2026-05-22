#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$SCRIPT_DIR/sasha_pasha.aep"
OUTPUT_DIR="$SCRIPT_DIR/output"
OUTPUT_MOV="$OUTPUT_DIR/sasha_pasha.mov"

# Pick latest installed AE version
AERENDER="/Applications/Adobe After Effects 2026/aerender"
if [ ! -f "$AERENDER" ]; then
    AERENDER="/Applications/Adobe After Effects 2025/aerender"
fi

if [ ! -f "$AERENDER" ]; then
    echo "ERROR: aerender not found"
    exit 1
fi

if [ ! -f "$PROJECT" ]; then
    echo "ERROR: Project not found: $PROJECT"
    echo "Run save_project.jsx in After Effects first."
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Rendering: $PROJECT"
echo "Output:    $OUTPUT_MOV"
echo ""

"$AERENDER" \
    -project "$PROJECT" \
    -comp "Sasha & Pasha" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -s 0 \
    -e 144 \
    -v ERRORS_AND_PROGRESS

echo ""
echo "Done! Output: $OUTPUT_MOV"
