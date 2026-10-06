/**
 * GDriveFilePreview
 *
 * Display file metadata for a selected Google Drive file.
 * Listens for `fileSelected` events and uses the `search` tool
 * to fetch metadata for the selected file.
 *
 * @package Google Drive
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    AlertBanner,
    Caption2,
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
    const { currentTheme } = useContext(ThemeContext);
    if (!value) return null;
    return (
        <div
            className={`flex items-start gap-2 py-1 border-b last:border-b-0 ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
            <Caption2 className="uppercase tracking-wide w-20 shrink-0">
                {label}
            </Caption2>
            <span
                className={`text-xs break-all ${
                    currentTheme?.["text-primary-medium"] || ""
                }`}
            >
                {value}
            </span>
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

    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

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

            {/* Loading State */}
            {loading && (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height="h-6" rounded="rounded" />
                    ))}
                </div>
            )}

            {/* File Metadata */}
            {!loading && metadata && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={`text-sm ${
                                currentTheme?.["text-secondary-medium"] || ""
                            }`}
                        >
                            {getFileIcon(metadata.mimeType)}
                        </span>
                        <SubHeading3
                            title={
                                metadata.name || metadata.title || "Untitled"
                            }
                        />
                    </div>
                    <div
                        className={`rounded p-2 ${
                            currentTheme?.["bg-primary-dark"] || ""
                        }`}
                    >
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
                <Caption2 block className="italic">
                    Select a file from GDriveFileList or GDriveFileSearch to
                    view its details.
                </Caption2>
            )}

            {/* Selected but no metadata yet */}
            {!loading && !metadata && selectedFile && !errorMsg && (
                <Caption2 block className="italic">
                    No metadata available for "{selectedFile.name}".
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

export const GDriveFilePreview = ({ title = "File Preview", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GDriveFilePreviewContent title={title} />
            </Panel>
        </Widget>
    );
};
