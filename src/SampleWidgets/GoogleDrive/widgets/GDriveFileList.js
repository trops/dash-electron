/**
 * GDriveFileList
 *
 * Browse files and folders in Google Drive via the Google Drive MCP provider.
 * Uses the `search` tool with a broad query to list files.
 * Publishes `fileSelected` events when a file is clicked.
 *
 * @package Google Drive
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    Panel,
    SelectInput,
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

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    onClick={loadFiles}
                    disabled={!isConnected || loading}
                >
                    {loading ? "Loading..." : "Load Files"}
                </Button>
                <SelectInput
                    value={sortBy}
                    onChange={(value) => setSortBy(value)}
                    options={SORT_OPTIONS.map((opt) => ({
                        value: opt.key,
                        label: opt.label,
                    }))}
                    placeholder="Sort by"
                    className="flex-1 min-w-0"
                    inputClassName="text-xs"
                />
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} height="h-8" rounded="rounded" />
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
                                        ? selectedSurface
                                        : `${rowSurface} border-transparent`
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${accentText}`}>
                                        {getFileIcon(file.mimeType)}
                                    </span>
                                    <span
                                        className={`truncate ${
                                            isSelected ? "" : bodyText
                                        }`}
                                    >
                                        {file.name || file.title || "Untitled"}
                                    </span>
                                </div>
                                {file.mimeType && (
                                    <Caption2 block className="mt-0.5 ml-5">
                                        {file.mimeType}
                                    </Caption2>
                                )}
                                {file.modifiedTime && (
                                    <Caption2 block className="mt-0.5 ml-5">
                                        Modified:{" "}
                                        {new Date(
                                            file.modifiedTime
                                        ).toLocaleDateString()}
                                    </Caption2>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && files.length === 0 && (
                <Caption2 block className="italic">
                    Click "Load Files" to browse your Google Drive.
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

export const GDriveFileList = ({ title = "Drive Files", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GDriveFileListContent title={title} />
            </Panel>
        </Widget>
    );
};
