#!/bin/bash
# Usage: run_aep_to_jsx.sh <path/to/file.aep>
set -euo pipefail

AEP_FILE="$1"
if [ ! -f "$AEP_FILE" ]; then
    echo "ERROR: AEP not found: $AEP_FILE"; exit 1
fi

AEP_ABS="$(cd "$(dirname "$AEP_FILE")" && pwd)/$(basename "$AEP_FILE")"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/src/utils/ae_control.sh"

# Build the modular exporter bundle, then use it as the script
"$ROOT_DIR/src/aep_exporter/build.sh"
SCRIPT="$ROOT_DIR/src/aep_exporter/dist/aep_exporter_bundle.jsx"
ERROR_LOG="/tmp/ae_aep2jsx_$$.txt"

if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly before export"
    exit 1
fi
sleep 1

TMP_JSX="/tmp/ae_aep2jsx_runner_$$.jsx"
cat > "$TMP_JSX" <<EOF
(function () {
    var errFile = new File("$ERROR_LOG");
    try {
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch(e2) {}
        app.open(new File("$AEP_ABS"));
        $.evalFile("$SCRIPT");
        errFile.open("w"); errFile.writeln("OK"); errFile.close();
    } catch(e) {
        errFile.open("w");
        errFile.writeln("ERROR: " + e.toString() + " line:" + e.line);
        errFile.close();
    }
    app.endSuppressDialogs(false);
})();
EOF

osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""
SECS=0
until [ -s "$ERROR_LOG" ]; do
    sleep 2; SECS=$((SECS+2))
    if [ $SECS -ge 60 ]; then
        echo "ERROR: AE timed out after 60s" > "$ERROR_LOG"
        break
    fi
done
if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly after export"
    exit 1
fi
sleep 1
rm -f "$TMP_JSX"

cat "$ERROR_LOG"
RESULT="$(cat "$ERROR_LOG")"
rm -f "$ERROR_LOG"

if [[ "$RESULT" != OK* ]]; then
    echo "FAILED"; exit 1
fi

# Print where the output was saved
GENERATED="${AEP_ABS%.aep}_generated.jsx"
if [ -f "$GENERATED" ]; then
    echo "Generated: $GENERATED"
    wc -l "$GENERATED"
fi
