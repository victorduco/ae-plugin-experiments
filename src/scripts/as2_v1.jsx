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
    bRect.property("ADBE Vector Rect Size").setValue([bW, bH]);
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
    _gmRect.property("ADBE Vector Rect Size").setValue([bW, bH]);
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
    glRect.property("ADBE Vector Rect Size").setValue([bW, bH]);
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
    var textDoc  = textProp.value;
    textDoc.fontSize      = fontSize;
    textDoc.font          = "GoogleSansFlex_500.000wght_100.000ROND";
    textDoc.fillColor     = [1, 1, 1];
    textDoc.applyFill     = true;
    textDoc.applyStroke   = false;
    textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
    textDoc.tracking      = 0;
    textProp.setValue(textDoc);
    // anchor at top-left (default for text)
    textLayer.property("Transform").property("ADBE Anchor Point").setValue([0, 0, 0]);
    textLayer.parent = nullLayer;
    // horizontal: group centered on null; vertical: 0 (null is at bH/2)
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

    // Fill effect — заливает лого белым, сохраняя альфу; легко анимировать цвет
    var fillEffect = logoLayer.property("Effects").addProperty("ADBE Fill");
    fillEffect.property("ADBE Fill-0002").setValue([1, 1, 1]); // цвет: белый

    // icon layer in bubble — uses icon comp
    var bIcon = compBubble1.layers.add(compIcon);
    bIcon.name     = "icon";
    bIcon.inPoint  = 0;
    bIcon.outPoint = tBubbleOut;
    bIcon.property("Transform").property("ADBE Anchor Point").setValue([iconSz / 2, iconSz / 2, 0]);
    bIcon.parent = nullLayer;
    bIcon.property("Transform").property("ADBE Position").expression =
        'var txt = thisComp.layer("label");\n' +
        'var iconSz = ' + iconSz + ';\n' +
        'var gap = ' + gap + ';\n' +
        'var r = txt.sourceRectAtTime(time, false);\n' +
        'var groupW = iconSz + gap + r.width;\n' +
        '[-groupW / 2 + iconSz / 2, 0]';

    // === COMP: life_easier ===
    var compLife = app.project.items.addComp("life_easier", W, H, 1, tLifeOut - tLifeIn, fps);
    var lSolid = compLife.layers.addSolid([0.2, 0.7, 0.3], "bg", W, H, 1);
    lSolid.inPoint  = 0;
    lSolid.outPoint = tLifeOut - tLifeIn;

    // === COMP: logo ===
    var compLogo = app.project.items.addComp("logo", W, H, 1, dur - tLogoIn, fps);
    var loSolid = compLogo.layers.addSolid([0.9, 0.7, 0.1], "bg", W, H, 1);
    loSolid.inPoint  = 0;
    loSolid.outPoint = dur - tLogoIn;

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
    layerMessenger.property("Transform").property("ADBE Scale").setValue([100, 100, 100]);

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
    layerBubble.property("Transform").property("ADBE Scale").setValue([100, 100, 100]);

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
