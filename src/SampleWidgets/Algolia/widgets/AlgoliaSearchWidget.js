/**
 * AlgoliaSearchWidget
 *
 * Browse indices, search records, and view record details via the Algolia MCP provider.
 * Requires an Algolia MCP provider to be configured.
 *
 * @package Algolia
 */
import { useState, useEffect, useContext, useCallback } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Button,
    Button2,
    Button3,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
    StatusBadge,
    ThemeContext,
    useStatusTokens,
    readableError,
} from "@trops/dash-react";
import { Widget, useMcpProvider, DashboardContext } from "@trops/dash-core";

import {
    extractMcpText,
    parseMcpJson,
    listSearchIndices,
    buildSearchParams,
    normalizeSearchResult,
} from "../utils/mcpUtils";

function AlgoliaSearchContent({
    id,
    title,
    defaultIndex,
    hitsPerPage = 10,
    uuid,
}) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("algolia");
    const { widgetApi } = useContext(DashboardContext);
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const [selectedIndex, setSelectedIndex] = useState(defaultIndex || "");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [expandedRecord, setExpandedRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [debugData, setDebugData] = useState(null);
    const [showDebug, setShowDebug] = useState(false);

    // One search tool per index: algolia_search_index_<index> (see listSearchIndices)
    const indexTools = listSearchIndices(tools);
    const indices = indexTools.map((t) => t.index);
    const toolSuffix =
        indexTools.find((t) => t.index === selectedIndex)?.suffix || null;

    // Auto-select defaultIndex or first available index when tools change
    useEffect(() => {
        if (indices.length === 0) return;
        if (defaultIndex && indices.includes(defaultIndex)) {
            setSelectedIndex(defaultIndex);
        } else if (!selectedIndex || !indices.includes(selectedIndex)) {
            setSelectedIndex(indices[0]);
        }
    }, [tools.length, defaultIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = useCallback(
        async (page = 0) => {
            if (!toolSuffix) return;
            setLoading(true);
            setErrorMsg(null);
            setCurrentPage(page);
            try {
                // Build params from the tool's input schema so all required fields are provided
                const toolDef = tools.find(
                    (t) => (t.name || t) === `algolia_search_${toolSuffix}`
                );
                const schema =
                    toolDef?.inputSchema?.properties ||
                    toolDef?.schema?.properties ||
                    {};
                const params = buildSearchParams(schema, {
                    query,
                    page,
                    hitsPerPage,
                    sessionId: uuid || id || "default",
                });
                const res = await callTool(
                    `algolia_search_${toolSuffix}`,
                    params
                );
                const extracted = extractMcpText(res);
                const parsed = parseMcpJson(res);
                setDebugData({
                    toolSchema: JSON.stringify(schema, null, 2),
                    sentParams: JSON.stringify(params, null, 2),
                    raw: JSON.stringify(res, null, 2),
                    extracted:
                        typeof extracted === "string"
                            ? extracted
                            : JSON.stringify(extracted, null, 2),
                    parsed: JSON.stringify(parsed, null, 2),
                });
                // A tool error (bad arguments, auth, …) comes back as a
                // result with isError — show it instead of "No results".
                const normalized = res?.isError
                    ? null
                    : normalizeSearchResult(parsed);
                if (!normalized) {
                    setResults(null);
                    setErrorMsg(readableError(res, "Search failed"));
                } else {
                    setResults(normalized);
                }
            } catch (err) {
                setErrorMsg(readableError(err));
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [toolSuffix, query, hitsPerPage, callTool]
    );

    const handleIndexChange = (indexName) => {
        setSelectedIndex(indexName);
        setResults(null);
        setExpandedRecord(null);
        setCurrentPage(0);
        if (widgetApi) {
            widgetApi.publishEvent(
                `AlgoliaSearchWidget[${id}].algolia-index-selected`,
                { indexName }
            );
        }
    };

    const handleRecordClick = (record) => {
        const objectID = record.objectID || record.id;
        if (expandedRecord === objectID) {
            setExpandedRecord(null);
        } else {
            setExpandedRecord(objectID);
            if (widgetApi) {
                widgetApi.publishEvent(
                    `AlgoliaSearchWidget[${id}].algolia-record-selected`,
                    { objectID, indexName: selectedIndex, record }
                );
            }
        }
    };

    const hits = results?.hits || [];
    const nbHits = results?.nbHits ?? hits.length;
    // Current servers don't report nbPages — a full page means there may
    // be another one.
    const nbPages = results?.nbPages ?? null;
    const hasNextPage =
        nbPages != null
            ? currentPage < nbPages - 1
            : hits.length >= hitsPerPage;
    const showPager = currentPage > 0 || hasNextPage;

    // Theme tokens: record rows / debug panel sit one step above the Panel
    // surface; object IDs and debug section labels use the accent channel.
    const surfaceClass = currentTheme?.["bg-primary-dark"] || "";
    const borderClass = currentTheme?.["border-primary-dark"] || "";
    const hoverClass = currentTheme?.["hover-bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";
    const debugLabelClass = "text-xs font-semibold mb-0.5";
    const debugBodyClass =
        "whitespace-pre-wrap overflow-auto max-h-40 font-mono";

    const connectionState = isConnected
        ? "success"
        : isConnecting
        ? "pending"
        : error
        ? "error"
        : "neutral";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <StatusBadge state={connectionState} label={status} compact />
                <Caption2>({tools.length} tools)</Caption2>
            </div>

            {(error || errorMsg) && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={error || errorMsg}
                />
            )}

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Index" padding={false} />
                <SelectInput
                    value={selectedIndex}
                    onChange={(value) => handleIndexChange(value)}
                    disabled={!isConnected || indices.length === 0}
                    placeholder={
                        indices.length === 0
                            ? "No indices available"
                            : "Select an index"
                    }
                    options={indices.map((name) => ({
                        value: name,
                        label: name,
                    }))}
                    inputClassName="text-xs"
                />
            </div>

            {/* Search Bar */}
            <div className="space-y-1">
                <SubHeading3 title="Search" padding={false} />
                <div className="flex gap-2">
                    <InputText
                        type="text"
                        value={query}
                        onChange={(value) => setQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch(0)}
                        placeholder={
                            selectedIndex
                                ? `Search ${selectedIndex}...`
                                : "Select an index first"
                        }
                        disabled={!selectedIndex || !isConnected}
                        className="flex-1"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        onClick={() => handleSearch(0)}
                        disabled={!isConnected || loading || !selectedIndex}
                        size="sm"
                    >
                        {loading ? "..." : "Search"}
                    </Button>
                </div>
            </div>

            {/* Debug Toggle */}
            {debugData && (
                <div className="space-y-1">
                    <Button3
                        title={showDebug ? "Hide Debug" : "Debug"}
                        onClick={() => setShowDebug((v) => !v)}
                        size="sm"
                    />
                    {showDebug && (
                        <div
                            className={`border rounded p-2 space-y-2 max-h-96 overflow-y-auto ${surfaceClass} ${borderClass}`}
                        >
                            {debugData.toolSchema && (
                                <div>
                                    <div
                                        className={`${debugLabelClass} ${statusTokens.warning.icon}`}
                                    >
                                        Tool Schema
                                    </div>
                                    <Caption2 block className={debugBodyClass}>
                                        {debugData.toolSchema}
                                    </Caption2>
                                </div>
                            )}
                            {debugData.sentParams && (
                                <div className={`border-t pt-2 ${borderClass}`}>
                                    <div
                                        className={`${debugLabelClass} ${statusTokens.warning.icon}`}
                                    >
                                        Sent Params
                                    </div>
                                    <Caption2 block className={debugBodyClass}>
                                        {debugData.sentParams}
                                    </Caption2>
                                </div>
                            )}
                            <div className={`border-t pt-2 ${borderClass}`}>
                                <div
                                    className={`${debugLabelClass} ${accentText}`}
                                >
                                    Raw MCP Response
                                </div>
                                <Caption2 block className={debugBodyClass}>
                                    {debugData.raw}
                                </Caption2>
                            </div>
                            <div className={`border-t pt-2 ${borderClass}`}>
                                <div
                                    className={`${debugLabelClass} ${accentText}`}
                                >
                                    Extracted Text
                                </div>
                                <Caption2 block className={debugBodyClass}>
                                    {debugData.extracted}
                                </Caption2>
                            </div>
                            <div className={`border-t pt-2 ${borderClass}`}>
                                <div
                                    className={`${debugLabelClass} ${accentText}`}
                                >
                                    Parsed JSON
                                </div>
                                <Caption2 block className={debugBodyClass}>
                                    {debugData.parsed}
                                </Caption2>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-2">
                    <Caption2
                        block
                        className="flex items-center justify-between"
                    >
                        <span>
                            {nbHits.toLocaleString()} result
                            {nbHits !== 1 ? "s" : ""}
                        </span>
                        {showPager && (
                            <span>
                                Page {currentPage + 1}
                                {nbPages != null ? ` of ${nbPages}` : ""}
                            </span>
                        )}
                    </Caption2>

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
                                        className={`rounded overflow-hidden ${surfaceClass}`}
                                    >
                                        <button
                                            onClick={() =>
                                                handleRecordClick(hit)
                                            }
                                            className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${hoverClass}`}
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
                                                    className="whitespace-pre-wrap overflow-auto max-h-48 mt-1 font-mono"
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
                    {showPager && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <Button2
                                onClick={() => handleSearch(currentPage - 1)}
                                disabled={currentPage === 0 || loading}
                                size="sm"
                            >
                                Prev
                            </Button2>
                            <Caption2>
                                {currentPage + 1}
                                {nbPages != null ? ` / ${nbPages}` : ""}
                            </Caption2>
                            <Button2
                                onClick={() => handleSearch(currentPage + 1)}
                                disabled={!hasNextPage || loading}
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

export const AlgoliaSearchWidget = ({
    title = "Algolia Search",
    defaultIndex = "",
    hitsPerPage = 10,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaSearchContent
                    id={props.id}
                    title={title}
                    defaultIndex={defaultIndex}
                    hitsPerPage={hitsPerPage}
                    uuid={props.uuid}
                />
            </Panel>
        </Widget>
    );
};
