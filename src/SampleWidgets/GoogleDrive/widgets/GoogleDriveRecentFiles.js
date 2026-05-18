/**
 * GoogleDriveRecentFiles
 *
 * Compact list of the user's most-recently-modified Drive files.
 * Each row: file-type icon + name + relative "modified Ns ago"
 * timestamp. Click → opens the file in the browser (when the file
 * carries a webViewLink) and always publishes `fileSelected` so paired
 * widgets (preview, metadata viewer) can react.
 *
 * Calls the Google Drive MCP `search` tool with a broad query and
 * sorts client-side by `modifiedTime DESC` before taking the top N.
 * Client-side ordering is defensive — the MCP server's default sort
 * isn't guaranteed, and the widget's whole point is "most recent
 * first", so we don't trust the wire order.
 *
 * Auto-refresh interval defaults to 5 minutes — Drive isn't an
 * inbox; refreshing more often costs API quota without much user
 * benefit. The Refresh button is always available for on-demand.
 *
 * @package Google Drive
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, FontAwesomeIcon } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import {
    extractMcpText,
    safeParse,
    parseTextFileList,
} from "../utils/mcpUtils";

function fileIcon(mimeType) {
    if (!mimeType) return "file";
    const t = mimeType.toLowerCase();
    if (t.includes("folder")) return "folder";
    if (t.includes("spreadsheet") || t.includes("excel")) return "file-excel";
    if (t.includes("presentation") || t.includes("powerpoint"))
        return "file-powerpoint";
    if (t.includes("document") || t.includes("text")) return "file-lines";
    if (t.includes("image")) return "file-image";
    if (t.includes("pdf")) return "file-pdf";
    if (t.includes("video")) return "file-video";
    if (t.includes("audio")) return "file-audio";
    if (t.includes("zip") || t.includes("archive")) return "file-zipper";
    return "file";
}

function fileIconColor(mimeType) {
    if (!mimeType) return "text-gray-400";
    const t = mimeType.toLowerCase();
    if (t.includes("folder")) return "text-yellow-400";
    if (t.includes("spreadsheet")) return "text-emerald-400";
    if (t.includes("presentation")) return "text-orange-400";
    if (t.includes("document")) return "text-blue-400";
    if (t.includes("pdf")) return "text-red-400";
    if (t.includes("image")) return "text-pink-400";
    return "text-gray-400";
}

function relativeTime(input) {
    if (!input) return "";
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    const sec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.round(mo / 12);
    return `${yr}y ago`;
}

function GoogleDriveRecentFilesContent({
    title,
    query,
    limit,
    autoRefreshSeconds,
    openInBrowser,
}) {
    const { isConnected, isConnecting, error, callTool, status } =
        useMcpProvider("google-drive");
    const { publishEvent } = useWidgetEvents();

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [lastFetchedAt, setLastFetchedAt] = useState(null);

    // re-render every 30s so relative timestamps stay fresh without
    // re-hitting the MCP.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // publishEvent + openInBrowser kept in refs so the fetch callback
    // doesn't list them as deps — otherwise the auto-refresh effect
    // would re-arm on every render.
    const publishRef = useRef(publishEvent);
    publishRef.current = publishEvent;

    const fetchFiles = useCallback(async () => {
        if (!isConnected) return;
        setLoading(true);
        setFetchError(null);
        try {
            const res = await callTool("search", { query: query || "*" });
            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (res?.isError) {
                const errText = typeof parsed === "string" ? parsed : text;
                setFetchError(errText);
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

            // Client-side recency sort + slice. Don't trust the wire
            // order — the MCP server's default may not be modified-desc.
            const sorted = [...list].sort((a, b) => {
                const ta = new Date(a.modifiedTime || 0).getTime();
                const tb = new Date(b.modifiedTime || 0).getTime();
                return tb - ta;
            });
            const top = sorted.slice(0, Math.max(1, Number(limit) || 10));
            setFiles(top);
            setLastFetchedAt(new Date());
        } catch (err) {
            setFetchError(err?.message || "Failed to load files");
        } finally {
            setLoading(false);
        }
    }, [isConnected, callTool, query, limit]);

    // Initial fetch + re-fetch on connection / config change.
    useEffect(() => {
        if (isConnected) fetchFiles();
    }, [isConnected, fetchFiles]);

    // Auto-refresh — guarded by autoRefreshSeconds (0 disables).
    useEffect(() => {
        const seconds = Number(autoRefreshSeconds) || 0;
        if (seconds <= 0 || !isConnected) return undefined;
        const id = setInterval(() => fetchFiles(), seconds * 1000);
        return () => clearInterval(id);
    }, [autoRefreshSeconds, isConnected, fetchFiles]);

    const handleClick = (file) => {
        const id = file.id || file.name;
        setSelectedId(id);
        publishRef.current("fileSelected", {
            id: file.id || null,
            name: file.name || file.title || "Untitled",
            mimeType: file.mimeType || null,
            modifiedTime: file.modifiedTime || null,
            webViewLink: file.webViewLink || null,
        });
        if (openInBrowser && file.webViewLink) {
            // window.open is fine in the renderer — Electron treats
            // http(s) URLs as external (open in default browser) when
            // shell.openExternal is wired up, or as a new BrowserWindow
            // otherwise. Either way the user gets the file.
            window.open(file.webViewLink, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection status line — same shape as the other
                Drive widgets so the dashboard reads consistently. */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        !isConnected && !isConnecting
                            ? "bg-gray-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : loading
                            ? "bg-blue-500 animate-pulse"
                            : "bg-green-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                {lastFetchedAt && (
                    <span className="text-gray-600">
                        · updated {relativeTime(lastFetchedAt)}
                    </span>
                )}
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Loading skeleton — same row count as the configured
                limit (capped) so the layout doesn't reflow when files
                land. */}
            {loading && files.length === 0 && (
                <div className="space-y-2 animate-pulse">
                    {Array.from({
                        length: Math.min(5, Math.max(1, Number(limit) || 5)),
                    }).map((_, i) => (
                        <div key={i} className="h-8 bg-white/5 rounded" />
                    ))}
                </div>
            )}

            {/* Empty states — separate from loading + connection-error
                so the user knows whether to wait, connect, or accept
                that Drive is genuinely empty for this query. */}
            {!loading && !error && files.length === 0 && (
                <div className="text-xs text-gray-500 italic">
                    {!isConnected
                        ? "Connect the Google Drive provider in Settings to load recent files."
                        : `No files matched the query "${
                              query || "*"
                          }". Try a broader query or check your Drive.`}
                </div>
            )}

            {files.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {files.map((file, i) => {
                        const fileId = file.id || file.name || i;
                        const isSelected = selectedId === fileId;
                        const name = file.name || file.title || "Untitled";
                        return (
                            <button
                                key={fileId}
                                type="button"
                                onClick={() => handleClick(file)}
                                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors border ${
                                    isSelected
                                        ? "bg-yellow-900/40 border-yellow-600"
                                        : "bg-white/5 hover:bg-white/10 border-transparent"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FontAwesomeIcon
                                        icon={fileIcon(file.mimeType)}
                                        className={`${fileIconColor(
                                            file.mimeType
                                        )} shrink-0`}
                                    />
                                    <span className="text-gray-200 truncate flex-1">
                                        {name}
                                    </span>
                                    <span className="text-[11px] text-gray-500 shrink-0 font-mono">
                                        {relativeTime(file.modifiedTime)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Per-fetch error — distinct from the provider-level
                error rendered above. */}
            {fetchError && (
                <div className="text-xs text-red-400">
                    Last refresh failed: {fetchError}
                </div>
            )}

            {/* Footer with refresh — always present, disabled when not
                connected/loading. */}
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                    {files.length > 0
                        ? `top ${files.length} of recent`
                        : "no files yet"}
                </span>
                <button
                    type="button"
                    onClick={() => fetchFiles()}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading…" : "Refresh"}
                </button>
            </div>
        </div>
    );
}

export const GoogleDriveRecentFiles = ({
    title = "Recent Drive Files",
    query = "*",
    limit = 10,
    autoRefreshSeconds = 300,
    openInBrowser = true,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GoogleDriveRecentFilesContent
                    title={title}
                    query={query || "*"}
                    limit={Number(limit) || 10}
                    autoRefreshSeconds={Number(autoRefreshSeconds) || 0}
                    openInBrowser={
                        // userConfig select returns strings, so an
                        // explicit string compare is needed — `!== false`
                        // would always be true for the "false" string.
                        openInBrowser === false ||
                        openInBrowser === "false" ||
                        openInBrowser === "no"
                            ? false
                            : true
                    }
                />
            </Panel>
        </Widget>
    );
};
