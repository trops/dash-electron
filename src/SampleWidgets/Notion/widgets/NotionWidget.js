/**
 * NotionWidget
 *
 * Search and read Notion pages and databases via the Notion MCP provider.
 * Requires a Notion MCP provider to be configured.
 *
 * @package Notion
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Button3,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { parseMcpResponse, parseNotionTextEntries } from "../utils/mcpUtils";

function NotionContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("notion");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    // Object-type badges: database → secondary accent, page → tertiary
    // accent (was fixed blue / orange).
    const databaseBadge = `${currentTheme?.["bg-secondary-dark"] || ""} ${
        currentTheme?.["text-secondary-light"] || ""
    }`;
    const pageBadge = `${currentTheme?.["bg-tertiary-dark"] || ""} ${
        currentTheme?.["text-tertiary-light"] || ""
    }`;

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
                            ? statusTokens.success.solidBg
                            : isConnecting
                            ? `${statusTokens.warning.solidBg} animate-pulse`
                            : error
                            ? statusTokens.error.solidBg
                            : currentTheme?.["bg-primary-medium"] || ""
                    }`}
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Pages" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Notion..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* Results List */}
            {results.length > 0 && !pageContent && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {results.map((page, i) => (
                        <button
                            key={page.id || i}
                            onClick={() => handleSelectPage(page)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${rowSurface}`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        page.object === "database"
                                            ? databaseBadge
                                            : pageBadge
                                    }`}
                                >
                                    {page.object || "page"}
                                </span>
                                <span className={`truncate ${bodyText}`}>
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
                        <Button3
                            size="sm"
                            onClick={() => {
                                setPageContent(null);
                                setSelectedPage(null);
                            }}
                        >
                            Back
                        </Button3>
                    </div>
                    <div
                        className={`p-2 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap ${
                            currentTheme?.["bg-primary-dark"] || ""
                        } ${bodyText}`}
                    >
                        {typeof pageContent === "string"
                            ? pageContent
                            : JSON.stringify(pageContent, null, 2)}
                    </div>
                </div>
            )}

            {/* Error */}
            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
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
