// effects.jsx — effects emission with per-property catch, nested groups, and summary log
// Depends on: core.jsx (w, q, fmtVal, effectsLog, NL), properties.jsx (emitProperty, emitTemporalEase, emitKeyInterpType)

// Effects that must be added by display name instead of matchName.
// To discover new ones: run extraction, check effectsLog for "used display name" notes,
// then add them here so future runs are clean.
var EFF_DISPLAY_NAME = {
    "ADBE Glo2":     "Glow",
    "APC Colorama":  "Colorama"
};

// Emit a single leaf property inside an effect, with per-property error capture.
function emitEffectLeafProp(ep, epRef, failedProps, indent) {
    try {
        var pvt = ep.propertyValueType;
        var v = safeVal(ep);
        if (v === null) {
            // Distinguish why: CUSTOM_VALUE = opaque binary blob, API hard limit
            if (pvt === PropertyValueType.CUSTOM_VALUE) {
                failedProps.push({
                    propName:  ep.name || "?",
                    matchName: ep.matchName || "?",
                    error:     "CUSTOM_VALUE — opaque binary, not accessible via scripting API"
                });
            } else if (pvt === PropertyValueType.NO_VALUE) {
                // silently skip — no value by design
            } else if (pvt !== PropertyValueType.MARKER && pvt !== PropertyValueType.TEXT_DOCUMENT) {
                failedProps.push({
                    propName:  ep.name || "?",
                    matchName: ep.matchName || "?",
                    error:     "null value (pvt=" + pvt + ")"
                });
            }
            return;
        }

        if (ep.numKeys === 0) {
            w(indent + epRef + '.setValue(' + fmtVal(v) + ');');
            if (ep.expressionEnabled && ep.expression) {
                w(indent + epRef + '.expressionEnabled = true;');
                w(indent + epRef + '.expression = ' + q(ep.expression) + ';');
            }
        } else {
            for (var k = 1; k <= ep.numKeys; k++) {
                var kt = ep.keyTime(k);
                var kv = safeKeyVal(ep, k);
                if (kv === null) continue;
                w(indent + epRef + '.setValueAtTime(' + fmtVal(kt) + ', ' + fmtVal(kv) + ');');
            }
            if (ep.expressionEnabled && ep.expression) {
                w(indent + epRef + '.expressionEnabled = true;');
                w(indent + epRef + '.expression = ' + q(ep.expression) + ';');
            }
            for (var k = 1; k <= ep.numKeys; k++) {
                emitKeyInterpType(ep, k, epRef, indent);
            }
            for (var k = 1; k <= ep.numKeys; k++) {
                emitTemporalEase(ep, k, epRef, indent);
            }
        }
    } catch(effPropErr) {
        failedProps.push({
            propName:  ep.name || "?",
            matchName: ep.matchName || "?",
            error:     effPropErr.toString()
        });
    }
}

// Recurse into a nested property group inside an effect.
function emitEffectGroup(eg, egRef, failedProps, indent) {
    try {
        for (var p = 1; p <= eg.numProperties; p++) {
            try {
                var ep = eg.property(p);
                if (!ep) continue;
                var epmn = ep.matchName || "";
                if (epmn === "ADBE Effect Built In Params") continue;
                var epRef = egRef + '.property(' + q(epmn || ep.name) + ')';

                if (ep.propertyType === PropertyType.PROPERTY) {
                    emitEffectLeafProp(ep, epRef, failedProps, indent);
                } else {
                    // Nested group — recurse one more level
                    emitEffectGroup(ep, epRef, failedProps, indent);
                }
            } catch(e) {
                try {
                    failedProps.push({
                        propName: eg.property(p).name || ("prop_" + p),
                        matchName: "?",
                        error: e.toString()
                    });
                } catch(e2) {}
            }
        }
    } catch(e) {}
}

