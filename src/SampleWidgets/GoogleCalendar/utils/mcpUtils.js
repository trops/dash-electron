/**
 * MCP Response Utilities — Google Calendar
 *
 * Self-contained MCP parsing utilities for the Google Calendar widget package.
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

export function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
