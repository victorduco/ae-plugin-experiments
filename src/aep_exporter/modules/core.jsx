// core.jsx — shared state, helpers, registries, constants
// NOTE: No IIFE wrapper. All declarations go into the single shared scope created by main.jsx.

var NL = "\n";
var lines = [];
function w(s) { lines.push(s); }

function q(s) {
    return '"' + ("" + s)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r") + '"';
}

function fmtVal(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return isFinite(v) ? ("" + v) : "0";
    if (typeof v === "string") return q(v);
    if (typeof v === "object" && typeof v.length === "number") {
        var parts = [];
        for (var i = 0; i < v.length; i++) parts.push(fmtVal(v[i]));
        return "[" + parts.join(", ") + "]";
    }
    return q("" + v);
}

function safeVal(prop) {
    var pt = prop.propertyValueType;
    if (pt === PropertyValueType.NO_VALUE)      return null;
    if (pt === PropertyValueType.CUSTOM_VALUE)  return null;
    if (pt === PropertyValueType.MARKER)        return null;
    if (pt === PropertyValueType.TEXT_DOCUMENT) return null;
    try { return prop.valueAtTime(0, false); } catch(e) { return null; }
}

function safeKeyVal(prop, k) {
    try { return prop.keyValue(k); } catch(e) { return null; }
}

// ─── footage registry ────────────────────────────────────────────────────────
var footageVars = {};
var footageLines = [];

// ─── comp registry ───────────────────────────────────────────────────────────
var compVars = {};

// ─── deferred track matte pairs ──────────────────────────────────────────────
var mattePairs = [];

// ─── deferred parent links ───────────────────────────────────────────────────
// Each entry: { ref, parentIndex, compRef }
var parentLinks = [];

// ─── effects extraction log ──────────────────────────────────────────────────
// Each entry: {compName, layerName, effectName, effectMN, failedProps[], note}
var effectsLog = [];

// ─── skip lists ──────────────────────────────────────────────────────────────
var SKIP_GROUPS = { "ADBE Vector Materials Group": true };

var SKIP_PROPS = {
    "ADBE Position_0": true,
    "ADBE Position_1": true,
    "ADBE Position_2": true,
    "ADBE Envir Appear in Reflect": true
    // NOTE: 3D rotation/orientation are NOT globally skipped here anymore.
    // layers.jsx checks layer.threeDLayer and skips them only for 2D layers.
};

// ─── track matte types ───────────────────────────────────────────────────────
var MATTE_TYPES = {};
MATTE_TYPES[TrackMatteType.NO_TRACK_MATTE] = null;
MATTE_TYPES[TrackMatteType.ALPHA]          = "TrackMatteType.ALPHA";
MATTE_TYPES[TrackMatteType.ALPHA_INVERTED] = "TrackMatteType.ALPHA_INVERTED";
MATTE_TYPES[TrackMatteType.LUMA]           = "TrackMatteType.LUMA";
MATTE_TYPES[TrackMatteType.LUMA_INVERTED]  = "TrackMatteType.LUMA_INVERTED";

// ─── blend modes (all AE modes) ──────────────────────────────────────────────
var BLEND_MODES = {};
BLEND_MODES[BlendingMode.NORMAL]         = "BlendingMode.NORMAL";
BLEND_MODES[BlendingMode.DISSOLVE]       = "BlendingMode.DISSOLVE";
BLEND_MODES[BlendingMode.DANCING_DISSOLVE] = "BlendingMode.DANCING_DISSOLVE";
BLEND_MODES[BlendingMode.DARKEN]         = "BlendingMode.DARKEN";
BLEND_MODES[BlendingMode.MULTIPLY]       = "BlendingMode.MULTIPLY";
BLEND_MODES[BlendingMode.COLOR_BURN]     = "BlendingMode.COLOR_BURN";
BLEND_MODES[BlendingMode.CLASSIC_COLOR_BURN] = "BlendingMode.CLASSIC_COLOR_BURN";
BLEND_MODES[BlendingMode.LINEAR_BURN]    = "BlendingMode.LINEAR_BURN";
BLEND_MODES[BlendingMode.DARKER_COLOR]   = "BlendingMode.DARKER_COLOR";
BLEND_MODES[BlendingMode.ADD]            = "BlendingMode.ADD";
BLEND_MODES[BlendingMode.LIGHTEN]        = "BlendingMode.LIGHTEN";
BLEND_MODES[BlendingMode.SCREEN]         = "BlendingMode.SCREEN";
BLEND_MODES[BlendingMode.COLOR_DODGE]    = "BlendingMode.COLOR_DODGE";
BLEND_MODES[BlendingMode.CLASSIC_COLOR_DODGE] = "BlendingMode.CLASSIC_COLOR_DODGE";
BLEND_MODES[BlendingMode.LINEAR_DODGE]   = "BlendingMode.LINEAR_DODGE";
BLEND_MODES[BlendingMode.LIGHTER_COLOR]  = "BlendingMode.LIGHTER_COLOR";
BLEND_MODES[BlendingMode.OVERLAY]        = "BlendingMode.OVERLAY";
BLEND_MODES[BlendingMode.SOFT_LIGHT]     = "BlendingMode.SOFT_LIGHT";
BLEND_MODES[BlendingMode.HARD_LIGHT]     = "BlendingMode.HARD_LIGHT";
BLEND_MODES[BlendingMode.LINEAR_LIGHT]   = "BlendingMode.LINEAR_LIGHT";
BLEND_MODES[BlendingMode.VIVID_LIGHT]    = "BlendingMode.VIVID_LIGHT";
BLEND_MODES[BlendingMode.PIN_LIGHT]      = "BlendingMode.PIN_LIGHT";
BLEND_MODES[BlendingMode.HARD_MIX]       = "BlendingMode.HARD_MIX";
BLEND_MODES[BlendingMode.DIFFERENCE]     = "BlendingMode.DIFFERENCE";
BLEND_MODES[BlendingMode.CLASSIC_DIFFERENCE] = "BlendingMode.CLASSIC_DIFFERENCE";
BLEND_MODES[BlendingMode.EXCLUSION]      = "BlendingMode.EXCLUSION";
BLEND_MODES[BlendingMode.SUBTRACT]       = "BlendingMode.SUBTRACT";
BLEND_MODES[BlendingMode.DIVIDE]         = "BlendingMode.DIVIDE";
BLEND_MODES[BlendingMode.HUE]            = "BlendingMode.HUE";
BLEND_MODES[BlendingMode.SATURATION]     = "BlendingMode.SATURATION";
BLEND_MODES[BlendingMode.COLOR]          = "BlendingMode.COLOR";
BLEND_MODES[BlendingMode.LUMINOSITY]     = "BlendingMode.LUMINOSITY";
BLEND_MODES[BlendingMode.STENCIL_ALPHA]  = "BlendingMode.STENCIL_ALPHA";
BLEND_MODES[BlendingMode.STENCIL_LUMA]   = "BlendingMode.STENCIL_LUMA";
BLEND_MODES[BlendingMode.SILHOUETTE_ALPHA] = "BlendingMode.SILHOUETTE_ALPHA";
BLEND_MODES[BlendingMode.SILHOUETTE_LUMA]  = "BlendingMode.SILHOUETTE_LUMA";
BLEND_MODES[BlendingMode.ALPHA_ADD]      = "BlendingMode.ALPHA_ADD";
BLEND_MODES[BlendingMode.LUMINESCENT_PREMUL] = "BlendingMode.LUMINESCENT_PREMUL";
