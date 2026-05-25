#!/bin/bash

AE_RS_TEMPLATE="Best Settings"
AE_OM_TEMPLATE="Lossless"
AE_RENDER_SETTINGS_FULL="Resolution: Full"
AE_RENDER_SETTINGS_PREVIEW="Resolution: Quarter"
AE_FFMPEG_SCALE_FILTER="scale=trunc(iw/2)*2:trunc(ih/2)*2"
AE_FFMPEG_MP4_ARGS=(
    -c:v libx264
    -crf 18
    -preset ultrafast
    -pix_fmt yuv420p
    -vf "$AE_FFMPEG_SCALE_FILTER"
)

ae_resolve_aerender() {
    local aerender="/Applications/Adobe After Effects 2026/aerender"
    if [ ! -f "$aerender" ]; then
        aerender="/Applications/Adobe After Effects 2025/aerender"
    fi
    if [ ! -f "$aerender" ]; then
        echo "ERROR: aerender not found" >&2
        return 1
    fi
    printf '%s\n' "$aerender"
}

ae_resolve_project_file_and_name() {
    local root_dir="$1"
    local script_input="$2"
    local project_file=""
    local script_name=""

    if [[ "$script_input" == *.aep ]]; then
        project_file="$(cd "$(dirname "$script_input")" && pwd)/$(basename "$script_input")"
        script_name="$(basename "${script_input%.aep}")"
    else
        project_file="$root_dir/output/aep/${script_input}.aep"
        script_name="$script_input"
    fi

    printf '%s\t%s\n' "$project_file" "$script_name"
}

ae_find_jsx_file() {
    local root_dir="$1"
    local script_name="$2"
    local jsx_file="$root_dir/src/scripts/${script_name}.jsx"

    if [ ! -f "$jsx_file" ]; then
        jsx_file="$root_dir/output/jsx/${script_name}.jsx"
    fi

    if [ -f "$jsx_file" ]; then
        printf '%s\n' "$jsx_file"
    fi
}

ae_resolve_comp_name() {
    local root_dir="$1"
    local script_name="$2"
    local comp_override="${3:-}"
    local comp_name="$comp_override"

    if [ -z "$comp_name" ]; then
        local jsx_file=""
        jsx_file="$(ae_find_jsx_file "$root_dir" "$script_name" || true)"
        if [ -n "$jsx_file" ] && [ -f "$jsx_file" ]; then
            comp_name="$(grep -o 'addComp("[^"]*"' "$jsx_file" | tail -1 | sed 's/addComp("//;s/"//')"
        fi
    fi

    if [ -z "$comp_name" ]; then
        comp_name="$script_name"
    fi

    printf '%s\n' "$comp_name"
}

ae_frame_preview_path() {
    local root_dir="$1"
    local script_name="$2"
    printf '%s\n' "$root_dir/output/${script_name}_current_frame.png"
}

ae_cleanup_script_outputs() {
    local output_dir="$1"
    local aep_dir="$2"
    local logs_dir="$3"
    local script_name="$4"

    find "$output_dir" -maxdepth 1 -type f \( \
        -name "${script_name}_*.mp4" -o \
        -name "${script_name}_*.mov" \
    \) \
    ! -name "${script_name}_last.mp4" \
    ! -name "${script_name}_ref.mp4" \
    -delete

    find "$aep_dir" -maxdepth 1 -type f \
        -name "${script_name}_*.aep" \
        -delete

    find "$logs_dir" -maxdepth 1 -type f \
        -name "${script_name}_*.log" \
        -delete
}
