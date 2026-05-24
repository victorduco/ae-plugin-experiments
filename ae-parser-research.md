Reverse Engineering and Data Extraction from Adobe After Effects AEP Files
Bottom line
If the requirement is extraction without launching After Effects, the strongest public option I found in 2026 is forticheprod/py-aep. It parses binary .aep files directly, models a large portion of the After Effects object model in Python, and explicitly exposes compositions, layers, effects, properties, keyframes, markers, shapes, text data, and render-queue structures. Its documentation also states that it can read, modify, and save .aep files, and its latest public release is dated May 22, 2026, which makes it the clearest sign of an actively maintained no-AE parser in the public ecosystem.

If the requirement is maximum fidelity, launching After Effects is still the most reliable route. Adobe’s own scripting API gives access to the project, compositions, layers, effect property groups, keyframes, expressions, and property values through the live object model, which is why JSX / ExtendScript exporters such as ae-to-json still matter. Static parsing can recover a great deal from the file, but it cannot reproduce everything the runtime knows.

The central obstacle is plugin-specific serialization. Adobe’s C++ SDK makes clear that effect plug-ins can flatten custom sequence data and arbitrary data into byte blobs for storage in the project file, effectively creating their own mini file formats. Adobe also documents that plug-ins may keep some project-specific state in preferences rather than in the project file at all. In practice, this means a universal decoder for every third-party effect is not realistic unless you reverse engineer each plug-in individually.

So the practical conclusion is straightforward: binary .aep extraction is now genuinely possible without AE for a large subset of project structure and animation data, but not for the entire semantic state of every effect plug-in and not for runtime-only behavior such as evaluated expressions.

What the formats really expose
Adobe’s official documentation still treats .aep as the primary project format and .aepx as an XML copy for intermediate automation workflows. Adobe explicitly says that .aep is a binary project file, while .aepx is a text-based XML project file. It also says that .aepx contains some information as hexadecimal-encoded binary data, while only part of the project is surfaced as human-readable strings. Adobe specifically lists marker attributes, source footage file paths, and composition / footage / layer / folder names and comments as fields you can meaningfully edit in XML. Adobe also warns not to use .aepx as the primary format.

That point matters because it answers a common misconception: .aepx is not a fully transparent schema for the project. Adobe says some strings are readable, but also notes that certain string edits, such as workspace and view names, are ignored when the project is reopened. Community discussions from the CS4 era and later Adobe forums line up with that: users observed that .aepx leaves significant information encoded or opaque, and long-time AE users specifically called out custom plug-in controls as data that would remain binary even inside the XML flavor.

For binary .aep, the public reverse-engineering consensus is not “protobuf” or another off-the-shelf schema, but a big-endian RIFF-family container. The older Go parser boltframe/aftereffects-aep-parser states that .aep files are encoded as RIFX, and includes a Kaitai-style schema showing chunk types such as LIST, cdta, idta, fdta, and Utf8. The newer py-aep documentation independently describes .aep as a binary RIFX format and ships chunk-inspection tools for reverse engineering the structure. In other words, the public evidence I found consistently points to a proprietary chunked RIFX container, not protobuf.

Adobe’s scripting documentation explains what the live application can expose once the project is open. The Project object represents the entire project. Layers are subclasses of property groups. Effect groups are identifiable through PropertyBase.isEffect; effects and masks are indexed property groups; properties have stable matchName identifiers; properties expose expression strings, whether expressions are enabled, the number of keyframes, keyframe times, and keyframe values; and in AE 26.0 Adobe added propertyParameters for reading dropdown-menu strings from certain effect and layer properties. That means the live scripting API is still the reference model for “what exists” in a project, even when a static parser mirrors part of it.

A minimal official AEPX workflow is also scriptable from within AE:

jsx
Copy
app.project.save("myproject.aepx");
Adobe community staff confirmed that saving with an .aepx extension writes XML. That is still useful in 2026 when you want a one-time XML copy for diffing or path surgery.

