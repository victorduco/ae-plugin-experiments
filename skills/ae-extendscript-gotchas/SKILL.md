---
name: ae-extendscript-gotchas
description: Known AE ExtendScript API traps and bugs found in this project. Read before writing any keyframe, shape, or easing code to avoid silent failures.
---

# AE ExtendScript Gotchas

## 1. Property refs invalidate after `addProperty`

After any `addProperty(...)` call on a `Contents` group, **all previously saved references to sibling properties become invalid** — accessing them throws `ReferenceError: Object is invalid`.

**Rule: add everything first, fetch refs after.**

```jsx
// WRONG
var rectPath = grpContents.addProperty("ADBE Vector Shape - Rect");
grpContents.addProperty("ADBE Vector Graphic - Fill"); // kills rectPath ref
rectPath.property("Size").setValue([200, 200]);         // ReferenceError

// CORRECT
grpContents.addProperty("ADBE Vector Shape - Rect");
grpContents.addProperty("ADBE Vector Graphic - Fill");
var rectPath = grpContents.property("ADBE Vector Shape - Rect"); // fresh ref
var fill     = grpContents.property("ADBE Vector Graphic - Fill");
rectPath.property("Size").setValue([200, 200]);                   // OK
```

This applies to any nesting level: layer contents, group contents, effect properties.

---

## 2. `setTemporalEaseAtKey` — количество элементов зависит от версии AE

Количество элементов в массиве ease **зависит от версии AE и типа свойства**:

- AE 2025 и ниже: **1 элемент** для любого свойства
- AE 2026: **3 элемента** для Scale (2D), **1 элемент** для Rotation (1D), Position (2D)

Ошибка "Value array does not have N elements" говорит сколько нужно.

```jsx
// Rotation (1D) — всегда 1 элемент
rotProp.setTemporalEaseAtKey(1, [eIn], [eOut]);

// Scale (2D) в AE 2026 — 3 элемента
scaleProp.setTemporalEaseAtKey(1, [eIn, eIn, eIn], [eOut, eOut, eOut]);

// Position (2D) — 1 элемент (проверено в AE 2026)
posProp.setTemporalEaseAtKey(1, [eIn], [eOut]);
```

Signature:
```jsx
property.setTemporalEaseAtKey(keyIndex, easeIn_array, easeOut_array);
// keyIndex is 1-based
```

`KeyframeEase(speed, influence)` — speed 0 = slow, 100 = fast; influence **0.1–100** (% of segment, minimum 0.1 — passing 0 throws range error):
```jsx
var easeIn  = new KeyframeEase(0,   80); // slow start
var easeOut = new KeyframeEase(100, 80); // fast arrival
```

---

## 3. `Roundness` on ADBE Vector Shape - Rect is not keyframeable

`setValueAtTime` throws `ReferenceError: Object is invalid` on the Roundness property of a rect path. Use `setValue` for a static value only.

```jsx
// WRONG
rectPath.property("Roundness").setValueAtTime(0,   12); // crashes
rectPath.property("Roundness").setValueAtTime(1.4, 28);

// CORRECT — static only
rectPath.property("Roundness").setValue(20);
```

To animate corner radius, use a different approach: expression on roundness or switch to `ADBE Vector Shape - Group` with a custom path.

---

## 4. mktemp can't create .jsx files on macOS

`mktemp /tmp/foo_XXXX.jsx` fails with "File exists" due to macOS extension handling. Use a fixed path instead:

```bash
# WRONG
TMP_JSX="$(mktemp /tmp/ae_runner_XXXX.jsx)"

# CORRECT
TMP_JSX="/tmp/ae_runner_$$.jsx"   # $$ = current PID, unique enough
# or just use a fixed name
TMP_JSX="/tmp/ae_runner.jsx"
```

---

## 5. Script errors are silent — AE shows a dialog, pipeline uses stale .aep

If the JSX throws, AE shows an error **dialog** (not logged anywhere). AppleScript returns exit code `1` instead of `0`. The pipeline doesn't stop — it falls through to aerender using the **stale `.aep`** from the previous successful build. Result: render "succeeds" but outputs old content.

