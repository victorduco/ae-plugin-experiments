// effects.jsx — effects emission with savePreset fallback for CUSTOM_VALUE params
// Depends on: core.jsx (w, q, fmtVal, effectsLog, NL), properties.jsx (emitKeyInterpType, emitTemporalEase)
//
// Strategy:
//   1. Scan each effect for CUSTOM_VALUE properties.
//   2. If any found → savePreset() the whole effect to a .ffx file next to the output JSX.
//      In the generated JSX emit addProperty(new File("...ffx")) instead of addProperty(matchName).
//      The .ffx restores ALL params including opaque binary ones.
//   3. If no CUSTOM_VALUE → emit normally via setValue/setValueAtTime as before.

// Effects that must be added by display name instead of matchName.
var EFF_DISPLAY_NAME = {
    "ADBE Glo2":    "Glow",
    "APC Colorama": "Colorama"
};

// Output JSX path — set by main.jsx before calling emitEffects.
// Used to derive sibling .ffx paths.
var _effOutputBasePath = "";

// Check if an effect has any CUSTOM_VALUE leaf property anywhere in its tree.
function effHasCustomValue(prop) {
    if (prop.propertyType === PropertyType.PROPERTY) {
        return prop.propertyValueType === PropertyValueType.CUSTOM_VALUE;
    }
    for (var i = 1; i <= prop.numProperties; i++) {
        try {
            if (effHasCustomValue(prop.property(i))) return true;
        } catch(e) {}
    }
    return false;
}

// Emit a single leaf property inside an effect.
function emitEffectLeafProp(ep, epRef, failedProps, indent) {
    try {
        var pvt = ep.propertyValueType;
        var v = safeVal(ep);
        if (v === null) {
            if (pvt === PropertyValueType.CUSTOM_VALUE) {
                failedProps.push({
                    propName:  ep.name || "?",
                    matchName: ep.matchName || "?",
                    error:     "CUSTOM_VALUE — opaque binary, saved via .ffx preset"
                });
            } else if (pvt !== PropertyValueType.NO_VALUE &&
                       pvt !== PropertyValueType.MARKER &&
                       pvt !== PropertyValueType.TEXT_DOCUMENT) {
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
                var ep   = eg.property(p);
                if (!ep) continue;
                var epmn = ep.matchName || "";
                if (epmn === "ADBE Effect Built In Params") continue;
                var epRef = egRef + '.property(' + q(epmn || ep.name) + ')';
                if (ep.propertyType === PropertyType.PROPERTY) {
                    emitEffectLeafProp(ep, epRef, failedProps, indent);
                } else {
                    emitEffectGroup(ep, epRef, failedProps, indent);
                }
            } catch(e) {
                try {
                    failedProps.push({
                        propName:  eg.property(p).name || ("prop_" + p),
                        matchName: "?",
                        error:     e.toString()
                    });
                } catch(e2) {}
            }
        }
    } catch(e) {}
}

// Save the entire Effects group of a layer as a .ffx preset.
// savePreset() only works on PropertyGroup, not on individual effects.
// Returns the .ffx path on success, null on failure.
var _lastPresetError = "";

// AE scripting doesn't expose savePreset() on PropertyGroup.
// Workaround: select the layer, select all effects, then use
// app.project.activeItem.activeLayer... actually the only reliable path
// is layer.savePreset() which IS documented but only on Layer object itself
// for animation presets that include transform+effects together.
// For effects-only we use layer.property("Effects") approach via copyToClipboard workaround.
// Simplest working approach: use layer.savePreset() if available, else use
// the undocumented but working approach of saving via the layer directly.
function saveLayerEffectsPreset(layer, layerName) {
    if (!_effOutputBasePath) return null;
    try {
        var safeName = layerName.replace(/[^a-zA-Z0-9_\-]/g, "_");
        var ffxPath = _effOutputBasePath + "_fx_" + safeName + ".ffx";
        var ffxFile = new File(ffxPath);

        // savePreset() requires comp open in viewer + layer selected + effects selected
        try { layer.containingComp.openInViewer(); } catch(e) {}

        // Deselect all layers in comp first
        try {
            var comp = layer.containingComp;
            for (var li = 1; li <= comp.numLayers; li++) {
                try { comp.layer(li).selected = false; } catch(e) {}
            }
        } catch(e) {}

        layer.selected = true;

        // Select all effects — savePreset only saves selected effects
        try {
            var eff = layer.property("Effects");
            for (var ei = 1; ei <= eff.numProperties; ei++) {
                try { eff.property(ei).selected = true; } catch(e) {}
            }
        } catch(e) {}

        layer.savePreset(ffxFile);
        if (!ffxFile.exists) { _lastPresetError = "file not written"; return null; }
        return ffxPath;
    } catch(e) {
        _lastPresetError = e.toString();
        return null;
    }
}

