---
name: ae-builder-and-render
description: Build AE project and render for UI — current frame first, then full video. Default scripting flow: jsx_to_current_frame_and_mp4. Split steps remain available via jsx_to_aep and aep_to_mp4.
---

# AE Render Skill

## When to use

По умолчанию для скриптинга и UI preview запускай новый frame-first flow:
- `jsx_to_current_frame_and_mp4` для `.jsx`
- `aep_to_current_frame_and_mp4` для уже существующего `.aep`

Он сначала рендерит один PNG кадр с теми же render settings, потом полный MP4. Так UI быстрее показывает пользователю текущий кадр.

Запускай шаги по отдельности только если пользователь явно просит что-то одно:
- только "собери" / "build" → только jsx_to_aep
- только "кадр" / "frame" → только aep_to_frame
- только "отрендери" / "render" → только aep_to_mp4

## How to Render

```bash
# Recommended: JSX → AEP → current frame PNG → MP4
./src/utils/jsx_to_current_frame_and_mp4.sh android_show_1 --frame 84

# Open/project AEP → current frame PNG → MP4
./src/utils/aep_to_current_frame_and_mp4.sh output/aep/android_show_1.aep --frame 84 --comp android_show_1

# Frame only
./src/utils/aep_to_frame.sh output/aep/android_show_1.aep --frame 84 --comp android_show_1

# Manual split flow
npm run jsx_to_aep <script_name>
npm run aep_to_mp4 <script_name>
```

`<script_name>` is the `.jsx` filename **without the extension**.

## What Each Script Does

### jsx_to_aep.sh — JSX → AEP
- Opens Adobe After Effects 2026 (falls back to 2025) via AppleScript
- Closes current project without saving
- Runs `$.evalFile()` on your `.jsx` script
- Saves the resulting AE project to `output/aep/<name>.aep`
- Closes AE

### aep_to_frame.sh — AEP → current-frame PNG
- Renders exactly one frame via `aerender -s <frame> -e <frame>`
- Uses the same render settings and output-module settings as the full video render
- Converts the temporary MOV into `output/<name>_current_frame.png`

### jsx_to_current_frame_and_mp4.sh / aep_to_current_frame_and_mp4.sh
- Orchestrate the new staged render flow
- Stage 1: render current frame PNG for the UI
- Stage 2: render full MP4
- When full video is ready, the temporary `*_current_frame.png` is deleted

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
- Deletes `output/<name>_current_frame.png` after the full video succeeds, so old frame previews do not pile up
- Pass `--backup` to also save timestamped copies

## Output Files

```
output/
├── aep/android_show_1.aep            ← AE project (overwritten each build)
├── android_show_1_current_frame.png  ← temporary UI preview while MP4 is still rendering
└── android_show_1_last.mp4           ← latest render (used by Web UI)
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
| Wrong frame rendered first | Wrong `--frame` value or UI didn't pass current frame | Re-run with the exact frame number; in the UI render path, current scrubber frame is sent automatically |
| aerender exits with comp-not-found error | Comp name ≠ script name | Match comp name in `.jsx` to filename |
| Black video / empty comp | Script errored silently | Open AE, run script manually via File → Scripts |
| ffmpeg missing | Not installed | `brew install ffmpeg` |

## Viewing Results

After render completes, open the Web UI:
```bash
npm run ui
# → http://localhost:3131
```

The UI auto-refreshes via SSE when `output/` changes. In the open-project render flow it also:
- asks the backend to render the current scrubber frame first
- shows the PNG immediately
- blocks seek/play controls while only the PNG exists
- swaps to the MP4 as soon as the full video finishes
