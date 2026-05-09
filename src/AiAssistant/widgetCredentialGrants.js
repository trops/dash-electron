/**
 * Widget credential-grants store (slice 17d.1).
 *
 * Persists per-(packageName, service, method) booleans in
 * localStorage. Drives the install-time permission modal:
 * before a widget is installed, the user reviews the credential
 * methods it would call and decides which to grant. Default for
 * absent entries is `false` (denied) — calls without an explicit
 * grant are blocked at the IPC layer (slice 17d.2 wires the
 * enforcement; this slice ships the storage + UI).
 *
 * Why localStorage and not electron-store: this is renderer-side
 * state that follows the install flow. It mirrors the existing
 * pattern of `dash-widget-builder` chat history. A future slice
 * can move it to a hardened main-process store; for now
 * localStorage is enough to plumb the UX end-to-end.
 */

export const GRANTS_STORAGE_KEY = "dash:widget-credential-grants";

function readAll() {
    try {
        const raw = window.localStorage.getItem(GRANTS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(allGrants) {
    try {
        window.localStorage.setItem(
            GRANTS_STORAGE_KEY,
            JSON.stringify(allGrants)
        );
    } catch {
        // localStorage may be disabled (private browsing, quota);
        // silent failure is acceptable — next read returns the
        // pre-write state, and the install-time modal will simply
        // re-prompt next time.
    }
}

/**
 * Read every grant for a package. Returns `{}` if the package has
 * no grants stored.
 */
export function getGrants(packageName) {
    if (!packageName || typeof packageName !== "string") return {};
    const all = readAll();
    const entry = all[packageName];
    return entry && typeof entry === "object" ? entry : {};
}

/**
 * Read a single (service, method) grant. Defaults to `false`
 * (denied) — calls without explicit consent are blocked.
 */
export function getGrant(packageName, service, method) {
    const grants = getGrants(packageName);
    const svc = grants[service];
    if (!svc || typeof svc !== "object") return false;
    return svc[method] === true;
}

/**
 * Atomically replace the grants for a package. Other packages'
 * grants are left untouched.
 */
export function setGrants(packageName, grants) {
    if (!packageName || typeof packageName !== "string") return;
    const all = readAll();
    all[packageName] = grants && typeof grants === "object" ? grants : {};
    writeAll(all);
}

/**
 * Clear all grants for a package (e.g. on uninstall).
 */
export function clearGrantsForPackage(packageName) {
    if (!packageName || typeof packageName !== "string") return;
    const all = readAll();
    if (all[packageName]) {
        delete all[packageName];
        writeAll(all);
    }
}
