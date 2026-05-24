// footage.jsx — footage/solid registration and import emission
// Depends on: core.jsx (footageVars, footageLines, compVars, q, w)

function compVarName(item) {
    if (compVars[item.id]) return compVars[item.id];
    var vname = "comp_" + item.id;
    compVars[item.id] = vname;
    return vname;
}

function registerFootage(item) {
    if (footageVars[item.id]) return footageVars[item.id];
    var vname = "footage_" + item.id;
    footageVars[item.id] = vname;
    // Solids are created inline via addSolid() — no import needed
    if (item.mainSource instanceof SolidSource) return vname;
    var path = "";
    try { path = item.file ? item.file.fsName : ""; } catch(e) {}
    if (path) {
        footageLines.push('    var ' + vname + ' = app.project.importFile(new ImportOptions(new File(' + q(path) + ')));');
        footageLines.push('    ' + vname + '.name = ' + q(item.name) + ';');
    }
    return vname;
}

function emitFootageSection() {
    if (footageLines.length === 0) return;
    w('    // ── footage imports ──────────────────────────────────────────────');
    for (var i = 0; i < footageLines.length; i++) w(footageLines[i]);
    w('');
}
