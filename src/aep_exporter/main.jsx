// main.jsx — entry point IIFE for the AEP-to-JSX exporter
// This is the ONLY file that contains an IIFE wrapper.
// All module code (core, properties, footage, shapes, transform, effects, layers, comps)
// is concatenated before this file by build.sh and runs in the same shared scope.
//
// Usage: run via osascript DoScriptFile on the built bundle (dist/aep_exporter_bundle.jsx)
// Output: <aep_path_without_ext>_generated.jsx

(function () {

    app.beginSuppressDialogs();

    var proj = app.project;
    if (!proj) {
        app.endSuppressDialogs(false);
        throw new Error("No project is open in After Effects.");
    }

    // ── Collect all compositions ──────────────────────────────────────────────

    var allComps = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) allComps.push(item);
    }

    if (allComps.length === 0) {
        app.endSuppressDialogs(false);
        throw new Error("No compositions found in the project.");
    }

    // ── Topological sort (sub-comps before parents) ──────────────────────────

    var sorted = topoSort(allComps);

    // ── Pre-scan footage ──────────────────────────────────────────────────────

    gatherFootage(sorted);

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

    var outPath = "";
    var projFile = proj.file;
    if (projFile) {
        outPath = projFile.fsName.replace(/\.aep$/i, '_generated.jsx');
    } else {
        // Fallback: use a temp path
        outPath = "/tmp/ae_generated.jsx";
    }

    var outFile = new File(outPath);
    outFile.open("w");
    outFile.write(result);
    outFile.close();

    app.endSuppressDialogs(false);

    return outFile.fsName;

})();
