/**
 * MCP Response Utilities — Filesystem
 *
 * Self-contained MCP parsing utilities for the Filesystem widget package.
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
    if (typeof text !== "string") return text;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export function isMcpError(res, parsed) {
    if (res?.isError) {
        return typeof parsed === "string" ? parsed : extractMcpText(res);
    }
    if (
        typeof parsed === "string" &&
        parsed.toLowerCase().startsWith("error")
    ) {
        return parsed;
    }
    if (
        typeof parsed === "object" &&
        parsed !== null &&
        parsed.ok === false &&
        parsed.error
    ) {
        return String(parsed.error);
    }
    return null;
}
