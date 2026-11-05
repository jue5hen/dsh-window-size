/**
 * dsh-window-size — Client half.
 *
 * The Host-injected boot script (index.js) applies the startup size and
 * position before first paint and keeps the last size/position in
 * localStorage while the app runs; this Client half adds the settings page.
 *
 *  - a settings page edits the startup size, startup mode and position policy;
 *  - the same record is what the boot script reads on the next start.
 *
 * One record under `dsh-window-size:v2`; the old v1 shape `{width,height}` is
 * still read and migrated on the next write.
 *
 * No Host service, no IPC, no files. Removing the bundle removes the page and
 * stops the startup resize; the app falls back to its built-in 1280×820.
 */
window.__ModuleLoader__.load({
  id: "dsh-window-size",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useEffect, useState } = React;

    const NS = "dsh-window-size";
    const STORAGE_KEY = "dsh-window-size:v2";
    const LEGACY_STORAGE_KEY = "dsh-window-size:v1";
    const DEFAULT_WIDTH = 1280;
    const DEFAULT_HEIGHT = 820;
    const MIN_WIDTH = 520;
    const MIN_HEIGHT = 600;
    const UPPER_BOUND = 10000;
    const PRESET_LIMIT = 12;
    const PRESET_GROUPS = [
      {
        ratio: "4:3",
        items: [
          { width: 1024, height: 768, size: "small" },
          { width: 1280, height: 960, size: "large" },
        ],
      },
      {
        ratio: "16:9",
        items: [
          { width: 1280, height: 720, size: "small" },
          { width: 1600, height: 900, size: "large" },
        ],
      },
      {
        ratio: "16:10",
        items: [
          { width: 1280, height: 800, size: "small" },
          { width: 1600, height: 1000, size: "large" },
        ],
      },
    ];

    const DICTS = {
      zh: {
        title: "窗口大小",
        description:
          "设置桌面版启动时的窗口大小与位置。固定大小每次都使用同一尺寸；记忆模式沿用上次关闭时的大小。",
        current: "当前窗口",
        currentNote: "内容区尺寸，随手动调整实时更新",
        startup: "下次启动",
        startupDefault: "应用默认 {width} × {height}",
        startupNoteFixed: "每次启动使用固定尺寸",
        startupNoteMemory: "每次启动沿用上次关闭时的大小",
        startupNoteDefault: "尚未设置启动尺寸",
        position: "启动位置",
        positionCenter: "屏幕正中",
        positionLast: "上次位置",
        positionPending: "尚未记录",
        positionNoteCenter: "启动时窗口在屏幕正中",
        positionNoteRemember: "启动时回到上次位置",
        modeLabel: "启动方式",
        modeFixed: "固定大小",
        modeMemory: "记忆模式",
        modeFixedHint: "每次启动都使用下方设置的固定尺寸。",
        modeMemoryHint: "启动时使用上次关闭时的窗口大小；手动缩放会自动记忆。",
        rememberPosition: "记住关闭时窗口位置",
        rememberPositionHint: "开启后下次启动回到上次位置；关闭时窗口在屏幕正中启动。",
        on: "开",
        off: "关",
        resolution: "分辨率",
        width: "宽度",
        height: "高度",
        px: "px",
        presets: "预设尺寸",
        groupSmall: "偏小",
        groupLarge: "偏大",
        customPresets: "自定义预设",
        customEmpty: "还没有自定义预设：设置宽高后点“保存为预设”。",
        hint: "最小 {minW} × {minH}，最大 {maxW} × {maxH}（窗口内容区，按当前屏幕可用区域计算）。",
        save: "保存并应用",
        savePreset: "保存为预设",
        reset: "恢复默认",
        saved: "已保存并应用：{width} × {height}，下次启动使用固定大小。",
        modeFixedDone: "已切换为固定大小模式。",
        modeMemoryDone: "已切换为记忆模式，下次启动沿用上次关闭时的大小。",
        positionOn: "已开启位置记忆，下次启动回到上次位置。",
        positionOff: "已关闭位置记忆，下次启动窗口居中。",
        presetSaved: "已保存为预设：{width} × {height}。",
        presetExists: "该尺寸已在预设中。",
        presetLimit: "自定义预设最多 {limit} 个，请先删除一个。",
        presetRemoved: "已删除预设：{width} × {height}。",
        removePreset: "删除预设",
        presetTooLarge: "超出当前屏幕可用区域",
        resetDone: "已恢复默认：启动尺寸 1280 × 820、窗口居中、不记忆位置；自定义预设保留。",
        invalid: "请输入 {minW}–{maxW} 之间的宽度、{minH}–{maxH} 之间的高度（整数）。",
        storageFailed: "无法写入本地存储，设置没有保存。",
        desktopOnly:
          "当前是网页版，浏览器不允许页面调整窗口大小。该设置只在 DSH 桌面版生效。",
        memoryTitle: "记忆模式",
        memoryNote:
          "下次启动使用上次关闭时的窗口大小。当前窗口为 {width} × {height}，关闭或隐藏后自动记录。",
        memoryLast: "当前记忆的大小",
        memoryLastNote: "窗口缩放后自动更新",
      },
      en: {
        title: "Window Size",
        description:
          "Set the desktop app's startup window size and position. Fixed mode always uses the same size; Memory mode reuses the size from the last close.",
        current: "Current window",
        currentNote: "Content area; updates when you resize it",
        startup: "Next start",
        startupDefault: "App default {width} × {height}",
        startupNoteFixed: "Uses the fixed size on every start",
        startupNoteMemory: "Uses the size from the last close",
        startupNoteDefault: "No startup size is set",
        position: "Startup position",
        positionCenter: "Screen center",
        positionLast: "Last position",
        positionPending: "Not recorded yet",
        positionNoteCenter: "Starts in the center of the screen",
        positionNoteRemember: "Returns to the last position",
        modeLabel: "Startup mode",
        modeFixed: "Fixed size",
        modeMemory: "Memory",
        modeFixedHint: "Use the fixed size set below on every start.",
        modeMemoryHint: "Start at the size from the last close; manual resizes are remembered.",
        rememberPosition: "Remember position on close",
        rememberPositionHint: "When on, the next start returns to the last position; otherwise it starts centered.",
        on: "On",
        off: "Off",
        resolution: "Resolution",
        width: "Width",
        height: "Height",
        px: "px",
        presets: "Presets",
        groupSmall: "Small",
        groupLarge: "Large",
        customPresets: "Custom presets",
        customEmpty: "No custom presets yet. Set a size and click “Save as preset”.",
        hint: "Minimum {minW} × {minH}, maximum {maxW} × {maxH} (content area, limited by this screen's available area).",
        save: "Save and apply",
        savePreset: "Save as preset",
        reset: "Restore default",
        saved: "Saved and applied: {width} × {height}. The next start will use the fixed size.",
        modeFixedDone: "Switched to Fixed size mode.",
        modeMemoryDone: "Switched to Memory mode. The next start will reuse the last size.",
        positionOn: "Position memory is on. The next start will return to the last position.",
        positionOff: "Position memory is off. The next start will be centered.",
        presetSaved: "Saved as a preset: {width} × {height}.",
        presetExists: "That size is already in the presets.",
        presetLimit: "Up to {limit} custom presets; remove one first.",
        presetRemoved: "Removed preset: {width} × {height}.",
        removePreset: "Remove preset",
        presetTooLarge: "Larger than this screen's available area",
        resetDone: "Restored the default: 1280 × 820, centered, no position memory. Custom presets are kept.",
        invalid: "Enter a width between {minW}–{maxW} and a height between {minH}–{maxH} (integers).",
        storageFailed: "Local storage is unavailable, so the setting was not saved.",
        desktopOnly:
          "This is the web client; browsers do not let a page resize its window. The setting only affects the DSH desktop app.",
        memoryTitle: "Memory mode",
        memoryNote:
          "The next start will use the size from the last close. The current window is {width} × {height}; it is recorded when you close or hide the app.",
        memoryLast: "Currently remembered size",
        memoryLastNote: "Updates automatically when you resize",
      },
    };

    function isDesktop() {
      try {
        return globalThis.dshDesktop && globalThis.dshDesktop.protocolVersion === 1;
      } catch (error) {
        return false;
      }
    }

    // Chromium reports outer == inner while the window is hidden or minimized, so
    // a live measurement can be wrong. Keep the last sane frame delta and fall back
    // to the frame this app uses on Windows (16 px sideways, 8 px vertically).
    let FRAME = { x: 16, y: 8 };

    function measureFrame() {
      try {
        const dx = Math.round(window.outerWidth - window.innerWidth);
        const dy = Math.round(window.outerHeight - window.innerHeight);
        if (dx >= 0 && dx <= 64 && dy >= 0 && dy <= 96) FRAME = { x: dx, y: dy };
      } catch (error) {
        /* keep the last known frame */
      }
      return FRAME;
    }

    function screenBox() {
      try {
        return {
          left: Math.round(window.screen.availLeft) || 0,
          top: Math.round(window.screen.availTop) || 0,
          width: Math.round(window.screen.availWidth) || UPPER_BOUND,
          height: Math.round(window.screen.availHeight) || UPPER_BOUND,
        };
      } catch (error) {
        return { left: 0, top: 0, width: UPPER_BOUND, height: UPPER_BOUND };
      }
    }

    function screenLimit() {
      const box = screenBox();
      const frame = measureFrame();
      return {
        width: Math.max(MIN_WIDTH, Math.min(box.width - frame.x, UPPER_BOUND)),
        height: Math.max(MIN_HEIGHT, Math.min(box.height - frame.y, UPPER_BOUND)),
      };
    }

    function currentWindowSize() {
      try {
        return {
          width: Math.round(window.innerWidth),
          height: Math.round(window.innerHeight),
        };
      } catch (error) {
        return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
      }
    }

    function clampSize(size) {
      const limit = screenLimit();
      return {
        width: Math.min(Math.max(Math.round(size.width), MIN_WIDTH), limit.width),
        height: Math.min(Math.max(Math.round(size.height), MIN_HEIGHT), limit.height),
      };
    }

    function normalizeSize(value) {
      if (!value || typeof value !== "object") return null;
      const width = Number(value.width);
      const height = Number(value.height);
      if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
      if (width < MIN_WIDTH || height < MIN_HEIGHT) return null;
      if (width > UPPER_BOUND || height > UPPER_BOUND) return null;
      return { width, height };
    }

    function normalizePresets(list) {
      const presets = [];
      const seen = new Set();
      if (!Array.isArray(list)) return presets;
      for (const item of list) {
        const size = normalizeSize(item);
        if (!size) continue;
        const key = size.width + "x" + size.height;
        if (seen.has(key)) continue;
        seen.add(key);
        presets.push(size);
        if (presets.length >= PRESET_LIMIT) break;
      }
      return presets;
    }

    function normalizePosition(value) {
      if (!value || typeof value !== "object") return null;
      const x = Number(value.x);
      const y = Number(value.y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
      if (Math.abs(x) > 100000 || Math.abs(y) > 100000) return null;
      return { x, y };
    }

    function isBuiltinSize(size) {
      return PRESET_GROUPS.some((group) =>
        group.items.some((item) => item.width === size.width && item.height === size.height)
      );
    }

    function readRawRecord() {
      let value = {};
      let hasRecord = false;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            value = parsed;
            hasRecord = true;
          }
        }
        if (!hasRecord) {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const old = normalizeSize(JSON.parse(legacy));
            if (old) {
              value.width = old.width;
              value.height = old.height;
            }
          }
        }
      } catch (error) {
        /* malformed records are treated as empty */
      }
      return value;
    }

    function readRecord() {
      const value = readRawRecord();
      const fixed = normalizeSize(value);
      const last = normalizeSize(value.last);
      const mode = value.mode === "memory" ? "memory" : "fixed";
      return {
        mode,
        fixed,
        last,
        size: mode === "memory" ? last || fixed : fixed,
        position: normalizePosition(value.position),
        rememberPosition: value.rememberPosition === true,
        presets: normalizePresets(value.presets),
      };
    }

    function isEmptyRecord(value) {
      return (
        value.mode !== "memory" &&
        !normalizeSize(value) &&
        !normalizeSize(value.last) &&
        !normalizePosition(value.position) &&
        value.rememberPosition !== true &&
        normalizePresets(value.presets).length === 0
      );
    }

    function writeRawRecord(value) {
      try {
        if (isEmptyRecord(value)) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          return true;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return true;
      } catch (error) {
        return false;
      }
    }

    function patchRecord(patch) {
      const value = readRawRecord();
      for (const key of Object.keys(patch)) {
        if (patch[key] === null || patch[key] === undefined) delete value[key];
        else value[key] = patch[key];
      }
      const ok = writeRawRecord(value);
      return { ok, record: readRecord() };
    }

    function contentPoint() {
      try {
        const frame = measureFrame();
        return {
          x: Math.round(window.screenX + Math.max(0, Math.round(frame.x / 2))),
          y: Math.round(window.screenY),
        };
      } catch (error) {
        return null;
      }
    }

    function targetPoint(size, position) {
      const frame = measureFrame();
      const box = screenBox();
      const leftInset = Math.max(0, Math.round(frame.x / 2));
      const maxX = Math.max(box.left, box.left + box.width - size.width - leftInset);
      const maxY = Math.max(box.top, box.top + box.height - size.height - frame.y);
      if (position) {
        return {
          x: Math.min(Math.max(position.x, box.left), maxX),
          y: Math.min(Math.max(position.y, box.top), maxY),
        };
      }
      return {
        x: Math.min(
          Math.max(box.left + Math.round((box.width - size.width) / 2), box.left),
          maxX
        ),
        y: Math.min(
          Math.max(box.top + Math.round((box.height - size.height) / 2), box.top),
          maxY
        ),
      };
    }

    function applyWindow(size, position) {
      try {
        const frame = measureFrame();
        const leftInset = Math.max(0, Math.round(frame.x / 2));
        const point = targetPoint(size, position);
        /* Resize first: Windows clamps moveTo() against the window's current
           height, so moving a large window before shrinking it can leave it
           off-center. moveTo() then grows the frameless window by one frame
           and the final resizeTo() restores the target size and shifts the
           content origin left by half a frame; pre-adding leftInset makes the
           final x exact. */
        window.resizeTo(size.width, size.height);
        window.moveTo(point.x + leftInset, point.y);
        window.resizeTo(size.width, size.height);
      } catch (error) {
        /* The web client denies this; the desktop app allows it. */
      }
    }

    const CSS = `
.dws-page{box-sizing:border-box;display:flex;flex-direction:column;gap:18px;width:100%;max-width:760px;padding:2px 2px 40px;color:var(--dsw-alias-label-primary)}
.dws-head{display:flex;flex-direction:column;gap:6px}
.dws-title{margin:0;font-size:18px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dws-desc{margin:0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary)}
.dws-note{box-sizing:border-box;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);background:transparent}
.dws-note[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
.dws-card{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:16px 18px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.dws-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dws-row-label{display:flex;flex-direction:column;gap:2px;min-width:0}
.dws-row-title{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dws-row-sub{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dws-value{flex:none;font-size:13px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);white-space:nowrap}
.dws-divider{height:1px;background:var(--dsw-alias-border-l2);opacity:.7}
.dws-section-label{font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}
.dws-fields{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
.dws-field{display:flex;flex-direction:column;gap:6px}
.dws-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dws-input{box-sizing:border-box;width:116px;height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;font-variant-numeric:tabular-nums;outline:none}
.dws-input:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}
.dws-input:focus{border-color:var(--dsw-alias-label-secondary)}
.dws-input:disabled{opacity:.5;cursor:not-allowed}
.dws-times{padding-bottom:9px;font-size:13px;color:var(--dsw-alias-label-tertiary)}
.dws-presets{display:flex;flex-direction:column;gap:10px}
.dws-preset-group{display:flex;align-items:flex-start;gap:12px}
.dws-preset-ratio{flex:none;width:44px;padding-top:5px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dws-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dws-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1;font-variant-numeric:tabular-nums;cursor:pointer}
.dws-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dws-chip[data-active="true"]{border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary);font-weight:600}
.dws-chip:disabled{opacity:.5;cursor:not-allowed}
.dws-chip-tag{padding:1px 5px;border-radius:999px;background:var(--dsw-alias-bg-mask-1);color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400}
.dws-chip-custom{padding:0 4px 0 10px;cursor:default}
.dws-chip-text{padding:0;border:0;background:transparent;color:inherit;font:inherit;line-height:1;cursor:pointer}
.dws-chip-text:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dws-chip-text:disabled{opacity:.5;cursor:not-allowed}
.dws-chip-remove{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1;cursor:pointer}
.dws-chip-remove:hover:not(:disabled){background:var(--dsw-alias-bg-mask-1);color:var(--dsw-alias-label-primary)}
.dws-chip-remove:disabled{opacity:.5;cursor:not-allowed}
.dws-segment{box-sizing:border-box;display:flex;gap:2px;width:100%;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-mask-1)}
.dws-segment-item{flex:1;height:30px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:1;cursor:pointer}
.dws-segment-item:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dws-segment-item[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dws-segment-item:disabled{opacity:.5;cursor:not-allowed}
.dws-switch{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1;cursor:pointer}
.dws-switch-track{position:relative;display:inline-block;width:36px;height:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-mask-1);transition:background .15s ease,border-color .15s ease}
.dws-switch-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .15s ease,background .15s ease}
.dws-switch[data-on="true"] .dws-switch-track{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary)}
.dws-switch[data-on="true"] .dws-switch-thumb{transform:translateX(16px);background:var(--dsw-alias-bg-layer-2)}
.dws-switch:disabled{opacity:.5;cursor:not-allowed}
.dws-hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
.dws-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dws-button{box-sizing:border-box;height:34px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1;cursor:pointer}
.dws-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dws-button:disabled{opacity:.5;cursor:not-allowed}
.dws-button-primary{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-2);font-weight:600}
.dws-button-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary);opacity:.9}
.dws-status{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);min-height:18px}
.dws-status[data-tone="success"]{color:var(--dsw-alias-state-success-primary)}
.dws-status[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
`;

    function useCurrentSize() {
      const [size, setSize] = useState(currentWindowSize);
      useEffect(() => {
        function onResize() {
          measureFrame();
          setSize(currentWindowSize());
        }
        window.addEventListener("resize", onResize);
        return function dispose() {
          window.removeEventListener("resize", onResize);
        };
      }, []);
      return size;
    }

    function WindowSizePage(props) {
      const t = props.t;
      const desktop = isDesktop();
      const current = useCurrentSize();
      const limit = screenLimit();
      const [record, setRecord] = useState(readRecord);
      const [width, setWidth] = useState(() => {
        const initial = record.fixed || record.last || current;
        return String(initial.width);
      });
      const [height, setHeight] = useState(() => {
        const initial = record.fixed || record.last || current;
        return String(initial.height);
      });
      const [status, setStatus] = useState(null);

      const mode = record.mode;
      const rememberPosition = record.rememberPosition;
      const presets = record.presets;
      const fixed = record.fixed;
      const memorySize = current;

      function updateWidth(value) {
        setWidth(value);
        setStatus(null);
      }

      function updateHeight(value) {
        setHeight(value);
        setStatus(null);
      }

      function choosePreset(preset) {
        setWidth(String(preset.width));
        setHeight(String(preset.height));
        setStatus(null);
      }

      function fail() {
        setStatus({ tone: "error", text: t("storageFailed") });
      }

      function readDraft() {
        const nextWidth = Number(width);
        const nextHeight = Number(height);
        const invalidWidth =
          !Number.isInteger(nextWidth) || nextWidth < MIN_WIDTH || nextWidth > limit.width;
        const invalidHeight =
          !Number.isInteger(nextHeight) || nextHeight < MIN_HEIGHT || nextHeight > limit.height;
        if (invalidWidth || invalidHeight) {
          setStatus({
            tone: "error",
            text: t("invalid", {
              minW: MIN_WIDTH,
              maxW: limit.width,
              minH: MIN_HEIGHT,
              maxH: limit.height,
            }),
          });
          return null;
        }
        return { width: nextWidth, height: nextHeight };
      }

      function onMode(nextMode) {
        if (!desktop || nextMode === mode) return;
        const patch = { mode: nextMode };
        let nextSize;
        if (nextMode === "memory") {
          patch.last = current;
          if (!fixed) {
            patch.width = current.width;
            patch.height = current.height;
          }
          nextSize = current;
        } else {
          nextSize = fixed || record.last || current;
          if (!fixed) {
            patch.width = nextSize.width;
            patch.height = nextSize.height;
          }
        }
        const result = patchRecord(patch);
        if (!result.ok) {
          fail();
          return;
        }
        setRecord(result.record);
        setWidth(String(nextSize.width));
        setHeight(String(nextSize.height));
        setStatus({
          tone: "success",
          text: nextMode === "memory" ? t("modeMemoryDone") : t("modeFixedDone"),
        });
      }

      function onTogglePosition() {
        if (!desktop) return;
        const next = !rememberPosition;
        const point = next ? targetPoint(current, contentPoint()) : null;
        const result = patchRecord(
          next
            ? { rememberPosition: true, position: point }
            : { rememberPosition: null, position: null }
        );
        if (!result.ok) {
          fail();
          return;
        }
        setRecord(result.record);
        setStatus({ tone: "success", text: next ? t("positionOn") : t("positionOff") });
      }

      function onSave() {
        if (!desktop) return;
        const size = readDraft();
        if (!size) return;
        const point = rememberPosition ? targetPoint(size, contentPoint()) : null;
        const patch = { mode: "fixed", width: size.width, height: size.height };
        if (rememberPosition) patch.position = point;
        const result = patchRecord(patch);
        if (!result.ok) {
          fail();
          return;
        }
        applyWindow(size, point);
        setRecord(result.record);
        setWidth(String(size.width));
        setHeight(String(size.height));
        setStatus({ tone: "success", text: t("saved", size) });
      }

      function onSavePreset() {
        if (!desktop) return;
        const size = readDraft();
        if (!size) return;
        const exists =
          isBuiltinSize(size) ||
          presets.some((item) => item.width === size.width && item.height === size.height);
        if (exists) {
          setStatus({ tone: "info", text: t("presetExists") });
          return;
        }
        if (presets.length >= PRESET_LIMIT) {
          setStatus({ tone: "error", text: t("presetLimit", { limit: PRESET_LIMIT }) });
          return;
        }
        const next = presets.concat([size]);
        const result = patchRecord({ presets: next });
        if (!result.ok) {
          fail();
          return;
        }
        setRecord(result.record);
        setStatus({ tone: "success", text: t("presetSaved", size) });
      }

      function onRemovePreset(preset) {
        if (!desktop) return;
        const next = presets.filter(
          (item) => !(item.width === preset.width && item.height === preset.height)
        );
        const result = patchRecord({ presets: next });
        if (!result.ok) {
          fail();
          return;
        }
        setRecord(result.record);
        setStatus({ tone: "success", text: t("presetRemoved", preset) });
      }

      function onReset() {
        if (!desktop) return;
        const result = patchRecord({
          mode: "fixed",
          width: null,
          height: null,
          last: null,
          position: null,
          rememberPosition: null,
        });
        if (!result.ok) {
          fail();
          return;
        }
        const size = clampSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        applyWindow(size, null);
        setRecord(result.record);
        setWidth(String(size.width));
        setHeight(String(size.height));
        setStatus({ tone: "success", text: t("resetDone") });
      }

      function presetChip(group, item) {
        const tooLarge = item.width > limit.width || item.height > limit.height;
        const active =
          String(item.width) === width.trim() && String(item.height) === height.trim();
        return h(
          "button",
          {
            key: group.ratio + ":" + item.width + "x" + item.height,
            type: "button",
            className: "dws-chip",
            "data-active": String(active),
            disabled: !desktop || tooLarge,
            title: tooLarge ? t("presetTooLarge") : undefined,
            onClick: () => choosePreset(item),
          },
          item.width + " × " + item.height,
          h(
            "span",
            { className: "dws-chip-tag" },
            item.size === "small" ? t("groupSmall") : t("groupLarge")
          )
        );
      }

      const customChips = presets.map((preset) => {
        const active =
          String(preset.width) === width.trim() && String(preset.height) === height.trim();
        return h(
          "span",
          {
            key: "custom:" + preset.width + "x" + preset.height,
            className: "dws-chip dws-chip-custom",
            "data-active": String(active),
          },
          h(
            "button",
            {
              type: "button",
              className: "dws-chip-text",
              disabled: !desktop,
              onClick: () => choosePreset(preset),
            },
            preset.width + " × " + preset.height
          ),
          h(
            "button",
            {
              type: "button",
              className: "dws-chip-remove",
              "aria-label": t("removePreset"),
              title: t("removePreset"),
              disabled: !desktop,
              onClick: () => onRemovePreset(preset),
            },
            "×"
          )
        );
      });

      const startupValue =
        mode === "memory"
          ? memorySize.width + " × " + memorySize.height
          : fixed
          ? fixed.width + " × " + fixed.height
          : t("startupDefault", { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
      const startupNote =
        mode === "memory"
          ? t("startupNoteMemory")
          : fixed
          ? t("startupNoteFixed")
          : t("startupNoteDefault");
      const positionValue = rememberPosition
        ? record.position
          ? t("positionLast")
          : t("positionPending")
        : t("positionCenter");
      const positionNote = rememberPosition
        ? t("positionNoteRemember")
        : t("positionNoteCenter");

      const statusNode = h(
        "div",
        {
          className: "dws-status",
          "data-tone": status ? status.tone : "info",
          role: "status",
          "aria-live": "polite",
        },
        status ? status.text : ""
      );

      const resetButton = h(
        "button",
        { type: "button", className: "dws-button", disabled: !desktop, onClick: onReset },
        t("reset")
      );

      const fixedCard = h(
        "div",
        { className: "dws-card", key: "fixed" },
        h("div", { className: "dws-section-label" }, t("resolution")),
        h(
          "div",
          { className: "dws-fields" },
          h(
            "label",
            { className: "dws-field" },
            h("span", { className: "dws-field-label" }, t("width")),
            h("input", {
              className: "dws-input",
              type: "number",
              inputMode: "numeric",
              min: MIN_WIDTH,
              max: limit.width,
              step: 1,
              value: width,
              disabled: !desktop,
              "aria-label": t("width"),
              onChange: (event) => updateWidth(event.target.value),
            })
          ),
          h("span", { className: "dws-times" }, "×"),
          h(
            "label",
            { className: "dws-field" },
            h("span", { className: "dws-field-label" }, t("height")),
            h("input", {
              className: "dws-input",
              type: "number",
              inputMode: "numeric",
              min: MIN_HEIGHT,
              max: limit.height,
              step: 1,
              value: height,
              disabled: !desktop,
              "aria-label": t("height"),
              onChange: (event) => updateHeight(event.target.value),
            })
          ),
          h("span", { className: "dws-times" }, t("px"))
        ),
        h("div", { className: "dws-section-label" }, t("presets")),
        h(
          "div",
          { className: "dws-presets" },
          PRESET_GROUPS.map((group) =>
            h(
              "div",
              { className: "dws-preset-group", key: group.ratio },
              h("div", { className: "dws-preset-ratio" }, group.ratio),
              h(
                "div",
                { className: "dws-chips", role: "group", "aria-label": group.ratio },
                group.items.map((item) => presetChip(group, item))
              )
            )
          )
        ),
        h("div", { className: "dws-divider" }),
        h("div", { className: "dws-section-label" }, t("customPresets")),
        h(
          "div",
          { className: "dws-chips", role: "group", "aria-label": t("customPresets") },
          presets.length === 0 ? h("span", { className: "dws-hint" }, t("customEmpty")) : customChips
        ),
        h(
          "p",
          { className: "dws-hint" },
          t("hint", {
            minW: MIN_WIDTH,
            minH: MIN_HEIGHT,
            maxW: limit.width,
            maxH: limit.height,
          })
        ),
        h(
          "div",
          { className: "dws-actions" },
          h(
            "button",
            {
              type: "button",
              className: "dws-button dws-button-primary",
              disabled: !desktop,
              onClick: onSave,
            },
            t("save")
          ),
          h(
            "button",
            {
              type: "button",
              className: "dws-button",
              disabled: !desktop || presets.length >= PRESET_LIMIT,
              onClick: onSavePreset,
            },
            t("savePreset")
          ),
          resetButton
        ),
        statusNode
      );

      const memoryCard = h(
        "div",
        { className: "dws-card", key: "memory" },
        h("div", { className: "dws-section-label" }, t("memoryTitle")),
        h(
          "p",
          { className: "dws-hint" },
          t("memoryNote", { width: memorySize.width, height: memorySize.height })
        ),
        h("div", { className: "dws-divider" }),
        h(
          "div",
          { className: "dws-row" },
          h(
            "div",
            { className: "dws-row-label" },
            h("div", { className: "dws-row-title" }, t("memoryLast")),
            h("div", { className: "dws-row-sub" }, t("memoryLastNote"))
          ),
          h("div", { className: "dws-value" }, memorySize.width + " × " + memorySize.height)
        ),
        h("div", { className: "dws-actions" }, resetButton),
        statusNode
      );

      return h(
        "div",
        { className: "dws-page", "data-dsh-window-size": "root" },
        h("style", { key: "css" }, CSS),
        h(
          "div",
          { className: "dws-head", key: "head" },
          h("h2", { className: "dws-title" }, t("title")),
          h("p", { className: "dws-desc" }, t("description"))
        ),
        !desktop &&
          h(
            "div",
            { className: "dws-note", key: "web-note", "data-tone": "info", role: "note" },
            t("desktopOnly")
          ),
        h(
          "div",
          { className: "dws-card", key: "summary" },
          h(
            "div",
            { className: "dws-row" },
            h(
              "div",
              { className: "dws-row-label" },
              h("div", { className: "dws-row-title" }, t("current")),
              h("div", { className: "dws-row-sub" }, t("currentNote"))
            ),
            h("div", { className: "dws-value" }, current.width + " × " + current.height)
          ),
          h("div", { className: "dws-divider" }),
          h(
            "div",
            { className: "dws-row" },
            h(
              "div",
              { className: "dws-row-label" },
              h("div", { className: "dws-row-title" }, t("startup")),
              h("div", { className: "dws-row-sub" }, startupNote)
            ),
            h("div", { className: "dws-value" }, startupValue)
          ),
          h("div", { className: "dws-divider" }),
          h(
            "div",
            { className: "dws-row" },
            h(
              "div",
              { className: "dws-row-label" },
              h("div", { className: "dws-row-title" }, t("position")),
              h("div", { className: "dws-row-sub" }, positionNote)
            ),
            h("div", { className: "dws-value" }, positionValue)
          )
        ),
        h(
          "div",
          { className: "dws-card", key: "behavior" },
          h("div", { className: "dws-section-label" }, t("modeLabel")),
          h(
            "div",
            { className: "dws-segment", role: "group", "aria-label": t("modeLabel") },
            h(
              "button",
              {
                type: "button",
                className: "dws-segment-item",
                "data-active": String(mode === "fixed"),
                "aria-pressed": mode === "fixed",
                disabled: !desktop,
                onClick: () => onMode("fixed"),
              },
              t("modeFixed")
            ),
            h(
              "button",
              {
                type: "button",
                className: "dws-segment-item",
                "data-active": String(mode === "memory"),
                "aria-pressed": mode === "memory",
                disabled: !desktop,
                onClick: () => onMode("memory"),
              },
              t("modeMemory")
            )
          ),
          h(
            "p",
            { className: "dws-hint" },
            mode === "memory" ? t("modeMemoryHint") : t("modeFixedHint")
          ),
          h("div", { className: "dws-divider" }),
          h(
            "div",
            { className: "dws-row" },
            h(
              "div",
              { className: "dws-row-label" },
              h("div", { className: "dws-row-title" }, t("rememberPosition")),
              h("div", { className: "dws-row-sub" }, t("rememberPositionHint"))
            ),
            h(
              "button",
              {
                type: "button",
                className: "dws-switch",
                role: "switch",
                "aria-checked": rememberPosition,
                "data-on": String(rememberPosition),
                disabled: !desktop,
                onClick: onTogglePosition,
              },
              h("span", { className: "dws-switch-track" }, h("span", { className: "dws-switch-thumb" })),
              h("span", { className: "dws-switch-label" }, rememberPosition ? t("on") : t("off"))
            )
          )
        ),
        mode === "memory" ? memoryCard : fixedCard
      );
    }

    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), "dsh-window-size: dictionaries");
        const t = ctx.locale.bind(NS);
        /* The startup size and position are applied by index.js before the
           window is shown; resizing here would be too late. */
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            {
              name: "settings.section",
              id: "window-size",
              order: 30,
              label: () => t("title"),
              locale: NS,
            },
            (props) => h(WindowSizePage, Object.assign({}, props, { t }))
          )
        );
      },
    };
  },
});