// Emit all effects on a layer.
// If any effect has CUSTOM_VALUE params → save the whole Effects group as .ffx
// and emit a single addProperty(new File(...)) call that restores everything.
// Otherwise emit each effect normally via addProperty + setValue.
function emitEffects(layer, layerRef, indent) {
    var eff;
    try { eff = layer.property("Effects"); } catch(e) { return; }
    if (!eff || eff.numProperties === 0) return;

    var compName  = "";
    var layerName = layer.name || ("layer_" + layer.index);
    try { compName = layer.containingComp.name; } catch(e) {}

    // Check if ANY effect on this layer has CUSTOM_VALUE params
    var layerHasCustom = false;
    for (var e = 1; e <= eff.numProperties; e++) {
        try {
            if (effHasCustomValue(eff.property(e))) { layerHasCustom = true; break; }
        } catch(e2) {}
    }

    if (layerHasCustom) {
        // Save entire Effects group as one .ffx — includes all effects + opaque binary data
        var ffxPath = saveLayerEffectsPreset(layer, layerName);
        if (ffxPath) {
            // addProperty on an Effects group with a File applies all effects at once
            w(indent + layerRef + '.applyPreset(new File(' + q(ffxPath) + '));');

            // Collect effect names for the log
            var effNames = [];
            for (var e = 1; e <= eff.numProperties; e++) {
                try { effNames.push(eff.property(e).name || ("eff_" + e)); } catch(e2) {}
            }
            effectsLog.push({
                compName:    compName,
                layerName:   layerName,
                effectName:  effNames.join(", "),
                effectMN:    "multiple",
                failedProps: [],
                note:        "Layer has CUSTOM_VALUE params — all effects saved as .ffx: " + ffxPath
            });
            return;
        } else {
            // savePreset failed — fall through to normal per-effect emit, log the loss
            effectsLog.push({
                compName:    compName,
                layerName:   layerName,
                effectName:  "all effects",
                effectMN:    "multiple",
                failedProps: [],
                note:        "Layer has CUSTOM_VALUE params but savePreset() failed: " + _lastPresetError
            });
        }
    }

    // Normal per-effect emit
    w(indent + 'var _eff = ' + layerRef + '.Effects;');

    for (var e = 1; e <= eff.numProperties; e++) {
        try {
            var ef     = eff.property(e);
            var mn     = ef.matchName || "";
            var evname = '_eff_' + e;

            var displayOverride = EFF_DISPLAY_NAME[mn];
            var addName = displayOverride ? q(displayOverride) : q(mn);

            try {
                w(indent + 'var ' + evname + ' = _eff.addProperty(' + addName + ');');
            } catch(addErr1) {
                if (!displayOverride) {
                    try {
                        w(indent + 'var ' + evname + ' = _eff.addProperty(' + q(ef.name) + ');');
                        effectsLog.push({
                            compName: compName, layerName: layerName,
                            effectName: ef.name || mn, effectMN: mn, failedProps: [],
                            note: "matchName failed; used display name — add to EFF_DISPLAY_NAME map"
                        });
                    } catch(addErr2) {
                        effectsLog.push({
                            compName: compName, layerName: layerName,
                            effectName: ef.name || mn, effectMN: mn, failedProps: [],
                            note: "ENTIRE EFFECT FAILED to add. matchName: " + mn + ", displayName: " + (ef.name || "?")
                        });
                        continue;
                    }
                } else {
                    effectsLog.push({
                        compName: compName, layerName: layerName,
                        effectName: ef.name || mn, effectMN: mn, failedProps: [],
                        note: "ENTIRE EFFECT FAILED to add. matchName: " + mn
                    });
                    continue;
                }
            }

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

// Appended to the output JSX after closing })();
function emitEffectsSummary() {
    w('');
    w('/*');
    w(' * EFFECTS EXTRACTION ISSUES');
    w(' * ===========================');
    if (effectsLog.length === 0) {
        w(' * (none — all effects extracted successfully)');
    } else {
        w(' * The following effects had issues or used .ffx presets during extraction.');
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
