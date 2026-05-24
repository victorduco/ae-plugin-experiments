#!/bin/bash
# run_exporter.sh — build the bundle and run it against an AEP file.
# Usage: run_exporter.sh <path/to/file.aep>
#
# Replaces src/utils/run_aep_to_jsx.sh with the new modular exporter.
# Output: <aep_path_without_ext>_generated.jsx

set -euo pipefail

AEP_FILE="$1"
if [ ! -f "$AEP_FILE" ]; then
    echo "ERROR: AEP not found: $AEP_FILE"; exit 1
fi

AEP_ABS="$(cd "$(dirname "$AEP_FILE")" && pwd)/$(basename "$AEP_FILE")"
EXPORTER_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$EXPORTER_DIR/../.." && pwd)"

source "$ROOT_DIR/src/utils/ae_control.sh"

# Build the bundle first (fast, idempotent)
echo "Building exporter bundle..."
"$EXPORTER_DIR/build.sh"

BUNDLE="$EXPORTER_DIR/dist/aep_exporter_bundle.jsx"
ERROR_LOG="/tmp/ae_exporter_$$.txt"

# Close AE cleanly before opening the target AEP
if ! ae_close_without_saving 10; then
    echo "ERROR: Could not close After Effects cleanly before export"
    exit 1
fi
sleep 1

# Write a thin runner JSX that opens the AEP then evals the bundle
TMP_JSX="/tmp/ae_exporter_runner_$$.jsx"
cat > "$TMP_JSX" <<EOF
(function () {
    var errFile = new File("$ERROR_LOG");
    try {
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch(e2) {}
        app.open(new File("$AEP_ABS"));
        $.evalFile("$BUNDLE");
        errFile.open("w"); errFile.writeln("OK"); errFile.close();
    } catch(e) {
        errFile.open("w");
        errFile.writeln("ERROR: " + e.toString() + " line:" + e.line);
        errFile.close();
    }
    app.endSuppressDialogs(false);
})();
EOF

echo "Running exporter in After Effects..."
osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$TMP_JSX\""

# Wait for AE to finish (up to 90s for large projects)
SECS=0
until [ -s "$ERROR_LOG" ]; do
    sleep 2; SECS=$((SECS+2))
    if [ $SECS -ge 90 ]; then
        echo "ERROR: AE timed out after 90s" > "$ERROR_LOG"
        break
    fi
done

if ! ae_close_without_saving 10; then
    echo "WARNING: Could not close After Effects cleanly after export"
fi
sleep 1

rm -f "$TMP_JSX"

RESULT="$(cat "$ERROR_LOG")"
echo "$RESULT"
rm -f "$ERROR_LOG"

if [[ "$RESULT" != OK* ]]; then
    echo "FAILED"; exit 1
fi

# Report output file
GENERATED="${AEP_ABS%.aep}_generated.jsx"
if [ -f "$GENERATED" ]; then
    echo "Generated: $GENERATED"
    wc -l "$GENERATED"

    # Print effects summary if any issues were logged
    SUMMARY=$(grep -A 200 "EFFECTS EXTRACTION ISSUES" "$GENERATED" 2>/dev/null | head -50 || true)
    if [ -n "$SUMMARY" ]; then
        echo ""
        echo "─── Effects summary ──────────────────────────────"
        echo "$SUMMARY"
    fi
fi
