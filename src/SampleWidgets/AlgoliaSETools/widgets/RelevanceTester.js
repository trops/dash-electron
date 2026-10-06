/**
 * RelevanceTester
 *
 * Run a search query against an Algolia index, see ranked results,
 * mark expected results, and get a relevance score. Core demo tool
 * for showing customers how relevance changes with config tweaks.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button3,
    SectionLabel,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
    StatusBadge,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";
import { scoreRelevance } from "../utils/relevanceScorer";

// Maps a relevance hit status to a status-token channel (light/dark aware)
// and a StatusBadge state for the position-delta badge.
const STATUS_CHANNEL = {
    perfect: { channel: "success", badge: "success" },
    close: { channel: "warning", badge: "warning" },
    displaced: { channel: "error", badge: "error" },
    unexpected: { channel: null, badge: "neutral" },
};

function RelevanceTesterContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    // Expected results tracking
    const [expectedIds, setExpectedIds] = useState([]);
    const [relevanceResult, setRelevanceResult] = useState(null);
    const fromEventRef = useRef(false);

    // Load index list via invoke (returns data directly)
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoadingIndices(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || "Failed to load indices");
                    setLoadingIndices(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) {
                        fromEventRef.current = true;
                        setSelectedIndex(payload.name);
                    }
                },
            });
        }
    }, [listeners, listen]);

    const handleSearch = useCallback(async () => {
        if (!pc?.providerHash || !selectedIndex) return;
        setSearching(true);
        setError(null);
        setRelevanceResult(null);
        try {
            const result = await window.mainApi.algolia.search({
                ...pc,
                indexName: selectedIndex,
                query: query.trim(),
                page: 0,
                hitsPerPage: 20,
            });
            if (result?.error) {
                setError(result.message || "Search failed");
                return;
            }
            setHits(result?.hits || []);
            // Re-score if we have expected results
            if (expectedIds.length > 0) {
                setRelevanceResult(
                    scoreRelevance(result?.hits || [], expectedIds)
                );
            }
        } catch (err) {
            setError(err.message || "Search failed");
        } finally {
            setSearching(false);
        }
    }, [pc, selectedIndex, query, expectedIds]);

    // Auto-trigger search when index is set via indexSelected event
    useEffect(() => {
        if (fromEventRef.current && selectedIndex) {
            fromEventRef.current = false;
            handleSearch();
        }
    }, [selectedIndex, handleSearch]);

    const toggleExpected = useCallback(
        (objectID) => {
            setExpectedIds((prev) => {
                const next = prev.includes(objectID)
                    ? prev.filter((id) => id !== objectID)
                    : [...prev, objectID];
                // Re-score
                if (hits.length > 0 && next.length > 0) {
                    setRelevanceResult(scoreRelevance(hits, next));
                } else {
                    setRelevanceResult(null);
                }
                return next;
            });
        },
        [hits]
    );

    const clearExpected = useCallback(() => {
        setExpectedIds([]);
        setRelevanceResult(null);
    }, []);

    // Theme tokens: result rows sit one step above the Panel surface.
    const rowClass = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const borderClass = currentTheme?.["border-primary-dark"] || "";

    const rowStyle = (detail, isExpected) => {
        if (detail) {
            const ch = STATUS_CHANNEL[detail.status]?.channel;
            if (ch) return `${status[ch].bg} ${status[ch].border}`;
            return `${rowClass} ${borderClass}`;
        }
        if (isExpected) return `${status.info.bg} ${status.info.border}`;
        return `${rowClass} ${borderClass}`;
    };

    const precision = relevanceResult?.metrics?.precisionAtN ?? 0;
    const precisionClass =
        precision >= 80
            ? status.success.icon
            : precision >= 50
            ? status.warning.icon
            : status.error.icon;

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia provider not configured. Add an Algolia credential provider in Settings > Providers."
                />
            )}

            {hasCredentials && (
                <div className="space-y-2">
                    <SelectInput
                        value={selectedIndex}
                        onChange={(value) => setSelectedIndex(value)}
                        placeholder={
                            loadingIndices ? "Loading..." : "Select an index"
                        }
                        options={indices.map((idx) => ({
                            value: idx.name,
                            label: `${idx.name} (${(
                                idx.entries || 0
                            ).toLocaleString()})`,
                        }))}
                        inputClassName="text-xs"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <InputText
                            type="text"
                            value={query}
                            onChange={(value) => setQuery(value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
                            placeholder="Search query..."
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                            className="flex-1 min-w-0"
                        />
                        <Button
                            size="sm"
                            onClick={handleSearch}
                            disabled={!selectedIndex || searching}
                        >
                            {searching ? "..." : "Search"}
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Relevance Score */}
            {relevanceResult && (
                <div
                    className={`flex items-center gap-3 p-2 rounded text-xs ${rowClass}`}
                >
                    <span className={`text-lg font-bold ${precisionClass}`}>
                        {relevanceResult.metrics.precisionAtN}%
                    </span>
                    <Caption2 block className="flex-1 space-y-0.5">
                        <div>
                            Precision@{relevanceResult.metrics.totalExpected}:{" "}
                            <span className={bodyText}>
                                {relevanceResult.metrics.foundInTopN}/
                                {relevanceResult.metrics.totalExpected}
                            </span>
                        </div>
                        <div>
                            Recall: {relevanceResult.metrics.recall}% | MRR:{" "}
                            {relevanceResult.metrics.mrr}%
                            {relevanceResult.metrics.firstFoundAt && (
                                <>
                                    {" "}
                                    | First at #
                                    {relevanceResult.metrics.firstFoundAt}
                                </>
                            )}
                        </div>
                    </Caption2>
                    <Button3 size="xs" onClick={clearExpected}>
                        Clear
                    </Button3>
                </div>
            )}

            {/* Expected IDs indicator */}
            {expectedIds.length > 0 && !relevanceResult && (
                <Caption2 block>
                    {expectedIds.length} expected result
                    {expectedIds.length !== 1 ? "s" : ""} marked. Run a search
                    to score.
                </Caption2>
            )}

            {/* Results */}
            {hits.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <SectionLabel as="span">
                            Results ({hits.length})
                        </SectionLabel>
                        <Caption2>
                            Click star to mark as expected result
                        </Caption2>
                    </div>
                    {hits.map((hit, idx) => {
                        const id = hit.objectID;
                        const isExpected = expectedIds.includes(id);
                        const detail = relevanceResult?.hitDetails?.[idx];
                        const badgeState =
                            (detail && STATUS_CHANNEL[detail.status]?.badge) ||
                            "neutral";

                        return (
                            <div
                                key={id || idx}
                                className={`flex items-start gap-2 px-2 py-1.5 rounded border ${rowStyle(
                                    detail,
                                    isExpected
                                )}`}
                            >
                                {/* Position */}
                                <Caption2 className="font-mono w-6 text-right shrink-0 mt-0.5">
                                    #{idx + 1}
                                </Caption2>

                                {/* Star toggle */}
                                <button
                                    onClick={() => toggleExpected(id)}
                                    className={`shrink-0 mt-0.5 text-sm ${
                                        isExpected
                                            ? status.warning.icon
                                            : `opacity-50 hover:opacity-100 ${bodyText}`
                                    }`}
                                    title={
                                        isExpected
                                            ? "Remove from expected"
                                            : "Mark as expected result"
                                    }
                                >
                                    {isExpected ? "\u2605" : "\u2606"}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div
                                        className={`text-xs truncate ${bodyText}`}
                                    >
                                        {hit.title ||
                                            hit.name ||
                                            hit.label ||
                                            hit.objectID}
                                    </div>
                                    {(hit.description || hit.content) && (
                                        <Caption2 block className="truncate">
                                            {(
                                                hit.description ||
                                                hit.content ||
                                                ""
                                            ).slice(0, 120)}
                                        </Caption2>
                                    )}
                                    <Caption2
                                        block
                                        className="font-mono opacity-75"
                                    >
                                        {id}
                                    </Caption2>
                                </div>

                                {/* Position delta badge */}
                                {detail && detail.isExpected && (
                                    <StatusBadge
                                        state={badgeState}
                                        className="shrink-0"
                                        label={
                                            detail.status === "perfect"
                                                ? "exact"
                                                : detail.positionDelta > 0
                                                ? `+${detail.positionDelta}`
                                                : String(detail.positionDelta)
                                        }
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {hits.length === 0 && !searching && !error && hasCredentials && (
                <Caption2 block className="italic">
                    Select an index, enter a query, and search. Star the results
                    you expect at the top to measure relevance quality.
                </Caption2>
            )}
        </div>
    );
}

export const RelevanceTester = ({ title = "Relevance Tester", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <RelevanceTesterContent title={title} />
            </Panel>
        </Widget>
    );
};
