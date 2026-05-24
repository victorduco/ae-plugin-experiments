#!/bin/bash
# build_aep.sh — AEP → JSX → build AEP → render MP4
# Usage: build_aep.sh <path/to/file.aep> [comp_name]
#
# comp_name defaults to the last addComp() in the generated JSX (the main comp).

set -euo pipefail

AEP_INPUT="$1"
COMP_OVERRIDE="${2:-}"

if [ ! -f "$AEP_INPUT" ]; then
    echo "ERROR: AEP not found: $AEP_INPUT"; exit 1
fi

AEP_ABS="$(cd "$(dirname "$AEP_INPUT")" && pwd)/$(basename "$AEP_INPUT")"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/ae_control.sh"

BASE_NAME="$(basename "${AEP_ABS%.aep}")"
OUTPUT_DIR="$ROOT_DIR/output"
AEP_DIR="$OUTPUT_DIR/aep"
LOGS_DIR="$ROOT_DIR/logs"
GENERATED_JSX="$ROOT_DIR/src/scripts/${BASE_NAME}_generated.jsx"
OUTPUT_AEP="$AEP_DIR/${BASE_NAME}.aep"
OUTPUT_MOV="$OUTPUT_DIR/${BASE_NAME}.mov"
OUTPUT_LAST="$OUTPUT_DIR/${BASE_NAME}_last.mp4"

AERENDER="/Applications/Adobe After Effects 2026/aerender"
if [ ! -f "$AERENDER" ]; then
    AERENDER="/Applications/Adobe After Effects 2025/aerender"
fi
if [ ! -f "$AERENDER" ]; then
    echo "ERROR: aerender not found"; exit 1
fi

mkdir -p "$OUTPUT_DIR" "$AEP_DIR" "$LOGS_DIR"

# ── Step 1: AEP → JSX ────────────────────────────────────────────────────────
echo ""
echo "==> [1/3] Exporting JSX from: $AEP_ABS"
"$ROOT_DIR/src/aep_exporter/parse_aep.sh" "$AEP_ABS" "$GENERATED_JSX"

if [ ! -f "$GENERATED_JSX" ]; then
    echo "ERROR: generated JSX not found: $GENERATED_JSX"; exit 1
fi
echo "    OK: $GENERATED_JSX"

# ── Step 2: JSX → build AEP ──────────────────────────────────────────────────
echo ""
echo "==> [2/3] Building AEP from generated JSX"

BUILD_ERROR_LOG="/tmp/ae_pipeline_$$.txt"
TMP_JSX="/tmp/ae_pipeline_$$.jsx"
cat > "$TMP_JSX" <<EOF
(function () {
    var errFile = new File("$BUILD_ERROR_LOG");
    try {
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch(e2) {}
        $.evalFile("$GENERATED_JSX");
        app.project.save(new File("$OUTPUT_AEP"));
        errFile.open("w"); errFile.writeln("OK"); errFile.close();
    } catch(e) {
        errFile.open("w");
        errFile.writeln("ERROR: " + e.toString() + " line:" + e.line);
        errFile.close();
    }
    try { app.endSuppressDialogs(false); } catch(e) {}
})();
EOF

if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly"; exit 1
fi
sleep 1

rm -f "$BUILD_ERROR_LOG"
osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""

SECS=0
until [ -s "$BUILD_ERROR_LOG" ]; do
    sleep 2; SECS=$((SECS+2))
    if [ $SECS -ge 60 ]; then echo "ERROR: AE timed out after 60s" > "$BUILD_ERROR_LOG"; break; fi
done

if ! ae_close_without_saving 10; then
    echo "WARNING: Could not close After Effects cleanly after build"
fi
sleep 1
rm -f "$TMP_JSX"

BUILD_RESULT="$(cat "$BUILD_ERROR_LOG")"
rm -f "$BUILD_ERROR_LOG"
if [[ "$BUILD_RESULT" != OK* ]]; then
    echo "ERROR: build failed: $BUILD_RESULT"; exit 1
fi
echo "    OK: $OUTPUT_AEP"

# ── Step 3: Render ────────────────────────────────────────────────────────────
if [ -n "$COMP_OVERRIDE" ]; then
    COMP_NAME="$COMP_OVERRIDE"
else
    COMP_NAME=$(grep -o 'addComp("[^"]*"' "$GENERATED_JSX" | tail -1 | sed 's/addComp("//;s/"//')
    if [ -z "$COMP_NAME" ]; then COMP_NAME="$BASE_NAME"; fi
fi

echo ""
echo "==> [3/3] Rendering comp: $COMP_NAME"
rm -f "$OUTPUT_MOV"
"$AERENDER" \
    -project "$OUTPUT_AEP" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS

echo ""
echo "==> Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUTPUT_LAST" -y 2>&1 | tail -3
rm -f "$OUTPUT_MOV"

ls -lh "$OUTPUT_LAST"
echo ""
echo "Done!"
echo "AEP  → $OUTPUT_AEP"
echo "MP4  → $OUTPUT_LAST"
