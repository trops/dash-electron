/**
 * MCP Response Utilities — Notion
 *
 * Self-contained MCP parsing utilities for the Notion widget package.
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

export function extractJsonFromText(text) {
    if (typeof text !== "string") return null;

    const arrayMatch = text.indexOf("[");
    if (arrayMatch !== -1) {
        try {
            return JSON.parse(text.slice(arrayMatch));
        } catch {
            // not valid JSON from that point
        }
    }

    const objMatch = text.indexOf("{");
    if (objMatch !== -1) {
        try {
            return JSON.parse(text.slice(objMatch));
        } catch {
            // not valid JSON from that point
        }
    }

    return null;
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

export function parseMcpResponse(res, options = {}) {
    const { arrayKeys, textParser } = options;

    const text = extractMcpText(res);
    const parsed = safeParse(text);

    const error = isMcpError(res, parsed);
    if (error) {
        return { data: null, error, text };
    }

    if (Array.isArray(parsed)) {
        return { data: parsed, error: null, text };
    }

    if (arrayKeys && typeof parsed === "object" && parsed !== null) {
        for (const key of arrayKeys) {
            const value = key.split(".").reduce((obj, k) => obj?.[k], parsed);
            if (Array.isArray(value)) {
                return { data: value, error: null, text };
            }
        }
    }

    if (typeof parsed !== "string") {
        return { data: parsed, error: null, text };
    }

    const extracted = extractJsonFromText(parsed);
    if (extracted !== null) {
        if (Array.isArray(extracted)) {
            return { data: extracted, error: null, text };
        }
        if (arrayKeys && typeof extracted === "object") {
            for (const key of arrayKeys) {
                const value = key
                    .split(".")
                    .reduce((obj, k) => obj?.[k], extracted);
                if (Array.isArray(value)) {
                    return { data: value, error: null, text };
                }
            }
        }
        return { data: extracted, error: null, text };
    }

    if (textParser) {
        const textParsed = textParser(parsed);
        if (textParsed !== null && textParsed !== undefined) {
            return { data: textParsed, error: null, text };
        }
    }

    return { data: parsed, error: null, text };
}

/**
 * Parse Notion text entries like "- Page Title (page_id)"
 */
export function parseNotionTextEntries(text) {
    const lines = text.split("\n").filter((l) => l.trim());
    const entries = [];
    for (const line of lines) {
        const match = line.match(/[-•]\s+(.+?)\s*\((\S+)\)/);
        if (match) {
            entries.push({
                title: match[1]?.trim(),
                id: match[2],
                object: "page",
            });
        }
    }
    return entries.length > 0 ? entries : null;
}
