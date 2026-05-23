---
name: ae-render
description: Rendering video from an AE script in this project. Use when asked to render, re-render, or run the render pipeline for a script.
---

# AE Render Skill

## How to Render

```bash
npm run render <script_name>
# e.g.
npm run render android_show_1
```

Or call the script directly:
```bash
./src/utils/runner.sh android_show_1
```

`<script_name>` is the `.jsx` filename **without the extension**.

## What the Pipeline Does (3 stages)

### Stage 1 — Build AE Project via AppleScript
- Opens Adobe After Effects 2026 (falls back to 2025)
- Closes current project without saving
- Runs `$.evalFile()` on your `.jsx` script
- Saves the resulting AE project to `output/<name>_<timestamp>.aep`
- Wait: **~8 seconds** for AE to finish

### Stage 2 — Render with aerender
```bash
aerender \
  -project "output/<name>_<ts>.aep" \
  -comp "<script_name>" \
  -output "output/<name>_<ts>.mov" \
  -OMtemplate "Lossless" \
  -RStemplate "Best Settings" \
  -v ERRORS_AND_PROGRESS
```
- `aerender` is AE's headless CLI renderer
- Located at `/Applications/Adobe After Effects 2026/aerender` (auto-detected)
- Output: lossless `.mov`

### Stage 3 — Convert to MP4 via ffmpeg
```bash
ffmpeg -i input.mov -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4 -y
```
- CRF 18 = high quality H.264
- Creates two files:
  - `output/<name>_<timestamp>.mp4` — timestamped archive
  - `output/<name>_last.mp4` — always the latest (overwritten each render)

## Output Files

```
output/
├── android_show_1_20260522_164313.aep   ← AE project (timestamped)
├── android_show_1_20260522_164313.mp4   ← render archive
└── android_show_1_last.mp4              ← latest render (used by Web UI)
```

`_ref.mp4` is the reference video for comparison — place it manually:
```bash
cp output/android_show_1_last.mp4 output/android_show_1_ref.mp4
```

## Requirements

- macOS only (uses AppleScript)
- Adobe After Effects 2026 or 2025 installed at `/Applications/`
- `ffmpeg` in PATH (`brew install ffmpeg`)
- AE script file at `src/scripts/<name>.jsx`
- Composition inside the script named exactly `<name>`

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `aerender: command not found` | AE not at expected path | Check `AERENDER` var in `runner.sh` |
| Stage 1 hangs | AE dialog open or crashed | Quit AE manually, re-run |
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
