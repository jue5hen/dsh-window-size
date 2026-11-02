# dsh-window-size

**Start DeepSeek Harness Desktop at the window size you want.**

[简体中文](README.md) · [Changelog](CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/dsh-window-size?logo=npm&color=CB3837)](https://www.npmjs.com/package/dsh-window-size)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![validate](https://github.com/jue5hen/dsh-window-size/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/jue5hen/dsh-window-size/actions/workflows/validate.yml)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-4B6EF5.svg)

![Window size settings page](docs/screenshot.png)

DSH Desktop always starts at **1280×820** and does not remember a resized window: `createWindow` hardcodes the size and there is no bounds save/restore logic. This plugin fills that gap — save a startup size in the settings panel and the window is resized during page startup, so the next launch opens at your size.

## Features

- **Startup size**: applies immediately after saving and again on every launch.
- **Ratio presets**: 4:3 / 16:9 / 16:10, one small and one large preset each (six built-ins); a preset is disabled when it exceeds the current screen's available area.
- **Custom presets**: save any valid size, up to 12, removable, persisted across restarts.
- **Live current size**: shows the current window content size and updates as you resize it.
- **Save & apply / Reset**: resize the current window; reset only clears the startup size and keeps custom presets.
- **Desktop-only**: in the browser build the panel is read-only and explains that the feature requires the desktop app.

## Install

Requires DSH Desktop (Electron shell) on a runtime that satisfies `engines.dsh` (`^0.2.1-rc.5`, verified on 0.2.1-rc.5). When the runtime is too old the host rejects the install before pnpm runs and points at the compatibility override.

### From npm (recommended)

The plugin is published on [npm](https://www.npmjs.com/package/dsh-window-size), so the install pulls a prebuilt package: no repository clone, no build scripts.

1. Install it from a DSH session (omit the version to take the latest release):

   ```text
   plugin_manager install_bundle dsh-window-size@1.0.2
   ```

2. **Quit and restart** DSH completely (including the tray process). A restart is required after the first install or any upgrade so the new Client module is loaded.

In the desktop app you can also install it from **Settings → Plugins** by searching for `dsh-window-size`; with a market plugin such as dshmarket installed, search the same name in its store. The desktop profile is owned by the Electron shell, so no command line is involved.

Web profiles (`dsh web`) can use the CLI:

```bash
dsh plugin add dsh-window-size            # default profile; add --profile <name> for another
```

### From source (development)

1. Clone the repository:

   ```bash
   git clone https://github.com/jue5hen/dsh-window-size.git
   ```

2. Install it from a DSH session, using an absolute path on your machine:

   ```text
   plugin_manager install_bundle file:/absolute/path/to/dsh-window-size
   ```

   Windows example: `file:D:/tools/dsh-window-size`.

3. **Quit and restart** DSH completely, as above.

A `file:` install links the whole checkout into the profile and ignores the `files` allowlist (`node_modules/`, screenshots and everything else come along); the npm install only lands package files. Both record the plugin in the `desktop` profile's `package.json` and in `dsh.profile.bundles`. The plugin writes no files and makes no network requests.

## Usage

1. After restarting, open **account menu (bottom-left) → Settings → 窗口大小 / Window Size**.
2. Pick a preset or type a width and height, then click **保存并应用 / Save & apply**.
3. Click **保存为预设 / Save as preset** to keep a size for later; click **×** to remove a custom preset.
4. **恢复默认 / Reset** clears the startup size and returns to the app default **1280×820**, keeping custom presets.

## How it works

A pure Client plugin with minimal impact:

- The Host half `index.js` registers nothing and writes no files: it subscribes to `webserver/index-inject` and pushes one inline boot script.
- That script runs during page boot, before the window is shown, reads `localStorage`, validates the size, calls `window.resizeTo` and centers the window, so the app no longer starts at the default size and jumps. The Client module only owns the settings page, presets and saving.
- `window.resizeTo` sets the **content area** (`innerWidth` / `innerHeight`), matching the app's own `BrowserWindow({ width: 1280, height: 820 })` convention. The outer frame is slightly larger (about 16×8 px on Windows).
- While the window is hidden, `resizeTo` measures the frame differently (ask for `width-frameX × height-frameY`) and `moveTo` is ignored; after the window appears the plugin makes at most 5 centering attempts 350 ms apart, stopping within ±12 px, because repeated `moveTo` calls can trigger Windows maximize.
- The size and presets live only in the local `localStorage['dsh-window-size:v2']`, inside the app data directory. Nothing is uploaded and other plugins are not touched.
- Storage format:

  ```json
  {
    "width": 1280,
    "height": 960,
    "presets": [
      { "width": 1100, "height": 700 }
    ]
  }
  ```

  `width` / `height` may be omitted (use the app default). The legacy `dsh-window-size:v1` shape (`{width,height}`) is still read at startup and migrated to v2 on the first save.
- Frame-measurement fallback: when the window is hidden or minimized, Chromium can report a wrong (even negative) frame delta. The plugin only accepts a sane range and reuses the last valid measurement (falling back to 16×8), so the maximum size is not miscalculated.
- Bounds: minimum **520×600**; maximum is the screen's available area minus the window frame, capped at **10000**.

## Compatibility

- **Verified**: Windows 11, DSH 0.2.1-rc.5, Electron 44.7.0 (Chrome 152), 1920×1032 available screen area.
- **macOS / Linux desktop**: same Electron and DOM APIs; expected to work but not yet tested.
- **Web build**: the plugin loads, but the panel is read-only and explains that the desktop app is required.
- No dependency on other plugins and no changes to the DSH installation.
- Known limit: the very first frame of a cold start can still briefly show the app default size (the shell shows the window at page `load`); removing that entirely would require changing the Electron shell.

## FAQ

**The size did not change after a restart.**
Fully quit and restart DSH after installing or upgrading. Closing the window to the tray is not a restart.

**Why is the outer window larger than the value I entered?**
The value is the content area. On Windows the frame adds about 16 px in width and 8 px in height.

**What is the maximum size?**
The screen's available area minus the frame, hard-capped at 10000. Larger values are rejected with an error.

**Does it affect other plugins?**
No. It only writes its own `localStorage` key and registers one settings page; the Host half registers nothing.

**What is left after uninstalling?**
A leftover key is ignored. Clear the app's site storage if you want it gone completely.

**Does it remember the window position?**
No, only the size. The window is centered on startup, but the position itself is not persisted.

## Development

```text
dsh-window-size/
├─ package.json       bundle manifest (dsh.bundle.patch + dsh.client)
├─ cordis.patch.yml   inserts one dsh-window-size row (Host half)
├─ index.js           Host half: pushes the startup boot script
├─ client.js          Client half: settings page, presets, startup resize
├─ locale/zh.json     panel title/description
├─ locale/en.json
├─ icon.svg
├─ assets/icon-180.png   storefront icon (GitHub-hosted raster)
├─ docs/screenshot.png
├─ screenshots.json      storefront screenshot manifest
├─ scripts/validate.mjs  pre-publish checks (manifest, icon, packed files)
├─ .github/workflows/    validate.yml (CI checks) · publish.yml (npm release)
├─ README.md / README.en.md
├─ CHANGELOG.md
└─ LICENSE
```

Local checks before publishing (syntax, JSON, manifest, icon, and the real `npm pack` file list):

```bash
npm run validate
```

`npm publish` re-runs it through `prepublishOnly`, so a drifting tarball never reaches the registry. `.github/workflows/validate.yml` runs the same checks on every push and pull request; `.github/workflows/publish.yml` verifies that a `v*` tag matches `package.json` and publishes with provenance.

To release: set `package.json` and `CHANGELOG.md` to the same version, commit, then push the tag:

```bash
git tag v1.0.2
git push origin v1.0.2
```

## Version

See [CHANGELOG.md](CHANGELOG.md). Current version: **1.0.2**.

## License

[MIT](LICENSE)