Open-source approaches that actually work
Static binary parsers without After Effects
The most important project here is forticheprod/py-aep. Its README says it parses .aep directly and returns an API close to ExtendScript, covering items, layers, effects, and properties. Its docs describe a hierarchy with Project, CompItem, multiple layer classes, PropertyGroup, Property, Keyframe, MarkerValue, Shape, text objects, sources, and render queue objects. It also ships CLI tools that are unusually useful for real reverse engineering work: aep-compare can diff chunk trees or hex-dump individual chunks; aep-visualize can emit structure as DOT, Mermaid, or JSON; and aep-validate compares a parsed project against reference JSON exported from ExtendScript. That last point is especially valuable because it gives you a concrete validation loop between static parsing and Adobe’s runtime truth.

A simple py-aep pattern looks like this:

python
Copy
import py_aep

app = py_aep.parse("project.aep")
project = app.project
for comp in project.compositions:
print(comp.name, comp.frame_rate, len(comp.layers))
This is directly in line with the documented API shape for py-aep, which models projects, comps, layers, properties, and keyframes.

The second important project is boltframe/aftereffects-aep-parser, which is older but still valuable as a public RE reference. It describes itself as an unofficial parser for .aep, explains the RIFX framing, and includes a compact chunk taxonomy that remains useful for reverse-engineering unknown fields. It is not the most complete extractor in 2026, but it is still a good “format anatomy” source and it influenced later work. Community discussion in 2023 explicitly described it as useful but dated, which matches its last visible update in 2022.

The third useful line of work is Matt Basaglia’s AEP reverse-engineering effort. In the aftereffects-project-research issue, Basaglia says he documented discoveries on the AEP format, focused on .aep, and wrote aep_dump.py to export an AEP file into YAML while destructuring binary chunks into more useful data. He explicitly says he managed to extract a lot of layer types, shapes, keyframes, and other structures. Separately, on Stack Overflow he points users to python-lottie for rudimentary AEP parsing support, and the py-aep maintainer later commented there that Basaglia’s documentation helped while building a different parser focused on mirroring ExtendScript. That is exactly the kind of obscure-but-useful research lineage you asked for: not the cleanest production tool, but highly relevant proof-of-concept work.

AEPX and XML readers
If you can get a .aepx, actumn/aepx.js is still a relevant lightweight reader: the repository is explicitly described as parsing an After Effects XML project file into readable JSON. Its own README also tells users to prefer boltframe/aftereffects-aep-parser for broader work, which is a good sign that aepx.js is mostly a focused legacy utility rather than the current center of gravity.

The catch is Adobe’s own documentation: .aepx only surfaces some project information clearly, while much remains hex-encoded binary, and Adobe only blesses a narrow class of edits as reliable. So .aepx readers are useful for paths, markers, names, comments, and some selective batch edits, but they are not a full substitute for either static .aep parsing or live AE scripting.

AE-launched exporters and narrow extraction tools
For workflows where launching AE is acceptable, Experience-Monks/ae-to-json remains one of the clearest open-source examples of exporting project state through the scripting engine. Its README says the purpose is to export After Effects files as JSON-like objects, standardize AE-to-JSON exporters, and support renderers built on top of that JSON. It can run via the after-effects Node module or directly inside AE’s scripting tools. This is not static extraction, but it is still one of the most faithful ways to serialize project data into a machine-readable structure.

There is also a family of narrow but real exporters that matter because they show how people operationalize AE data extraction in practice. after-effects-to-blender-export exports animated comp layer data to Blender and explicitly bakes transforms and expression-driven values over a selected time range when direct import is not possible. AE-export-tracking-data exports tracked null-layer motion to JSON, including frame rate, layer IDs, layer names, and per-frame positions. ae-export-curves exports After Effects curves to JSON and supports bezier, hold, and linear keyframe types, though it does not support colors or spatial properties. AEToolbox includes JSON and XML export for selected keyframes. These are not general .aep parsers, but they are excellent examples of working extraction workflows for specific data families.

