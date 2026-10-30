# dsh-window-size

**Start DeepSeek Harness Desktop at the window size you want.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![validate](https://github.com/jue5hen/dsh-window-size/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/jue5hen/dsh-window-size/actions/workflows/validate.yml)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-4B6EF5.svg)

![Window size settings page](docs/screenshot.png)

DSH Desktop always starts at **1280×820** and does not remember a resized window: `createWindow` hardcodes the size and there is no bounds save/restore logic. This plugin fills that gap — save a startup size in the settings panel and the window is resized during page startup, so the next launch opens at your size.

[Chinese README](README.md)

## Features

- **Startup size**: applies immediately after saving and again on every launch.
- **Ratio presets**: 4:3 / 16:9 / 16:10, one small and one large preset each (six built-ins); a preset is disabled when it exceeds the current screen's available area.
- **Custom presets**: save any valid size, up to 12, removable, persisted across restarts.
- **Live current size**: shows the current window content size and updates as you resize it.
- **Save & apply / Reset**: resize the current window; reset only clears the startup size and keeps custom presets.
- **Desktop-only**: in the browser build the panel is read-only and explains that the feature requires the desktop app.

## Install

Requires DSH Desktop (Electron shell); tested on **0.2.1-rc.5**.

1. Clone the repository:

   ```bash
   git clone https://github.com/jue5hen/dsh-window-size.git
   ```

2. Install it from a DSH session, using an absolute path on your machine:

   ```text
   plugin_manager install_bundle file:/absolute/path/to/dsh-window-size
   ```

   Windows example: `file:D:/tools/dsh-window-size`.

3. **Quit and restart** DSH completely (including the tray process). A restart is required after the first install or any upgrade so the new Client module is loaded.

The install records the plugin as a `file:` dependency in the `desktop` profile and adds it to `dsh.profile.bundles`. The plugin writes no files and makes no network requests.

## Usage

1. After restarting, open **account menu (bottom-left) → Settings → 窗口大小 / Window Size**.
2. Pick a preset or type a width and height, then click **保存并应用 / Save & apply**.
3. Click **保存为预设 / Save as preset** to keep a size for later; click **×** to remove a custom preset.
4. **恢复默认 / Reset** clears the startup size and returns to the app default **1280×820**, keeping custom presets.

## How it works

A pure Client plugin with minimal impact:

- The Host half `index.js` is an empty `apply()` — no services, no config, no file writes.
- The Client module reads `localStorage` in `apply()` and calls `window.resizeTo(width, height)` after validation; saving writes the value back.
- `window.resizeTo` sets the **content area** (`innerWidth` / `innerHeight`), matching the app's own `BrowserWindow({ width: 1280, height: 820 })` convention. The outer frame is slightly larger (about 16×8 px on Windows).
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
No, only the size.

## Development

```text
dsh-window-size/
├─ package.json       bundle manifest (dsh.bundle.patch + dsh.client)
├─ cordis.patch.yml   inserts one dsh-window-size row (Host half)
├─ index.js           Host half: empty apply()
├─ client.js          Client half: settings page, presets, startup resize
├─ locale/zh.json     panel title/description
├─ locale/en.json
├─ icon.svg
├─ docs/screenshot.png
├─ README.md / README.en.md
├─ CHANGELOG.md
└─ LICENSE
```

Local checks before committing:

```bash
node --check client.js
node --check index.js
node -e "for (const f of ['package.json','locale/zh.json','locale/en.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"
```

GitHub Actions (`.github/workflows/validate.yml`) runs the same checks on every push and pull request.

## Version

See [CHANGELOG.md](CHANGELOG.md). Current version: **1.1.1**.

## License

[MIT](LICENSE)
