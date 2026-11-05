/**
 * Host half of dsh-window-size.
 *
 * The desktop shell shows its main window as soon as the page finishes
 * loading, which is well before a Client plugin module is fetched and
 * applied. The only hook earlier than that is the index injection table:
 * the shell hands these rows to the page during boot, so the inline script
 * below restores the size and position before the first paint.
 *
 * The record is the same localStorage object the settings page edits:
 *
 *   {
 *     mode: "fixed" | "memory",
 *     width, height,                    // fixed target; fallback for old builds
 *     last: { width, height },          // last visible content size
 *     rememberPosition: boolean,
 *     position: { x, y },               // content-area screen position
 *     presets: [{ width, height }]
 *   }
 *
 * The script also tracks the live size and position while the app runs, so
 * "memory" mode and "remember position" survive a tray close (the shell only
 * hides the window on the close button; beforeunload does not fire then).
 *
 * The row is harmless in the web client: the script returns unless the
 * desktop bridge is present.
 */
const BOOT_SCRIPT = `(function () {
  try {
    var bridge = globalThis.dshDesktop;
    if (!bridge || bridge.protocolVersion !== 1) return;

    var KEY = "dsh-window-size:v2";
    var LEGACY_KEY = "dsh-window-size:v1";
    var MIN_WIDTH = 520;
    var MIN_HEIGHT = 600;
    var MAX_SIZE = 10000;

    function readRaw() {
      var value = {};
      var hasRecord = false;
      try {
        var text = localStorage.getItem(KEY);
        if (text) {
          var parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            value = parsed;
            hasRecord = true;
          }
        }
      } catch (error) { /* malformed records are treated as empty */ }
      if (!hasRecord) {
        try {
          var legacy = localStorage.getItem(LEGACY_KEY);
          if (legacy) {
            var old = JSON.parse(legacy);
            var oldSize = size(old);
            if (oldSize) {
              value.width = oldSize.width;
              value.height = oldSize.height;
            }
          }
        } catch (error) { /* ignore legacy noise */ }
      }
      return value;
    }

    function number(value) {
      var result = Math.round(Number(value));
      return isFinite(result) ? result : null;
    }

    function size(value) {
      if (!value || typeof value !== "object") return null;
      var width = number(value.width);
      var height = number(value.height);
      if (width === null || height === null) return null;
      if (width < MIN_WIDTH || height < MIN_HEIGHT) return null;
      if (width > MAX_SIZE || height > MAX_SIZE) return null;
      return { width: width, height: height };
    }

    function point(value) {
      if (!value || typeof value !== "object") return null;
      var x = number(value.x);
      var y = number(value.y);
      if (x === null || y === null) return null;
      if (Math.abs(x) > 100000 || Math.abs(y) > 100000) return null;
      return { x: x, y: y };
    }

    function record() {
      var value = readRaw();
      var fixed = size(value);
      var last = size(value.last);
      var remember = value.rememberPosition === true;
      var mode = value.mode === "memory" ? "memory" : "fixed";
      return {
        mode: mode,
        fixed: fixed,
        last: last,
        size: mode === "memory" ? last || fixed : fixed,
        position: point(value.position),
        rememberPosition: remember
      };
    }

    function write(patch) {
      var value = readRaw();
      for (var key in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        if (patch[key] === null || patch[key] === undefined) delete value[key];
        else value[key] = patch[key];
      }
      try {
        if (value.mode !== "memory" && !size(value) && !size(value.last) &&
            !point(value.position) && value.rememberPosition !== true &&
            (!Array.isArray(value.presets) || value.presets.length === 0)) {
          localStorage.removeItem(KEY);
        } else {
          localStorage.setItem(KEY, JSON.stringify(value));
        }
        localStorage.removeItem(LEGACY_KEY);
      } catch (error) { /* a size preference must never break the page */ }
    }

    var frameX = Math.round(outerWidth - innerWidth);
    var frameY = Math.round(outerHeight - innerHeight);
    if (!(frameX >= 0 && frameX <= 64)) frameX = 16;
    if (!(frameY >= 0 && frameY <= 96)) frameY = 8;
    var leftInset = Math.max(0, Math.round(frameX / 2));
    var availWidth = Math.round(screen.availWidth);
    var availHeight = Math.round(screen.availHeight);
    var availLeft = Math.round(screen.availLeft) || 0;
    var availTop = Math.round(screen.availTop) || 0;
    if (!(availWidth > 0)) availWidth = 1920;
    if (!(availHeight > 0)) availHeight = 1080;

    function clampSize(value) {
      return {
        width: Math.min(Math.max(value.width, MIN_WIDTH), Math.max(MIN_WIDTH, availWidth - frameX)),
        height: Math.min(Math.max(value.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, availHeight - frameY))
      };
    }

    function clampPoint(value, target) {
      var maxX = availLeft + Math.max(0, availWidth - target.width - leftInset);
      var maxY = availTop + Math.max(0, availHeight - target.height - frameY);
      return {
        x: Math.min(Math.max(value.x, availLeft), maxX),
        y: Math.min(Math.max(value.y, availTop), maxY)
      };
    }

    function centered(target) {
      return {
        x: availLeft + Math.round((availWidth - target.width) / 2),
        y: availTop + Math.round((availHeight - target.height) / 2)
      };
    }

    function visibleOnScreen(value, target) {
      return value.x + target.width > availLeft + 40 &&
        value.x < availLeft + availWidth - 40 &&
        value.y + target.height > availTop + 40 &&
        value.y < availTop + availHeight - 40;
    }

    var saved = record();
    var target = saved.size;
    var onlyPosition = !target && saved.rememberPosition && saved.position;
    if (!target && !onlyPosition) return;
    if (!target) {
      target = { width: Math.round(innerWidth), height: Math.round(innerHeight) };
    }
    target = clampSize(target);

    var desired;
    if (saved.rememberPosition && saved.position && visibleOnScreen(saved.position, target)) {
      desired = clampPoint(saved.position, target);
    } else {
      desired = centered(target);
    }

    function apply() {
      try {
        /* Resize first: Windows clamps moveTo() against the window's current
           height, so moving a large window before shrinking it can leave it
           off-center. moveTo() then grows the frameless window by one frame
           and the final resizeTo() restores the target size and shifts the
           content origin left by half a frame; pre-adding leftInset makes the
           final x exact. */
        window.resizeTo(target.width, target.height);
        window.moveTo(desired.x + leftInset, desired.y);
        window.resizeTo(target.width, target.height);
      } catch (error) { /* a cosmetic preference must never break the page */ }
    }

    apply();

    /* The window is hidden during boot; its renderer metrics can lag one
       frame behind. Correct at most twice, and only when the measured
       content or position is actually off. Never loop: every correction
       goes through the safe resize-move-resize sequence above. */
    var attempts = 0;
    var settled = false;
    function verify() {
      if (settled || attempts >= 2) return;
      attempts += 1;
      var currentSize = { width: Math.round(innerWidth), height: Math.round(innerHeight) };
      var currentPoint = { x: Math.round(screenX + leftInset), y: Math.round(screenY) };
      var sizeOk = Math.abs(currentSize.width - target.width) <= 1 &&
        Math.abs(currentSize.height - target.height) <= 1;
      var pointOk = Math.abs(currentPoint.x - desired.x) <= 2 &&
        Math.abs(currentPoint.y - desired.y) <= 2;
      if (!sizeOk || !pointOk) apply();
    }
    function settle() { settled = true; }
    window.addEventListener("pointerdown", settle, { passive: true });
    window.addEventListener("click", settle, { passive: true });
    window.addEventListener("keydown", settle, { passive: true });
    setTimeout(verify, 300);
    setTimeout(verify, 1200);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") verify();
    });

    /* ---- live tracking -------------------------------------------------
       The tray close button only hides the window, and the shell restores
       the last bounds itself, so localStorage is the source of truth. */
    var lastSize = null;
    var lastPoint = null;

    function capture(force) {
      if (!force && document.visibilityState !== "visible") return false;
      var width = Math.round(innerWidth);
      var height = Math.round(innerHeight);
      if (width < MIN_WIDTH || height < MIN_HEIGHT) return false;
      var x = Math.round(screenX + leftInset);
      var y = Math.round(screenY);
      if (Math.abs(x) > 100000 || Math.abs(y) > 100000) return false;
      if (force && (x < availLeft - 40 || x > availLeft + availWidth - 40 ||
        y < availTop - 40 || y > availTop + availHeight - 40)) return false;
      lastSize = { width: width, height: height };
      lastPoint = { x: x, y: y };
      return true;
    }

    function snapshot() {
      capture(false);
    }

    function saveLast() {
      if (!lastSize) return;
      var value = readRaw();
      var old = size(value.last);
      if (old && old.width === lastSize.width && old.height === lastSize.height) return;
      write({ last: lastSize });
    }

    function savePoint() {
      var value = readRaw();
      if (value.rememberPosition !== true || !lastPoint) return;
      var old = point(value.position);
      if (old && old.x === lastPoint.x && old.y === lastPoint.y) return;
      write({ position: lastPoint });
    }

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      snapshot();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(saveLast, 600);
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        snapshot();
        saveLast();
        savePoint();
      } else {
        capture(true);
        saveLast();
        savePoint();
      }
    });

    window.addEventListener("blur", function () {
      snapshot();
      savePoint();
    }, { passive: true });

    function saveNow() {
      capture(true);
      saveLast();
      savePoint();
    }
    window.addEventListener("pagehide", saveNow, { passive: true });
    window.addEventListener("beforeunload", saveNow, { passive: true });

    var pointTimer = null;
    setInterval(function () {
      if (document.visibilityState !== "visible") return;
      snapshot();
      var value = readRaw();
      if (value.rememberPosition !== true || !lastPoint) return;
      var old = point(value.position);
      if (old && old.x === lastPoint.x && old.y === lastPoint.y) return;
      clearTimeout(pointTimer);
      pointTimer = setTimeout(savePoint, 400);
    }, 1000);
  } catch (error) {
    /* A cosmetic preference must never break the boot sequence. */
  }
})();`;

export function apply(ctx) {
  ctx.on("webserver/index-inject", (table) => {
    table.push({ kind: "script", placement: "body", text: BOOT_SCRIPT });
  });
}
