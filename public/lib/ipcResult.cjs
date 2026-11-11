/**
 * ipcResult — did an IPC handler's answer say it failed? (issues PRD)
 *
 * Some handlers answer a failure instead of throwing: `{ error: true,
 * message }` (Dash's own, e.g. a widget's MCP call) or an MCP tool result with `isError`. The Debug Console logs these as
 * errors, not successes.
 */

/** @returns {boolean} */
function resultFailed(result) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return false;
    }
    if (result.error === true) return true;
    const inner = result.result;
    return !!(inner && typeof inner === "object" && inner.isError === true);
}

/** The failure's own words, clipped. */
function failureText(result) {
    if (!result || typeof result !== "object") return "";
    if (typeof result.message === "string") return result.message.slice(0, 500);
    const inner = result.result;
    const parts =
        (inner && Array.isArray(inner.content) && inner.content) || [];
    return parts
        .map((p) => (p && typeof p.text === "string" ? p.text : ""))
        .join(" ")
        .slice(0, 500);
}

module.exports = { resultFailed, failureText };
