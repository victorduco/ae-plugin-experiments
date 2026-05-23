#!/bin/bash
set -e

# Usage: runner.sh <script_name>
# Example: runner.sh redcircle

SCRIPT_NAME="$1"
if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: runner.sh <script_name>"
    echo "Example: runner.sh redcircle"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
JSX_FILE="$ROOT_DIR/src/scripts/${SCRIPT_NAME}.jsx"
OUTPUT_DIR="$ROOT_DIR/output"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
PROJECT_FILE="$OUTPUT_DIR/${SCRIPT_NAME}_${TIMESTAMP}.aep"
OUTPUT_MOV="$OUTPUT_DIR/${SCRIPT_NAME}_${TIMESTAMP}.mov"
OUTPUT_MP4="$OUTPUT_DIR/${SCRIPT_NAME}_${TIMESTAMP}.mp4"

AERENDER="/Applications/Adobe After Effects 2026/aerender"
if [ ! -f "$AERENDER" ]; then
    AERENDER="/Applications/Adobe After Effects 2025/aerender"
fi
if [ ! -f "$AERENDER" ]; then
    echo "ERROR: aerender not found"; exit 1
fi

if [ ! -f "$JSX_FILE" ]; then
    echo "ERROR: Script not found: $JSX_FILE"; exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Step 1: Run JSX via AppleScript — builds and saves .aep
echo "==> [1/3] Building project: $SCRIPT_NAME"

# Write a temp runner JSX that loads the scene and saves the .aep
TMP_JSX="$(mktemp /tmp/ae_runner_XXXX.jsx)"
cat > "$TMP_JSX" <<EOF
(function () {
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    $.evalFile("$JSX_FILE");
    app.project.save(new File("$PROJECT_FILE"));
})();
EOF

osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""
sleep 8
rm -f "$TMP_JSX"

# Step 2: Render
echo "==> [2/3] Rendering..."
"$AERENDER" \
    -project "$PROJECT_FILE" \
    -comp "$SCRIPT_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS

# Step 3: Convert to MP4
echo "==> [3/3] Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUTPUT_MP4" -y 2>&1 \
    | grep -E "frame=|time=|error" || true

rm -f "$OUTPUT_MOV"

# Copy to _last (always overwrite)
OUTPUT_LAST="$OUTPUT_DIR/${SCRIPT_NAME}_last.mp4"
cp "$OUTPUT_MP4" "$OUTPUT_LAST"

echo ""
echo "Done! → $OUTPUT_MP4"
echo "Last  → $OUTPUT_LAST"
