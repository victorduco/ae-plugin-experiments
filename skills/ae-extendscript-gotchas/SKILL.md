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

## 2. `setTemporalEaseAtKey` — количество элементов зависит от версии AE и свойства

Количество элементов в массиве ease **зависит от версии AE и типа свойства**.
Ошибка `"Value array does not have N elements"` говорит сколько нужно — читай N из текста ошибки.

Проверено в AE 2026:
- Rotation (1D) → **1 элемент**
- Position (2D) → **1 элемент**
- Scale (2D) → **3 элемента**

```jsx
// Rotation (1D) — 1 элемент
rotProp.setTemporalEaseAtKey(1, [eIn], [eOut]);

// Position (2D) — 1 элемент
posProp.setTemporalEaseAtKey(1, [eIn], [eOut]);

// Scale (2D) в AE 2026 — 3 элемента
scaleProp.setTemporalEaseAtKey(1, [eIn, eIn, eIn], [eOut, eOut, eOut]);
```

`KeyframeEase(speed, influence)`:
- speed: 0 = медленно, 100 = быстро (можно выше 100 для overshoot-эффекта, но осторожно)
- influence: **минимум 0.1**, не 0 — `"Value 0 out of range 0.1 to 100"` иначе

```jsx
var eIn  = new KeyframeEase(0,   99);  // медленный старт
var eOut = new KeyframeEase(400, 80);  // быстрый финал
// WRONG: new KeyframeEase(400, 0) — бросает range error
// CORRECT: new KeyframeEase(400, 0.1)
```

**Overshoot**: высокий speed (>100) при малом influence создаёт кривую с перелётом за пределы значений (отрицательный scale и т.п.). Держи influence ≥ 80 при высоком speed.

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
| Glow | добавлять через `"Glow"` (display name), внутри `ADBE Glo2` | `ADBE Glo2-0002` (Threshold %), `ADBE Glo2-0003` (Radius), `ADBE Glo2-0004` (Intensity), `ADBE Glo2-0006` (Glow Operation) |

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

## 14. Glow effect — добавлять через display name "Glow", не matchName

`eff.addProperty("ADBE Glow")` бросает `"Can not add a property with name"`. Используй display name:

```jsx
var glow = eff.addProperty("Glow"); // display name работает
// matchName внутри: ADBE Glo2
glow.property("ADBE Glo2-0002").setValueAtTime(0,   19.6); // Threshold %
glow.property("ADBE Glo2-0002").setValueAtTime(t,  100);
glow.property("ADBE Glo2-0003").setValueAtTime(0,   0);    // Radius
glow.property("ADBE Glo2-0003").setValueAtTime(t,  80);
glow.property("ADBE Glo2-0004").setValueAtTime(0,   0);    // Intensity
glow.property("ADBE Glo2-0004").setValueAtTime(t,   3);
glow.property("ADBE Glo2-0006").setValue(5);               // Glow Operation: Multiply
```

**Glow Operation (`ADBE Glo2-0006`) — enum значения:**

| Значение | Режим |
|----------|-------|
| 1 | None |
| 2 | Above |
| 3 | Below |
| 4 | Add |
| 5 | Multiply |
| 6 | Screen |
| 7–9 | другие режимы |

---

## 15. Track matte — matte слой должен быть ВЫШЕ целевого слоя

В AE track matte: matte слой должен быть **прямо над** целевым (индекс на 1 меньше). Используй `moveBefore`, не `moveAfter`. AE автоматически скрывает matte слой визуально.

```jsx
var matteLayer = comp.layers.addShape();
// ... настрой форму ...
matteLayer.moveBefore(targetLayer);          // matte над target
targetLayer.trackMatteType = TrackMatteType.ALPHA;
```

Маска на самом слое (`layer.Masks`) двигается вместе со слоем — не подходит для статичного обрезания в comp-пространстве. Для статичной маски используй track matte.

---

## 16. Mask на слое — координаты относительно anchor, не comp

