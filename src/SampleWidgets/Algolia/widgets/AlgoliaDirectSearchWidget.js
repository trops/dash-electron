/**
 * AlgoliaDirectSearchWidget
 *
 * Search an Algolia index directly via the IPC API (window.mainApi.algolia.search).
 * Select index, type query, get paginated results with expandable record JSON.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Button2,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
    ThemeContext,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function AlgoliaDirectSearchContent({ title, defaultIndex, hitsPerPage = 10 }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(defaultIndex || "");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [expandedRecord, setExpandedRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(0);

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    // Load index list on mount
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoadingIndices(false);
                    if (data?.length > 0 && !selectedIndex) {
                        if (defaultIndex) {
                            const found = data.find(
                                (idx) => idx.name === defaultIndex
                            );
                            if (found) {
                                setSelectedIndex(defaultIndex);
                                return;
                            }
                        }
                        setSelectedIndex(data[0].name);
                    }
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

    const handleSearch = useCallback(
        async (page = 0) => {
            if (!selectedIndex || !pc?.providerHash) return;
            setLoading(true);
            setError(null);
            setCurrentPage(page);
            try {
                const result = await window.mainApi.algolia.search({
                    ...pc,
                    indexName: selectedIndex,
                    query,
                    options: { page, hitsPerPage },
                });
                if (result?.error) {
                    setError(result.message || "Search failed");
                } else {
                    setResults(result);
                }
            } catch (err) {
                setError(err.message || "Search failed");
            } finally {
                setLoading(false);
            }
        },
        [selectedIndex, query, hitsPerPage, pc?.providerHash] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Search as you type — debounce to avoid flooding API
    useEffect(() => {
        if (!selectedIndex || !pc?.providerHash) return;
        if (!query) {
            setResults(null);
            return;
        }
        const timer = setTimeout(() => {
            handleSearch(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleIndexChange = (indexName) => {
        setSelectedIndex(indexName);
        setResults(null);
        setExpandedRecord(null);
        setCurrentPage(0);
    };

    const hits = results?.hits || [];
    const nbHits = results?.nbHits ?? hits.length;
    const nbPages = results?.nbPages ?? 1;

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    // Theme tokens: result rows sit one step above the Panel surface; the
    // objectID uses the secondary channel as its accent.
    const rowClass = currentTheme?.["bg-primary-dark"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";
    const borderClass = currentTheme?.["border-primary-dark"] || "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Index" padding={false} />
                <SelectInput
                    value={selectedIndex}
                    onChange={(value) => handleIndexChange(value)}
                    disabled={loadingIndices || indices.length === 0}
                    placeholder={
                        loadingIndices
                            ? "Loading indices..."
                            : indices.length === 0
                            ? "No indices available"
                            : "Select an index"
                    }
                    options={indices.map((idx) => ({
                        value: idx.name,
                        label: `${idx.name} (${(
                            idx.entries || 0
                        ).toLocaleString()})`,
                    }))}
                    inputClassName="text-xs"
                />
            </div>

            {/* Search Bar */}
            <div className="space-y-1">
                <SubHeading3 title="Search" padding={false} />
                <div className="relative">
                    <InputText
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                            selectedIndex
                                ? `Search ${selectedIndex}...`
                                : "Select an index first"
                        }
                        disabled={!selectedIndex}
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName={`text-xs disabled:opacity-50 transition-opacity ${
                            loading ? "opacity-70" : ""
                        }`}
                    />
                    {loading && (
                        <span
                            className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs animate-pulse ${accentText}`}
                        >
                            searching...
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Results */}
            {results && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Caption2>
                            {nbHits.toLocaleString()} result
                            {nbHits !== 1 ? "s" : ""}
                            {results.processingTimeMS != null && (
                                <span className="opacity-75 ml-1">
                                    ({results.processingTimeMS}ms)
                                </span>
                            )}
                        </Caption2>
                        {nbPages > 1 && (
                            <Caption2>
                                Page {currentPage + 1} of {nbPages}
                            </Caption2>
                        )}
                    </div>

                    <div className="space-y-1 max-h-96 overflow-y-auto">
                        {hits.length === 0 ? (
                            <Caption2 block className="italic p-2">
                                No results found.
                            </Caption2>
                        ) : (
                            hits.map((hit, i) => {
                                const oid = hit.objectID || hit.id || i;
                                const isExpanded = expandedRecord === oid;
                                const displayTitle =
                                    hit.title ||
                                    hit.name ||
                                    hit.label ||
                                    hit.objectID ||
                                    `Record ${i + 1}`;
                                const displaySubtitle =
                                    hit.description ||
                                    hit.subtitle ||
                                    hit.content?.substring(0, 100) ||
                                    "";

                                return (
                                    <div
                                        key={oid + "-" + i}
                                        className={`rounded overflow-hidden ${rowClass}`}
                                    >
                                        <button
                                            onClick={() => {
                                                setExpandedRecord(
                                                    isExpanded ? null : oid
                                                );
                                            }}
                                            className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${rowHover}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`font-mono text-xs shrink-0 ${accentText}`}
                                                >
                                                    {oid}
                                                </span>
                                                <span
                                                    className={`truncate ${bodyText}`}
                                                >
                                                    {displayTitle}
                                                </span>
                                            </div>
                                            {displaySubtitle && (
                                                <Caption2
                                                    block
                                                    className="truncate mt-0.5"
                                                >
                                                    {displaySubtitle}
                                                </Caption2>
                                            )}
                                        </button>
                                        {isExpanded && (
                                            <div
                                                className={`px-2 pb-2 border-t ${borderClass}`}
                                            >
                                                <Caption2
                                                    block
                                                    className="font-mono whitespace-pre-wrap overflow-auto max-h-48 mt-1"
                                                >
                                                    {JSON.stringify(
                                                        hit,
                                                        null,
                                                        2
                                                    )}
                                                </Caption2>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    {nbPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <Button2
                                onClick={() => handleSearch(currentPage - 1)}
                                disabled={currentPage === 0 || loading}
                                size="sm"
                            >
                                Prev
                            </Button2>
                            <Caption2>
                                {currentPage + 1} / {nbPages}
                            </Caption2>
                            <Button2
                                onClick={() => handleSearch(currentPage + 1)}
                                disabled={currentPage >= nbPages - 1 || loading}
                                size="sm"
                            >
                                Next
                            </Button2>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export const AlgoliaDirectSearchWidget = ({
    title = "Algolia Direct Search",
    defaultIndex = "",
    hitsPerPage = 10,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaDirectSearchContent
                    title={title}
                    defaultIndex={defaultIndex}
                    hitsPerPage={hitsPerPage}
                />
            </Panel>
        </Widget>
    );
};
