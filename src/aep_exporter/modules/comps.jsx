// comps.jsx — composition creation, topological sort, deferred track matte assignment
// Depends on: core.jsx (w, q, fmtVal, mattePairs)
//             footage.jsx (registerFootage, compVarName)
//             layers.jsx (emitLayer)

// Scan all comps and register non-solid footage items before emitting.
function gatherFootage(sorted) {
    for (var c = 0; c < sorted.length; c++) {
        var comp = sorted[c];
        for (var li = 1; li <= comp.numLayers; li++) {
            try {
                var layer = comp.layer(li);
                var src   = layer.source;
                if (src && !(src instanceof CompItem) && src.mainSource && !(src.mainSource instanceof SolidSource)) {
                    registerFootage(src);
                }
            } catch(e) {}
        }
    }
}

// Return the IDs of all comp sources used as layers in this comp.
function getCompDeps(comp) {
    var deps = [];
    for (var li = 1; li <= comp.numLayers; li++) {
        try {
            var src = comp.layer(li).source;
            if (src instanceof CompItem) deps.push(src.id);
        } catch(e) {}
    }
    return deps;
}

// Topological sort: sub-comps before their parents.
function topoSort(allComps) {
    var sorted  = [];
    var visited = {};

    function visit(comp) {
        if (visited[comp.id]) return;
        visited[comp.id] = true;
        var deps = getCompDeps(comp);
        for (var d = 0; d < deps.length; d++) {
            for (var c = 0; c < allComps.length; c++) {
                if (allComps[c].id === deps[d]) { visit(allComps[c]); break; }
            }
        }
        sorted.push(comp);
    }

    for (var c = 0; c < allComps.length; c++) visit(allComps[c]);
    return sorted;
}

// Emit a single composition: create it, then emit all layers in reverse order.
// Layers are emitted bottom-to-top because add/addShape always inserts at top of stack.
function emitComp(comp, indent) {
    var vname = compVarName(comp);

    w(indent + '// === COMP: ' + comp.name + ' ===');
    w(indent + 'var ' + vname + ' = app.project.items.addComp(' +
        q(comp.name) + ', ' + comp.width + ', ' + comp.height + ', ' +
        comp.pixelAspect + ', ' + fmtVal(comp.duration) + ', ' + comp.frameRate + ');');

    // Motion blur sample limit (only emit if non-default or any layer uses MB)
    if (comp.motionBlurAdaptiveSampleLimit !== 16) {
        w(indent + vname + '.motionBlurAdaptiveSampleLimit = ' + comp.motionBlurAdaptiveSampleLimit + ';');
    } else {
        for (var li = 1; li <= comp.numLayers; li++) {
            try {
                if (comp.layer(li).motionBlur) {
                    w(indent + vname + '.motionBlurAdaptiveSampleLimit = 16;');
                    break;
                }
            } catch(e) {}
        }
    }

    // Emit layers in REVERSE order so final stack order is correct
    mattePairs  = [];
    parentLinks = [];

    for (var li = comp.numLayers; li >= 1; li--) {
        try {
            emitLayer(comp.layer(li), vname, indent);
        } catch(e) {}
    }

    // Apply track mattes after all layers exist
    for (var m = 0; m < mattePairs.length; m++) {
        w(indent + mattePairs[m].ref + '.trackMatteType = ' + mattePairs[m].type + ';');
    }

    // Apply parent links after all layers exist
    for (var p = 0; p < parentLinks.length; p++) {
        var pl = parentLinks[p];
        w(indent + pl.ref + '.parent = ' + pl.compRef + '.layer(' + pl.parentIndex + ');');
    }

    w('');
}
