#!/bin/bash
set -euo pipefail

# Usage: render.sh <script_name> [--backup]
# Example: render.sh redcircle --backup

SCRIPT_NAME=""
BACKUP=0
for arg in "$@"; do
    case "$arg" in
        --backup|-b)
            BACKUP=1
            ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$arg"
            else
                echo "ERROR: Unknown argument: $arg"
                echo "Usage: render.sh <script_name> [--backup]"
                exit 1
            fi
            ;;
    esac
done

if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: render.sh <script_name> [--backup]"
    echo "Example: render.sh redcircle --backup"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/ae_control.sh"
JSX_FILE="$ROOT_DIR/src/scripts/${SCRIPT_NAME}.jsx"
OUTPUT_DIR="$ROOT_DIR/output"
AEP_DIR="$OUTPUT_DIR/aep"
LOGS_DIR="$ROOT_DIR/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
PROJECT_FILE="$AEP_DIR/${SCRIPT_NAME}.aep"
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

if [ ! -f "$JSX_FILE" ]; then
    echo "ERROR: Script not found: $JSX_FILE"; exit 1
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
    echo "jsx=$JSX_FILE"
    echo "aerender=$AERENDER"
} >> "$OUTPUT_LOG"

# Step 1: Run JSX via AppleScript — builds and saves .aep
echo "==> [1/3] Building project: $SCRIPT_NAME"

BUILD_ERROR_LOG="/tmp/ae_build_error_$$.txt"
rm -f "$BUILD_ERROR_LOG"

TMP_JSX="/tmp/ae_runner_$$.jsx"
cat > "$TMP_JSX" <<EOF
(function () {
    var errFile = new File("$BUILD_ERROR_LOG");
    try {
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch(e2) {}
        $.evalFile("$JSX_FILE");
        app.project.save(new File("$PROJECT_FILE"));
        errFile.open("w"); errFile.writeln("OK"); errFile.close();
    } catch(e) {
        errFile.open("w");
        errFile.writeln("ERROR: " + e.toString());
        errFile.writeln("line: " + e.line);
        errFile.close();
    }
    app.endSuppressDialogs(false);
})();
EOF

if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly before build"
    exit 1
fi
sleep 1
osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""
SECS=0
until [ -s "$BUILD_ERROR_LOG" ]; do
    sleep 2; SECS=$((SECS+2))
    if [ $SECS -ge 60 ]; then
        echo "ERROR: AE timed out after 60s" > "$BUILD_ERROR_LOG"
        break
    fi
done
if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly after build"
    exit 1
fi
sleep 1
rm -f "$TMP_JSX"

if [ -f "$BUILD_ERROR_LOG" ]; then
    BUILD_RESULT="$(cat "$BUILD_ERROR_LOG")"
    rm -f "$BUILD_ERROR_LOG"
    if [[ "$BUILD_RESULT" != OK* ]]; then
        echo "ERROR: JSX build failed:"
        echo "$BUILD_RESULT"
        echo "[build] FAILED: $BUILD_RESULT" >> "$OUTPUT_LOG"
        exit 1
    fi
else
    echo "ERROR: JSX build produced no output (AE may have crashed or shown a dialog)"
    exit 1
fi

echo "[build] saved $PROJECT_FILE" >> "$OUTPUT_LOG"

# Step 2: Render
# Determine comp name: last addComp() call in the JSX is the main comp.
# Falls back to SCRIPT_NAME if not found (hand-written scripts use that convention).
COMP_NAME=$(grep -o 'addComp("[^"]*"' "$JSX_FILE" | tail -1 | sed 's/addComp("//;s/"//')
if [ -z "$COMP_NAME" ]; then
    COMP_NAME="$SCRIPT_NAME"
fi
echo "==> [2/3] Rendering comp: $COMP_NAME"
"$AERENDER" \
    -project "$PROJECT_FILE" \
    -comp "$COMP_NAME" \
    -output "$OUTPUT_MOV" \
    -OMtemplate "Lossless" \
    -RStemplate "Best Settings" \
    -v ERRORS_AND_PROGRESS >> "$OUTPUT_LOG" 2>&1

# Step 3: Convert to MP4
echo "==> [3/3] Converting to MP4..."
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
echo "Last  → $OUTPUT_LAST"
if [ -f "$OUTPUT_REF" ]; then
    echo "Ref   → $OUTPUT_REF"
fi
if [ "$BACKUP" -eq 1 ]; then
    echo "Backup AEP → $BACKUP_PROJECT_FILE"
    echo "Backup MP4 → $BACKUP_OUTPUT_MP4"
    echo "Backup Log → $BACKUP_OUTPUT_LOG"
fi
