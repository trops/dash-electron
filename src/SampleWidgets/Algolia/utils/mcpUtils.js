/**
 * MCP Response Utilities — Algolia
 *
 * Self-contained MCP parsing utilities for the Algolia widget package.
 */

export function extractMcpText(res) {
    if (typeof res === "string") return res;
    if (res?.content && Array.isArray(res.content)) {
        return res.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
    }
    return JSON.stringify(res, null, 2);
}

export function parseMcpJson(res) {
    const text = extractMcpText(res);
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * Indices exposed by an Algolia MCP server, one search tool per index.
 * Current servers name them `algolia_search_index_<index>` next to other
 * `algolia_search_*` tools (e.g. `algolia_search_for_facet_values`), so
 * only the `index_` tools count when present. Older servers used
 * `algolia_search_<index>`.
 *
 * @returns {Array<{ index: string, suffix: string }>} `suffix` is the part
 *   after `algolia_search_` — call `algolia_search_${suffix}`.
 */
export function listSearchIndices(tools) {
    const names = (tools || [])
        .map((t) => t?.name || t)
        .filter((n) => typeof n === "string" && n.startsWith("algolia_search_"))
        .map((n) => n.slice("algolia_search_".length));
    const indexTools = names.filter((s) => s.startsWith("index_"));
    if (indexTools.length > 0) {
        return indexTools.map((suffix) => ({
            index: suffix.slice("index_".length),
            suffix,
        }));
    }
    return names
        .filter((s) => s !== "for_facet_values")
        .map((suffix) => ({ index: suffix, suffix }));
}

/**
 * Arguments for an index search tool, shaped by its input schema. Current
 * servers take `queries: [{ query }]` plus required `userIntent`,
 * `originalQuery` and `sessionId`; older ones take a plain `query`.
 */
export function buildSearchParams(
    schema,
    { query, page, hitsPerPage, sessionId }
) {
    const props = schema || {};
    const params = {};
    if ("queries" in props) params.queries = [{ query }];
    else if ("query" in props) params.query = query;
    if ("userIntent" in props) params.userIntent = query || "browse records";
    if ("originalQuery" in props) params.originalQuery = query;
    if ("sessionId" in props) params.sessionId = sessionId;
    if ("hitsPerPage" in props) params.hitsPerPage = hitsPerPage;
    if ("hits_per_page" in props) params.hits_per_page = hitsPerPage;
    if ("page" in props) params.page = page;
    return params;
}

/**
 * Normalize a search tool's parsed response to `{ hits, nbHits, nbPages }`.
 * A multi-query response is an array of results; the first is used.
 * `nbPages` is null when the server doesn't report it.
 */
export function normalizeSearchResult(parsed) {
    const result =
        Array.isArray(parsed) && parsed[0]?.hits ? parsed[0] : parsed;
    if (result && Array.isArray(result.hits)) {
        return {
            hits: result.hits,
            nbHits: result.nbHits ?? result.hits.length,
            nbPages: result.nbPages ?? null,
        };
    }
    if (Array.isArray(result)) {
        return { hits: result, nbHits: result.length, nbPages: null };
    }
    return null;
}
