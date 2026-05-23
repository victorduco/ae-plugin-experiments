(function () {
    var comp = app.project.items.addComp("android_show_1", 1920, 1080, 1, 3, 24);

    var bg = comp.layers.addSolid([0.05, 0.05, 0.05], "BG", 1920, 1080, 1);
    bg.moveToEnd();

    var textLayer = comp.layers.addText("0%");
    textLayer.name = "Counter";

    var doc = textLayer.property("Source Text").value;
    doc.resetCharStyle();
    doc.fontSize = 300;
    doc.fillColor = [1, 1, 1];
    doc.font = "Arial-BoldMT";
    doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    textLayer.property("Source Text").setValue(doc);

    textLayer.property("Transform").property("Position").setValue([960, 640]);
    textLayer.property("Transform").property("Anchor Point").setValue([0, 0]);

    // linear 0% → 100% over 3 seconds
    textLayer.property("Source Text").expression =
        'Math.min(Math.round(time / 3 * 100), 100) + "%"';

    // --- Overlay: border + diagonals ---
    var W = 1920, H = 1080;
    var overlay = comp.layers.addShape();
    overlay.name = "Overlay";

    var contents = overlay.property("Contents");

    function addLine(name, x1, y1, x2, y2) {
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = name;
        var path = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
        var shape = new Shape();
        shape.vertices  = [[x1 - W/2, y1 - H/2], [x2 - W/2, y2 - H/2]];
        shape.inTangents  = [[0,0],[0,0]];
        shape.outTangents = [[0,0],[0,0]];
        shape.closed = false;
        path.property("Path").setValue(shape);
        var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue([1, 1, 1, 1]);
        stroke.property("Opacity").setValue(30);
        stroke.property("Stroke Width").setValue(3);
    }

    // border as 4 lines
    addLine("Top",    0, 0, W, 0);
    addLine("Bottom", 0, H, W, H);
    addLine("Left",   0, 0, 0, H);
    addLine("Right",  W, 0, W, H);

    // diagonals
    addLine("Diag1",  0, 0, W, H);
    addLine("Diag2",  W, 0, 0, H);

    return comp;
})();
