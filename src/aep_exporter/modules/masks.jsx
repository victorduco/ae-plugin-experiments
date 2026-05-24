// masks.jsx — layer mask emission
// Depends on: core.jsx (w, q, fmtVal), properties.jsx (emitProperty)

var MASK_MODES = {};
MASK_MODES[MaskMode.NONE]       = "MaskMode.NONE";
MASK_MODES[MaskMode.ADD]        = "MaskMode.ADD";
MASK_MODES[MaskMode.SUBTRACT]   = "MaskMode.SUBTRACT";
MASK_MODES[MaskMode.INTERSECT]  = "MaskMode.INTERSECT";
MASK_MODES[MaskMode.LIGHTEN]    = "MaskMode.LIGHTEN";
MASK_MODES[MaskMode.DARKEN]     = "MaskMode.DARKEN";
MASK_MODES[MaskMode.DIFFERENCE] = "MaskMode.DIFFERENCE";

// Serialize a Shape object to an ExtendScript literal that creates a Shape.
function fmtShape(shape) {
    function fmtPts(arr) {
        var parts = [];
        for (var i = 0; i < arr.length; i++) {
            parts.push('[' + fmtVal(arr[i][0]) + ',' + fmtVal(arr[i][1]) + ']');
        }
        return '[' + parts.join(',') + ']';
    }
    var s = '(function(){var _s=new Shape();'
        + '_s.closed=' + (shape.closed ? 'true' : 'false') + ';'
        + '_s.vertices=' + fmtPts(shape.vertices) + ';'
        + '_s.inTangents=' + fmtPts(shape.inTangents) + ';'
        + '_s.outTangents=' + fmtPts(shape.outTangents) + ';'
        + 'return _s;})()';
    return s;
}

function emitMaskShape(shapeProp, propRef, indent) {
    if (shapeProp.numKeys === 0) {
        try {
            var shape = shapeProp.valueAtTime(0, false);
            w(indent + propRef + '.setValue(' + fmtShape(shape) + ');');
        } catch(e) {}
    } else {
        for (var k = 1; k <= shapeProp.numKeys; k++) {
            try {
                var kt = shapeProp.keyTime(k);
                var kv = shapeProp.keyValue(k);
                w(indent + propRef + '.setValueAtTime(' + fmtVal(kt) + ', ' + fmtShape(kv) + ');');
            } catch(e) {}
        }
        // interpolation types for mask shape keys
        for (var k = 1; k <= shapeProp.numKeys; k++) {
            try {
                var inT  = shapeProp.keyInInterpolationType(k);
                var outT = shapeProp.keyOutInterpolationType(k);
                if (inT === KeyframeInterpolationType.HOLD || outT === KeyframeInterpolationType.HOLD) {
                    var inStr  = inT  === KeyframeInterpolationType.HOLD ? "KeyframeInterpolationType.HOLD"   : "KeyframeInterpolationType.LINEAR";
                    var outStr = outT === KeyframeInterpolationType.HOLD ? "KeyframeInterpolationType.HOLD"   : "KeyframeInterpolationType.LINEAR";
                    w(indent + propRef + '.setInterpolationTypeAtKey(' + k + ', ' + inStr + ', ' + outStr + ');');
                }
            } catch(e) {}
        }
    }
}

function emitMasks(layer, lname, indent) {
    var masks;
    try {
        masks = layer.property("Masks");
        if (!masks || masks.numProperties === 0) return;
    } catch(e) { return; }

    for (var m = 1; m <= masks.numProperties; m++) {
        try {
            var mask    = masks.property(m);
            // Must add the mask first; after addProperty it's accessible by index = m
            w(indent + lname + '.property("Masks").addProperty("ADBE Mask Atom");');
            var maskRef = lname + '.property("Masks").property(' + m + ')';

            // maskMode (default is ADD — still emit to be explicit)
            var modeStr = MASK_MODES[mask.maskMode];
            if (modeStr) w(indent + maskRef + '.maskMode = ' + modeStr + ';');

            // inverted
            try { if (mask.inverted) w(indent + maskRef + '.inverted = true;'); } catch(e) {}

            // Mask Path (Shape)
            var shapeProp = mask.property("ADBE Mask Shape");
            emitMaskShape(shapeProp, maskRef + '.property("ADBE Mask Shape")', indent);

            // Mask Feather
            try {
                var fp = mask.property("ADBE Mask Feather");
                emitProperty(fp, maskRef + '.property("ADBE Mask Feather")', indent);
            } catch(e) {}

            // Mask Opacity
            try {
                var op = mask.property("ADBE Mask Opacity");
                emitProperty(op, maskRef + '.property("ADBE Mask Opacity")', indent);
            } catch(e) {}

            // Mask Expansion
            try {
                var ep = mask.property("ADBE Mask Offset");
                emitProperty(ep, maskRef + '.property("ADBE Mask Offset")', indent);
            } catch(e) {}

        } catch(e) {}
    }
}