There is also a separate exporter ecosystem around Bodymovin / Lottie. Lottie’s own docs explain that the AE plugin exports compositions to JSON, but only for a subset of AE features. The wiki lists expressions as partial, 3D layers as no/partial depending on renderer, and supported effects as a short list that includes Drop Shadow, Fill, Levels, Tint, Tritone, partial Stroke, and Gaussian Blur. The Expressions page also explains a concrete workaround: expressions can be baked to keyframes. This makes Bodymovin useful as an extractor for a well-behaved subset of motion design projects, but not as a universal project serializer.

Practical workflows that are realistic in 2026
Pure no-AE extraction
If you must not launch After Effects, the most robust public pipeline I found is:

Run py-aep on the binary .aep.
Use aep-visualize for comp/layer/property topology.
Use aep-compare --list and --dump to inspect unknown chunks.
If the file is version-mismatched, run AEP-Downgrader or at least determine the exact saved version with aftereffects-version-check before further parsing.
A compact reverse-engineering loop looks like this:

bash
Copy
aep-visualize project.aep --format json > structure.json
aep-compare project.aep --list
aep-compare project.aep --dump "LIST:Fold/LIST:Layr/ldta"
py-aep documents these commands specifically for project structure inspection and reverse engineering of unknown binary fields.

This path can recover a lot of what you asked for: composition structure, layers, many effect/property trees, parameter values, keyframes, markers, shapes, text data, and metadata stored in the project file itself. The main caveats are evaluated expressions, runtime-only attributes, and vendor-specific plug-in blobs.

One-time AE-assisted extraction, then offline processing
If you are allowed to launch AE once, the highest-confidence workflow is hybrid:

Open the project in AE.
Save an .aepx copy.
Run a JSX / ExtendScript exporter such as ae-to-json or your own script over the live object model.
Use the exported JSON as a reference dataset for validating a static parser or for building downstream automation.
This is attractive because Adobe’s scripting APIs expose the project, layers, effect groups, expressions, numKeys, keyTime(), and keyValue() from the live app. You can therefore extract lists of effects, parameter trees, raw expression strings, and keyframes more faithfully than with pure file surgery. Then the .aepx copy helps with path substitutions, string-level diffs, and human inspection.

Subset-export pipelines for automation
For rendering pipelines, web delivery, or DCC interchange, people often avoid parsing the full project and instead export only the data they need. The public examples are consistent: ae-to-json exports project data; after-effects-to-blender-export exports layers and bakes difficult transforms; AE-export-tracking-data exports motion-tracking JSON; and Bodymovin bakes supported compositions to Lottie JSON, with a report feature that flags unsupported constructs. That means a lot of real-world AE automation uses targeted exporters, not full-format reverse engineering.

Damaged or version-mismatched projects
For broken project situations, the strongest public workflow is also hybrid. Adobe documents Auto-Save behavior, including save intervals, number of versions, and save locations, so Auto-Save versions are the first recovery source. If the failure is version mismatch rather than corruption, aftereffects-version-check can determine the saved AE version from header bytes, and AEP-Downgrader provides a no-AE downgrade path with ongoing 2026 updates and explicit support for AE 26.x detection. A recent Reddit thread from the tool’s author claims successful downgrades from 25.x to 24.x and 23.x on real projects, while acknowledging niche edge cases and the need for broader testing.

Hard limits and failure modes
The first hard limit is expression evaluation. py-aep is very explicit here: when an expression is enabled, the stored property value is the last static or keyframed value in the binary file, not the evaluated expression result. It also says expression errors are runtime-only and are not stored in the binary project. Adobe’s own scripting docs describe expressions as runtime value generators, which matches that limitation. So you can extract expression source strings without AE, but not the result of the expression engine.

The second hard limit is runtime-only application state. py-aep explicitly lists examples that cannot be derived from the .aep alone: installed effects, installed fonts, render template lists, dirty state, selection state, current viewer state, and other live host attributes. It also notes that canSetExpression is not stored in the file and is decided by AE at runtime from the layer/property context. This is one of the clearest public statements of what remains impossible in no-AE extraction.

