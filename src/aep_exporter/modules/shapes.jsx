// shapes.jsx — shape layer contents emission
// Depends on: core.jsx (w, q, fmtVal), properties.jsx (emitProperty)

// matchName → addProperty argument string
var SHAPE_ADD = {
    "ADBE Vector Shape - Rect":      '"ADBE Vector Shape - Rect"',
    "ADBE Vector Shape - Ellipse":   '"ADBE Vector Shape - Ellipse"',
    "ADBE Vector Shape - Star":      '"ADBE Vector Shape - Star"',
    "ADBE Vector Graphic - Fill":    '"ADBE Vector Graphic - Fill"',
    "ADBE Vector Graphic - Stroke":  '"ADBE Vector Graphic - Stroke"',
    "ADBE Vector Filter - Repeater": '"ADBE Vector Filter - Repeater"',
    "ADBE Vector Filter - Merge":    '"ADBE Vector Filter - Merge"',
    "ADBE Vector Filter - Offset":   '"ADBE Vector Filter - Offset"',
    "ADBE Vector Filter - Trim":     '"ADBE Vector Filter - Trim"',
    "ADBE Vector Group":             '"ADBE Vector Group"'
};

// Properties to emit per shape item type
var SHAPE_ITEM_PROPS = {
    "ADBE Vector Shape - Rect": [
        "ADBE Vector Rect Size", "ADBE Vector Rect Position", "ADBE Vector Rect Roundness",
        "ADBE Vector Shape Direction"
    ],
    "ADBE Vector Shape - Ellipse": [
        "ADBE Vector Ellipse Size", "ADBE Vector Ellipse Position",
        "ADBE Vector Shape Direction"
    ],
    "ADBE Vector Shape - Star": [
        "ADBE Vector Star Type", "ADBE Vector Star Points",
        "ADBE Vector Star Position", "ADBE Vector Star Rotation",
        "ADBE Vector Star Inner Radius", "ADBE Vector Star Outer Radius",
        "ADBE Vector Star Inner Roundness", "ADBE Vector Star Outer Roundness",
        "ADBE Vector Shape Direction"
    ],
    "ADBE Vector Graphic - Fill": [
        "ADBE Vector Fill Color", "ADBE Vector Fill Opacity",
        "ADBE Vector Blend Mode", "ADBE Vector Composite Order", "ADBE Vector Fill Rule"
    ],
    "ADBE Vector Graphic - Stroke": [
        "ADBE Vector Stroke Color", "ADBE Vector Stroke Opacity",
        "ADBE Vector Stroke Width", "ADBE Vector Blend Mode",
        "ADBE Vector Composite Order", "ADBE Vector Stroke Line Cap",
        "ADBE Vector Stroke Line Join", "ADBE Vector Stroke Miter Limit"
    ],
    "ADBE Vector Filter - Repeater": [
        "ADBE Vector Repeater Copies", "ADBE Vector Repeater Offset",
        "ADBE Vector Repeater Order"
    ],
    "ADBE Vector Filter - Trim": [
        "ADBE Vector Trim Start", "ADBE Vector Trim End",
        "ADBE Vector Trim Offset", "ADBE Vector Trim Type"
    ],
    "ADBE Vector Filter - Merge": [
        "ADBE Vector Merge Type"
    ],
    "ADBE Vector Filter - Offset": [
        "ADBE Vector Offset Amount", "ADBE Vector Offset Line Join",
        "ADBE Vector Offset Miter Limit"
    ]
};

var REPEATER_TF_PROPS = [
    "ADBE Vector Repeater Anchor", "ADBE Vector Repeater Position",
    "ADBE Vector Repeater Scale", "ADBE Vector Repeater Rotation",
    "ADBE Vector Repeater Opacity 1", "ADBE Vector Repeater Opacity 2"
];

var GROUP_TF_PROPS = [
    "ADBE Vector Anchor", "ADBE Vector Position", "ADBE Vector Scale",
    "ADBE Vector Skew", "ADBE Vector Skew Axis", "ADBE Vector Rotation",
    "ADBE Vector Group Opacity"
];

// Two-pass approach (gotcha #1): add all shape children first, then set their values.
// This is required because AE's property indices shift as children are added.
function emitShapeContents(contents, contentsRef, indent) {
    var children = [];
    for (var i = 1; i <= contents.numProperties; i++) {
        try { children.push(contents.property(i)); } catch(e) { children.push(null); }
    }

    // Pass 1: add all children
    for (var i = 0; i < children.length; i++) {
        var ch = children[i];
        if (!ch) continue;
        var mn = ch.matchName || "";
        // Skip Fill if paint type is None (enabled=false = paint=None in AE)
        if (mn === "ADBE Vector Graphic - Fill" && ch.enabled === false) continue;
        if (SHAPE_ADD[mn]) {
            w(indent + contentsRef + '.addProperty(' + SHAPE_ADD[mn] + ');');
        }
    }

    // Pass 2: fetch references by index and set values
    for (var i = 0; i < children.length; i++) {
        var ch = children[i];
        if (!ch) continue;
        var mn = ch.matchName || "";
        if (mn === "ADBE Vector Graphic - Fill" && ch.enabled === false) continue;

        if (mn === "ADBE Vector Group") {
            var grpRef    = contentsRef + '.property(' + (i + 1) + ')';
            var grpContRef = grpRef + '.property("ADBE Vectors Group")';
            var grpTfRef  = grpRef + '.property("ADBE Vector Transform Group")';

            // Group transform
            try {
                var tf = ch.property("ADBE Vector Transform Group");
                for (var t = 0; t < GROUP_TF_PROPS.length; t++) {
                    try {
                        var tp = tf.property(GROUP_TF_PROPS[t]);
                        if (tp) emitProperty(tp, grpTfRef + '.property(' + q(GROUP_TF_PROPS[t]) + ')', indent);
                    } catch(e) {}
                }
            } catch(e) {}

            // Recurse into group contents
            try {
                var grpContents = ch.property("ADBE Vectors Group");
                if (grpContents && grpContents.numProperties > 0) {
                    emitShapeContents(grpContents, grpContRef, indent);
                }
            } catch(e) {}

        } else if (SHAPE_ITEM_PROPS[mn]) {
            var itemRef    = contentsRef + '.property(' + q(mn) + ')';
            var propsToSet = SHAPE_ITEM_PROPS[mn];
            for (var p = 0; p < propsToSet.length; p++) {
                try {
                    var prop = ch.property(propsToSet[p]);
                    if (prop) emitProperty(prop, itemRef + '.property(' + q(propsToSet[p]) + ')', indent);
                } catch(e) {}
            }

            // Repeater transform
            if (mn === "ADBE Vector Filter - Repeater") {
                try {
                    var rtf = ch.property("ADBE Vector Repeater Transform");
                    if (rtf) {
                        var rtfRef = itemRef + '.property("ADBE Vector Repeater Transform")';
                        for (var p = 0; p < REPEATER_TF_PROPS.length; p++) {
                            try {
                                var rp = rtf.property(REPEATER_TF_PROPS[p]);
                                if (rp) emitProperty(rp, rtfRef + '.property(' + q(REPEATER_TF_PROPS[p]) + ')', indent);
                            } catch(e) {}
                        }
                    }
                } catch(e) {}
            }
        }
    }
}
