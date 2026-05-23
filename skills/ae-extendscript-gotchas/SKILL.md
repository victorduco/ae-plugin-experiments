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

## 2. `setTemporalEaseAtKey` always takes exactly 1 ease per array

Regardless of the property's dimensions (1D, 2D, 3D), the ease arrays must have **exactly 1 element**.

```jsx
// WRONG — AE says "Value array does not have 1 elements"
posProp.setTemporalEaseAtKey(1, [eIn, eIn], [eOut, eOut]); // Position is 2D

// CORRECT
posProp.setTemporalEaseAtKey(1, [eIn], [eOut]);
```

Signature:
```jsx
property.setTemporalEaseAtKey(keyIndex, easeIn_array, easeOut_array);
// keyIndex is 1-based
// each array = [KeyframeEase] — always length 1
```

`KeyframeEase(speed, influence)` — speed 0 = slow, 100 = fast; influence 0–100 (% of segment):
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

## 5. Script errors are silent — AE saves no .aep and aerender fails

If the JSX throws, `app.project.save()` never runs, the .aep file doesn't exist, and aerender reports:
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
