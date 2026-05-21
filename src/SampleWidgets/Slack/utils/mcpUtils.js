/**
 * MCP Response Utilities — Slack
 *
 * Self-contained MCP parsing utilities for the Slack widget package.
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

// slack-mcp-server returns most list/read tools (channels_list,
// conversations_history/replies/search, users_search) as CSV inside the
// MCP text content — hardcoded in the Go server with no env knob to
// switch to JSON. The CSV columns are the Go struct field names
// (`ID,Name,Topic,Purpose,MemberCount,Cursor` for channels; `MsgID,
// UserID,UserName,RealName,Channel,ThreadTs,Text,Time,...` for messages),
// so widget code that reads `.id` / `.name` needs the keys normalized
// to lowercase-first / camelCase. See pkg/handler/{channels,
// conversations}.go in github.com/korotovsky/slack-mcp-server.
export function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQ = !inQ;
            }
        } else if (c === "," && !inQ) {
            out.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out;
}

// All-caps keys (`ID`, `URL`) → fully lowercase; otherwise lowercase the
// first character only (`Name` → `name`, `MemberCount` → `memberCount`).
// Keeps widget code idiomatic without having to know which Go struct it
// came from.
export function normalizeCsvKey(key) {
    if (/^[A-Z]+$/.test(key)) return key.toLowerCase();
    return key.charAt(0).toLowerCase() + key.slice(1);
}

export function csvToObjects(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) =>
        normalizeCsvKey(h.trim())
    );
    return lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = cells[i] ?? "";
        });
        // Channel CSVs ship `#channel-name` in the Name column. Strip
        // the leading `#` so widgets that render `#${ch.name}` don't
        // double up. Harmless for other tools — their `name` field
        // doesn't start with `#`.
        if (typeof obj.name === "string" && obj.name.startsWith("#")) {
            obj.name = obj.name.slice(1);
        }
        return obj;
    });
}

// Heuristic for CSV detection: first non-blank line is a header line of
// the form `Word(,Word)+` (letters, digits, underscores only — no spaces
// in slack-mcp-server's column names), followed by at least one more
// line. Tight enough to not false-positive on prose that happens to
// contain commas.
export function looksLikeCsv(text) {
    if (typeof text !== "string") return false;
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    if (!/^\w+(,\w+)+$/.test(firstLine.trim())) return false;
    return text.indexOf("\n") !== -1;
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

    // CSV path — slack-mcp-server returns CSV for list/read tools.
    // Check before extractJsonFromText so a CSV row that happens to
    // contain a `{` or `[` in a quoted cell doesn't get mis-parsed as
    // JSON.
    if (looksLikeCsv(parsed)) {
        return { data: csvToObjects(parsed), error: null, text };
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
