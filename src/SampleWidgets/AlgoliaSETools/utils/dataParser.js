/**
 * Data Parsing Utilities
 *
 * Detect format and parse CSV, TSV, JSON, and NDJSON into a uniform
 * { columns, rows } structure for the DataTransformer widget.
 */

/**
 * Detect the format of input text.
 * @param {string} text - Raw input text
 * @returns {"json"|"ndjson"|"csv"|"tsv"|"unknown"}
 */
export function detectFormat(text) {
    if (!text || typeof text !== "string") return "unknown";
    const trimmed = text.trim();
    if (!trimmed) return "unknown";

    // JSON array or object
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) || typeof parsed === "object")
                return "json";
        } catch {
            // Not valid JSON — check NDJSON
        }
    }

    // NDJSON: multiple lines each starting with {
    const lines = trimmed.split("\n").filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{"))) {
        try {
            lines.forEach((l) => JSON.parse(l.trim()));
            return "ndjson";
        } catch {
            // Not valid NDJSON
        }
    }

    // TSV: tabs in the first line
    const firstLine = lines[0] || "";
    if (firstLine.includes("\t") && lines.length > 1) return "tsv";

    // CSV: commas in the first line
    if (firstLine.includes(",") && lines.length > 1) return "csv";

    return "unknown";
}

/**
 * Parse CSV/TSV text into { columns, rows }.
 * @param {string} text - Raw CSV or TSV
 * @param {string} delimiter - "," for CSV, "\t" for TSV
 * @returns {{ columns: string[], rows: object[] }}
 */
export function parseDelimited(text, delimiter = ",") {
    const lines = text
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length === 0) return { columns: [], rows: [] };

    // Simple CSV parsing — handles quoted fields with commas inside
    function splitRow(line, delim) {
        const cells = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === delim && !inQuotes) {
                cells.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
        cells.push(current.trim());
        return cells;
    }

    const columns = splitRow(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitRow(lines[i], delimiter);
        const row = {};
        columns.forEach((col, idx) => {
            row[col] = cells[idx] !== undefined ? cells[idx] : "";
        });
        rows.push(row);
    }

    return { columns, rows };
}

/**
 * Parse JSON text into { columns, rows }.
 * Supports: JSON array of objects, single object, or wrapped { results: [...] }.
 * @param {string} text - Raw JSON
 * @returns {{ columns: string[], rows: object[] }}
 */
export function parseJson(text) {
    const parsed = JSON.parse(text.trim());

    let items;
    if (Array.isArray(parsed)) {
        items = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
        // Look for a nested array (common patterns: hits, results, records, data, items)
        const arrayKeys = [
            "hits",
            "results",
            "records",
            "data",
            "items",
            "objects",
        ];
        const key = arrayKeys.find(
            (k) => parsed[k] && Array.isArray(parsed[k])
        );
        if (key) {
            items = parsed[key];
        } else {
            items = [parsed];
        }
    } else {
        return { columns: [], rows: [] };
    }

    // Collect all unique keys across all objects
    const colSet = new Set();
    for (const item of items) {
        if (typeof item === "object" && item !== null) {
            Object.keys(item).forEach((k) => colSet.add(k));
        }
    }
    const columns = Array.from(colSet);

    const rows = items.map((item) => {
        const row = {};
        columns.forEach((col) => {
            const val = item[col];
            row[col] =
                val !== undefined && val !== null
                    ? typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)
                    : "";
        });
        return row;
    });

    return { columns, rows };
}

/**
 * Parse NDJSON text into { columns, rows }.
 * @param {string} text - Raw NDJSON (one JSON object per line)
 * @returns {{ columns: string[], rows: object[] }}
 */
export function parseNdjson(text) {
    const lines = text
        .trim()
        .split("\n")
        .filter((l) => l.trim());
    const items = lines.map((l) => JSON.parse(l.trim()));
    const colSet = new Set();
    for (const item of items) {
        Object.keys(item).forEach((k) => colSet.add(k));
    }
    const columns = Array.from(colSet);
    const rows = items.map((item) => {
        const row = {};
        columns.forEach((col) => {
            const val = item[col];
            row[col] =
                val !== undefined && val !== null
                    ? typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)
                    : "";
        });
        return row;
    });
    return { columns, rows };
}

/**
 * Parse any supported format into { columns, rows, format }.
 * @param {string} text - Raw input
 * @returns {{ columns: string[], rows: object[], format: string }}
 */
export function parseAny(text) {
    const format = detectFormat(text);
    switch (format) {
        case "csv":
            return { ...parseDelimited(text, ","), format };
        case "tsv":
            return { ...parseDelimited(text, "\t"), format };
        case "json":
            return { ...parseJson(text), format };
        case "ndjson":
            return { ...parseNdjson(text), format };
        default:
            return { columns: [], rows: [], format };
    }
}
