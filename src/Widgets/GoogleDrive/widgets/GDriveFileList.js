/**
 * GDriveFileList
 *
 * Browse files and folders in Google Drive via the Google Drive MCP provider.
 * Uses the `search` tool with a broad query to list files.
 * Publishes `fileSelected` events when a file is clicked.
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

const SORT_OPTIONS = [
    { key: "name-asc", label: "Name A-Z" },
    { key: "name-desc", label: "Name Z-A" },
    { key: "type", label: "Type" },
    { key: "modified", label: "Modified" },
];

function GDriveFileListContent({ title }) {
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

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);
    const [sortBy, setSortBy] = useState("name-asc");
    const [selectedId, setSelectedId] = useState(null);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "search",
            args: { query: "*" },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("search", { query: "*" });
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

            setFiles(list);
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setErrorMsg(err.message);
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
            setLoading(false);
        }
    }, [callTool]);

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

    const sortedFiles = [...files].sort((a, b) => {
        const nameA = (a.name || a.title || "").toLowerCase();
        const nameB = (b.name || b.title || "").toLowerCase();
        switch (sortBy) {
            case "name-asc":
                return nameA.localeCompare(nameB);
            case "name-desc":
                return nameB.localeCompare(nameA);
            case "type":
                return (a.mimeType || "").localeCompare(b.mimeType || "");
            case "modified":
                return (
                    new Date(b.modifiedTime || 0) -
                    new Date(a.modifiedTime || 0)
                );
            default:
                return 0;
        }
    });

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

            {/* Controls */}
            <div className="flex items-center gap-2">
                <button
                    onClick={loadFiles}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading..." : "Load Files"}
                </button>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-yellow-500"
                >
                    {SORT_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-white/5 rounded" />
                    ))}
                </div>
            )}

            {/* File List */}
            {!loading && sortedFiles.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    <SubHeading3 title={`${sortedFiles.length} files`} />
                    {sortedFiles.map((file, i) => {
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
                                    <span className="text-gray-300 truncate">
                                        {file.name || file.title || "Untitled"}
                                    </span>
                                </div>
                                {file.mimeType && (
                                    <div className="text-gray-600 text-[10px] mt-0.5 ml-5">
                                        {file.mimeType}
                                    </div>
                                )}
                                {file.modifiedTime && (
                                    <div className="text-gray-600 text-[10px] mt-0.5 ml-5">
                                        Modified:{" "}
                                        {new Date(
                                            file.modifiedTime
                                        ).toLocaleDateString()}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && files.length === 0 && (
                <div className="text-xs text-gray-600 italic">
                    Click "Load Files" to browse your Google Drive.
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

export const GDriveFileList = ({ title = "Drive Files", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GDriveFileListContent title={title} />
            </Panel>
        </Widget>
    );
};
