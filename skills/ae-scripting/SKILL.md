---
name: ae-scripting
description: Writing, editing and creating After Effects ExtendScript (.jsx) scripts for this project. Use when asked to create, modify or understand AE scripts.
---

# AE Scripting Skill

Scripts live in `src/scripts/` (private git submodule `ae-animations-private`).

## Key Facts

- Language: **ExtendScript** (ES3-era JavaScript dialect for Adobe apps)
- Entry point: all scripts are plain `.jsx` files, no build step
- Each script creates one AE composition whose **name matches the filename** (e.g. `android_show_1.jsx` → comp `"android_show_1"`)
- The runner picks up the comp by that exact name — keep them in sync

## Script Structure

Every script follows this pattern:

```jsx
(function() {
    var compName = "my_script_name";
    var comp = app.project.items.addComp(compName, 1920, 1080, 1, 3, 60);

    // 1. Background solid
    var bg = comp.layers.addSolid([0.1, 0.1, 0.1], "BG", 1920, 1080, 1);

    // 2. Text layer with expression
    var textLayer = comp.layers.addText("hello");
    var textDoc = textLayer.property("Source Text").value;
    textDoc.fontSize = 300;
    textDoc.fillColor = [1, 1, 1];
    textDoc.font = "Arial-BoldMT";
    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
    textLayer.property("Source Text").setValue(textDoc);
    textLayer.property("Source Text").expression = 'Math.round(time / thisComp.duration * 100) + "%"';

    // 3. Shape layer (vectors)
    var shapeLayer = comp.layers.addShape();
    var contents = shapeLayer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    // ... add strokes, fills, paths

})();
```

## Core AE DOM API Reference

### Project & Comps
```jsx
app.project.items.addComp(name, width, height, pixelAspect, duration, fps)
app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)
app.project.save(new File("/path/to/project.aep"))
```

### Layers
```jsx
comp.layers.addSolid([r,g,b], "name", width, height, pixelAspect)
comp.layers.addText("initial text")
comp.layers.addShape()
comp.layers.addNull()
```

### Text
```jsx
var prop = textLayer.property("Source Text");
var doc = prop.value;          // TextDocument object
doc.fontSize = 300;
doc.font = "Arial-BoldMT";    // PostScript font name
doc.fillColor = [1, 1, 1];    // [R, G, B] 0..1
doc.justification = ParagraphJustification.CENTER_JUSTIFY;
prop.setValue(doc);
prop.expression = '...';       // JS expression string, runs at each frame
```

### Transform
```jsx
layer.property("Transform").property("Position").setValue([x, y]);
layer.property("Transform").property("Scale").setValue([100, 100]);
layer.property("Transform").property("Opacity").setValue(100);
layer.property("Transform").property("Rotation").setValue(0);
```

### Shape Layers
```jsx
var contents = shapeLayer.property("Contents");
var grp = contents.addProperty("ADBE Vector Group");
var shape = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
var strokeProp = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
strokeProp.property("Color").setValue([1, 1, 1]);
strokeProp.property("Stroke Width").setValue(8);
```

### Expressions
Expressions are JS strings evaluated per frame. Useful globals:
```js
time          // current time in seconds
thisComp.duration
thisComp.width
thisComp.height
thisLayer
value         // current property value (for override expressions)
```

## How to View Your Script

Run the web UI to preview rendered output:

```bash
npm run ui
# opens http://localhost:3131 automatically
```

Web UI features:
- **Split / Overlay** modes to compare `_last.mp4` vs `_ref.mp4`
- Playback speed: 0.1x → 1x
- Auto-refresh via SSE when output folder changes

To render and then view:
```bash
npm run render android_show_1
# then check the browser — UI auto-refreshes
```

## Sub-comps

Create a sub-comp first, then add it to the parent with `comp.layers.add()`:

```jsx
var logoComp = app.project.items.addComp("logo", 200, 200, 1, tFall, 60);
// ... build shapes inside logoComp ...

var mainComp = app.project.items.addComp("android_show_1", 1920, 1080, 1, 1.4, 60);
var logoLayer = mainComp.layers.add(logoComp);
logoLayer.outPoint = tFall;
logoLayer.property("Transform").property("Position").setValueAtTime(0, [960, 540]);
```

Pattern: shape/style lives in sub-comp, animation (position, in/outPoint) lives in parent.

## Gotchas

See [[ae-extendscript-gotchas]] for the full list — **update it whenever you hit a new API trap** so it doesn't happen again. Most critical ones:
- Add all sub-properties before fetching refs to animate (refs invalidate after `addProperty`)
- `setTemporalEaseAtKey` always takes `[ease]` — exactly 1 element, even for 2D properties
- `Roundness` on rect paths is not keyframeable — use `setValue` only
- `addComp` width/height must be integers — always `Math.round()` calculated dimensions
- Test scripts with the debug wrapper before running the full render pipeline:
  ```bash
  osascript -e 'tell application "Adobe After Effects 2026" to DoScriptFile "/tmp/ae_debug_runner.jsx"'
  sleep 8 && cat /tmp/ae_debug_out.txt
  # expect: OK
  ```

## Tips

- **Font names:** use PostScript names (`Arial-BoldMT`, `Helvetica-Bold`), not display names
- **Colors:** always `[R, G, B]` in 0..1 range
- **Comp name = file name** (without `.jsx`) — the runner depends on this
- `$.evalFile(new File("/abs/path.jsx"))` is how the runner loads your script into AE
- Avoid `alert()` — it blocks AE; use `$.writeln()` for debug (goes to ExtendScript console)
