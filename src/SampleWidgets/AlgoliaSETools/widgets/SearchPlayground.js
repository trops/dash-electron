/**
 * SearchPlayground
 *
 * Minimal search UI with toggles for every relevance lever.
 * Demo tool for showing customers the impact of typo tolerance,
 * distinct, highlighting, and search parameters in real-time.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    AlertBanner,
    Caption2,
    Checkbox,
    InputText,
    SelectInput,
    ThemeContext,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";

function SearchPlaygroundContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { currentTheme } = useContext(ThemeContext);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState([]);
    const [nbHits, setNbHits] = useState(0);
    const [queryTime, setQueryTime] = useState(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    // Search parameter toggles
    const [typoTolerance, setTypoTolerance] = useState("true");
    const [hitsPerPage, setHitsPerPage] = useState(10);
    const [distinct, setDistinct] = useState(0);
    const [filters, setFilters] = useState("");
    const [showHighlights, setShowHighlights] = useState(true);
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
        try {
            const searchParams = {
                ...pc,
                indexName: selectedIndex,
                query: query.trim(),
                page: 0,
                hitsPerPage,
                typoTolerance:
                    typoTolerance === "true"
                        ? true
                        : typoTolerance === "false"
                        ? false
                        : typoTolerance,
            };
            if (distinct > 0) searchParams.distinct = distinct;
            if (filters.trim()) searchParams.filters = filters.trim();

            const result = await window.mainApi.algolia.search(searchParams);
            if (result?.error) {
                setError(result.message || "Search failed");
                return;
            }
            setHits(result?.hits || []);
            setNbHits(result?.nbHits || 0);
            setQueryTime(result?.processingTimeMS ?? null);
        } catch (err) {
            setError(err.message || "Search failed");
        } finally {
            setSearching(false);
        }
    }, [
        pc,
        selectedIndex,
        query,
        hitsPerPage,
        typoTolerance,
        distinct,
        filters,
    ]);

    // Auto-trigger search when index is set via indexSelected event
    useEffect(() => {
        if (fromEventRef.current && selectedIndex) {
            fromEventRef.current = false;
            handleSearch();
        }
    }, [selectedIndex, handleSearch]);

    // Extract highlighted value from _highlightResult
    const getHighlighted = (hit, field) => {
        if (!showHighlights) return null;
        const hr = hit._highlightResult?.[field];
        if (!hr) return null;
        return hr.value || null;
    };

    // Theme tokens: result rows sit one step above the Panel surface.
    const rowClass = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const borderClass = currentTheme?.["border-primary-dark"] || "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia provider not configured."
                />
            )}

            {hasCredentials && (
                <>
                    {/* Index + Query */}
                    <div className="space-y-2">
                        <SelectInput
                            value={selectedIndex}
                            onChange={(value) => setSelectedIndex(value)}
                            placeholder={
                                loadingIndices ? "Loading..." : "Select index"
                            }
                            options={indices.map((idx) => ({
                                value: idx.name,
                                label: idx.name,
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
                                disabled={
                                    !selectedIndex || !query.trim() || searching
                                }
                            >
                                {searching ? "..." : "Search"}
                            </Button>
                        </div>
                    </div>

                    {/* Parameter Toggles */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <Caption2 block className="mb-0.5">
                                Typo Tolerance
                            </Caption2>
                            <SelectInput
                                value={typoTolerance}
                                onChange={(value) => setTypoTolerance(value)}
                                options={[
                                    { value: "true", label: "Enabled" },
                                    { value: "false", label: "Disabled" },
                                    { value: "min", label: "Min (1 typo)" },
                                    { value: "strict", label: "Strict" },
                                ]}
                                inputClassName="text-xs px-1.5 py-0.5"
                            />
                        </div>
                        <div>
                            <Caption2 block className="mb-0.5">
                                Hits / Page
                            </Caption2>
                            <SelectInput
                                value={hitsPerPage}
                                onChange={(value) =>
                                    setHitsPerPage(Number(value))
                                }
                                options={[5, 10, 20, 50].map((n) => ({
                                    value: n,
                                    label: String(n),
                                }))}
                                inputClassName="text-xs px-1.5 py-0.5"
                            />
                        </div>
                        <div>
                            <Caption2 block className="mb-0.5">
                                Distinct
                            </Caption2>
                            <SelectInput
                                value={distinct}
                                onChange={(value) => setDistinct(Number(value))}
                                options={[
                                    { value: 0, label: "Off" },
                                    { value: 1, label: "1 per group" },
                                    { value: 2, label: "2 per group" },
                                    { value: 3, label: "3 per group" },
                                ]}
                                inputClassName="text-xs px-1.5 py-0.5"
                            />
                        </div>
                        <div className="flex items-end">
                            <Checkbox
                                checked={showHighlights}
                                onChange={(checked) =>
                                    setShowHighlights(checked)
                                }
                                label="Show highlights"
                                className="cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div>
                        <Caption2 block className="mb-0.5">
                            Filters (Algolia filter syntax)
                        </Caption2>
                        <InputText
                            type="text"
                            value={filters}
                            onChange={(value) => setFilters(value)}
                            placeholder='e.g., brand:"Nike" AND price < 100'
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs font-mono"
                        />
                    </div>
                </>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Stats */}
            {hits.length > 0 && (
                <Caption2 block>
                    {nbHits.toLocaleString()} results
                    {queryTime != null && <> in {queryTime}ms</>}
                </Caption2>
            )}

            {/* Results */}
            {hits.length > 0 && (
                <div className="space-y-1">
                    {hits.map((hit, idx) => {
                        const titleField =
                            hit.title || hit.name || hit.label || hit.objectID;
                        const highlightedTitle = getHighlighted(
                            hit,
                            hit.title ? "title" : hit.name ? "name" : "label"
                        );

                        return (
                            <div
                                key={hit.objectID || idx}
                                className={`px-2 py-1.5 border rounded text-xs ${rowClass} ${borderClass}`}
                            >
                                <div className="flex items-start gap-2">
                                    <Caption2 className="font-mono shrink-0">
                                        #{idx + 1}
                                    </Caption2>
                                    <div className="flex-1 min-w-0">
                                        {highlightedTitle ? (
                                            <div
                                                className={`truncate ${bodyText}`}
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightedTitle,
                                                }}
                                            />
                                        ) : (
                                            <div
                                                className={`truncate ${bodyText}`}
                                            >
                                                {titleField}
                                            </div>
                                        )}
                                        <Caption2
                                            block
                                            className="font-mono truncate opacity-75"
                                        >
                                            {hit.objectID}
                                        </Caption2>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export const SearchPlayground = ({ title = "Search Playground", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SearchPlaygroundContent title={title} />
            </Panel>
        </Widget>
    );
};
