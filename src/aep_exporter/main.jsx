// main.jsx — entry point IIFE for the AEP-to-JSX exporter
// This is the ONLY file that contains an IIFE wrapper.
// All module code (core, properties, footage, shapes, transform, effects, layers, comps)
// is concatenated before this file by build.sh and runs in the same shared scope.
//
// Usage: run via osascript DoScriptFile on the built bundle (dist/aep_exporter_bundle.jsx)
// Output: <aep_path_without_ext>_generated.jsx

(function () {

    var proj = app.project;
    if (!proj) throw new Error("No project is open in After Effects.");

    // ── Collect all compositions ──────────────────────────────────────────────

    var allComps = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) allComps.push(item);
    }
    if (allComps.length === 0) throw new Error("No compositions found in the project.");

    // ── Topological sort (sub-comps before parents) ──────────────────────────

    var sorted = topoSort(allComps);

    // ── Pre-scan footage ──────────────────────────────────────────────────────

    gatherFootage(sorted);

    // ── Determine output path ─────────────────────────────────────────────────
    // _exporterOutputPath can be set by the runner JSX before evalFile() to override the destination.

    var outPath = "";
    if (typeof _exporterOutputPath === "string" && _exporterOutputPath !== "") {
        outPath = _exporterOutputPath;
    } else {
        var projFile = proj.file;
        if (projFile) {
            outPath = projFile.fsName.replace(/\.aep$/i, '_generated.jsx');
        } else {
            outPath = "/tmp/ae_generated.jsx";
        }
    }

    // Tell effects module where to save .ffx presets (same dir, same base name)
    _effOutputBasePath = outPath.replace(/\.jsx$/, '');

    // ── Pre-pass: save .ffx presets for layers with CUSTOM_VALUE effects ──────
    // Must run BEFORE beginSuppressDialogs — savePreset() is blocked by dialog suppression.
    for (var c = 0; c < sorted.length; c++) {
        var comp = sorted[c];
        for (var li = 1; li <= comp.numLayers; li++) {
            try {
                var layer = comp.layer(li);
                var eff;
                try { eff = layer.property("Effects"); } catch(e) { continue; }
                if (!eff || eff.numProperties === 0) continue;
                var hasCustom = false;
                for (var ei = 1; ei <= eff.numProperties; ei++) {
                    try { if (effHasCustomValue(eff.property(ei))) { hasCustom = true; break; } } catch(e) {}
                }
                if (hasCustom) {
                    saveLayerEffectsPreset(layer, layer.name || ("layer_" + li));
                }
            } catch(e) {}
        }
    }

    app.beginSuppressDialogs();

    // ── Build output JSX ──────────────────────────────────────────────────────

    w('(function () {');
    w('');
    w('    app.beginSuppressDialogs();');
    w('');

    emitFootageSection();

    for (var c = 0; c < sorted.length; c++) {
        emitComp(sorted[c], '    ');
    }

    var mainVar = compVarName(sorted[sorted.length - 1]);
    w('    app.endSuppressDialogs(false);');
    w('    return ' + mainVar + ';');
    w('})();');

    // Append effects issues summary as a comment after the closing })();
    emitEffectsSummary();

    // ── Save output file ──────────────────────────────────────────────────────

    var result = lines.join(NL);

    var outFile = new File(outPath);
    outFile.open("w");
    outFile.write(result);
    outFile.close();

    try { app.endSuppressDialogs(false); } catch(e) {}

    return outFile.fsName;

})();
