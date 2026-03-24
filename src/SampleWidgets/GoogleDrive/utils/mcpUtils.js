/**
 * MCP Response Utilities — Google Drive
 *
 * Self-contained MCP parsing utilities for the Google Drive widget package.
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

export function parseTextFileList(text) {
    const lines = text.split("\n").filter((line) => line.trim());
    const fileLines = lines.filter((line) => !line.startsWith("Found "));
    return fileLines
        .map((line) => {
            const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (match) {
                return { name: match[1].trim(), mimeType: match[2].trim() };
            }
            return { name: line.trim(), mimeType: null };
        })
        .filter((f) => f.name);
}
