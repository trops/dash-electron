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
