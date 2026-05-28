(function () {

    app.beginSuppressDialogs();

    var W   = 3456;
    var H   = 1938;
    var fps = 60;
    var dur = 9;

    // timecodes in frames / fps
    var tMessengerOut = 82  / fps; // 1s 22f
    var tBubbleOut    = 256 / fps; // 4s 16f
    var tLifeIn       = 256 / fps; // 4s 16f
    var tLifeOut      = 401 / fps; // 6s 41f
    var tLogoIn       = 401 / fps; // 6s 41f

    // === COMP: messenger ===
    var mW = 2975;
    var mH = H;
    var compMessenger = app.project.items.addComp("messenger", mW, mH, 1, tMessengerOut, fps);

    // phone PNG — 100% ширины компа, по центру
    var phonePng = app.project.importFile(new ImportOptions(new File("/Users/vitya/Repos/ae-vibecode/projects/assets/phone-alpha.png")));
    var phoneLayer = compMessenger.layers.add(phonePng);
    phoneLayer.name = "phone";
    phoneLayer.inPoint  = 0;
    phoneLayer.outPoint = tMessengerOut;
    var phoneNativeW = 650;
    var phoneNativeH = 1361;
    var phoneScale = (mW / phoneNativeW) * 100;
    phoneLayer.property("Transform").property("ADBE Anchor Point").setValue([phoneNativeW / 2, phoneNativeH / 2, 0]);
    phoneLayer.property("Transform").property("ADBE Position").setValue([mW / 2, mH / 2 - 720, 0]);
    phoneLayer.property("Transform").property("ADBE Scale").setValue([phoneScale, phoneScale, phoneScale]);

    // black overlay above phone
    var phoneOverlay = compMessenger.layers.addSolid([0, 0, 0], "overlay", mW, mH, 1);
    phoneOverlay.inPoint  = 0;
    phoneOverlay.outPoint = tMessengerOut;
    phoneOverlay.property("Transform").property("ADBE Opacity").setValue(50);
    phoneOverlay.moveBefore(phoneLayer);

    // === COMP: bubble ===
    var bW = 790 * 4;  // 3160
    var bH = 190 * 4;  // 760
    var compBubble1 = app.project.items.addComp("bubble", bW, bH, 1, tBubbleOut, fps);

    // pill background
    var bShape = compBubble1.layers.addShape();
    bShape.name = "bg";
    bShape.inPoint  = 0;
    bShape.outPoint = tBubbleOut;
    bShape.property("Transform").property("ADBE Position").setValue([bW / 2, bH / 2, 0]);
    var _bc = bShape.property("Contents");
    _bc.addProperty("ADBE Vector Group");
    _bc.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    _bc.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    var bRect = _bc.property(1).property("ADBE Vectors Group").property(1);
    var bFill = _bc.property(1).property("ADBE Vectors Group").property(2);
    var tChange  = 75 / fps; // 1s15f
    var bShrink  = 150 * 4; // 150px on screen → comp space (4x)
    bRect.property("ADBE Vector Rect Size").setValueAtTime(0,       [bW,           bH]);
    bRect.property("ADBE Vector Rect Size").setValueAtTime(tChange, [bW - bShrink, bH]);
    bRect.property("ADBE Vector Rect Position").setValue([0, 0]);
    bRect.property("ADBE Vector Rect Roundness").setValue(bH / 2); // full pill
    bFill.property("ADBE Vector Fill Color").setValue([0, 0, 0, 1]);
    bFill.property("ADBE Vector Fill Opacity").setValue(18);


    // glow bg — solid with Gradient Ramp + Gaussian Blur, clipped by pill track matte
    // Step 1: the solid (added first so matte layer can moveBefore it after)
    var glowBgLayer = compBubble1.layers.addSolid([1, 1, 1], "glow bg", bW, bH, 1);
    glowBgLayer.inPoint  = 0;
    glowBgLayer.outPoint = tBubbleOut;
    glowBgLayer.property("Transform").property("ADBE Position").setValue([bW / 2, bH / 2, 0]);
    glowBgLayer.property("Transform").property("ADBE Anchor Point").setValue([bW / 2, bH / 2, 0]);
    glowBgLayer.property("Transform").property("ADBE Opacity").setValueAtTime(0,       50);
    glowBgLayer.property("Transform").property("ADBE Opacity").setValueAtTime(tChange, 0);

    // Gradient Ramp: red (#FC413D) left → green (#00B95C) right, across bottom-right quarter
    // Ramp coords are in layer space = comp space when anchor=center and pos=center
    glowBgLayer.property("Effects").addProperty("ADBE Ramp");
    var gbgRamp = glowBgLayer.property("Effects").property("ADBE Ramp");
    gbgRamp.property("ADBE Ramp-0001").setValue([bW / 2, bH * 3 / 4]); // start: left of quarter
    gbgRamp.property("ADBE Ramp-0002").setValue([0.988, 0.255, 0.239, 1]); // red #FC413D
    gbgRamp.property("ADBE Ramp-0003").setValue([bW,     bH * 3 / 4]); // end: right edge
    gbgRamp.property("ADBE Ramp-0004").setValue([0.000, 0.725, 0.361, 1]); // green #00B95C
    gbgRamp.property("ADBE Ramp-0005").setValue(1); // Linear

    // rotate 20° clockwise — anchor at center so rotation is around bubble center
    glowBgLayer.property("Transform").property("ADBE Rotate Z").setValue(20);

    // Gaussian Blur — repeat edge pixels so blur doesn't fade to black at edges
    glowBgLayer.property("Effects").addProperty("ADBE Gaussian Blur 2");
    var gbgBlur = glowBgLayer.property("Effects").property("ADBE Gaussian Blur 2");
    gbgBlur.property("ADBE Gaussian Blur 2-0001").setValue(200);
    gbgBlur.property("ADBE Gaussian Blur 2-0003").setValue(1); // repeat edge pixels

    // Step 2: pill shape matte — must be directly above glowBgLayer (gotcha #15)
    var glowBgMatte = compBubble1.layers.addShape();
    glowBgMatte.name    = "glow bg matte";
    glowBgMatte.inPoint  = 0;
    glowBgMatte.outPoint = tBubbleOut;
    glowBgMatte.property("Transform").property("ADBE Position").setValue([bW / 2, bH / 2, 0]);
    var _gmc = glowBgMatte.property("Contents");
    _gmc.addProperty("ADBE Vector Group");
    var _gmvg = _gmc.property(1).property("ADBE Vectors Group");
    _gmvg.addProperty("ADBE Vector Shape - Rect");
    _gmvg.addProperty("ADBE Vector Graphic - Fill");
    var _gmRect = _gmvg.property("ADBE Vector Shape - Rect");
    var _gmFill = _gmvg.property("ADBE Vector Graphic - Fill");
    _gmRect.property("ADBE Vector Rect Size").setValueAtTime(0,       [bW,           bH]);
    _gmRect.property("ADBE Vector Rect Size").setValueAtTime(tChange, [bW - bShrink, bH]);
    _gmRect.property("ADBE Vector Rect Position").setValue([0, 0]);
    _gmRect.property("ADBE Vector Rect Roundness").setValue(bH / 2);
    _gmFill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);

    // wire up: matte above target, alpha matte
    glowBgMatte.moveBefore(glowBgLayer);
    glowBgLayer.trackMatteType = TrackMatteType.ALPHA;

    // glow border layer — pill shape, Glow effect
    var glowLayer = compBubble1.layers.addShape();
    glowLayer.name    = "glow border";
    glowLayer.inPoint  = 0;
    glowLayer.outPoint = tBubbleOut;
    var _gl = glowLayer.property("Contents");
    _gl.addProperty("ADBE Vector Group");
    _gl.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    _gl.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
    var glRect   = _gl.property(1).property("ADBE Vectors Group").property("ADBE Vector Shape - Rect");
    var glStroke = _gl.property(1).property("ADBE Vectors Group").property("ADBE Vector Graphic - Stroke");
    glRect.property("ADBE Vector Rect Size").setValueAtTime(0,       [bW,           bH]);
    glRect.property("ADBE Vector Rect Size").setValueAtTime(tChange, [bW - bShrink, bH]);
    glRect.property("ADBE Vector Rect Position").setValue([0, 0]);
    glRect.property("ADBE Vector Rect Roundness").setValue(bH / 2);
    glStroke.property("ADBE Vector Stroke Color").setValue([1, 1, 1, 1]);
    glStroke.property("ADBE Vector Stroke Opacity").setValue(100);
    glStroke.property("ADBE Vector Stroke Width").setValue(10);
    glowLayer.property("Transform").property("ADBE Position").setValue([bW / 2, bH / 2, 0]);
    glowLayer.applyPreset(new File("/Users/vitya/Repos/ae-vibecode/output/jsx/as1_v3_generated_fx_glow.ffx"));
    glowLayer.property("Effects").property("Turbulent Displace").enabled = false;

    var iconSz   = 280;  // 70*4
    var gap      = 88;
    var fontSize = 194;

    // null — button_center, anchored at comp center
    var nullLayer = compBubble1.layers.addNull();
    nullLayer.name     = "button_center";
    nullLayer.inPoint  = 0;
    nullLayer.outPoint = tBubbleOut;
    nullLayer.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    nullLayer.property("Transform").property("ADBE Position").setValue([bW / 2, bH / 2, 0]);

    // text layer — left-justified, position driven by expression
    var textLayer = compBubble1.layers.addText("Checking your calendar");
    textLayer.name     = "label";
    textLayer.inPoint  = 0;
    textLayer.outPoint = tBubbleOut;
    var textProp = textLayer.property("Source Text");
    // keyframe 0: "Checking your calendar", left-justified
    var textDoc  = textProp.value;
    textDoc.text          = "Checking your calendar";
    textDoc.fontSize      = fontSize;
    textDoc.font          = "GoogleSansFlex_500.000wght_100.000ROND";
    textDoc.fillColor     = [1, 1, 1];
    textDoc.applyFill     = true;
    textDoc.applyStroke   = false;
    textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
    textDoc.tracking      = 0;
    textProp.setValueAtTime(0, textDoc);
    // keyframe tChange: two lines, center-justified
    var textDoc2 = textProp.value;
    textDoc2.text          = "You're free 10/10.\rAdd to calendar?";
    textDoc2.fontSize      = fontSize;
    textDoc2.font          = "GoogleSansFlex_500.000wght_100.000ROND";
    textDoc2.fillColor     = [1, 1, 1];
    textDoc2.applyFill     = true;
    textDoc2.applyStroke   = false;
    textDoc2.justification = ParagraphJustification.LEFT_JUSTIFY;
    textDoc2.tracking      = 0;
    textProp.setValueAtTime(tChange, textDoc2);
    var tTransEnd = 90 / fps; // tChange + 15f = transition end
    // anchor at top-left (default for text)
    textLayer.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    textLayer.parent = nullLayer;
    // phase 1 (0..tChange): single line, centered group (icon+text) on null
    // phase 2 (tChange..): two lines, text starts right of icon+gap, vertically centered
    textLayer.property("Transform").property("ADBE Position").expression =
        'var iconSz = ' + iconSz + ';\n' +
        'var gap = ' + gap + ';\n' +
        'var r = thisLayer.sourceRectAtTime(time, false);\n' +
        'var groupW = iconSz + gap + r.width;\n' +
        'var textLeft = -groupW / 2 + iconSz + gap;\n' +
        'var textCenterY = -(r.top + r.height / 2) + 20;\n' +
        '[textLeft, textCenterY]';

    // === COMP: icon (logo) ===
    var compIcon = app.project.items.addComp("icon", iconSz, iconSz, 1, tBubbleOut, fps);

    // bg rect — opacity 0
    var iconBg = compIcon.layers.addShape();
    iconBg.name = "bg";
    iconBg.inPoint  = 0;
    iconBg.outPoint = tBubbleOut;
    var _ibg = iconBg.property("Contents");
    _ibg.addProperty("ADBE Vector Group");
    _ibg.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    _ibg.property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    var ibgRect = _ibg.property(1).property("ADBE Vectors Group").property(1);
    ibgRect.property("ADBE Vector Rect Size").setValue([iconSz, iconSz]);
    ibgRect.property("ADBE Vector Rect Position").setValue([0, 0]);
    iconBg.property("Transform").property("ADBE Position").setValue([iconSz / 2, iconSz / 2, 0]);
    iconBg.property("Transform").property("ADBE Opacity").setValue(0);

    // gemini logo PNG — centered
    var pngFile = new File("/Users/vitya/Repos/ae-vibecode/projects/assets/gemini.png");
    var pngItem = app.project.importFile(new ImportOptions(pngFile));
    var logoLayer = compIcon.layers.add(pngItem);
    logoLayer.name = "logo";
    logoLayer.inPoint  = 0;
    logoLayer.outPoint = tBubbleOut;
    var pngNative = 200;
    var logoScale = ((iconSz - 70) / pngNative) * 100;
    logoLayer.property("Transform").property("ADBE Anchor Point").setValue([pngNative / 2, pngNative / 2, 0]);
    logoLayer.property("Transform").property("ADBE Position").setValue([iconSz / 2, iconSz / 2, 0]);
    logoLayer.property("Transform").property("ADBE Scale").setValue([logoScale, logoScale, logoScale]);

    // Fill effect — белая заливка; убирается через opacity слоя
    var fillEffect = logoLayer.property("Effects").addProperty("ADBE Fill");
    fillEffect.property("ADBE Fill-0002").setValue([1, 1, 1]);
    // fade fill out: add second logo layer duplicate without fill on top won't work —
    // instead animate layer opacity: 100% fill visible → at tTransEnd layer at 100% but fill gone
    // We use a second shape on top that's original-color, faded in via opacity
    // Simplest: animate Fill effect opacity via layer Opacity keyframes on a duplicate isn't possible
    // → Just disable fill at tChange by setting opacity 0 via ADBE Fill-0007 static (not animated)
    // and crossfade by animating the logoLayer opacity 0→100 (without fill) with a pre-comp trick
    // Cleanest solution: animate logoLayer Opacity 100→0 at tChange, add logoLayer2 (no fill) 0→100
    logoLayer.property("Transform").property("ADBE Opacity").setValueAtTime(0,        100);
    logoLayer.property("Transform").property("ADBE Opacity").setValueAtTime(tChange,  100);
    logoLayer.property("Transform").property("ADBE Opacity").setValueAtTime(tTransEnd,  0);

    // logo without fill — fades in at transition
    var pngItem2 = app.project.importFile(new ImportOptions(pngFile));
    var logoLayer2 = compIcon.layers.add(pngItem2);
    logoLayer2.name = "logo_color";
    logoLayer2.inPoint  = 0;
    logoLayer2.outPoint = tBubbleOut;
    logoLayer2.property("Transform").property("ADBE Anchor Point").setValue([pngNative / 2, pngNative / 2, 0]);
    logoLayer2.property("Transform").property("ADBE Position").setValue([iconSz / 2, iconSz / 2, 0]);
    logoLayer2.property("Transform").property("ADBE Scale").setValue([logoScale, logoScale, logoScale]);
    logoLayer2.property("Transform").property("ADBE Opacity").setValueAtTime(0,        0);
    logoLayer2.property("Transform").property("ADBE Opacity").setValueAtTime(tChange,  0);
    logoLayer2.property("Transform").property("ADBE Opacity").setValueAtTime(tTransEnd, 100);

    // icon layer in bubble — uses icon comp
    var bIcon = compBubble1.layers.add(compIcon);
    bIcon.name     = "icon";
    bIcon.inPoint  = 0;
    bIcon.outPoint = tBubbleOut;
    bIcon.property("Transform").property("ADBE Anchor Point").setValue([iconSz / 2, iconSz / 2, 0]);
    bIcon.parent = nullLayer;
    // rotation: -45° → 0° over tChange..tChange+15f, ease out
    var rEaseIn  = new KeyframeEase(0,  0.1);
    var rEaseOut = new KeyframeEase(0, 80);
    var bIconRot = bIcon.property("Transform").property("ADBE Rotate Z");
    bIconRot.setValueAtTime(0,        -90);
    bIconRot.setValueAtTime(tChange,  -90);
    bIconRot.setValueAtTime(tTransEnd,  0);
    bIconRot.setTemporalEaseAtKey(1, [rEaseIn],  [rEaseIn]);
    bIconRot.setTemporalEaseAtKey(2, [rEaseIn],  [rEaseIn]);
    bIconRot.setTemporalEaseAtKey(3, [rEaseOut], [rEaseOut]);
    bIcon.property("Transform").property("ADBE Position").expression =
        'var txt = thisComp.layer("label");\n' +
        'var iconSz = ' + iconSz + ';\n' +
        'var gap = ' + gap + ';\n' +
        'var r = txt.sourceRectAtTime(time, false);\n' +
        'var groupW = iconSz + gap + r.width;\n' +
        '[-groupW / 2 + iconSz / 2, 0]';

    // === COMP: life_easier ===
    var compLife = app.project.items.addComp("life_easier", W, H, 1, tLifeOut - tLifeIn, fps);
    var lDur = tLifeOut - tLifeIn;

    var lifeText = compLife.layers.addText("Making life a little easier");
    lifeText.name    = "label";
    lifeText.inPoint  = 0;
    lifeText.outPoint = lDur;
    var lifeTextProp = lifeText.property("Source Text");
    var lifeTextDoc  = lifeTextProp.value;
    lifeTextDoc.fontSize      = fontSize;
    lifeTextDoc.font          = "GoogleSansFlex_500.000wght_100.000ROND";
    lifeTextDoc.fillColor     = [1, 1, 1];
    lifeTextDoc.applyFill     = true;
    lifeTextDoc.applyStroke   = false;
    lifeTextDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
    lifeTextDoc.tracking      = 0;
    lifeTextProp.setValue(lifeTextDoc);
    lifeText.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    lifeText.property("Transform").property("ADBE Position").expression =
        'var r = thisLayer.sourceRectAtTime(time, false);\n' +
        '[thisComp.width / 2 - r.width / 2 - r.left, thisComp.height / 2 - r.height / 2 - r.top]';

    // === COMP: logo ===
    var logoDur = dur - tLogoIn;
    var compLogo = app.project.items.addComp("logo", W, H, 1, logoDur, fps);

    // icon comp reused — add to logo comp with same layout as bubble (icon + label, centered)
    var logoIconLayer = compLogo.layers.add(compIcon);
    logoIconLayer.name    = "icon";
    logoIconLayer.inPoint  = 0;
    logoIconLayer.outPoint = logoDur;

    var logoNull = compLogo.layers.addNull();
    logoNull.name     = "center";
    logoNull.inPoint  = 0;
    logoNull.outPoint = logoDur;
    logoNull.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    logoNull.property("Transform").property("ADBE Position").setValue([W / 2, H / 2, 0]);

    var logoText = compLogo.layers.addText("Gemini Intelligence");
    logoText.name    = "label";
    logoText.inPoint  = 0;
    logoText.outPoint = logoDur;
    var logoTextProp = logoText.property("Source Text");
    var logoTextDoc  = logoTextProp.value;
    logoTextDoc.fontSize      = fontSize;
    logoTextDoc.font          = "GoogleSansFlex_500.000wght_100.000ROND";
    logoTextDoc.fillColor     = [1, 1, 1];
    logoTextDoc.applyFill     = true;
    logoTextDoc.applyStroke   = false;
    logoTextDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
    logoTextDoc.tracking      = 0;
    logoTextProp.setValue(logoTextDoc);
    logoText.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    logoText.parent = logoNull;
    logoText.property("Transform").property("ADBE Position").expression =
        'var iconSz = ' + iconSz + ';\n' +
        'var gap = ' + gap + ';\n' +
        'var r = thisLayer.sourceRectAtTime(time, false);\n' +
        'var groupW = iconSz + gap + r.width;\n' +
        'var textLeft = -groupW / 2 + iconSz + gap;\n' +
        'var textCenterY = -(r.top + r.height / 2);\n' +
        '[textLeft, textCenterY]';

    logoIconLayer.property("Transform").property("ADBE Anchor Point").setValue([iconSz / 2, iconSz / 2, 0]);
    logoIconLayer.parent = logoNull;
    logoIconLayer.property("Transform").property("ADBE Position").expression =
        'var txt = thisComp.layer("label");\n' +
        'var iconSz = ' + iconSz + ';\n' +
        'var gap = ' + gap + ';\n' +
        'var r = txt.sourceRectAtTime(time, false);\n' +
        'var groupW = iconSz + gap + r.width;\n' +
        '[-groupW / 2 + iconSz / 2, 0]';

    // === COMP: as2_v1 ===
    var compMain = app.project.items.addComp("as2_v1", W, H, 1, dur, fps);

    // BG gradient — linear top-to-bottom, black → [0.085, 0.082, 0.110]
    // simulated via N horizontal slices
    var gradSteps = 16;
    var sliceH = Math.ceil(H / gradSteps);
    var colorTop    = [0, 0, 0];
    var colorBottom = [0.060, 0.055, 0.090];
    for (var gs = 0; gs < gradSteps; gs++) {
        var t = (gs + 0.5) / gradSteps;
        var r = colorTop[0] + (colorBottom[0] - colorTop[0]) * t;
        var g = colorTop[1] + (colorBottom[1] - colorTop[1]) * t;
        var b = colorTop[2] + (colorBottom[2] - colorTop[2]) * t;
        var sliceLayer = compMain.layers.addSolid([r, g, b], gs === 0 ? "BG" : "BG_slice", W, sliceH, 1);
        sliceLayer.inPoint  = 0;
        sliceLayer.outPoint = dur;
        sliceLayer.property("Transform").property("ADBE Anchor Point").setValue([W / 2, sliceH / 2, 0]);
        sliceLayer.property("Transform").property("ADBE Position").setValue([W / 2, gs * sliceH + sliceH / 2, 0]);
    }

    // messenger — center, visible 0..tMessengerOut
    var layerMessenger = compMain.layers.add(compMessenger);
    layerMessenger.name = "messenger";
    layerMessenger.inPoint  = 0;
    layerMessenger.outPoint = tMessengerOut;
    layerMessenger.property("Transform").property("ADBE Anchor Point").setValue([mW / 2, mH / 2, 0]);
    layerMessenger.property("Transform").property("ADBE Position").setValue([W / 2, H / 2, 0]);
    // animate scale 100→75% over 0..1s10f, ease out (fast start, slow end)
    var tAnim = 70 / fps; // 1s10f
    var mScaleProp = layerMessenger.property("Transform").property("ADBE Scale");
    mScaleProp.setValueAtTime(0,     [100, 100, 100]);
    mScaleProp.setValueAtTime(tAnim, [75,  75,  75]);
    var eStart = new KeyframeEase(0,   0.1); // linear out from first key
    var eEnd   = new KeyframeEase(0,  80);   // ease in to last key (slow end)
    mScaleProp.setTemporalEaseAtKey(1, [eStart, eStart, eStart], [eStart, eStart, eStart]);
    mScaleProp.setTemporalEaseAtKey(2, [eEnd, eEnd, eEnd],       [eEnd, eEnd, eEnd]);

    // blur adjustment layer — masked to pill shape, blurs everything below
    var blurAdj = compMain.layers.addSolid([0, 0, 0], "bubble_blur", W, H, 1);
    blurAdj.adjustmentLayer = true;
    blurAdj.inPoint  = 0;
    blurAdj.outPoint = tBubbleOut;
    // Fast Box Blur
    var blurEffect = blurAdj.property("Effects").addProperty("ADBE Box Blur2");
    blurEffect.property("ADBE Box Blur2-0001").setValue(40);
    blurEffect.property("ADBE Box Blur2-0002").setValue(3); // iterations
    // pill mask — same shape as bubble bg
    var blurMask = blurAdj.Masks.addProperty("Mask");
    var pillW = bW;
    var pillH = bH;
    var pillX = W / 2;
    var pillY = H / 2 + 24;
    var rx = pillH / 2; // full pill radius
    // approximate pill with bezier — left cap + right cap
    var shape = new Shape();
    shape.vertices = [
        [pillX - pillW/2 + rx, pillY - pillH/2],
        [pillX + pillW/2 - rx, pillY - pillH/2],
        [pillX + pillW/2,      pillY           ],
        [pillX + pillW/2 - rx, pillY + pillH/2],
        [pillX - pillW/2 + rx, pillY + pillH/2],
        [pillX - pillW/2,      pillY           ]
    ];
    var c = rx * 0.5523;
    shape.inTangents  = [[-c,0],[0,-c],[c,0],[c,0],[0,c],[-c,0]];
    shape.outTangents = [[c,0],[c,0],[c,0],[-c,0],[-c,0],[0,-c]];
    shape.closed = true;
    blurMask.property("ADBE Mask Shape").setValue(shape);
    blurMask.property("ADBE Mask Feather").setValue([60, 60]);

    // bubble — center, visible 0..tBubbleOut
    var layerBubble = compMain.layers.add(compBubble1);
    layerBubble.name = "bubble";
    layerBubble.inPoint  = 0;
    layerBubble.outPoint = tBubbleOut;
    layerBubble.property("Transform").property("ADBE Anchor Point").setValue([bW / 2, bH / 2, 0]);
    layerBubble.property("Transform").property("ADBE Position").setValue([W / 2, H / 2 + 24, 0]);
    // animate scale 100→60% over 0..1s10f, ease out
    var bScaleProp = layerBubble.property("Transform").property("ADBE Scale");
    bScaleProp.setValueAtTime(0,     [100, 100, 100]);
    bScaleProp.setValueAtTime(tAnim, [60,  60,  60]);
    bScaleProp.setTemporalEaseAtKey(1, [eStart, eStart, eStart], [eStart, eStart, eStart]);
    bScaleProp.setTemporalEaseAtKey(2, [eEnd, eEnd, eEnd],       [eEnd, eEnd, eEnd]);

    // life_easier — visible tLifeIn..tLifeOut
    var layerLife = compMain.layers.add(compLife);
    layerLife.name = "life_easier";
    layerLife.startTime = tLifeIn;
    layerLife.inPoint   = tLifeIn;
    layerLife.outPoint  = tLifeOut;
    layerLife.property("Transform").property("ADBE Anchor Point").setValue([W / 2, H / 2, 0]);
    layerLife.property("Transform").property("ADBE Position").setValue([W / 2, H / 2, 0]);
    layerLife.property("Transform").property("ADBE Scale").setValue([100, 100, 100]);

    // logo — visible tLogoIn..end
    var layerLogo = compMain.layers.add(compLogo);
    layerLogo.name = "logo";
    layerLogo.startTime = tLogoIn;
    layerLogo.inPoint   = tLogoIn;
    layerLogo.outPoint  = dur;
    layerLogo.property("Transform").property("ADBE Anchor Point").setValue([W / 2, H / 2, 0]);
    layerLogo.property("Transform").property("ADBE Position").setValue([W / 2, H / 2, 0]);
    layerLogo.property("Transform").property("ADBE Scale").setValue([100, 100, 100]);

    app.endSuppressDialogs(false);
    return compMain;

})();
