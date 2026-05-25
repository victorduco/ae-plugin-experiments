
#!/bin/bash
# jsx_to_mp4.sh — JSX → AEP → MP4
# Usage: jsx_to_mp4.sh <script_name> [--wait-ae] [--preview] [--backup] [--comp <comp_name>]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

SCRIPT_NAME=""
WAIT_AE_FLAG=""
PASSTHROUGH_ARGS=""

while [ $# -gt 0 ]; do
    case "$1" in
        --wait-ae) WAIT_AE_FLAG="--wait-ae"; shift ;;
        --backup|-b|--comp|--preview|-p) PASSTHROUGH_ARGS="$PASSTHROUGH_ARGS $1"; shift ;;
        *)
            if [ -z "$SCRIPT_NAME" ]; then
                SCRIPT_NAME="$1"; shift
            else
                PASSTHROUGH_ARGS="$PASSTHROUGH_ARGS $1"; shift
            fi ;;
    esac
done

if [ -z "$SCRIPT_NAME" ]; then
    echo "Usage: jsx_to_mp4.sh <script_name> [--wait-ae] [--preview] [--backup] [--comp <comp_name>]"
    exit 1
fi

"$ROOT_DIR/src/utils/jsx_to_aep.sh" "$SCRIPT_NAME" $WAIT_AE_FLAG
"$ROOT_DIR/src/utils/aep_to_mp4.sh" "$SCRIPT_NAME" $PASSTHROUGH_ARGS