The third hard limit is opaque or custom plug-in state. Adobe’s SDK says sequence data and arbitrary data must be flattened for storage, which means the semantic meaning of those bytes is defined by the plug-in author. Adobe also documents that some project-specific data can be stored in preferences outside the project file through the Persistent Data Suite. Separately, an Adobe employee explained on the community forum that scripting does not expose opaque effect settings that are not represented as Timeline properties. Put those together and the conclusion is strong: you cannot count on recovering every effect’s internal state from .aep unless the parser knows that effect’s serialization and the data actually lives in the project file.

The fourth limit is what .aepx does and does not buy you. Adobe does not say that a same-version .aep → .aepx copy intentionally discards core project semantics, and I did not find a primary source claiming a systematic semantic-loss conversion for ordinary same-version save-as-XML. What Adobe does say is that much data remains hex-encoded binary, only certain fields are reliably editable in text, some string edits are ignored, and .aepx should not be your primary working format. Community discussion adds that file sizes can become very large and plug-ins with custom controls may still leave uneditable binary islands. So the right framing is not “AEPX loses everything,” but rather “AEPX only exposes part of the project in a convenient form.”

The fifth limit is version skew. Adobe states that when you save a copy for the previous major version, features from the current version that are used in the project are ignored in the older-format copy. AEP-Downgrader likewise labels some older targets as experimental, and its 2026 release notes distinguish more stable targets from lower-version paths that may require extra validation. In short, version conversion is useful, but not semantically neutral.

Recommendations and complexity assessment
The best approaches in 2026 separate into four tiers.

The best no-AE pipeline is: py-aep first, then chunk-level RE with aep-compare, then targeted plug-in reverse engineering only if genuinely necessary. This is the only public route I found that is both broad in scope and clearly active in 2026. It is the one I would choose for extracting composition structure, layer trees, many effect/property lists, parameter values, keyframes, markers, expressions-as-strings, and project metadata from .aep without opening After Effects.

The best high-fidelity pipeline is: open in AE, export JSON through ExtendScript, optionally save .aepx, then validate or post-process offline. This is more operationally annoying, but it remains the most faithful way to extract what AE actually sees, especially for effect property trees and keyframes exposed in the live object model.

The best rescue pipeline is: Auto-Save → version detect → downgrade/retarget → XML copy if the file opens. Adobe’s Auto-Save settings, the no-AE aftereffects-version-check header parser, and the newer AEP-Downgrader together make this a realistic recovery strategy for a surprising number of “wrong version / won’t open” cases.

The best subset-export pipeline is: use narrow exporters when the downstream consumer is specific. Blender, tracking JSON, curve export, or Lottie export are all much easier problems than decoding arbitrary .aep internals. For production automation, those narrower routes are often more reliable than full project extraction.

The practical answer to your “what really works in 2026” question is this:

Works today without AE: py-aep, aftereffects-version-check, AEP-Downgrader, older boltframe parser, Basaglia’s aep_dump.py research path.
Works today with AE: ExtendScript/JSX over the live object model, ae-to-json, AEPX save/export, narrow exporters like Blender/tracking/curve tools, and Bodymovin for supported feature subsets.
Still fundamentally hard: evaluated expressions, opaque effect internals, vendor-defined flattened data, and any project state that lives in AE runtime or outside the project file.
My overall complexity estimate for true reverse engineering of .aep is high. The container structure is now public enough to navigate, and broad extraction is finally realistic, but the format is still undocumented, version-sensitive, and deeply entangled with AE runtime behavior and plug-in-defined serialization. If your goal is “get most comps/layers/effects/keyframes/expressions and metadata out of real projects,” the problem is now solvable. If your goal is “decode every possible project including arbitrary third-party effect state with semantic fidelity,” it is still a long-tail reverse-engineering problem rather than a finished engineering task.
