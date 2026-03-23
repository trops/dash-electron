/**
 * NotionWidget
 *
 * Search and read Notion pages and databases via the Notion MCP provider.
 * Requires a Notion MCP provider to be configured.
 *
 * @package Notion
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import {
    parseMcpResponse,
    parseNotionTextEntries,
} from "../../_shared/mcpResponseParser";

function NotionContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("notion");

    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selectedPage, setSelectedPage] = useState(null);
    const [pageContent, setPageContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setErrorMsg(null);
        setSelectedPage(null);
        setPageContent(null);
        try {
            const res = await callTool("notion_search", {
                query: searchQuery.trim(),
            });
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["results", "pages"],
                textParser: parseNotionTextEntries,
            });
            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }
            setResults(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPage = async (page) => {
        const pageId = page.id || page.pageId || page.page_id;
        if (!pageId) return;

        setSelectedPage(page);
        setPageContent(null);
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await callTool("notion_retrieve_page", {
                page_id: pageId,
            });
            const { data, error: mcpError } = parseMcpResponse(res);
            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }
            setPageContent(data);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getPageTitle = (page) => {
        if (page.title)
            return typeof page.title === "string"
                ? page.title
                : page.title?.[0]?.plain_text || "Untitled";
        if (page.properties?.title?.title?.[0]?.plain_text)
            return page.properties.title.title[0].plain_text;
        if (page.properties?.Name?.title?.[0]?.plain_text)
            return page.properties.Name.title[0].plain_text;
        return page.object === "database" ? "Database" : "Untitled";
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

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

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Pages" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Notion..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* Results List */}
            {results.length > 0 && !pageContent && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {results.map((page, i) => (
                        <button
                            key={page.id || i}
                            onClick={() => handleSelectPage(page)}
                            className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        page.object === "database"
                                            ? "bg-blue-900/50 text-blue-400"
                                            : "bg-orange-900/50 text-orange-400"
                                    }`}
                                >
                                    {page.object || "page"}
                                </span>
                                <span className="text-gray-300 truncate">
                                    {getPageTitle(page)}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Page Content */}
            {pageContent && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3
                            title={
                                selectedPage
                                    ? getPageTitle(selectedPage)
                                    : "Page"
                            }
                        />
                        <button
                            onClick={() => {
                                setPageContent(null);
                                setSelectedPage(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Back
                        </button>
                    </div>
                    <div className="p-2 bg-white/5 rounded text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
                        {typeof pageContent === "string"
                            ? pageContent
                            : JSON.stringify(pageContent, null, 2)}
                    </div>
                </div>
            )}

            {/* Error */}
            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

export const NotionWidget = ({ title = "Notion", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <NotionContent title={title} />
            </Panel>
        </Widget>
    );
};
