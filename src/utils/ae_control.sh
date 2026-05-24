#!/bin/bash

ae_is_running() {
    pgrep -x "After Effects" >/dev/null 2>&1
}

ae_close_without_saving() {
    local wait_secs="${1:-10}"
    local attempt=0
    local max_attempts=3

    if ! ae_is_running; then
        return 0
    fi

    while ae_is_running && [ "$attempt" -lt "$max_attempts" ]; do
        osascript >/dev/null 2>&1 <<'APPLESCRIPT'
try
    tell application "After Effects" to quit
end try
try
    tell application "Adobe After Effects 2026" to quit
end try
try
    tell application "Adobe After Effects 2025" to quit
end try

delay 0.25

tell application "System Events"
    repeat with procName in {"After Effects", "Adobe After Effects 2026", "Adobe After Effects 2025"}
        try
            if exists process procName then
                tell process procName to set frontmost to true
                exit repeat
            end if
        end try
    end repeat
    key code 123
    delay 0.2
    key code 36
end tell
APPLESCRIPT

        local waited=0
        while ae_is_running && [ "$waited" -lt "$wait_secs" ]; do
            sleep 1
            waited=$((waited + 1))
        done

        if ! ae_is_running; then
            return 0
        fi

        attempt=$((attempt + 1))
    done

    return 1
}