**Watch for `1` on the build stage output line** — if Stage 1 prints `1`, the jsx errored and the render is invalid.

If the `.aep` doesn't exist yet, aerender reports:
```
Unable to call "openFast" because of parameter 1. Path is not valid.
```

**Always test scripts with a debug wrapper before running the full render pipeline:**

```jsx
// /tmp/ae_debug_runner.jsx
(function () {
    var logFile = new File("/tmp/ae_debug_out.txt");
    logFile.open("w");
    try {
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        $.evalFile("/abs/path/to/script.jsx");
        logFile.writeln("OK");
    } catch(e) {
        logFile.writeln("ERROR: " + e.toString() + " | line: " + e.line);
    }
    logFile.close();
})();
```

Run it:
```bash
osascript -e 'tell application "Adobe After Effects 2026" to DoScriptFile "/tmp/ae_debug_runner.jsx"'
sleep 8
cat /tmp/ae_debug_out.txt
```

---

## 6. osascript return value is the exit code, not the script result

```bash
osascript -e "tell application \"Adobe After Effects 2026\" to DoScriptFile \"$f\""
# prints "0" on success — that's the exit code, not the JSX return value
# use the file-based logging pattern (gotcha #5) to get actual output
```

---

## 7. Keyframe index is 1-based

All keyframe APIs use 1-based indices:
```jsx
prop.setValueAtTime(0,   val1); // creates key #1
prop.setValueAtTime(1.0, val2); // creates key #2
prop.setValueAtTime(1.4, val3); // creates key #3

prop.setTemporalEaseAtKey(1, ...); // key #1
prop.setTemporalEaseAtKey(2, ...); // key #2
```

---

## 8. `addComp` duration must be frame-exact

`app.project.items.addComp(name, w, h, par, duration, fps)` — if duration in seconds doesn't land on an exact frame boundary, AE rounds to the nearest frame.

At 60fps, 1 frame = 0.01667s. Use frame counts to be exact:
```jsx
var fps = 60;
var frames = 84;                     // exact frame count you want
var duration = frames / fps;         // 1.4s = exactly 84 frames at 60fps
var comp = app.project.items.addComp("name", 1920, 1080, 1, duration, fps);
```

---

## 9. `addComp` width and height must be integers

Passing a float throws immediately:
```
After Effects error: Unable to call "addComp" because of parameter 3. 928.8 is not an integer.
```

Always `Math.round()` any calculated dimensions:
```jsx
var margin  = H * 0.07;
var phoneH  = Math.round(H - margin * 2);  // not just H - margin * 2
var phoneW  = Math.round(phoneH * 9 / 19.5);
var comp = app.project.items.addComp("name", W, phoneH, 1, dur, fps);
```

This applies to all four numeric parameters: width, height — they must be whole integers.

---

## 10. Sub-comp duration must cover only what the layer needs

When creating a sub-comp that will be used as a layer with `inPoint`/`outPoint` in the parent, size the sub-comp duration to match only its own content — not the full parent duration:

```jsx
// logo sub-comp: only plays until tFall
var logoComp = app.project.items.addComp("logo", side, side, 1, tFall, 60);

// phone sub-comp: plays from tFall to end
var phoneComp = app.project.items.addComp("phone-frame", phoneW, phoneH, 1, 1.4 - tFall, 60);

// parent controls when each appears/disappears via inPoint/outPoint
logoLayer.outPoint = tFall;
phoneLayer.inPoint  = tFall;
```

---

## 11. SVG imports as raster footage — use PNG instead

AE imports SVG via `importFile` but renders it as a flat rasterized bitmap — the shape/transparency info from the SVG is lost, result is a solid square. **Convert to PNG first:**

```bash
# rsvg-convert (brew install librsvg) — preserves alpha
rsvg-convert -w 400 -h 400 icon.svg -o icon.png
```

