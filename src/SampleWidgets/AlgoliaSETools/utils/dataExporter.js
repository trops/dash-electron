/**
 * Data Export Utilities
 *
 * Convert { columns, rows } data into target formats (CSV, TSV, JSON, NDJSON).
 */

/**
 * Escape a CSV cell value — wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvCell(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Export to CSV format.
 * @param {string[]} columns - Column names
 * @param {object[]} rows - Row objects keyed by column name
 * @returns {string}
 */
export function toCsv(columns, rows) {
    const header = columns.map(escapeCsvCell).join(",");
    const body = rows
        .map((row) => columns.map((col) => escapeCsvCell(row[col])).join(","))
        .join("\n");
    return header + "\n" + body;
}

/**
 * Export to TSV format.
 * @param {string[]} columns - Column names
 * @param {object[]} rows - Row objects keyed by column name
 * @returns {string}
 */
export function toTsv(columns, rows) {
    const header = columns.join("\t");
    const body = rows
        .map((row) => columns.map((col) => String(row[col] ?? "")).join("\t"))
        .join("\n");
    return header + "\n" + body;
}

/**
 * Export to JSON array format.
 * @param {string[]} columns - Column names
 * @param {object[]} rows - Row objects keyed by column name
 * @param {object} typeMap - Optional map of column → type for casting
 * @returns {string}
 */
export function toJson(columns, rows, typeMap = {}) {
    const typed = rows.map((row) => {
        const obj = {};
        columns.forEach((col) => {
            obj[col] = castValue(row[col], typeMap[col]);
        });
        return obj;
    });
    return JSON.stringify(typed, null, 2);
}

/**
 * Export to NDJSON format (one JSON object per line).
 * @param {string[]} columns - Column names
 * @param {object[]} rows - Row objects keyed by column name
 * @param {object} typeMap - Optional map of column → type for casting
 * @returns {string}
 */
export function toNdjson(columns, rows, typeMap = {}) {
    return rows
        .map((row) => {
            const obj = {};
            columns.forEach((col) => {
                obj[col] = castValue(row[col], typeMap[col]);
            });
            return JSON.stringify(obj);
        })
        .join("\n");
}

/**
 * Cast a string value to the specified type.
 * @param {string} value - The raw string value
 * @param {string} type - "string" | "number" | "boolean" | "auto" | undefined
 * @returns {*}
 */
export function castValue(value, type) {
    if (value === "" || value === null || value === undefined) return value;
    switch (type) {
        case "number": {
            const num = Number(value);
            return isNaN(num) ? value : num;
        }
        case "boolean": {
            const lower = String(value).toLowerCase().trim();
            if (lower === "true" || lower === "1" || lower === "yes")
                return true;
            if (lower === "false" || lower === "0" || lower === "no")
                return false;
            return value;
        }
        case "auto": {
            // Try number first
            const num = Number(value);
            if (!isNaN(num) && String(value).trim() !== "") return num;
            // Try boolean
            const lower = String(value).toLowerCase().trim();
            if (lower === "true") return true;
            if (lower === "false") return false;
            return value;
        }
        default:
            return value;
    }
}

/**
 * Export data to a target format.
 * @param {string[]} columns
 * @param {object[]} rows
 * @param {string} format - "csv" | "tsv" | "json" | "ndjson"
 * @param {object} typeMap - Column type overrides
 * @returns {string}
 */
export function exportToFormat(columns, rows, format, typeMap = {}) {
    switch (format) {
        case "csv":
            return toCsv(columns, rows);
        case "tsv":
            return toTsv(columns, rows);
        case "json":
            return toJson(columns, rows, typeMap);
        case "ndjson":
            return toNdjson(columns, rows, typeMap);
        default:
            return toJson(columns, rows, typeMap);
    }
}
