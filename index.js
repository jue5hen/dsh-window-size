/**
 * Host half of the dsh-window-size bundle.
 *
 * Window size is a Client-side presentation preference: the Client module
 * (`client.js`) applies the saved size at boot and renders the settings page.
 * The Host half stays inert so the bundle adds no Host process, no storage
 * writes and no configuration surface to the running Harness.
 */
export function apply() {}
