/**
 * Attribute Analyzer
 *
 * Analyzes a sample of Algolia index records to discover attribute
 * characteristics: types, cardinality, null/empty rates, value samples.
 */

/**
 * Infer the type of a value.
 * @param {*} val
 * @returns {"string"|"number"|"boolean"|"array"|"object"|"null"}
 */
export function inferType(val) {
    if (val === null || val === undefined) return "null";
    if (Array.isArray(val)) return "array";
    return typeof val;
}

/**
 * Analyze an array of records and produce per-attribute statistics.
 * @param {object[]} records - Array of Algolia hit objects
 * @returns {{ attributes: object[], totalRecords: number }}
 */
export function analyzeRecords(records) {
    if (!records || records.length === 0) {
        return { attributes: [], totalRecords: 0 };
    }

    const stats = {};

    for (const record of records) {
        if (typeof record !== "object" || record === null) continue;

        for (const [key, value] of Object.entries(record)) {
            // Skip Algolia internal fields
            if (key === "_highlightResult" || key === "_snippetResult")
                continue;

            if (!stats[key]) {
                stats[key] = {
                    name: key,
                    types: {},
                    presentCount: 0,
                    nullCount: 0,
                    emptyCount: 0,
                    uniqueValues: new Set(),
                    sampleValues: [],
                    isObjectID: key === "objectID",
                };
            }

            const s = stats[key];
            const type = inferType(value);

            s.types[type] = (s.types[type] || 0) + 1;

            if (value === null || value === undefined) {
                s.nullCount++;
            } else if (
                value === "" ||
                (Array.isArray(value) && value.length === 0)
            ) {
                s.emptyCount++;
                s.presentCount++;
            } else {
                s.presentCount++;
            }

            // Track unique values (up to 50 for cardinality estimation)
            if (
                s.uniqueValues.size < 50 &&
                value !== null &&
                value !== undefined
            ) {
                const serialized =
                    typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value);
                s.uniqueValues.add(serialized);
            }

            // Keep up to 3 sample values
            if (
                s.sampleValues.length < 3 &&
                value !== null &&
                value !== undefined &&
                value !== ""
            ) {
                const display =
                    typeof value === "object"
                        ? JSON.stringify(value).slice(0, 80)
                        : String(value).slice(0, 80);
                if (!s.sampleValues.includes(display)) {
                    s.sampleValues.push(display);
                }
            }
        }
    }

    const totalRecords = records.length;
    const attributes = Object.values(stats).map((s) => {
        const typeEntries = Object.entries(s.types).sort((a, b) => b[1] - a[1]);
        const primaryType =
            typeEntries.length > 0 ? typeEntries[0][0] : "unknown";
        const missingCount = totalRecords - s.presentCount - s.nullCount;

        return {
            name: s.name,
            primaryType,
            types: typeEntries.map(([type, count]) => ({ type, count })),
            presentCount: s.presentCount,
            nullCount: s.nullCount,
            emptyCount: s.emptyCount,
            missingCount: missingCount > 0 ? missingCount : 0,
            fillRate: Math.round(
                ((s.presentCount + s.nullCount) / totalRecords) * 100
            ),
            cardinality: s.uniqueValues.size,
            cardinalityNote: s.uniqueValues.size >= 50 ? "50+ (sampled)" : null,
            sampleValues: s.sampleValues,
            isObjectID: s.isObjectID,
        };
    });

    // Sort: objectID first, then by fill rate descending
    attributes.sort((a, b) => {
        if (a.isObjectID) return -1;
        if (b.isObjectID) return 1;
        return b.fillRate - a.fillRate;
    });

    return { attributes, totalRecords };
}
