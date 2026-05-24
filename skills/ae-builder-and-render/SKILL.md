---
name: ae-builder-and-render
description: Build AE project and render video — Build Project (jsx_to_aep) + Render Video (aep_to_mp4). Use when asked to build, render, or re-render a JSX script. Commands: npm run jsx_to_aep <name> then npm run aep_to_mp4 <name>
---

# AE Render Skill

## How to Render

```bash
# Step 1: JSX → AEP
npm run jsx_to_aep <script_name>

# Step 2: AEP → MP4
npm run aep_to_mp4 <script_name>
```

Or call scripts directly:
```bash
./src/utils/jsx_to_aep.sh android_show_1
./src/utils/aep_to_mp4.sh android_show_1
```

`<script_name>` is the `.jsx` filename **without the extension**.

## What Each Script Does

### jsx_to_aep.sh — JSX → AEP
- Opens Adobe After Effects 2026 (falls back to 2025) via AppleScript
- Closes current project without saving
- Runs `$.evalFile()` on your `.jsx` script
- Saves the resulting AE project to `output/aep/<name>.aep`
- Closes AE

### aep_to_mp4.sh — AEP → MP4
```bash
aerender \
  -project "output/aep/<name>.aep" \
  -comp "<comp_name>" \
  -output "output/<name>.mov" \
  -OMtemplate "Lossless" \
  -RStemplate "Best Settings" \
  -v ERRORS_AND_PROGRESS
```
- `aerender` is AE's headless CLI renderer (no UI)
- Then: `ffmpeg -i input.mov -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`
- Creates `output/<name>_last.mp4` — always the latest (overwritten each render)
- Pass `--backup` to also save timestamped copies

## Output Files

```
output/
├── aep/android_show_1.aep     ← AE project (overwritten each build)
└── android_show_1_last.mp4    ← latest render (used by Web UI)
```

`_ref.mp4` is the reference video for comparison — place it manually:
```bash
cp output/android_show_1_last.mp4 output/android_show_1_ref.mp4
```

## AEP → JSX (parse existing .aep)

```bash
npm run aep_to_jsx -- src/scripts/aep/file.aep
```

Generated JSX lands in `output/jsx/<name>_generated.jsx`.

## Requirements

- macOS only (uses AppleScript)
- Adobe After Effects 2026 or 2025 installed at `/Applications/`
- `ffmpeg` in PATH (`brew install ffmpeg`)
- AE script file at `src/scripts/<name>.jsx`

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `aerender: command not found` | AE not at expected path | Check `AERENDER` var in `aep_to_mp4.sh` |
| jsx_to_aep hangs | AE dialog open or crashed | Quit AE manually, re-run |
| aerender exits with comp-not-found error | Comp name ≠ script name | Match comp name in `.jsx` to filename |
| Black video / empty comp | Script errored silently | Open AE, run script manually via File → Scripts |
| ffmpeg missing | Not installed | `brew install ffmpeg` |

## Viewing Results

After render completes, open the Web UI:
```bash
npm run ui
# → http://localhost:3131
```

The UI auto-refreshes via SSE when `output/` changes.
