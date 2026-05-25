#!/bin/bash
# monitor.sh — system monitor for AE render diagnostics (M4, no sudo needed)
# Samples CPU, RAM, GPU (Metal/AGX) every second, prints to screen and file.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS_DIR="$ROOT_DIR/logs"
mkdir -p "$LOGS_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOGS_DIR/monitor_${TIMESTAMP}.log"

# ── helpers ────────────────────────────────────────────────────────────────────

get_gpu_stats() {
    ioreg -r -d 1 -c IOAccelerator 2>/dev/null \
        | grep '"PerformanceStatistics"' \
        | head -1 \
        | python3 "$ROOT_DIR/src/utils/gpu_stats.py"
}

get_ae_pid() {
    pgrep -x "aerender" 2>/dev/null || pgrep -x "After Effects" 2>/dev/null || echo ""
}

sample() {
    local ts
    ts="$(date '+%H:%M:%S')"

    # CPU (from top, single sample)
    local cpu_line
    cpu_line="$(top -l 1 -s 0 | grep '^CPU')"
    local cpu_user cpu_sys cpu_idle
    cpu_user="$(echo "$cpu_line" | grep -oE '[0-9.]+% user' | grep -oE '[0-9.]+')"
    cpu_sys="$(echo  "$cpu_line" | grep -oE '[0-9.]+% sys'  | grep -oE '[0-9.]+')"
    cpu_idle="$(echo "$cpu_line" | grep -oE '[0-9.]+% idle' | grep -oE '[0-9.]+')"

    # RAM (from top)
    local mem_line
    mem_line="$(top -l 1 -s 0 | grep '^PhysMem')"
    local mem_used mem_free
    mem_used="$(echo "$mem_line" | grep -oE '[0-9]+[MG] used' | head -1)"
    mem_free="$(echo "$mem_line" | grep -oE '[0-9]+[MG] unused' | head -1)"

    # GPU via ioreg (AGX Metal)
    local gpu_raw gpu_device gpu_renderer gpu_tiler gpu_mem_used
    gpu_raw="$(get_gpu_stats)"
    gpu_device="$(echo   "$gpu_raw" | grep -oE 'device=[^|]+'   | cut -d= -f2)"
    gpu_renderer="$(echo "$gpu_raw" | grep -oE 'renderer=[^|]+' | cut -d= -f2)"
    gpu_tiler="$(echo    "$gpu_raw" | grep -oE 'tiler=[^|]+'    | cut -d= -f2)"
    gpu_mem_used="$(echo "$gpu_raw" | grep -oE 'vram=[^|]+'     | cut -d= -f2)"

    # AE / aerender process
    local ae_pid ae_cpu ae_mem
    ae_pid="$(get_ae_pid)"
    if [ -n "$ae_pid" ]; then
        local ae_stats
        ae_stats="$(ps -p "$ae_pid" -o %cpu=,rss= 2>/dev/null | head -1)"
        ae_cpu="$(echo "$ae_stats" | awk '{print $1}')%"
        ae_rss="$(echo "$ae_stats" | awk '{print $2}')"
        ae_mem="$(python3 -c "print(f'{int(\"$ae_rss\")/1024:.0f}M')" 2>/dev/null || echo "?")"
        ae_info="pid=$ae_pid cpu=$ae_cpu mem=$ae_mem"
    else
        ae_info="(not running)"
    fi

    local line
    line="[$ts] CPU: user=${cpu_user}% sys=${cpu_sys}% idle=${cpu_idle}% | RAM: used=$mem_used free=$mem_free | GPU: device=${gpu_device:-?}% renderer=${gpu_renderer:-?}% tiler=${gpu_tiler:-?}% vram=$gpu_mem_used | AE: $ae_info"

    echo "$line"
    echo "$line" >> "$LOG_FILE"
}

# ── main ───────────────────────────────────────────────────────────────────────

echo ""
echo "  AE Render Monitor — M4 Pro"
echo "  Log: $LOG_FILE"
echo ""
echo -n "  Press ENTER to start (q + ENTER to stop)... "
read -r

echo "  Sampling every 1s. Press q + ENTER to stop."
echo ""
echo "TIMESTAMP | CPU user/sys/idle | RAM used/free | GPU device/renderer/tiler/vram | AE process" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

while true; do
    sample
    # Non-blocking check for quit
    if read -r -t 1 input 2>/dev/null; then
        if [[ "$input" == "q" ]]; then
            echo ""
            echo "  Stopped. Log saved to: $LOG_FILE"
            break
        fi
    fi
done
