/**
 * GDriveFileSearch
 *
 * Search files in Google Drive via the Google Drive MCP provider.
 * Uses the `search` tool with user-provided queries.
 * Publishes `fileSelected` events when a result is clicked.
 *
 * @package Google Drive
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    Panel,
    Skeleton,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import {
    extractMcpText,
    safeParse,
    parseTextFileList,
} from "../utils/mcpUtils";

function getFileIcon(mimeType) {
    if (!mimeType) return "file";
    if (mimeType.includes("folder")) return "folder";
    if (mimeType.includes("document") || mimeType.includes("text"))
        return "file-lines";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
        return "table";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
        return "file-powerpoint";
    if (mimeType.includes("image")) return "image";
    if (mimeType.includes("pdf")) return "file-pdf";
    return "file";
}

function GDriveFileSearchContent({ title }) {
    const {
        isConnected,
        isConnecting,
        error,
        tools,
        callTool,
        status,
        provider,
        connect,
        disconnect,
    } = useMcpProvider("google-drive");

    const { publishEvent } = useWidgetEvents();

    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const rowSurface = `border ${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setErrorMsg(null);
        setResults([]);
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "search",
            args: { query: searchQuery.trim() },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("search", {
                query: searchQuery.trim(),
            });
            entry.response = res;
            entry.duration = Date.now() - start;
            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (res?.isError) {
                const errText = typeof parsed === "string" ? parsed : text;
                setErrorMsg(errText);
                return;
            }

            let list;
            if (Array.isArray(parsed)) {
                list = parsed;
            } else if (parsed?.files || parsed?.results || parsed?.items) {
                list = parsed.files || parsed.results || parsed.items;
            } else if (typeof text === "string" && text.includes("\n")) {
                list = parseTextFileList(text);
            } else {
                list = [];
            }

            setResults(list);
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setErrorMsg(err.message);
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
            setLoading(false);
        }
    }, [searchQuery, callTool]);

    const handleFileClick = useCallback(
        (file) => {
            const id = file.id || file.name;
            setSelectedId(id);
            const payload = {
                id: file.id || null,
                name: file.name || file.title || "Untitled",
                mimeType: file.mimeType || null,
            };
            if (publishEvent) {
                publishEvent("fileSelected", payload);
            }
        },
        [publishEvent]
    );

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

            {/* Search Input */}
            <div className="space-y-2">
                <SubHeading3 title="Search Files" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Google Drive..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={
                            !isConnected || loading || !searchQuery.trim()
                        }
                    >
                        {loading ? "Searching..." : "Search"}
                    </Button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height="h-8" rounded="rounded" />
                    ))}
                </div>
            )}

            {/* Search Results */}
            {!loading && results.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    <SubHeading3
                        title={`${results.length} result${
                            results.length !== 1 ? "s" : ""
                        }`}
                    />
                    {results.map((file, i) => {
                        const fileId = file.id || file.name || i;
                        const isSelected = selectedId === fileId;
                        return (
                            <button
                                key={fileId}
                                onClick={() => handleFileClick(file)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                    isSelected
                                        ? selectedSurface
                                        : `${rowSurface} border-transparent`
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${accentText}`}>
                                        {getFileIcon(file.mimeType)}
                                    </span>
                                    <span
                                        className={`truncate flex-1 ${
                                            isSelected ? "" : bodyText
                                        }`}
                                    >
                                        {file.name || file.title || "Untitled"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 ml-5">
                                    {file.mimeType && (
                                        <Caption2>{file.mimeType}</Caption2>
                                    )}
                                    {file.modifiedTime && (
                                        <Caption2>
                                            Modified:{" "}
                                            {new Date(
                                                file.modifiedTime
                                            ).toLocaleDateString()}
                                        </Caption2>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && !errorMsg && (
                <Caption2 block className="italic">
                    Enter a search query to find files in Google Drive.
                </Caption2>
            )}

            <McpReauthBanner
                error={errorMsg}
                provider={provider}
                catalogId="google-drive"
                connect={connect}
                disconnect={disconnect}
                onReauthComplete={() => setErrorMsg(null)}
            />

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
            )}

            <McpDebugLog entries={debugLog} />
        </div>
    );
}

export const GDriveFileSearch = ({ title = "Drive Search", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GDriveFileSearchContent title={title} />
            </Panel>
        </Widget>
    );
};
