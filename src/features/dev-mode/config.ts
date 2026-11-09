// ─── Dev mode: is it allowed on this server (GET /app-config → devMode, from the DEV_MODE env at run time)? ───
// Asked once per page load. Anything but a clear `true` (missing field, network error, old server) = not allowed,
// so with DEV_MODE unset nothing on screen changes.
let allowed: Promise<boolean> | undefined;

export function loadDevModeAllowed(): Promise<boolean> {
    allowed ??= fetch('/app-config', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() as Promise<unknown> : null))
        .then(body => typeof body === 'object' && body !== null && 'devMode' in body && body.devMode === true)
        .catch(() => false);
    return allowed;
}
