/**
 * MCP Response Utilities — Gmail
 *
 * Self-contained MCP parsing utilities for the Gmail widget package.
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

export function parseSearchResults(text) {
    if (typeof text !== "string") return [];
    const entries = [];
    let current = null;
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("ID:")) {
            if (current) entries.push(current);
            current = { id: trimmed.replace("ID:", "").trim() };
        } else if (current && trimmed.startsWith("Subject:")) {
            current.subject = trimmed.replace("Subject:", "").trim();
        } else if (current && trimmed.startsWith("From:")) {
            current.from = trimmed.replace("From:", "").trim();
        } else if (current && trimmed.startsWith("Date:")) {
            current.date = trimmed.replace("Date:", "").trim();
        }
    }
    if (current) entries.push(current);
    return entries;
}

export function parseEmailBody(text) {
    if (typeof text !== "string") return text;
    const lines = text.split("\n");
    const headers = {};
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "") {
            bodyStart = i + 1;
            break;
        }
        if (line.startsWith("Subject:"))
            headers.subject = line.replace("Subject:", "").trim();
        else if (line.startsWith("From:"))
            headers.from = line.replace("From:", "").trim();
        else if (line.startsWith("To:"))
            headers.to = line.replace("To:", "").trim();
        else if (line.startsWith("Date:"))
            headers.date = line.replace("Date:", "").trim();
        else if (line.startsWith("Thread ID:"))
            headers.threadId = line.replace("Thread ID:", "").trim();
    }
    headers.body = lines.slice(bodyStart).join("\n").trim();
    return headers;
}
