// transform.jsx — layer transform emission
// Depends on: core.jsx (w, q, SKIP_PROPS), properties.jsx (emitProperty)

// Standard 2D transform properties
var TF_PROPS_2D = [
    "ADBE Anchor Point",
    "ADBE Position",
    "ADBE Scale",
    "ADBE Rotate Z",
    "ADBE Opacity"
];

// Additional 3D-only transform properties
var TF_PROPS_3D = [
    "ADBE Orientation",
    "ADBE Rotate X",
    "ADBE Rotate Y"
];

function emitTransform(layer, layerRef, indent) {
    try {
        var tf = layer.property("Transform");
        if (!tf) return;

        var is3D = false;
        try { is3D = layer.threeDLayer; } catch(e) {}

        var props = TF_PROPS_2D;
        if (is3D) {
            props = TF_PROPS_2D.concat(TF_PROPS_3D);
        }

        for (var i = 0; i < props.length; i++) {
            try {
                var prop = tf.property(props[i]);
                if (!prop) continue;
                emitProperty(prop, layerRef + '.property("Transform").property(' + q(props[i]) + ')', indent);
            } catch(e) {}
        }
    } catch(e) {}
}
