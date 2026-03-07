/**
 * AlgoliaSearchWidget
 *
 * Browse indices, search records, and view record details via the Algolia MCP provider.
 * Requires an Algolia MCP provider to be configured.
 *
 * @package Algolia
 */
import { useState, useEffect, useContext, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, DashboardContext } from "@trops/dash-core";

/**
 * Extract text from an MCP CallToolResult.
 * MCP tools return { content: [{ type: "text", text: "..." }, ...] }.
 */
function extractMcpText(res) {
    if (typeof res === "string") return res;
    if (res?.content && Array.isArray(res.content)) {
        return res.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
    }
    return JSON.stringify(res, null, 2);
}

function parseMcpJson(res) {
    const text = extractMcpText(res);
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

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

    const [selectedIndex, setSelectedIndex] = useState(defaultIndex || "");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [expandedRecord, setExpandedRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [debugData, setDebugData] = useState(null);
    const [showDebug, setShowDebug] = useState(false);

    // Derive available indices from MCP tools matching algolia_search_* pattern
    const indices = tools
        .map((t) => t.name || t)
        .filter((name) => name.startsWith("algolia_search_"))
        .map((name) => name.replace("algolia_search_", ""));

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
            if (!selectedIndex) return;
            setLoading(true);
            setErrorMsg(null);
            setCurrentPage(page);
            try {
                // Build params from the tool's input schema so all required fields are provided
                const toolDef = tools.find(
                    (t) => (t.name || t) === `algolia_search_${selectedIndex}`
                );
                const schema =
                    toolDef?.inputSchema?.properties ||
                    toolDef?.schema?.properties ||
                    {};
                const params = {};
                for (const key of Object.keys(schema)) {
                    if (schema[key].type === "string") {
                        params[key] = query;
                    } else if (
                        schema[key].type === "number" ||
                        schema[key].type === "integer"
                    ) {
                        params[key] = 0;
                    }
                }
                // Override with our specific values
                if ("query" in schema) params.query = query;
                if ("userIntent" in schema) params.userIntent = query;
                if ("originalQuery" in schema) params.originalQuery = query;
                if ("sessionId" in schema)
                    params.sessionId = uuid || id || "default";
                if ("hits_per_page" in schema)
                    params.hits_per_page = hitsPerPage;
                if ("hitsPerPage" in schema) params.hitsPerPage = hitsPerPage;
                if ("page" in schema) params.page = page;
                const res = await callTool(
                    `algolia_search_${selectedIndex}`,
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
                setResults(parsed);
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [selectedIndex, query, hitsPerPage, callTool]
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

    const hits = results?.hits || (Array.isArray(results) ? results : []);
    const nbHits = results?.nbHits ?? hits.length;
    const nbPages = results?.nbPages ?? 1;

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? "bg-green-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                <span className="text-gray-600">({tools.length} tools)</span>
            </div>

            {(error || errorMsg) && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error || errorMsg}
                </div>
            )}

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Index" padding={false} />
                <select
                    value={selectedIndex}
                    onChange={(e) => handleIndexChange(e.target.value)}
                    disabled={!isConnected || indices.length === 0}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                    <option value="">
                        {indices.length === 0
                            ? "No indices available"
                            : "Select an index"}
                    </option>
                    {indices.map((name, i) => (
                        <option key={name + i} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Search Bar */}
            <div className="space-y-1">
                <SubHeading3 title="Search" padding={false} />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch(0)}
                        placeholder={
                            selectedIndex
                                ? `Search ${selectedIndex}...`
                                : "Select an index first"
                        }
                        disabled={!selectedIndex || !isConnected}
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <button
                        onClick={() => handleSearch(0)}
                        disabled={!isConnected || loading || !selectedIndex}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "..." : "Search"}
                    </button>
                </div>
            </div>

            {/* Debug Toggle */}
            {debugData && (
                <div className="space-y-1">
                    <button
                        onClick={() => setShowDebug((v) => !v)}
                        className="px-2 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        {showDebug ? "Hide Debug" : "Debug"}
                    </button>
                    {showDebug && (
                        <div className="bg-gray-900/80 border border-gray-700 rounded p-2 space-y-2 max-h-[50vh] overflow-y-auto">
                            {debugData.toolSchema && (
                                <div>
                                    <div className="text-[10px] font-semibold text-yellow-400 mb-0.5">
                                        Tool Schema
                                    </div>
                                    <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                        {debugData.toolSchema}
                                    </pre>
                                </div>
                            )}
                            {debugData.sentParams && (
                                <div className="border-t border-gray-700 pt-2">
                                    <div className="text-[10px] font-semibold text-yellow-400 mb-0.5">
                                        Sent Params
                                    </div>
                                    <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                        {debugData.sentParams}
                                    </pre>
                                </div>
                            )}
                            <div className="border-t border-gray-700 pt-2">
                                <div className="text-[10px] font-semibold text-indigo-400 mb-0.5">
                                    Raw MCP Response
                                </div>
                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                    {debugData.raw}
                                </pre>
                            </div>
                            <div className="border-t border-gray-700 pt-2">
                                <div className="text-[10px] font-semibold text-indigo-400 mb-0.5">
                                    Extracted Text
                                </div>
                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                    {debugData.extracted}
                                </pre>
                            </div>
                            <div className="border-t border-gray-700 pt-2">
                                <div className="text-[10px] font-semibold text-indigo-400 mb-0.5">
                                    Parsed JSON
                                </div>
                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                    {debugData.parsed}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                            {nbHits.toLocaleString()} result
                            {nbHits !== 1 ? "s" : ""}
                        </span>
                        {nbPages > 1 && (
                            <span>
                                Page {currentPage + 1} of {nbPages}
                            </span>
                        )}
                    </div>

                    <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                        {hits.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No results found.
                            </div>
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
                                        className="bg-white/5 rounded overflow-hidden"
                                    >
                                        <button
                                            onClick={() =>
                                                handleRecordClick(hit)
                                            }
                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-indigo-400 font-mono text-[10px] shrink-0">
                                                    {oid}
                                                </span>
                                                <span className="text-gray-200 truncate">
                                                    {displayTitle}
                                                </span>
                                            </div>
                                            {displaySubtitle && (
                                                <div className="text-gray-500 truncate mt-0.5">
                                                    {displaySubtitle}
                                                </div>
                                            )}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-2 pb-2 border-t border-gray-700">
                                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-48 mt-1">
                                                    {JSON.stringify(
                                                        hit,
                                                        null,
                                                        2
                                                    )}
                                                </pre>
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
                            <button
                                onClick={() => handleSearch(currentPage - 1)}
                                disabled={currentPage === 0 || loading}
                                className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white"
                            >
                                Prev
                            </button>
                            <span className="text-xs text-gray-500">
                                {currentPage + 1} / {nbPages}
                            </span>
                            <button
                                onClick={() => handleSearch(currentPage + 1)}
                                disabled={currentPage >= nbPages - 1 || loading}
                                className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white"
                            >
                                Next
                            </button>
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
