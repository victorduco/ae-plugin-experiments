// layers.jsx — layer type dispatch and common layer property emission
// Depends on: core.jsx (w, q, fmtVal, mattePairs, MATTE_TYPES, BLEND_MODES, effectsLog)
//             footage.jsx (registerFootage, compVarName)
//             shapes.jsx (emitShapeContents)
//             transform.jsx (emitTransform)
//             effects.jsx (emitEffects)

// ─── shape layer ─────────────────────────────────────────────────────────────

function emitShapeLayerBody(layer, lname, compRef, indent) {
    w(indent + 'var ' + lname + ' = ' + compRef + '.layers.addShape();');
}

// ─── AV layer (footage or comp source) ───────────────────────────────────────

function emitAVLayerBody(layer, lname, compRef, indent) {
    var src = layer.source;
    if (!src) return false;

    if (src instanceof CompItem) {
        var srcVar = compVarName(src);
        w(indent + 'var ' + lname + ' = ' + compRef + '.layers.add(' + srcVar + ');');
    } else if (src.mainSource instanceof SolidSource) {
        var ms = src.mainSource;
        var cr = ms.color;
        w(indent + 'var ' + lname + ' = ' + compRef + '.layers.addSolid(' +
            fmtVal([cr[0], cr[1], cr[2]]) + ', ' + q(layer.name) + ', ' +
            src.width + ', ' + src.height + ', ' + src.pixelAspect + ');');
    } else {
        var fvar = registerFootage(src);
        w(indent + 'var ' + lname + ' = ' + compRef + '.layers.add(' + fvar + ');');
    }
    return true;
}

// ─── text layer ──────────────────────────────────────────────────────────────

function emitTextLayerBody(layer, lname, compRef, indent) {
    // Basic text: create with empty string, then try to read TextDocument
    w(indent + 'var ' + lname + ' = ' + compRef + '.layers.addText("");');

    try {
        var textProp = layer.property("Source Text");
        if (!textProp) return;

        // If there's an expression driving Source Text, emit it
        if (textProp.expressionEnabled && textProp.expression) {
            w(indent + lname + '.property("Source Text").expressionEnabled = true;');
            w(indent + lname + '.property("Source Text").expression = ' + q(textProp.expression) + ';');
            return;
        }

        // Try to read the TextDocument
        var td = null;
        try {
            if (textProp.numKeys > 0) {
                td = textProp.keyValue(1);
            } else {
                td = textProp.value;
            }
        } catch(e) {}

        if (!td) return;

        var textStr = "";
        try { textStr = td.text; } catch(e) {}

        if (textStr) {
            w(indent + 'var _td = ' + lname + '.property("Source Text").value;');
            w(indent + '_td.text = ' + q(textStr) + ';');

            try { if (td.font)          w(indent + '_td.font = ' + q(td.font) + ';'); } catch(e) {}
            try { if (td.fontSize)      w(indent + '_td.fontSize = ' + fmtVal(td.fontSize) + ';'); } catch(e) {}
            try { if (td.fillColor)     w(indent + '_td.fillColor = ' + fmtVal(td.fillColor) + ';'); } catch(e) {}
            try { if (td.strokeColor)   w(indent + '_td.strokeColor = ' + fmtVal(td.strokeColor) + ';'); } catch(e) {}
            try { if (td.strokeWidth)   w(indent + '_td.strokeWidth = ' + fmtVal(td.strokeWidth) + ';'); } catch(e) {}
            try {
                var just = td.justification;
                if (just === ParagraphJustification.LEFT_JUSTIFY)   w(indent + '_td.justification = ParagraphJustification.LEFT_JUSTIFY;');
                if (just === ParagraphJustification.CENTER_JUSTIFY) w(indent + '_td.justification = ParagraphJustification.CENTER_JUSTIFY;');
                if (just === ParagraphJustification.RIGHT_JUSTIFY)  w(indent + '_td.justification = ParagraphJustification.RIGHT_JUSTIFY;');
            } catch(e) {}
            try { if (td.tracking !== undefined) w(indent + '_td.tracking = ' + fmtVal(td.tracking) + ';'); } catch(e) {}
            try { if (td.leading  !== undefined) w(indent + '_td.leading  = ' + fmtVal(td.leading)  + ';'); } catch(e) {}

            w(indent + lname + '.property("Source Text").setValue(_td);');
        }

        // Handle keyframes on Source Text
        if (textProp.numKeys > 1) {
            // Log that animated text exists but only first frame was set
            effectsLog.push({
                compName:  "",
                layerName: layer.name || lname,
                effectName: "Source Text (animated)",
                effectMN:   "ADBE Text Document",
                failedProps: [],
                note: "Animated text (Source Text has " + textProp.numKeys + " keyframes) — only first keyframe value set. Complex text animators not supported."
            });
        }
    } catch(e) {
        effectsLog.push({
            compName:  "",
            layerName: layer.name || lname,
            effectName: "Text layer body",
            effectMN:   "ADBE Text Layer",
            failedProps: [],
            note: "Text extraction error: " + e.toString()
        });
    }
}

