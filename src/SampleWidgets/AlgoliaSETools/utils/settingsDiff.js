/**
 * Settings Diff Utility
 *
 * Compares two Algolia index settings objects and produces a structured
 * diff showing what's different, added, or removed between them.
 */

/**
 * Keys we compare — the most important Algolia settings for an SE audit.
 */
const DIFF_KEYS = [
    "searchableAttributes",
    "customRanking",
    "attributesForFaceting",
    "ranking",
    "attributesToRetrieve",
    "unretrievableAttributes",
    "attributesToHighlight",
    "attributesToSnippet",
    "highlightPreTag",
    "highlightPostTag",
    "snippetEllipsisText",
    "typoTolerance",
    "minWordSizefor1Typo",
    "minWordSizefor2Typos",
    "allowTyposOnNumericTokens",
    "disableTypoToleranceOnAttributes",
    "hitsPerPage",
    "paginationLimitedTo",
    "maxValuesPerFacet",
    "distinct",
    "attributeForDistinct",
    "removeStopWords",
    "exactOnSingleWordQuery",
    "alternativesAsExact",
];

/**
 * Normalize a value for display.
 */
function displayValue(val) {
    if (val === undefined || val === null) return "(not set)";
    if (Array.isArray(val)) {
        return val.length === 0 ? "(empty array)" : val.join(", ");
    }
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
}

/**
 * Check if two values are equal (deep comparison for arrays/objects).
 */
function isEqual(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare two Algolia settings objects.
 * @param {object} settingsA - First index settings
 * @param {object} settingsB - Second index settings
 * @returns {{ diffs: object[], identical: string[], summary: object }}
 */
export function diffSettings(settingsA, settingsB) {
    const a = settingsA || {};
    const b = settingsB || {};

    const diffs = [];
    const identical = [];

    for (const key of DIFF_KEYS) {
        const valA = a[key];
        const valB = b[key];

        if (isEqual(valA, valB)) {
            identical.push(key);
        } else {
            diffs.push({
                key,
                valueA: displayValue(valA),
                valueB: displayValue(valB),
                rawA: valA,
                rawB: valB,
            });
        }
    }

    // Also check for keys present in either settings but not in DIFF_KEYS
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const extraDiffs = [];
    for (const key of allKeys) {
        if (DIFF_KEYS.includes(key)) continue;
        if (key.startsWith("_") || key === "primary") continue;
        const valA = a[key];
        const valB = b[key];
        if (!isEqual(valA, valB)) {
            extraDiffs.push({
                key,
                valueA: displayValue(valA),
                valueB: displayValue(valB),
                rawA: valA,
                rawB: valB,
            });
        }
    }

    return {
        diffs,
        extraDiffs,
        identical,
        summary: {
            totalChecked: DIFF_KEYS.length,
            differences: diffs.length,
            identicalCount: identical.length,
            extraDifferences: extraDiffs.length,
        },
    };
}

export { DIFF_KEYS, displayValue, isEqual };