`layer.Masks` задаются в координатах слоя, центр = anchor point слоя. Если слой двигается — маска двигается вместе с ним. Это часто не то что нужно.

```jsx
// WRONG для статичной маски в comp-пространстве:
var m = logoLayer.Masks.addProperty("Mask");
// маска будет двигаться вместе с logoLayer

// CORRECT — используй track matte (см. gotcha #15)
```

---

## 17. Gradient Fill — `setValue` на цветовых стопах крашит AE

`gradColors.setValue({stops: ...})` роняет AE без диалога и без лога. Gradient Fill через ExtendScript практически невозможно настроить стандартным способом.

**Не используй `ADBE Vector Graphic - Gradient Fill` с анимацией стопов.** Для эффекта градиентного fade используй несколько полупрозрачных rect слоёв:

```jsx
// WRONG — крашит AE:
var gradFill = gradc.property("ADBE Vector Graphic - Gradient Fill");
var gradColors = gradFill.property("ADBE Vector Grad Colors");
gradColors.setValue({ stops: [[0, [0,0,0,1]], [1, [0,0,0,0]]] }); // CRASH

// CORRECT — симулируй градиент через N полупрозрачных слоёв:
var steps = 10;
for (var s = 0; s < steps; s++) {
    var fade = comp.layers.addShape();
    // ... rect size = fullW x (gradH / steps) ...
    var opacity = 1 - (s + 0.5) / steps;
    fade.property("Transform").property("Opacity").setValue(opacity * 100);
}
```

---

## 18. `moveAfter` / `moveBefore` внутри цикла — осторожно

Вызов `layer.moveAfter(other)` внутри цикла `for` может крашить AE — после каждого вызова индексы слоёв пересчитываются, и следующая итерация работает с невалидными ссылками. Если нужно упорядочить слои из цикла — делай это после завершения цикла, или не используй `moveAfter` вообще (добавляй слои в нужном порядке изначально).

```jsx
// ОПАСНО:
for (var s = 0; s < steps; s++) {
    var layer = comp.layers.addShape();
    layer.moveAfter(refLayer); // может крашить AE
}

// БЕЗОПАСНО — просто добавляй в нужном порядке без moveAfter:
for (var s = 0; s < steps; s++) {
    var layer = comp.layers.addShape();
    // порядок определяется последовательностью addShape()
}
```

---

## 19. Variable fonts (Google Sans Flex) — устанавливать через `font` строку, НЕ через аниматор

**Шрифт:** `GoogleSansFlex-Regular` (файл: `~/Library/Fonts/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf`)

### Как задать оси — через `textDoc.font`

AE кодирует активные оси прямо в строке `font` объекта `TextDocument`. Устанавливай нужные оси так:

```jsx
var sourceProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
var td = sourceProp.value;
td.font = "GoogleSansFlex_400.000wght_100.000ROND";
sourceProp.setValue(td);
```

**Формат строки:**
```
GoogleSansFlex_{value}.000{axisTag}_{value}.000{axisTag}...
```
- `{value}` — числовое значение оси
- `.000` — три десятичных знака (всегда нули для целых)
- `{axisTag}` — 4-буквенный тег оси

**Оси Google Sans Flex:**

| Тег | Название | Пример |
|---|---|---|
| `wght` | Weight | `400.000wght` |
| `ROND` | Roundness | `100.000ROND` |
| `opsz` | Optical Size | `46.000opsz` |
| `GRAD` | Grade | `0.000GRAD` |
| `slnt` | Slant | `-10.000slnt` |
| `wdth` | Width | `100.000wdth` |

Включай только нужные оси — остальные примут дефолтные значения шрифта. Без осей: `font = "GoogleSansFlex-Regular"`.

**`fontStyle`** обновляется автоматически вместе с `font` и отражает текущие значения осей в читаемом виде.

> **Не используй Text Animator для установки VF Axis** — добавить оси в аниматор через скрипт невозможно (`addProperty` бросает ошибку для всех `ADBE Text VF Axis N`). Только через UI.

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
