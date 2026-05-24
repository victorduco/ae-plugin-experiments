#!/bin/bash
# jsx_to_aep.sh — JSX → AEP
# Usage: jsx_to_aep.sh <script_name>
# Looks for src/scripts/<script_name>.jsx, saves AEP to output/aep/<script_name>.aep

set -euo pipefail

SCRIPT_NAME="$1"
if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: jsx_to_aep.sh <script_name>"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/ae_control.sh"

JSX_FILE="$ROOT_DIR/src/scripts/${SCRIPT_NAME}.jsx"
if [ ! -f "$JSX_FILE" ]; then
    JSX_FILE="$ROOT_DIR/output/jsx/${SCRIPT_NAME}.jsx"
fi
if [ ! -f "$JSX_FILE" ]; then
    echo "ERROR: Script not found: src/scripts/${SCRIPT_NAME}.jsx"; exit 1
fi

AEP_DIR="$ROOT_DIR/output/aep"
PROJECT_FILE="$AEP_DIR/${SCRIPT_NAME}.aep"
mkdir -p "$AEP_DIR"

echo "==> JSX → AEP: $SCRIPT_NAME"

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
    echo "ERROR: Could not close After Effects cleanly before build"; exit 1
fi
sleep 1
osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""
SECS=0
until [ -s "$BUILD_ERROR_LOG" ]; do
    sleep 2; SECS=$((SECS+2))
    if [ $SECS -ge 60 ]; then
        echo "ERROR: AE timed out after 60s" > "$BUILD_ERROR_LOG"; break
    fi
done
if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly after build"; exit 1
fi
sleep 1
rm -f "$TMP_JSX"

if [ -f "$BUILD_ERROR_LOG" ]; then
    BUILD_RESULT="$(cat "$BUILD_ERROR_LOG")"
    rm -f "$BUILD_ERROR_LOG"
    if [[ "$BUILD_RESULT" != OK* ]]; then
        echo "ERROR: JSX build failed:"
        echo "$BUILD_RESULT"
        exit 1
    fi
else
    echo "ERROR: JSX build produced no output (AE may have crashed or shown a dialog)"
    exit 1
fi

echo "Done! → $PROJECT_FILE"
