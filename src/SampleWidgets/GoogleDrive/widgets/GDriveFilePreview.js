/**
 * GDriveFilePreview
 *
 * Display file metadata for a selected Google Drive file.
 * Listens for `fileSelected` events and uses the `search` tool
 * to fetch metadata for the selected file.
 *
 * @package Google Drive
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import { extractMcpText, safeParse } from "../utils/mcpUtils";

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

function MetadataRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2 py-1 border-b border-gray-800 last:border-b-0">
            <span className="text-gray-500 text-[10px] uppercase tracking-wide w-20 shrink-0">
                {label}
            </span>
            <span className="text-gray-300 text-xs break-all">{value}</span>
        </div>
    );
}

function GDriveFilePreviewContent({ title }) {
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

    const { listen, listeners } = useWidgetEvents();

    const [selectedFile, setSelectedFile] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);

    const handlerRef = useRef(null);

    const loadMetadata = useCallback(
        async (file) => {
            if (!file?.name) return;
            setLoading(true);
            setErrorMsg(null);
            setMetadata(null);
            const entry = {
                id: Date.now(),
                timestamp: new Date(),
                toolName: "search",
                args: { query: file.name },
                response: null,
                error: null,
                duration: 0,
            };
            const start = Date.now();
            try {
                const res = await callTool("search", {
                    query: file.name,
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
                } else {
                    list = [];
                }

                // Find the matching file by id or name
                const match = list.find(
                    (f) => (file.id && f.id === file.id) || f.name === file.name
                );
                setMetadata(
                    match ||
                        list[0] || { name: file.name, mimeType: file.mimeType }
                );
            } catch (err) {
                entry.error = err.message;
                entry.duration = Date.now() - start;
                setErrorMsg(err.message);
            } finally {
                setDebugLog((prev) => [entry, ...prev]);
                setLoading(false);
            }
        },
        [callTool]
    );

    handlerRef.current = useCallback(
        (data) => {
            const file = data.message || data;
            setSelectedFile(file);
            if (isConnected) {
                loadMetadata(file);
            }
        },
        [isConnected, loadMetadata]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                const handlers = {
                    fileSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            }
        }
    }, [listeners, listen]);

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

            {/* Loading State */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 bg-white/5 rounded" />
                    ))}
                </div>
            )}

            {/* File Metadata */}
            {!loading && metadata && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-400 text-sm">
                            {getFileIcon(metadata.mimeType)}
                        </span>
                        <SubHeading3
                            title={
                                metadata.name || metadata.title || "Untitled"
                            }
                        />
                    </div>
                    <div className="bg-white/5 rounded p-2">
                        <MetadataRow
                            label="Name"
                            value={metadata.name || metadata.title}
                        />
                        <MetadataRow label="Type" value={metadata.mimeType} />
                        <MetadataRow label="ID" value={metadata.id} />
                        <MetadataRow
                            label="Modified"
                            value={
                                metadata.modifiedTime
                                    ? new Date(
                                          metadata.modifiedTime
                                      ).toLocaleString()
                                    : null
                            }
                        />
                        <MetadataRow
                            label="Created"
                            value={
                                metadata.createdTime
                                    ? new Date(
                                          metadata.createdTime
                                      ).toLocaleString()
                                    : null
                            }
                        />
                        <MetadataRow
                            label="Size"
                            value={
                                metadata.size
                                    ? `${(Number(metadata.size) / 1024).toFixed(
                                          1
                                      )} KB`
                                    : null
                            }
                        />
                        <MetadataRow
                            label="Owner"
                            value={
                                metadata.owners?.[0]?.displayName ||
                                metadata.owner
                            }
                        />
                        <MetadataRow
                            label="Shared"
                            value={metadata.shared ? "Yes" : null}
                        />
                        <MetadataRow
                            label="Web Link"
                            value={metadata.webViewLink || metadata.webLink}
                        />
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !metadata && !selectedFile && (
                <div className="text-xs text-gray-600 italic">
                    Select a file from GDriveFileList or GDriveFileSearch to
                    view its details.
                </div>
            )}

            {/* Selected but no metadata yet */}
            {!loading && !metadata && selectedFile && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    No metadata available for "{selectedFile.name}".
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

export const GDriveFilePreview = ({ title = "File Preview", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GDriveFilePreviewContent title={title} />
            </Panel>
        </Widget>
    );
};
