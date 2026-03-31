/**
 * Relevance Scorer
 *
 * Compares actual search results against expected/ideal ordering.
 * Computes position-based metrics for SE demos.
 */

/**
 * Compute relevance metrics by comparing actual result order to expected.
 *
 * @param {object[]} actualHits - Search results in returned order
 * @param {string[]} expectedIds - objectIDs in ideal order (best first)
 * @param {string} idField - Field to use as identifier (default: "objectID")
 * @returns {{ score: number, maxScore: number, hitDetails: object[], metrics: object }}
 */
export function scoreRelevance(actualHits, expectedIds, idField = "objectID") {
    if (
        !actualHits ||
        actualHits.length === 0 ||
        !expectedIds ||
        expectedIds.length === 0
    ) {
        return { score: 0, maxScore: 0, hitDetails: [], metrics: {} };
    }

    const actualIds = actualHits.map((h) => h[idField]);
    const expectedSet = new Set(expectedIds);

    // Position match: how many expected results appear in the top N?
    const topN = expectedIds.length;
    let foundInTopN = 0;
    let sumReciprocalRank = 0;
    let firstFoundAt = -1;

    const hitDetails = actualHits.map((hit, idx) => {
        const id = hit[idField];
        const isExpected = expectedSet.has(id);
        const expectedPosition = expectedIds.indexOf(id);
        const positionDelta =
            expectedPosition >= 0 ? idx - expectedPosition : null;

        if (isExpected && idx < topN) {
            foundInTopN++;
        }

        if (isExpected && firstFoundAt === -1) {
            firstFoundAt = idx;
            sumReciprocalRank = 1 / (idx + 1);
        } else if (isExpected) {
            sumReciprocalRank += 1 / (idx + 1);
        }

        return {
            position: idx + 1,
            id,
            title: hit.title || hit.name || hit.label || id,
            isExpected,
            expectedPosition:
                expectedPosition >= 0 ? expectedPosition + 1 : null,
            positionDelta,
            status: !isExpected
                ? "unexpected"
                : positionDelta === 0
                ? "perfect"
                : Math.abs(positionDelta) <= 2
                ? "close"
                : "displaced",
        };
    });

    // Precision at N: fraction of top-N results that are expected
    const precisionAtN = topN > 0 ? Math.round((foundInTopN / topN) * 100) : 0;

    // Mean Reciprocal Rank
    const mrr =
        expectedIds.length > 0
            ? Math.round((sumReciprocalRank / expectedIds.length) * 100)
            : 0;

    // Simple score: percentage of expected results found in actual
    const foundCount = actualIds.filter((id) => expectedSet.has(id)).length;
    const recall =
        expectedIds.length > 0
            ? Math.round((foundCount / expectedIds.length) * 100)
            : 0;

    return {
        score: precisionAtN,
        maxScore: 100,
        hitDetails,
        metrics: {
            precisionAtN,
            recall,
            mrr,
            foundInTopN,
            totalExpected: expectedIds.length,
            firstFoundAt: firstFoundAt >= 0 ? firstFoundAt + 1 : null,
        },
    };
}
