/**
 * GDriveFileSearch
 *
 * Search files in Google Drive via the Google Drive MCP provider.
 * Uses the `search` tool with user-provided queries.
 * Publishes `fileSelected` events when a result is clicked.
 *
 * @package Google Drive
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";

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

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function parseTextFileList(text) {
    const lines = text.split("\n").filter((line) => line.trim());
    const fileLines = lines.filter((line) => !line.startsWith("Found "));
    return fileLines
        .map((line) => {
            const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (match) {
                return { name: match[1].trim(), mimeType: match[2].trim() };
            }
            return { name: line.trim(), mimeType: null };
        })
        .filter((f) => f.name);
}

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

            {/* Search Input */}
            <div className="space-y-2">
                <SubHeading3 title="Search Files" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Google Drive..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={
                            !isConnected || loading || !searchQuery.trim()
                        }
                        className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-8 bg-white/5 rounded" />
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
                                        ? "bg-yellow-800/40 border border-yellow-600"
                                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-400 text-[10px]">
                                        {getFileIcon(file.mimeType)}
                                    </span>
                                    <span className="text-gray-300 truncate flex-1">
                                        {file.name || file.title || "Untitled"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 ml-5">
                                    {file.mimeType && (
                                        <span className="text-gray-600 text-[10px]">
                                            {file.mimeType}
                                        </span>
                                    )}
                                    {file.modifiedTime && (
                                        <span className="text-gray-600 text-[10px]">
                                            Modified:{" "}
                                            {new Date(
                                                file.modifiedTime
                                            ).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    Enter a search query to find files in Google Drive.
                </div>
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
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
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
