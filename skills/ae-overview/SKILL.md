---
name: ae-overview
description: Overview of all tools, scripts, and workflows in this project. Read first when unsure what command to use or how the pieces fit together.
---

# Project Overview

AE animation experiments — write ExtendScript → render MP4. Also supports roundtripping existing `.aep` files.

## npm Scripts

| Command | Does |
|---|---|
| `npm run render <name>` | JSX → AEP → MP4 (hand-written scripts) |
| `npm run parse_aep -- <file.aep>` | AEP → JSX (export existing project) |
| `npm run build_aep -- <file.aep>` | AEP → JSX → AEP → MP4 (full roundtrip) |
| `npm run ui` | Start web UI at localhost:3131 |

## Two Workflows

**Write a new animation:**
```
src/scripts/<name>.jsx  →  npm run render <name>  →  output/<name>_last.mp4
```
Script name = comp name inside the JSX. See [[ae-scripting]].

**Roundtrip an existing AEP:**
```
src/scripts/aep/<file>.aep  →  npm run build_aep  →  output/<file>_last.mp4
```
Generated JSX lands in `src/scripts/<file>_generated.jsx`. See [[ae-aep-parser]].

## File Layout

```
src/
  scripts/          ← hand-written .jsx animations + generated JSX (gitignored)
  scripts/aep/      ← source .aep files for roundtrip
  aep_exporter/     ← modular AEP→JSX exporter (parse_aep / build_aep)
  utils/
    render.sh       ← npm run render
    build_aep.sh    ← npm run build_aep
    ae_control.sh   ← shared: ae_close_without_saving()
    render-open.sh  ← render an already-built .aep (no JSX step)
    ui.sh           ← npm run ui
output/             ← .aep, _last.mp4, _ref.mp4 (all gitignored)
```

## Skills

| Skill | Use when |
|---|---|
| [[ae-scripting]] | Writing or editing `.jsx` animation scripts |
| [[ae-render]] | Running the render pipeline, troubleshooting aerender |
| [[ae-aep-parser]] | Working with the exporter, fixing parse bugs, roundtrip |
| [[ae-extendscript-gotchas]] | Before writing any keyframe, shape, or easing code |
