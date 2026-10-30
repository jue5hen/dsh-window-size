/**
 * Host half of dsh-window-size.
 *
 * The desktop shell shows its main window as soon as the page finishes
 * loading, which is well before a Client plugin module is fetched and
 * applied. The only hook earlier than that is the index injection table:
 * the shell hands these rows to the page during boot, so the inline script
 * below resizes and centers the window before the first paint.
 *
 * The row is harmless in the web client: the script returns unless the
 * desktop bridge is present. It holds no state of its own and writes
 * nothing; the size still lives in localStorage on the app origin.
 */
const BOOT_SCRIPT = `(function () {
  try {
    var bridge = globalThis.dshDesktop;
    if (!bridge || bridge.protocolVersion !== 1) return;
    var raw = localStorage.getItem("dsh-window-size:v2") || localStorage.getItem("dsh-window-size:v1");
    if (!raw) return;
    var data = JSON.parse(raw);
    var width = Math.round(Number(data.width));
    var height = Math.round(Number(data.height));
    if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return;
    var frameX = Math.round(outerWidth - innerWidth);
    var frameY = Math.round(outerHeight - innerHeight);
    if (!(frameX >= 1 && frameX <= 64)) frameX = 16;
    if (!(frameY >= 1 && frameY <= 96)) frameY = 8;
    var maxWidth = Math.max(screen.availWidth - frameX, 520);
    var maxHeight = Math.max(screen.availHeight - frameY, 600);
    width = Math.min(Math.max(width, 520), maxWidth);
    height = Math.min(Math.max(height, 600), maxHeight);
    /* A resize during the boot pass is measured with the frame included,
       so ask for the content size minus one frame and let the window
       settle at exactly the saved content size. */
    window.resizeTo(width - frameX, height - frameY);
    /* moveTo is ignored while the window is hidden, so try a few bounded
       single moves instead of a tight polling loop: repeated moveTo calls
       can make Windows maximize the window. Each attempt recomputes the
       center from the real outer size and stops as soon as it matches. */
    var attempts = 0;
    function recenter() {
      attempts += 1;
      var outerW = Math.round(outerWidth);
      var outerH = Math.round(outerHeight);
      var targetLeft = Math.max(0, Math.round((screen.availLeft || 0) + (screen.availWidth - outerW) / 2));
      var targetTop = Math.max(0, Math.round((screen.availTop || 0) + (screen.availHeight - outerH) / 2));
      if (Math.abs(window.screenX - targetLeft) <= 12 && Math.abs(window.screenY - targetTop) <= 12) return true;
      window.moveTo(targetLeft, targetTop);
      return false;
    }
    if (!recenter()) {
      var timer = setInterval(function () {
        if (recenter() || attempts >= 5) clearInterval(timer);
      }, 350);
    }
  } catch (error) {
    /* A cosmetic preference must never break the boot sequence. */
  }
})();`;

export function apply(ctx) {
  ctx.on("webserver/index-inject", (table) => {
    table.push({ kind: "script", placement: "body", text: BOOT_SCRIPT });
  });
}
