/**
 * MCP Response Utilities — Gong
 *
 * Self-contained MCP parsing utilities for the Gong widget package.
 *
 * The callTool() hook can return responses in many formats depending on the
 * MCP server implementation.  This module normalises all of them into a
 * consistent { data, error, raw } shape.
 *
 * Known response shapes:
 *   1. Standard MCP:  { content: [{ type:"text", text:"..." }] }
 *   2. Unwrapped:     "plain string"
 *   3. Direct object:  { calls: [...] }  (JSON already parsed by IPC)
 *   4. Direct array:   [{ id: "1" }, ...]
 */

/**
 * Dig into any wrapper layers and pull out the innermost text or object.
 * Handles: strings, { content:[...] }, { result: X }, nested combos.
 */
export function unwrapResponse(res) {
    if (res == null) return res;
    if (typeof res === "string") return res;

    // Standard MCP content blocks — join all text blocks
    if (res.content && Array.isArray(res.content)) {
        const text = res.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        if (text) return text;
    }

    // { result: <inner> } wrapper (some servers / IPC bridges)
    if ("result" in res && Object.keys(res).length <= 3) {
        return unwrapResponse(res.result);
    }

    // Already a usable object / array — return as-is
    return res;
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
        return typeof parsed === "string"
            ? parsed
            : JSON.stringify(res, null, 2);
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

/**
 * Search an object for an array at any of the given keys (supports dot paths).
 */
function findArray(obj, arrayKeys) {
    if (!arrayKeys || typeof obj !== "object" || obj === null) return null;
    for (const key of arrayKeys) {
        const value = key.split(".").reduce((o, k) => o?.[k], obj);
        if (Array.isArray(value)) return value;
    }
    return null;
}

/**
 * Parse an MCP tool response into { data, error, raw }.
 *
 * `raw` is always the stringified form of whatever came back — the widget
 * can display it as a fallback so the user always sees *something*.
 */
export function parseMcpResponse(res, options = {}) {
    const { arrayKeys, textParser } = options;

    // Keep raw for debug display
    const raw =
        typeof res === "string" ? res : JSON.stringify(res, null, 2) || "";

    // 1. Unwrap any server / IPC wrappers
    const inner = unwrapResponse(res);

    // 2. If we got a string, try parsing as JSON
    const parsed = safeParse(inner);

    // 3. Error check
    const error = isMcpError(res, parsed);
    if (error) return { data: null, error, raw };

    // 4. Already an array
    if (Array.isArray(parsed)) return { data: parsed, error: null, raw };

    // 5. Object — search for arrays at known keys
    if (typeof parsed === "object" && parsed !== null) {
        const arr = findArray(parsed, arrayKeys);
        if (arr) return { data: arr, error: null, raw };
        // Return the object itself (useful for summaries / transcripts)
        return { data: parsed, error: null, raw };
    }

    // 6. String — try extracting embedded JSON
    if (typeof parsed === "string") {
        const extracted = extractJsonFromText(parsed);
        if (extracted !== null) {
            if (Array.isArray(extracted))
                return { data: extracted, error: null, raw };
            const arr = findArray(extracted, arrayKeys);
            if (arr) return { data: arr, error: null, raw };
            return { data: extracted, error: null, raw };
        }

        // 7. Custom text parser
        if (textParser) {
            const textParsed = textParser(parsed);
            if (textParsed != null)
                return { data: textParsed, error: null, raw };
        }
    }

    // 8. Return whatever we have
    return { data: parsed, error: null, raw };
}

/**
 * Parse Gong text entries like "1. Call Title (2026-03-01) - ID: abc123"
 */
export function parseGongTextEntries(text) {
    const lines = text.split("\n").filter((l) => l.trim());
    const entries = [];
    for (const line of lines) {
        const match = line.match(
            /^\d+\.\s+(.+?)\s*(?:\(([^)]+)\))?\s*[-–—]\s*(?:ID:\s*)?(\S+)/
        );
        if (match) {
            entries.push({
                title: match[1]?.trim(),
                date: match[2] || "",
                id: match[3],
            });
        }
    }
    return entries.length > 0 ? entries : null;
}
