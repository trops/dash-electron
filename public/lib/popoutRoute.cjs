/**
 * popoutRoute.cjs — dashboard popout URLs (bot-teams TEAM-011 B3).
 *
 * A popout can open in the Bots view on one bot (the Bot monitor's
 * "Open in Bots view"). The renderer's options are untrusted: only
 * view "bots", a plain bot id and a known tab ever reach the window's URL.
 */

const BOT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TABS = ["conversation", "activity", "settings"];

/**
 * @param {unknown} opts  { view, botId, tab } from the renderer
 * @returns {{ view: "bots", botId: string, tab: string } | null}
 */
function parseBotsOptions(opts) {
    if (!opts || typeof opts !== "object") return null;
    if (opts.view !== "bots") return null;
    if (typeof opts.botId !== "string" || !BOT_ID_RE.test(opts.botId)) {
        return null;
    }
    const tab = TABS.includes(opts.tab) ? opts.tab : "conversation";
    return { view: "bots", botId: opts.botId, tab };
}

/**
 * @param {string} workspaceId
 * @param {{ botId: string, tab: string } | null} bots  parseBotsOptions() result
 */
function popoutHashRoute(workspaceId, bots) {
    const base = `#/popout/${encodeURIComponent(String(workspaceId))}`;
    if (!bots) return base;
    return `${base}?view=bots&bot=${encodeURIComponent(
        bots.botId
    )}&tab=${encodeURIComponent(bots.tab)}`;
}

module.exports = { parseBotsOptions, popoutHashRoute };