// ─── camera / light stubs ─────────────────────────────────────────────────────

function emitCameraLayerBody(layer, lname, compRef, indent) {
    // Camera layers require addCamera(name, centerPoint) — skip for now
    effectsLog.push({
        compName:  "",
        layerName: layer.name || lname,
        effectName: "Camera layer",
        effectMN:   "ADBE Camera Layer",
        failedProps: [],
        note: "Camera layers are not supported by the exporter — layer skipped."
    });
    return false;
}

function emitLightLayerBody(layer, lname, compRef, indent) {
    effectsLog.push({
        compName:  "",
        layerName: layer.name || lname,
        effectName: "Light layer",
        effectMN:   "ADBE Light Layer",
        failedProps: [],
        note: "Light layers are not supported by the exporter — layer skipped."
    });
    return false;
}

// ─── main layer emitter ──────────────────────────────────────────────────────

function emitLayer(layer, compRef, indent) {
    var mn    = layer.matchName || "";
    var lname = '_layer_' + layer.index;

    // Dispatch by layer type
    if (mn === "ADBE Vector Layer") {
        emitShapeLayerBody(layer, lname, compRef, indent);
    } else if (mn === "ADBE AV Layer") {
        var ok = emitAVLayerBody(layer, lname, compRef, indent);
        if (!ok) return null;
    } else if (mn === "ADBE Text Layer") {
        emitTextLayerBody(layer, lname, compRef, indent);
    } else if (mn === "ADBE Camera Layer") {
        emitCameraLayerBody(layer, lname, compRef, indent);
        return null;
    } else if (mn === "ADBE Light Layer") {
        emitLightLayerBody(layer, lname, compRef, indent);
        return null;
    } else {
        return null;
    }

    // ── Common layer properties ──────────────────────────────────────────────

    w(indent + lname + '.name = ' + q(layer.name) + ';');

    // startTime must be set BEFORE inPoint/outPoint (affects their calculation)
    if (Math.abs(layer.startTime) > 0.0001) {
        w(indent + lname + '.startTime = ' + fmtVal(layer.startTime) + ';');
    }
    w(indent + lname + '.inPoint  = ' + fmtVal(layer.inPoint) + ';');
    w(indent + lname + '.outPoint = ' + fmtVal(layer.outPoint) + ';');

    // Detect matte layers (auto-hidden by AE) — don't write enabled=false for them
    var isMatte = false;
    try {
        var compObj  = layer.containingComp;
        var belowIdx = layer.index + 1;
        if (belowIdx <= compObj.numLayers) {
            var below = compObj.layer(belowIdx);
            if (below && below.trackMatteType !== TrackMatteType.NO_TRACK_MATTE) {
                isMatte = true;
            }
        }
    } catch(e) {}
    if (!layer.enabled && !isMatte) w(indent + lname + '.enabled = false;');

    if (layer.motionBlur) w(indent + lname + '.motionBlur = true;');

    // 3D layer flag — must be set before emitting 3D transform props
    var is3D = false;
    try { is3D = layer.threeDLayer; } catch(e) {}
    if (is3D) w(indent + lname + '.threeDLayer = true;');

    // Blend mode
    var bm = BLEND_MODES[layer.blendingMode];
    if (bm && layer.blendingMode !== BlendingMode.NORMAL) {
        w(indent + lname + '.blendingMode = ' + bm + ';');
    }

    // Transform (3D-aware via emitTransform)
    emitTransform(layer, lname, indent);

    // Effects
    emitEffects(layer, lname, indent);

    // Shape contents
    if (mn === "ADBE Vector Layer") {
        try {
            var contents = layer.property("Contents");
            if (contents && contents.numProperties > 0) {
                w(indent + 'var _contents = ' + lname + '.property("Contents");');
                emitShapeContents(contents, '_contents', indent);
            }
        } catch(e) {}
    }

    // Track matte — deferred until all layers are added (see comps.jsx)
    var tmt = MATTE_TYPES[layer.trackMatteType];
    if (tmt) {
        mattePairs.push({ ref: lname, type: tmt, index: layer.index });
    }

    return lname;
}
