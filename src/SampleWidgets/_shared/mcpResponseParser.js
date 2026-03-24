/**
 * Shared MCP Response Parser
 *
 * Unified utilities for parsing MCP tool call responses across all SampleWidgets.
 *
 * MCP response chain: callTool() returns { content: [{ type: "text", text: "<data>" }], isError?: boolean }
 * extractMcpText() pulls text from the content array, then safeParse() attempts JSON.parse.
 * parseMcpResponse() is the unified pipeline that handles the full chain.
 */

/**
 * Extract text from an MCP response content array.
 * @param {object|string} res - Raw MCP response
 * @returns {string} Extracted text
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

/**
 * JSON.parse with graceful fallback.
 * @param {string} text - Text to parse
 * @returns {any} Parsed JSON or original string
 */
export function safeParse(text) {
    if (typeof text !== "string") return text;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * Find and parse JSON embedded within text that has a preamble line.
 * e.g. "Found 3 channels:\n[{...}]" -> [{...}]
 * @param {string} text - Text potentially containing JSON after a preamble
 * @returns {any|null} Parsed JSON or null if not found
 */
export function extractJsonFromText(text) {
    if (typeof text !== "string") return null;

    // Try to find JSON array starting with [
    const arrayMatch = text.indexOf("[");
    if (arrayMatch !== -1) {
        try {
            return JSON.parse(text.slice(arrayMatch));
        } catch {
            // not valid JSON from that point
        }
    }

    // Try to find JSON object starting with {
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

/**
 * Check if an MCP response indicates an error.
 * Detects: MCP-level isError, text starting with "error",
 * and API-level {ok:false, error:"..."} patterns (Slack, etc.)
 * @param {object} res - Raw MCP response
 * @param {any} parsed - Parsed response data
 * @returns {string|null} Error message or null
 */
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
    // Detect API-level errors: {ok: false, error: "..."} (Slack, etc.)
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
 * Unified MCP response parsing pipeline.
 *
 * @param {object} res - Raw MCP response from callTool()
 * @param {object} options
 * @param {string[]} [options.arrayKeys] - Property names to check for array data (e.g. ["channels", "items"])
 * @param {function} [options.textParser] - Custom parser for non-JSON text responses
 * @returns {{ data: any, error: string|null, text: string }}
 */
export function parseMcpResponse(res, options = {}) {
    const { arrayKeys, textParser } = options;

    const text = extractMcpText(res);
    const parsed = safeParse(text);

    // Check for errors
    const error = isMcpError(res, parsed);
    if (error) {
        return { data: null, error, text };
    }

    // If parsed is already an array, return it directly
    if (Array.isArray(parsed)) {
        return { data: parsed, error: null, text };
    }

    // If parsed is an object and we have arrayKeys, look for array data
    if (arrayKeys && typeof parsed === "object" && parsed !== null) {
        for (const key of arrayKeys) {
            // Support dotted paths like "messages.matches"
            const value = key.split(".").reduce((obj, k) => obj?.[k], parsed);
            if (Array.isArray(value)) {
                return { data: value, error: null, text };
            }
        }
    }

    // If parsed is a non-string object (JSON parsed successfully), return it
    if (typeof parsed !== "string") {
        return { data: parsed, error: null, text };
    }

    // Parsed is a string — try extracting embedded JSON
    const extracted = extractJsonFromText(parsed);
    if (extracted !== null) {
        return { data: extracted, error: null, text };
    }

    // Try custom text parser
    if (textParser) {
        const textParsed = textParser(parsed);
        if (textParsed !== null && textParsed !== undefined) {
            return { data: textParsed, error: null, text };
        }
    }

    // Return raw text as data
    return { data: parsed, error: null, text };
}

// --- Per-service text parsers ---

/**
 * Parse GitHub text entries like "1. owner/repo - description"
 */
export function parseGitHubTextEntries(text) {
    const lines = text.split("\n").filter((l) => l.trim());
    const entries = [];
    for (const line of lines) {
        const match = line.match(/^\d+\.\s+([^\s]+\/[^\s]+)\s*[-–—]\s*(.*)$/);
        if (match) {
            const [owner, name] = match[1].split("/");
            entries.push({
                full_name: match[1],
                name: name || match[1],
                owner: { login: owner || "" },
                description: match[2]?.trim() || "",
            });
        }
    }
    return entries.length > 0 ? entries : null;
}

/**
 * Parse Slack text entries like "#channel-name (C12345)"
 */
export function parseSlackTextEntries(text) {
    const lines = text.split("\n").filter((l) => l.trim());
    const entries = [];
    for (const line of lines) {
        const match = line.match(/#?(\S+)\s*\((\w+)\)/);
        if (match) {
            entries.push({ name: match[1], id: match[2] });
        }
    }
    return entries.length > 0 ? entries : null;
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
