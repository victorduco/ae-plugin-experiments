// properties.jsx — generic property and keyframe emission
// Depends on: core.jsx (w, q, fmtVal, safeVal, safeKeyVal, NL, SKIP_GROUPS, SKIP_PROPS)

// Emit keyframe interpolation types for a single key index.
// Skips if both sides are BEZIER (the default — no need to emit).
function emitKeyInterpType(prop, k, ref, indent) {
    try {
        var inType  = prop.keyInInterpolationType(k);
        var outType = prop.keyOutInterpolationType(k);
        var inStr, outStr;

        if (inType === KeyframeInterpolationType.LINEAR) {
            inStr = "KeyframeInterpolationType.LINEAR";
        } else if (inType === KeyframeInterpolationType.HOLD) {
            inStr = "KeyframeInterpolationType.HOLD";
        } else {
            inStr = "KeyframeInterpolationType.BEZIER";
        }

        if (outType === KeyframeInterpolationType.LINEAR) {
            outStr = "KeyframeInterpolationType.LINEAR";
        } else if (outType === KeyframeInterpolationType.HOLD) {
            outStr = "KeyframeInterpolationType.HOLD";
        } else {
            outStr = "KeyframeInterpolationType.BEZIER";
        }

        // Skip if both are default BEZIER
        if (inType === KeyframeInterpolationType.BEZIER && outType === KeyframeInterpolationType.BEZIER) return;

        w(indent + ref + '.setInterpolationTypeAtKey(' + k + ', ' + inStr + ', ' + outStr + ');');
    } catch(e) {}
}

// Emit temporal ease for a single key.
// Handles the dimensionality gotcha: ease array length must match property dimensions.
function emitTemporalEase(prop, k, ref, indent) {
    try {
        // Skip HOLD keys on the out side — no easing applies
        var outType = prop.keyOutInterpolationType(k);
        if (outType === KeyframeInterpolationType.HOLD) return;

        var eIn  = prop.keyInTemporalEase(k);
        var eOut = prop.keyOutTemporalEase(k);
        if (!eIn || !eOut || eIn.length === 0) return;

        var inArr = [], outArr = [];
        for (var e = 0; e < eIn.length; e++) {
            inArr.push('new KeyframeEase(' + fmtVal(eIn[e].speed) + ', ' + fmtVal(Math.max(0.1, eIn[e].influence)) + ')');
        }
        for (var e = 0; e < eOut.length; e++) {
            outArr.push('new KeyframeEase(' + fmtVal(eOut[e].speed) + ', ' + fmtVal(Math.max(0.1, eOut[e].influence)) + ')');
        }
        w(indent + ref + '.setTemporalEaseAtKey(' + k + ', [' + inArr.join(', ') + '], [' + outArr.join(', ') + ']);');
    } catch(e) {}
}

// Emit spatial tangents for a single key (Position and other spatial properties).
function emitSpatialEase(prop, k, ref, indent) {
    try {
        var inTan  = prop.keyInSpatialTangent(k);
        var outTan = prop.keyOutSpatialTangent(k);
        if (!inTan || !outTan) return;
        // Skip if both tangents are zero vectors (linear spatial)
        var anyNonZero = false;
        for (var i = 0; i < inTan.length; i++) {
            if (inTan[i] !== 0 || outTan[i] !== 0) { anyNonZero = true; break; }
        }
        if (!anyNonZero) return;
        w(indent + ref + '.setSpatialTangentsAtKey(' + k + ', ' + fmtVal(inTan) + ', ' + fmtVal(outTan) + ');');
    } catch(e) {}
}

// Core property emitter. Handles both leaf properties and property groups.
// For leaf: emits setValue or setValueAtTime + interp + temporal ease + spatial ease.
// For group: recurses into children.
function emitProperty(prop, ref, indent) {
    if (!prop) return;
    var mn = prop.matchName || "";
    if (SKIP_PROPS[mn]) return;

    var pt = prop.propertyType;

    if (pt === PropertyType.PROPERTY) {
        try { if (!prop.active) return; } catch(e) {}
        var v = safeVal(prop);
        if (v === null) return;

        var exprStr = "";
        if (prop.expressionEnabled && prop.expression) {
            exprStr = NL + indent + ref + '.expressionEnabled = true;'
                    + NL + indent + ref + '.expression = ' + q(prop.expression) + ';';
        }

        if (prop.numKeys === 0) {
            w(indent + ref + '.setValue(' + fmtVal(v) + ');' + exprStr);
        } else {
            // 1. Set all keyframe values
            for (var k = 1; k <= prop.numKeys; k++) {
                var kt = prop.keyTime(k);
                var kv = safeKeyVal(prop, k);
                if (kv === null) continue;
                w(indent + ref + '.setValueAtTime(' + fmtVal(kt) + ', ' + fmtVal(kv) + ');');
            }
            if (exprStr) w(exprStr);
            // 2. Interpolation types
            for (var k = 1; k <= prop.numKeys; k++) {
                emitKeyInterpType(prop, k, ref, indent);
            }
            // 3. Temporal eases
            for (var k = 1; k <= prop.numKeys; k++) {
                emitTemporalEase(prop, k, ref, indent);
            }
            // 4. Spatial tangents (Position, etc.)
            for (var k = 1; k <= prop.numKeys; k++) {
                emitSpatialEase(prop, k, ref, indent);
            }
        }

    } else {
        // Property group — recurse
        if (SKIP_GROUPS[mn]) return;
        for (var i = 1; i <= prop.numProperties; i++) {
            try {
                var child = prop.property(i);
                if (!child) continue;
                var childMN = child.matchName || "";
                if (SKIP_PROPS[childMN]) continue;
                var childRef = ref + '.property(' + q(childMN || child.name) + ')';
                emitProperty(child, childRef, indent);
            } catch(e) {}
        }
    }
}