Use 2× the display size for sharpness (e.g. display at 200px → export PNG at 400px, then scale to 50% in AE).

Then import the PNG normally:

```jsx
var pngItem = app.project.importFile(new ImportOptions(new File("/path/icon.png")));
var layer = comp.layers.add(pngItem);
// PNG is 400×400, display at 100px = 25%
layer.property("Transform").property("Scale").setValue([25, 25]);
layer.property("Transform").property("Position").setValue([compW / 2, compH / 2]);
```

## 12. Effects: adding by display name, getting matchNames, animating properties

Add effects via `layer.Effects.addProperty("matchName")`. After adding, re-fetch property refs (same invalidation rule as #1):

```jsx
// Add all effects first
var gaussBlur = eff.addProperty("ADBE Gaussian Blur 2");
var dirBlur   = eff.addProperty("ADBE Motion Blur");
var bc        = eff.addProperty("ADBE Brightness & Contrast");

// Then animate — fetch property by matchName
gaussBlur.property("ADBE Gaussian Blur 2-0001").setValueAtTime(0,     0);
gaussBlur.property("ADBE Gaussian Blur 2-0001").setValueAtTime(tEnd, 40);
```

**Known matchNames:**

| Effect | matchName | Key properties |
|---|---|---|
| Gaussian Blur | `ADBE Gaussian Blur 2` | `ADBE Gaussian Blur 2-0001` (Blurriness) |
| Directional Blur | `ADBE Motion Blur` | `ADBE Motion Blur-0001` (Direction°: **0=vertical**, 90=horizontal), `ADBE Motion Blur-0002` (Blur Length) |
| Brightness & Contrast | `ADBE Brightness & Contrast` | `ADBE Brightness & Contrast-0001` (Brightness, range −100..100), `ADBE Brightness & Contrast-0002` (Contrast) |
| Fast Box Blur | `ADBE Box Blur2` | — |

**Brightness max is 100**, not unlimited — `setValueAtTime(..., 120)` throws range error.

---

## 13. Motion blur is a layer toggle, not an effect

There's no "Motion Blur" effect to add via `addProperty`. It's a layer-level flag:

```jsx
layer.motionBlur = true;
comp.motionBlurAdaptiveSampleLimit = 16; // optional quality setting
// Also make sure aerender uses -RStemplate "Best Settings" which enables MB
```

For directional/velocity blur as an **animatable effect**, use `ADBE Motion Blur` (Directional Blur) instead.

---

### SVG import via `importFile` (kept for reference — but use PNG above)

AE 2022+ can import SVG as footage via ExtendScript:

```jsx
var svgFile = new File("/abs/path/to/icon.svg");
var svgItem = app.project.importFile(new ImportOptions(svgFile));
var svgLayer = comp.layers.add(svgItem);

// Scale to fit — SVG renders at its native viewBox size (e.g. 65×65)
// comp is 200×200, so scale = (200/65)*100 = 307.7%
var svgScale = (compSize / svgNativeSize) * 100;
svgLayer.property("Transform").property("Scale").setValue([svgScale, svgScale]);
svgLayer.property("Transform").property("Position").setValue([compW / 2, compH / 2]);
```

Wrong constructor (`ImportOptions(file)` without `new`) throws:
```
Unable to call "importFile" because of parameter 1. undefined is not of the correct type.
```
Always use `new ImportOptions(file)`.

---

## Property matchNames (rect shape)

Useful when `property("Display Name")` fails — use matchName instead:

| Display Name | matchName |
|---|---|
| Size | `ADBE Vector Rect Size` |
| Position | `ADBE Vector Rect Position` |
| Roundness | `ADBE Vector Rect Roundness` |
| Rect path | `ADBE Vector Shape - Rect` |
| Fill | `ADBE Vector Graphic - Fill` |
| Stroke | `ADBE Vector Graphic - Stroke` |
| Group | `ADBE Vector Group` |

Fetch by matchName:
```jsx
var rectPath = grpContents.property("ADBE Vector Shape - Rect");
```
