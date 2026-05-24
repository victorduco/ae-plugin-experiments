---
name: ae-overview
description: Overview of all tools, scripts, and workflows in this project. Read first when unsure what command to use or how the pieces fit together.
---

# Project Overview

AE animation experiments — write ExtendScript → render MP4. Also supports roundtripping existing `.aep` files.

## npm Scripts

| Command | Does |
|---|---|
| `npm run jsx_to_aep <name>` | JSX → AEP (build AE project from script) |
| `npm run aep_to_mp4 <name>` | AEP → MP4 (render with aerender + ffmpeg) |
| `npm run aep_to_jsx -- <file.aep>` | AEP → JSX (export existing project to script) |
| `npm run ui` | Start web UI at localhost:3131 |

## Two Workflows

**Write a new animation:**
```
src/scripts/<name>.jsx
  → npm run jsx_to_aep <name>   → output/aep/<name>.aep
  → npm run aep_to_mp4 <name>   → output/<name>_last.mp4
```
See [[ae-scripting]].

**Roundtrip an existing AEP:**
```
src/scripts/aep/<file>.aep
  → npm run aep_to_jsx -- src/scripts/aep/<file>.aep
  → output/jsx/<file>_generated.jsx
  → npm run jsx_to_aep <file>_generated
  → npm run aep_to_mp4 <file>_generated
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
    aep_to_mp4.sh   ← npm run aep_to_mp4
    ae_control.sh   ← shared: ae_close_without_saving()
    ui.sh           ← npm run ui
output/
  aep/              ← built .aep files
  jsx/              ← generated .jsx + .ffx files
  <name>_last.mp4   ← latest render
  <name>_ref.mp4    ← reference for comparison
```

## Skills

| Skill | Use when |
|---|---|
| [[ae-scripting]] | Writing or editing `.jsx` animation scripts |
| [[ae-render]] | Running the render pipeline, troubleshooting aerender |
| [[ae-aep-parser]] | Working with the exporter, fixing parse bugs, roundtrip |
| [[ae-extendscript-gotchas]] | Before writing any keyframe, shape, or easing code |
