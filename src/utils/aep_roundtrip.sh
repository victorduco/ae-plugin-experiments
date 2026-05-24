#!/bin/bash
# aep_roundtrip.sh <input.aep> <output_name>
# Full flow: AEP → generate JSX → build new AEP → render MP4
set -euo pipefail

AEP_INPUT="$1"
OUTPUT_NAME="${2:-roundtrip}"

if [ ! -f "$AEP_INPUT" ]; then
    echo "ERROR: AEP not found: $AEP_INPUT"; exit 1
fi

AEP_ABS="$(cd "$(dirname "$AEP_INPUT")" && pwd)/$(basename "$AEP_INPUT")"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/ae_control.sh"

# Build the modular exporter bundle, then use it as the script
"$ROOT_DIR/src/aep_exporter/build.sh"
AEP2JSX_SCRIPT="$ROOT_DIR/src/aep_exporter/dist/aep_exporter_bundle.jsx"
OUTPUT_DIR="$ROOT_DIR/output"
mkdir -p "$OUTPUT_DIR"

GENERATED_JSX="${AEP_ABS%.aep}_generated.jsx"
OUTPUT_AEP="$OUTPUT_DIR/${OUTPUT_NAME}.aep"
OUTPUT_MOV="$OUTPUT_DIR/${OUTPUT_NAME}.mov"
OUTPUT_MP4="$OUTPUT_DIR/${OUTPUT_NAME}_last.mp4"

AERENDER="/Applications/Adobe After Effects 2026/aerender"

ae_quit() {
    if ! ae_close_without_saving 10; then
        echo "ERROR: Could not close After Effects cleanly" >&2
        return 1
    fi
    sleep 1
}

# ae_exec <jsx_file> <log_file> <timeout_secs>
ae_exec() {
    local JSX="$1"
    local LOG="$2"
    local TIMEOUT="$3"
    rm -f "$LOG"

    osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$JSX\"" &
    local OSPID=$!

    local SECS=0
    until [ -s "$LOG" ]; do
        sleep 1; SECS=$((SECS + 1))
        if [ $SECS -ge "$TIMEOUT" ]; then
            echo "ERROR: AE timed out after ${TIMEOUT}s" > "$LOG"
            break
        fi
    done
    kill "$OSPID" 2>/dev/null || true
}

# ── Step 1: open AEP → generate JSX ─────────────────────────────────────────
echo ""
echo "==> [1/3] Generating JSX from: $AEP_ABS"

# Quit any running AE cleanly first
if pgrep "After Effects" >/dev/null 2>&1; then
    ae_quit
fi

# Open AEP fresh — no existing project to trigger save dialog
open -a "Adobe After Effects 2026" "$AEP_ABS"
echo "    Waiting for AE to load..."
sleep 15

LOG1="/tmp/ae_step1_$$.txt"
JSX1="/tmp/ae_step1_$$.jsx"
cat > "$JSX1" <<EOF
(function(){
    var log = new File("$LOG1");
    try {
        $.evalFile("$AEP2JSX_SCRIPT");
        log.open("w"); log.writeln("OK"); log.close();
    } catch(e) {
        log.open("w"); log.writeln("ERROR: "+e+" line:"+e.line); log.close();
    }
})();
EOF

ae_exec "$JSX1" "$LOG1" 30
rm -f "$JSX1"

RESULT1="$(cat "$LOG1")"
if [[ "$RESULT1" != OK* ]]; then
    echo "FAILED step 1: $RESULT1"; ae_quit; exit 1
fi

if [ ! -f "$GENERATED_JSX" ]; then
    echo "ERROR: generated JSX not found: $GENERATED_JSX"; ae_quit; exit 1
fi
echo "    Generated: $GENERATED_JSX ($(wc -l < "$GENERATED_JSX") lines)"

# ── Step 2: JSX → build new AEP ──────────────────────────────────────────────
echo ""
echo "==> [2/3] Building AEP from generated JSX"

# Rename main comp to output name
SOURCE_NAME="$(basename "${AEP_ABS%.aep}")"
RENAMED_JSX="/tmp/ae_renamed_$$.jsx"
sed "s/addComp(\"$SOURCE_NAME\"/addComp(\"$OUTPUT_NAME\"/" "$GENERATED_JSX" > "$RENAMED_JSX"

LOG2="/tmp/ae_step2_$$.txt"
JSX2="/tmp/ae_step2_$$.jsx"
cat > "$JSX2" <<EOF
(function(){
    var log = new File("$LOG2");
    try {
        // Create fresh project — no save dialog
        app.newProject();
        $.evalFile("$RENAMED_JSX");
        app.project.save(new File("$OUTPUT_AEP"));
        log.open("w"); log.writeln("OK"); log.close();
    } catch(e) {
        log.open("w"); log.writeln("ERROR: "+e+" line:"+e.line); log.close();
    }
})();
EOF

ae_exec "$JSX2" "$LOG2" 30
rm -f "$JSX2" "$RENAMED_JSX"

RESULT2="$(cat "$LOG2")"
if [[ "$RESULT2" != OK* ]]; then
    echo "FAILED step 2: $RESULT2"; ae_quit; exit 1
fi
echo "    Built: $OUTPUT_AEP"

ae_quit

# ── Step 3: Render via aerender (no UI) ──────────────────────────────────────
echo ""
echo "==> [3/3] Rendering..."

rm -f "$OUTPUT_MOV"
"$AERENDER" \
    -project "$OUTPUT_AEP" \
    -comp "$OUTPUT_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS

echo ""
echo "==> Converting to MP4..."
ffmpeg -i "$OUTPUT_MOV" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUTPUT_MP4" -y 2>&1 | tail -3
rm -f "$OUTPUT_MOV"

ls -lh "$OUTPUT_MP4"
echo ""
echo "Done! → $OUTPUT_MP4"
