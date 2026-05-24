---
name: ae-aep-parser
description: Export AEP to JSX (aep_to_jsx). Use when parsing an existing .aep file into a reproducible JSX script, working with the aep_exporter, or fixing parser bugs. Command: npm run aep_to_jsx -- <file.aep>
---

# AEP Parser Skill

## Commands

```bash
# AEP → JSX only
npm run aep_to_jsx -- src/scripts/aep/file.aep

# Full roundtrip: AEP → JSX → AEP → MP4
npm run aep_to_jsx -- src/scripts/aep/file.aep
npm run jsx_to_aep <name>_generated
npm run aep_to_mp4 <name>_generated
```

Output JSX lands in `output/jsx/<name>_generated.jsx`.

## How It Works

```
src/scripts/aep/file.aep
        ↓  aep_to_jsx.sh
        ↓  opens AEP in AE, runs aep_exporter_bundle.jsx
output/jsx/file_generated.jsx
        ↓  jsx_to_aep.sh
        ↓  evalFile in AE, saves project
output/aep/file.aep
        ↓  aep_to_mp4.sh (aerender + ffmpeg)
output/file_last.mp4
```

## Exporter Source

`src/aep_exporter/` — modular ExtendScript exporter:

| File | Responsibility |
|---|---|
| `build.sh` | concatenates modules → `dist/aep_exporter_bundle.jsx` |
| `aep_to_jsx.sh` | builds bundle, opens AEP in AE, evals bundle, force-quits AE |
| `main.jsx` | entry point IIFE; output path override via `_exporterOutputPath` |
| `modules/core.jsx` | output helpers (`w`, `q`, `fmtVal`), topo sort |
| `modules/footage.jsx` | footage import emission |
| `modules/shapes.jsx` | shape layer Contents emission (groups, ellipse, rect, repeater, fill, stroke) |
| `modules/transform.jsx` | layer Transform emission |
| `modules/effects.jsx` | effects emission; CUSTOM_VALUE properties saved as `.ffx` presets |
| `modules/properties.jsx` | generic property/keyframe emission |
| `modules/layers.jsx` | per-layer dispatch |
| `modules/comps.jsx` | per-comp emission |

## Known Shape Parser Bug (fixed)

Named property access (`property("ADBE Vector Filter - Repeater")`) always returns the **first** match — breaks when a group has multiple Repeaters. Fixed in `shapes.jsx`: use index-based access `property(i+1)` for all non-Group shape items.

## Debugging a Parse Problem

1. Dump the raw AEP structure for a specific layer with a standalone JSX:
```jsx
// run via osascript DoScriptFile
(function(){
    var out = [];
    function dump(prop, d) {
        var pad = ""; for (var i=0;i<d;i++) pad+="  ";
        if (prop.propertyType === PropertyType.PROPERTY) {
            var v; try { v = prop.valueAtTime(0,false); } catch(e) { v="ERR"; }
            out.push(pad + prop.matchName + " = " + v);
        } else {
            out.push(pad + prop.matchName + "/ n=" + prop.numProperties);
            for (var i=1;i<=prop.numProperties;i++) try{dump(prop.property(i),d+1);}catch(e){}
        }
    }
    var comp = ...; // find your comp
    var layer = comp.layer("dot");
    dump(layer.property("Contents"), 0);
    var f = new File("/tmp/dump.txt"); f.open("w"); f.write(out.join("\n")); f.close();
})();
```

2. Compare dump vs generated JSX — check values match.

3. Edit the relevant module in `src/aep_exporter/modules/`, re-run `npm run aep_to_jsx`.

## Effects with CUSTOM_VALUE

Some effect properties are opaque binary blobs inaccessible via scripting. The exporter saves `.ffx` preset files next to the output JSX and emits `applyPreset(new File("...ffx"))` in the generated JSX instead of trying to set individual values. These `.ffx` files must be present when running `jsx_to_aep`.
