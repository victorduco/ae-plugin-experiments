---
name: ae-overview
description: Overview of all tools, scripts, and workflows in this project. Read first when unsure what command to use or how the pieces fit together.
---

# Project Overview

AE animation experiments — write ExtendScript → render current frame for UI first → render MP4. Also supports roundtripping existing `.aep` files.

## npm Scripts

| Command | Does |
|---|---|
| `npm run jsx_to_aep <name>` | JSX → AEP (build AE project from script) |
| `npm run jsx_to_current_frame_and_mp4` | JSX → AEP → current-frame PNG → MP4 (recommended UI-first scripting flow) |
| `npm run aep_to_frame` | AEP → one PNG frame with the same render settings as video |
| `npm run aep_to_current_frame_and_mp4` | AEP → current-frame PNG → MP4 |
| `npm run aep_to_mp4 <name>` | AEP → MP4 (render with aerender + ffmpeg) |
| `npm run aep_to_jsx -- <file.aep>` | AEP → JSX (export existing project to script) |
| `npm run ui` | Start web UI at localhost:3131 |

For the frame-first scripts, CLI usage needs an explicit `--frame <n>`. In the open-project Web UI flow, the UI passes the current frame automatically.

## Two Workflows

**Write a new animation for UI review (recommended):**
```
src/scripts/<name>.jsx
  → npm run jsx_to_current_frame_and_mp4   ← pass `--frame <n>` in CLI usage
  → output/<name>_current_frame.png   ← temporary, shown in UI first
  → output/<name>_last.mp4
```
See [[ae-scripting]].

**Video-only render / manual split steps:**
```
src/scripts/<name>.jsx
  → npm run jsx_to_aep <name>   → output/aep/<name>.aep
  → npm run aep_to_mp4 <name>   → output/<name>_last.mp4
```
See [[ae-builder-and-render]].

**Roundtrip an existing AEP:**
```
src/scripts/aep/<file>.aep
  → npm run aep_to_jsx -- src/scripts/aep/<file>.aep
  → output/jsx/<file>_generated.jsx
  → npm run jsx_to_current_frame_and_mp4   ← pass `--frame <n>` in CLI usage
  → output/<file>_generated_current_frame.png
  → output/<file>_generated_last.mp4
```
See [[ae-aep-parser]].

## File Layout

```
src/
  scripts/          ← hand-written .jsx animations
  scripts/aep/      ← source .aep files for roundtrip
  aep_exporter/     ← modular AEP→JSX exporter
    aep_to_jsx.sh   ← npm run aep_to_jsx
  utils/
    jsx_to_aep.sh   ← npm run jsx_to_aep
    jsx_to_current_frame_and_mp4.sh ← recommended JSX → frame-first render
    aep_to_frame.sh ← single-frame renderer
    aep_to_current_frame_and_mp4.sh ← open/project AEP → frame-first render
    aep_to_mp4.sh   ← npm run aep_to_mp4
    render_common.sh ← shared render settings for frame + video
    ae_control.sh   ← shared: ae_close_without_saving()
    ui.sh           ← npm run ui
output/
  aep/              ← built .aep files
  jsx/              ← generated .jsx + .ffx files
  <name>_current_frame.png ← temporary UI preview, removed after MP4 is ready
  <name>_last.mp4   ← latest render
  <name>_ref.mp4    ← reference for comparison
```

## Skills

| Skill | Use when |
|---|---|
| [[ae-scripting]] | Writing or editing `.jsx` animation scripts |
| [[ae-builder-and-render]] | Running the render pipeline, especially frame-first UI renders |
| [[ae-aep-parser]] | Working with the exporter, fixing parse bugs, roundtrip |
| [[ae-extendscript-gotchas]] | Before writing any keyframe, shape, or easing code |