// Emit all effects on a layer. Three-level catch:
//   1. Effect add fails → try display name; if both fail, log and skip.
//   2. Property read fails → log property, continue.
//   3. Nested group recursion fails → log group, continue.
function emitEffects(layer, layerRef, indent) {
    var eff;
    try { eff = layer.property("Effects"); } catch(e) { return; }
    if (!eff || eff.numProperties === 0) return;

    var compName  = "";
    var layerName = layer.name || ("layer_" + layer.index);
    try { compName = layer.containingComp.name; } catch(e) {}

    w(indent + 'var _eff = ' + layerRef + '.Effects;');

    for (var e = 1; e <= eff.numProperties; e++) {
        try {
            var ef   = eff.property(e);
            var mn   = ef.matchName || "";
            var displayOverride = EFF_DISPLAY_NAME[mn];
            var addName = displayOverride ? q(displayOverride) : q(mn);

            var evname     = '_eff_' + e;
            var addSucceed = false;
            var usedDisplayName = false;

            // Level 1: try to add effect
            try {
                w(indent + 'var ' + evname + ' = _eff.addProperty(' + addName + ');');
                addSucceed = true;
            } catch(addErr1) {
                // Retry with display name if we used matchName
                if (!displayOverride) {
                    try {
                        var dnFallback = q(ef.name);
                        w(indent + 'var ' + evname + ' = _eff.addProperty(' + dnFallback + ');');
                        addSucceed    = true;
                        usedDisplayName = true;
                        effectsLog.push({
                            compName:    compName,
                            layerName:   layerName,
                            effectName:  ef.name || mn,
                            effectMN:    mn,
                            failedProps: [],
                            note: "matchName failed; used display name " + ef.name + " — add to EFF_DISPLAY_NAME map"
                        });
                    } catch(addErr2) {
                        effectsLog.push({
                            compName:    compName,
                            layerName:   layerName,
                            effectName:  ef.name || mn,
                            effectMN:    mn,
                            failedProps: [],
                            note: "ENTIRE EFFECT FAILED to add (tried matchName and display name). matchName: " + mn + ", displayName: " + (ef.name || "?")
                        });
                        continue;
                    }
                } else {
                    effectsLog.push({
                        compName:    compName,
                        layerName:   layerName,
                        effectName:  ef.name || mn,
                        effectMN:    mn,
                        failedProps: [],
                        note: "ENTIRE EFFECT FAILED to add. matchName: " + mn
                    });
                    continue;
                }
            }

            // Level 2 & 3: emit properties
            var failedProps = [];
            for (var p = 1; p <= ef.numProperties; p++) {
                try {
                    var ep   = ef.property(p);
                    var epmn = ep.matchName || "";
                    if (epmn === "ADBE Effect Built In Params") continue;
                    var epRef = evname + '.property(' + q(epmn || ep.name) + ')';

                    if (ep.propertyType === PropertyType.PROPERTY) {
                        emitEffectLeafProp(ep, epRef, failedProps, indent);
                    } else {
                        emitEffectGroup(ep, epRef, failedProps, indent);
                    }
                } catch(propErr) {
                    try {
                        failedProps.push({
                            propName:  ef.property(p).name || ("prop_" + p),
                            matchName: "?",
                            error:     propErr.toString()
                        });
                    } catch(e2) {}
                }
            }

            if (failedProps.length > 0) {
                effectsLog.push({
                    compName:    compName,
                    layerName:   layerName,
                    effectName:  ef.name || mn,
                    effectMN:    mn,
                    failedProps: failedProps,
                    note:        ""
                });
            }

        } catch(outerErr) {
            try {
                effectsLog.push({
                    compName:    compName,
                    layerName:   layerName,
                    effectName:  "effect_" + e,
                    effectMN:    "?",
                    failedProps: [],
                    note:        "Outer error: " + outerErr.toString()
                });
            } catch(e2) {}
        }
    }
}

// Appended to the output JSX after the closing })(); — human-readable summary.
function emitEffectsSummary() {
    w('');
    w('/*');
    w(' * EFFECTS EXTRACTION ISSUES');
    w(' * ===========================');
    if (effectsLog.length === 0) {
        w(' * (none — all effects extracted successfully)');
    } else {
        w(' * The following effects had issues during extraction.');
        w(' * Review manually or provide screenshots for these layers.');
        w(' *');
        var lastComp = "", lastLayer = "";
        for (var i = 0; i < effectsLog.length; i++) {
            var entry = effectsLog[i];
            if (entry.compName !== lastComp) {
                w(' * Comp: "' + entry.compName + '"');
                lastComp  = entry.compName;
                lastLayer = "";
            }
            if (entry.layerName !== lastLayer) {
                w(' *   Layer: "' + entry.layerName + '"');
                lastLayer = entry.layerName;
            }
            w(' *     Effect: ' + entry.effectName + ' (' + entry.effectMN + ')');
            if (entry.note) {
                w(' *       NOTE: ' + entry.note);
            }
            for (var p = 0; p < entry.failedProps.length; p++) {
                var fp = entry.failedProps[p];
                w(' *       - "' + fp.propName + '" [' + fp.matchName + ']: ' + fp.error);
            }
        }
    }
    w(' */');
}
