/**
 * dsh-window-size — Client half.
 *
 * The renderer may resize its own BrowserWindow (verified on Electron 44.7 /
 * Chrome 152, including while the window is still hidden), so the whole
 * feature lives here:
 *
 *  - at boot, read the saved size from localStorage and resize before the
 *    window is shown;
 *  - contribute a "Window Size" page to Settings that edits the same record
 *    and applies it immediately.
 *
 * Sizes and user presets are one record under `dsh-window-size:v2`; the old
 * v1 shape `{width,height}` is still read and migrated on the next write.
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
          "设置 DeepSeek Harness 桌面版启动时的默认窗口尺寸。保存后立即应用到当前窗口，下次启动会在窗口显示前套用。",
        current: "当前窗口",
        currentNote: "内容区尺寸，随手动调整实时更新",
        startup: "启动尺寸",
        notSet: "未设置，使用应用默认尺寸",
        storedValue: "下次启动自动使用",
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
        saved: "已保存并应用：{width} × {height}，下次启动自动使用。",
        presetSaved: "已保存为预设：{width} × {height}。",
        presetExists: "该尺寸已在预设中。",
        presetLimit: "自定义预设最多 {limit} 个，请先删除一个。",
        presetRemoved: "已删除预设：{width} × {height}。",
        removePreset: "删除预设",
        presetTooLarge: "超出当前屏幕可用区域",
        resetDone: "已清除自定义尺寸，窗口恢复为应用默认 1280 × 820。",
        invalid: "请输入 {minW}–{maxW} 之间的宽度、{minH}–{maxH} 之间的高度（整数）。",
        storageFailed: "无法写入本地存储，设置没有保存。",
        desktopOnly:
          "当前是网页版，浏览器不允许页面调整窗口大小。该设置只在 DSH 桌面版生效，仍可在此保存，但不会改变浏览器窗口。",
        disabled: "网页版不可用",
      },
      en: {
        title: "Window Size",
        description:
          "Set the default window size for the DeepSeek Harness desktop app. Saving applies it to this window immediately; the next launch applies it before the window appears.",
        current: "Current window",
        currentNote: "Content area; updates when you resize it",
        startup: "Startup size",
        notSet: "Not set — the app default is used",
        storedValue: "Used on the next start",
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
        saved: "Saved and applied: {width} × {height}. The next launch will use it.",
        presetSaved: "Saved as a preset: {width} × {height}.",
        presetExists: "That size is already in the presets.",
        presetLimit: "Up to {limit} custom presets; remove one first.",
        presetRemoved: "Removed preset: {width} × {height}.",
        removePreset: "Remove preset",
        presetTooLarge: "Larger than this screen's available area",
        resetDone: "Custom size cleared. The window is back to the app default 1280 × 820.",
        invalid: "Enter a width between {minW}–{maxW} and a height between {minH}–{maxH} (integers).",
        storageFailed: "Local storage is unavailable, so the size was not saved.",
        desktopOnly:
          "This is the web client; browsers do not let a page resize its window. The setting only affects the DSH desktop app. You can still save it here, but the browser window will not change.",
        disabled: "Unavailable in the web client",
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
        if (dx > 0 && dx <= 64 && dy > 0 && dy <= 96) FRAME = { x: dx, y: dy };
      } catch (error) {
        /* keep the last known frame */
      }
      return FRAME;
    }

    function screenLimit() {
      try {
        const frame = measureFrame();
        const availWidth = Math.round(window.screen && window.screen.availWidth);
        const availHeight = Math.round(window.screen && window.screen.availHeight);
        const frameX = frame.x;
        const frameY = frame.y;
        const width = Number.isFinite(availWidth) && availWidth > 0 ? availWidth : UPPER_BOUND;
        const height = Number.isFinite(availHeight) && availHeight > 0 ? availHeight : UPPER_BOUND;
        return {
          width: Math.max(MIN_WIDTH, Math.min(width - frameX, UPPER_BOUND)),
          height: Math.max(MIN_HEIGHT, Math.min(height - frameY, UPPER_BOUND)),
        };
      } catch (error) {
        return { width: UPPER_BOUND, height: UPPER_BOUND };
      }
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

    function isBuiltinSize(size) {
      return PRESET_GROUPS.some((group) =>
        group.items.some((item) => item.width === size.width && item.height === size.height)
      );
    }

    function readStored() {
      const result = { size: null, presets: [] };
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const value = JSON.parse(raw);
          if (value && typeof value === "object") {
            result.size = normalizeSize(value);
            result.presets = normalizePresets(value.presets);
          }
          return result;
        }
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          result.size = normalizeSize(JSON.parse(legacy));
        }
      } catch (error) {
        /* malformed records are treated as empty */
      }
      return result;
    }

    function writeStored(size, presets) {
      try {
        if (!size && presets.length === 0) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          return true;
        }
        const record = {
          presets: presets.map((item) => ({ width: item.width, height: item.height })),
        };
        if (size) {
          record.width = size.width;
          record.height = size.height;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return true;
      } catch (error) {
        return false;
      }
    }

    function resizeToSize(size) {
      try {
        const frameX = Math.max(0, window.outerWidth - window.innerWidth);
        const frameY = Math.max(0, window.outerHeight - window.innerHeight);
        window.resizeTo(size.width, size.height);
        const left = (window.screen.availLeft || 0) + (window.screen.availWidth - (size.width + frameX)) / 2;
        const top = (window.screen.availTop || 0) + (window.screen.availHeight - (size.height + frameY)) / 2;
        window.moveTo(Math.max(0, Math.round(left)), Math.max(0, Math.round(top)));
      } catch (error) {
        /* The web client denies this; the desktop app allows it. */
      }
    }

    function applyStoredSize() {
      if (!isDesktop()) return;
      const stored = readStored();
      if (!stored.size) return;
      resizeToSize(clampSize(stored.size));
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
      const [record, setRecord] = useState(readStored);
      const stored = record.size;
      const presets = record.presets;
      const initial = stored || current;
      const [width, setWidth] = useState(String(initial.width));
      const [height, setHeight] = useState(String(initial.height));
      const [status, setStatus] = useState(null);

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

      function onSave() {
        if (!desktop) return;
        const size = readDraft();
        if (!size) return;
        if (!writeStored(size, presets)) {
          setStatus({ tone: "error", text: t("storageFailed") });
          return;
        }
        resizeToSize(size);
        setRecord({ size, presets });
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
        if (!writeStored(stored, next)) {
          setStatus({ tone: "error", text: t("storageFailed") });
          return;
        }
        setRecord({ size: stored, presets: next });
        setStatus({ tone: "success", text: t("presetSaved", size) });
      }

      function onRemovePreset(preset) {
        if (!desktop) return;
        const next = presets.filter(
          (item) => !(item.width === preset.width && item.height === preset.height)
        );
        if (!writeStored(stored, next)) {
          setStatus({ tone: "error", text: t("storageFailed") });
          return;
        }
        setRecord({ size: stored, presets: next });
        setStatus({ tone: "success", text: t("presetRemoved", preset) });
      }

      function onReset() {
        if (!desktop) return;
        if (!writeStored(null, presets)) {
          setStatus({ tone: "error", text: t("storageFailed") });
          return;
        }
        const size = clampSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        resizeToSize(size);
        setRecord({ size: null, presets });
        setWidth(String(DEFAULT_WIDTH));
        setHeight(String(DEFAULT_HEIGHT));
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
              h(
                "div",
                { className: "dws-row-sub" },
                stored ? t("storedValue", stored) : t("notSet")
              )
            ),
            h(
              "div",
              { className: "dws-value" },
              stored ? stored.width + " × " + stored.height : DEFAULT_WIDTH + " × " + DEFAULT_HEIGHT
            )
          )
        ),
        h(
          "div",
          { className: "dws-card", key: "form" },
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
            h(
              "button",
              { type: "button", className: "dws-button", disabled: !desktop, onClick: onReset },
              t("reset")
            )
          ),
          h(
            "div",
            {
              className: "dws-status",
              "data-tone": status ? status.tone : "info",
              role: "status",
              "aria-live": "polite",
            },
            status ? status.text : ""
          )
        )
      );
    }

    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), "dsh-window-size: dictionaries");
        const t = ctx.locale.bind(NS);
        /* The boot size is applied by the index injection in index.js, which
           runs before the window is shown; resizing here would be too late
           and would also re-add the frame while the window is hidden. */
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
