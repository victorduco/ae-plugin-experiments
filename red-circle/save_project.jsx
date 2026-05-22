(function () {
    var comp = app.project.items.addComp("Sasha & Pasha", 1920, 1080, 1, 6, 24);

    var bgSolid = comp.layers.addSolid([0.9, 0.9, 0.9], "Background", 1920, 1080, 1);
    bgSolid.moveToEnd();

    function addTextLayer(text, fontSize, color) {
        var layer = comp.layers.addText(text);
        var textDoc = layer.property("Source Text").value;
        textDoc.resetCharStyle();
        textDoc.fontSize = fontSize;
        textDoc.fillColor = color;
        textDoc.font = "Arial-BoldMT";
        textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        layer.property("Source Text").setValue(textDoc);
        layer.property("Transform").property("Anchor Point").setValue([0, 0]);
        return layer;
    }

    var sasha = addTextLayer("Саша", 160, [0.95, 0.2, 0.3]);
    sasha.name = "Саша";
    var sashaPos   = sasha.property("Transform").property("Position");
    var sashaScale = sasha.property("Transform").property("Scale");
    sashaPos.setValueAtTime(0,    [-600, 540]);
    sashaPos.setValueAtTime(1.5,  [530, 540]);
    sashaPos.setValueAtTime(1.7,  [490, 540]);
    sashaPos.setValueAtTime(2.0,  [510, 540]);
    sashaScale.setValueAtTime(0,   [100, 100]);
    sashaScale.setValueAtTime(0.5, [120, 80]);
    sashaScale.setValueAtTime(1.5, [80, 120]);
    sashaScale.setValueAtTime(1.7, [115, 85]);
    sashaScale.setValueAtTime(2.0, [100, 100]);

    var pasha = addTextLayer("Паша", 160, [0.2, 0.4, 0.95]);
    pasha.name = "Паша";
    var pashaPos   = pasha.property("Transform").property("Position");
    var pashaScale = pasha.property("Transform").property("Scale");
    pashaPos.setValueAtTime(0,    [2520, 540]);
    pashaPos.setValueAtTime(1.5,  [1390, 540]);
    pashaPos.setValueAtTime(1.7,  [1430, 540]);
    pashaPos.setValueAtTime(2.0,  [1410, 540]);
    pashaScale.setValueAtTime(0,   [100, 100]);
    pashaScale.setValueAtTime(0.5, [80, 120]);
    pashaScale.setValueAtTime(1.5, [80, 120]);
    pashaScale.setValueAtTime(1.7, [115, 85]);
    pashaScale.setValueAtTime(2.0, [100, 100]);

    var i = addTextLayer("И", 180, [0.15, 0.15, 0.15]);
    i.name = "И";
    i.inPoint = 2.0;
    i.property("Transform").property("Position").setValue([960, 540]);
    var iScale = i.property("Transform").property("Scale");
    var iRot   = i.property("Transform").property("Rotation");
    var iOpac  = i.property("Transform").property("Opacity");
    iScale.setValueAtTime(2.0,  [0, 0]);
    iScale.setValueAtTime(2.3,  [180, 180]);
    iScale.setValueAtTime(2.45, [90, 90]);
    iScale.setValueAtTime(2.6,  [110, 110]);
    iScale.setValueAtTime(2.75, [100, 100]);
    iRot.setValueAtTime(2.0,  -720);
    iRot.setValueAtTime(2.6,   15);
    iRot.setValueAtTime(2.75,   0);
    iOpac.setValueAtTime(2.0,   0);
    iOpac.setValueAtTime(2.15, 100);

    var des = addTextLayer("Дизайнеры", 110, [0.1, 0.6, 0.3]);
    des.name = "Дизайнеры";
    des.inPoint = 2.8;
    var desPos   = des.property("Transform").property("Position");
    var desScale = des.property("Transform").property("Scale");
    var desRot   = des.property("Transform").property("Rotation");
    desPos.setValueAtTime(2.8,  [960, 1600]);
    desPos.setValueAtTime(3.3,  [960, 680]);
    desPos.setValueAtTime(3.5,  [960, 720]);
    desPos.setValueAtTime(3.65, [960, 695]);
    desPos.setValueAtTime(3.8,  [960, 710]);
    desRot.setValueAtTime(2.8,  -30);
    desRot.setValueAtTime(3.3,    8);
    desRot.setValueAtTime(3.5,   -5);
    desRot.setValueAtTime(3.65,   3);
    desRot.setValueAtTime(3.8,    0);
    desScale.setValueAtTime(2.8,  [60, 140]);
    desScale.setValueAtTime(3.3,  [130, 70]);
    desScale.setValueAtTime(3.5,  [85, 115]);
    desScale.setValueAtTime(3.8,  [100, 100]);

    function applyRainbow(layer) {
        var colors = [
            [0.95, 0.2,  0.2 ],
            [0.95, 0.6,  0.1 ],
            [0.2,  0.85, 0.3 ],
            [0.1,  0.5,  0.95],
            [0.7,  0.1,  0.95],
            [0.95, 0.2,  0.2 ],
        ];
        var src = layer.property("Source Text");
        var startTime = layer.inPoint;
        for (var k = 0; k < colors.length; k++) {
            var t = startTime + k * (6 - startTime) / (colors.length - 1);
            var doc = src.valueAtTime(t, false);
            doc.fillColor = colors[k];
            src.setValueAtTime(t, doc);
        }
    }

    applyRainbow(sasha);
    applyRainbow(pasha);
    applyRainbow(i);
    applyRainbow(des);

    // --- Add to Render Queue ---
    var rqItem = app.project.renderQueue.items.add(comp);

    // Output path — same folder as this script
    var scriptFile = new File($.fileName);
    var outputDir  = scriptFile.parent.fsName;

    // Make sure output folder exists
    var outFolder = new Folder(outputDir + "/output");
    if (!outFolder.exists) outFolder.create();

    var outputModule = rqItem.outputModules[1];
    outputModule.file = new File(outputDir + "/output/sasha_pasha.mov");

    // --- Save the project ---
    var projectPath = outputDir + "/sasha_pasha.aep";
    app.project.save(new File(projectPath));

    alert("Проект сохранён:\n" + projectPath + "\n\nТеперь запусти render.sh для рендера!");
})();
