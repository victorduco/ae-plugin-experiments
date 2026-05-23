---
name: ae-cep-panel
description: How to create, install and debug CEP panels in After Effects 2026 (AE 26.x). Includes gotchas found the hard way.
---

# CEP Panels in After Effects 2026

## Key facts

- AE 26.x uses **CEP 12** (`com.adobe.CSXS.12`)
- **UXP is NOT available in AE 26** — only in Photoshop/Premiere. Don't waste time on UXP for AE.
- **UXP Developer Tool does not support AE** — "App not supported" error, useless for AE.
- CEP panels appear under **Window → Extensions** in AE.

---

## Correct folder structure

```
~/Library/Application Support/Adobe/CEP/extensions/com.your.extensionid/
├── csxs/               ← lowercase! macOS is case-sensitive
│   └── manifest.xml
└── index.html
```

**Gotcha #1: folder name `csxs` must be lowercase.** AE scans for `csxs/manifest.xml` — uppercase `CSXS/` is ignored silently.

**Gotcha #2: extension folder name should match the `ExtensionBundleId`** in manifest.xml. Use `com.your.extensionid` not a short name like `my-panel`.

---

## manifest.xml — correct working structure for AE 26

Copy this exactly — every structural detail matters:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="7.0"
  ExtensionBundleId="com.your.extensionid"
  ExtensionBundleVersion="1.0.0"
  ExtensionBundleName="My Panel"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <ExtensionList>
    <Extension Id="com.your.extensionid.panel" />   <!-- no Version attribute -->
  </ExtensionList>

  <ExecutionEnvironment>
    <HostList>
      <Host Name="AEFT" Version="[22,99.9]" />
    </HostList>
    <LocaleList>
      <Locale Code="All" />
    </LocaleList>
    <RequiredRuntimeList>
      <RequiredRuntime Name="CSXS" Version="11.0" />
    </RequiredRuntimeList>
  </ExecutionEnvironment>

  <DispatchInfoList>
    <Extension Id="com.your.extensionid.panel">
      <HostList>                        <!-- REQUIRED: inside <Extension>, BEFORE <DispatchInfo> -->
        <Host Name="AEFT" />            <!-- no Version attribute here -->
      </HostList>
      <DispatchInfo>
        <Resources>
          <MainPath>./index.html</MainPath>
        </Resources>
        <Lifecycle>
          <AutoVisible>true</AutoVisible>
        </Lifecycle>
        <UI>
          <Type>Panel</Type>
          <Menu>My Panel</Menu>
          <Geometry>
            <Size>                      <!-- use <Size>, not <PreferredSize> -->
              <Height>800</Height>
              <Width>500</Width>
            </Size>
            <MinSize>
              <Height>200</Height>
              <Width>300</Width>
            </MinSize>
          </Geometry>
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>

</ExtensionManifest>
```

**Gotcha #3: `HostList` must be inside `<Extension>` tag, BEFORE `<DispatchInfo>`.** Without it AE logs `"doesn't have a specific HostList"` and silently removes the extension.

**Gotcha #4: `HostList` inside `<Extension>` uses `<Host Name="AEFT" />` with no Version attribute.**

**Gotcha #5: Use `<Size>` not `<PreferredSize>` in Geometry.** `<PreferredSize>` is silently ignored.

**Gotcha #6: `<Extension Id>` in `ExtensionList` should have no `Version` attribute.**

---

## Enabling debug mode (unsigned extensions)

AE 26 requires `PlayerDebugMode = 1` to load unsigned extensions. Run both commands:

```bash
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
killall -u `whoami` cfprefsd
```

Verify it stuck:
```bash
defaults read com.adobe.CSXS.12 PlayerDebugMode
# must print: 1
```

**Gotcha #7: `killall cfprefsd` is mandatory.** macOS caches plist values — without killing the daemon AE reads the old value even after `defaults write`.

**Gotcha #8: `LogLevel: 1` in the CEP log does NOT mean debug mode failed.** LogLevel is logging verbosity (1 = errors only), unrelated to `PlayerDebugMode`. To enable verbose logging:
```bash
defaults write com.adobe.CSXS.12 LogLevel 6 && killall -u `whoami` cfprefsd
```

---

## Where AE scans for extensions

AE 26 scans these paths in order:
1. `/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/Resources` — bundled
2. `/Library/Application Support/Adobe/CEP/extensions` — system-wide (requires sudo)
3. `~/Library/Application Support/Adobe/CEP/extensions` — user (use this for development)

---

## Debugging with the CEP log

```
~/Library/Logs/CSXS/CEP12-AEFT.log
```

Key patterns to grep:
```bash
grep -i "googlepanel\|your.extensionid" ~/Library/Logs/CSXS/CEP12-AEFT.log
```

What to look for:
- `Adding extension with id '...'` — success
- `doesn't have a specific HostList` → missing `<HostList>` inside `<Extension>` in `DispatchInfoList`
- `Removing ... because it is incomplete` + `Missing DispatchInfo` → `<DispatchInfo>` not found, usually XML structure issue
- `contains '0' valid extensions` → manifest parsed but no extension matched the host

---

## iframe in CEP

Standard `<iframe>` works in CEP panels. Many sites (Google, ChatGPT) block iframe via `X-Frame-Options` — panel loads but shows blank. This is a site restriction, not a CEP issue.
