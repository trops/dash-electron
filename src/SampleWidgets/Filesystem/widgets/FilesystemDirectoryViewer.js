/**
 * FilesystemDirectoryViewer
 *
 * Tree-style directory browser. Unlike `FilesystemWidget` (which
 * navigates one directory at a time with a breadcrumb), this widget
 * shows a nested expandable tree of folders rooted at a configured
 * path. Clicking a folder expands/collapses (lazy-loading children
 * on first expand); clicking a file publishes `fileSelected` so
 * paired widgets (file preview, code viewer) can react.
 *
 * Lazy expansion matters: a full recursive directory list of a
 * deep path would block the MCP for seconds AND drown the user in
 * thousands of rows. Each folder is fetched only when the user
 * opens it. `maxDepth` is a defensive cap — folders past that depth
 * still expand, but show a "depth limit" hint instead of recursing
 * automatically on mount.
 *
 * Calls the Filesystem MCP `list_directory` tool, reuses the same
 * `[DIR]/[FILE]` text parsing the FilesystemWidget does, and
 * publishes a `fileSelected` event with the absolute path so paired
 * widgets get a stable handle to read.
 *
 * @package Filesystem
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, FontAwesomeIcon } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { extractMcpText, isMcpError } from "../utils/mcpUtils";

function parseDirectoryEntries(text) {
    if (typeof text !== "string") return [];
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const isDir = line.startsWith("[DIR]") || line.endsWith("/");
            const name = line
                .replace(/^\[DIR\]\s*/, "")
                .replace(/^\[FILE\]\s*/, "")
                .replace(/\/$/, "");
            return { name, isDir };
        });
}

function joinPath(base, name) {
    if (!base || base === "/") return `/${name}`;
    return `${base.replace(/\/+$/, "")}/${name}`;
}

function fileIcon(name) {
    const lower = (name || "").toLowerCase();
    if (lower.endsWith(".pdf")) return "file-pdf";
    if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".svg")
    )
        return "file-image";
    if (
        lower.endsWith(".zip") ||
        lower.endsWith(".tar") ||
        lower.endsWith(".gz")
    )
        return "file-zipper";
    if (
        lower.endsWith(".js") ||
        lower.endsWith(".ts") ||
        lower.endsWith(".jsx") ||
        lower.endsWith(".tsx") ||
        lower.endsWith(".py") ||
        lower.endsWith(".rb") ||
        lower.endsWith(".go")
    )
        return "file-code";
    if (lower.endsWith(".md") || lower.endsWith(".txt")) return "file-lines";
    return "file";
}

/**
 * One folder/file row in the tree. Recursive — child folders render
 * their own DirectoryNode. Children state is lifted into a map keyed
 * by full path so collapsed-state survives parent re-renders, and so
 * the same folder appearing twice (rare but possible with symlinks)
 * doesn't double-fetch.
 */
function DirectoryNode({
    path,
    name,
    depth,
    maxDepth,
    expanded,
    childrenByPath,
    loadingPaths,
    errorByPath,
    selectedPath,
    onToggle,
    onSelectFile,
}) {
    const indent = { paddingLeft: `${Math.min(depth, 6) * 12}px` };
    const isLoading = loadingPaths.has(path);
    const err = errorByPath[path];
    const children = childrenByPath[path];
    const overDepth = depth >= maxDepth;

    return (
        <div>
            <button
                type="button"
                onClick={() => onToggle(path)}
                style={indent}
                className="w-full text-left px-2 py-1 text-xs flex items-center gap-2 rounded hover:bg-white/5"
            >
                <FontAwesomeIcon
                    icon={
                        isLoading
                            ? "spinner"
                            : expanded
                            ? "chevron-down"
                            : "chevron-right"
                    }
                    className={`text-gray-500 shrink-0 ${
                        isLoading ? "animate-spin" : ""
                    }`}
                />
                <FontAwesomeIcon
                    icon={expanded ? "folder-open" : "folder"}
                    className="text-yellow-400 shrink-0"
                />
                <span className="text-gray-200 truncate flex-1">{name}</span>
            </button>
            {expanded && err && (
                <div
                    style={{ paddingLeft: `${Math.min(depth + 1, 7) * 12}px` }}
                    className="text-[11px] text-red-400 px-2 py-1"
                >
                    {err}
                </div>
            )}
            {expanded && overDepth && !children && (
                <div
                    style={{ paddingLeft: `${Math.min(depth + 1, 7) * 12}px` }}
                    className="text-[11px] text-gray-500 italic px-2 py-1"
                >
                    depth limit ({maxDepth}). Increase Max depth in widget
                    settings to load deeper.
                </div>
            )}
            {expanded &&
                children &&
                children.length === 0 &&
                !isLoading &&
                !err && (
                    <div
                        style={{
                            paddingLeft: `${Math.min(depth + 1, 7) * 12}px`,
                        }}
                        className="text-[11px] text-gray-500 italic px-2 py-1"
                    >
                        empty
                    </div>
                )}
            {expanded && children && children.length > 0 && (
                <div>
                    {children.map((entry) => {
                        const childPath = joinPath(path, entry.name);
                        if (entry.isDir) {
                            return (
                                <DirectoryNode
                                    key={childPath}
                                    path={childPath}
                                    name={entry.name}
                                    depth={depth + 1}
                                    maxDepth={maxDepth}
                                    expanded={Boolean(
                                        childrenByPath[childPath] !== undefined
                                    )}
                                    childrenByPath={childrenByPath}
                                    loadingPaths={loadingPaths}
                                    errorByPath={errorByPath}
                                    selectedPath={selectedPath}
                                    onToggle={onToggle}
                                    onSelectFile={onSelectFile}
                                />
                            );
                        }
                        const isSelected = selectedPath === childPath;
                        return (
                            <button
                                key={childPath}
                                type="button"
                                onClick={() =>
                                    onSelectFile(childPath, entry.name)
                                }
                                style={{
                                    paddingLeft: `${
                                        Math.min(depth + 1, 7) * 12 + 14
                                    }px`,
                                }}
                                className={`w-full text-left px-2 py-1 text-xs flex items-center gap-2 rounded border ${
                                    isSelected
                                        ? "bg-emerald-900/40 border-emerald-600"
                                        : "border-transparent hover:bg-white/5"
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon={fileIcon(entry.name)}
                                    className="text-gray-400 shrink-0"
                                />
                                <span className="text-gray-300 truncate flex-1">
                                    {entry.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function FilesystemDirectoryViewerContent({ title, rootPath, maxDepth }) {
    const { isConnected, isConnecting, error, callTool, status } =
        useMcpProvider("filesystem");
    const { publishEvent } = useWidgetEvents();

    // `childrenByPath` is the tree's authoritative state. Setting a
    // key collapses naturally to "fetched + expanded"; deleting a key
    // collapses + drops the children. Avoids managing a separate
    // expanded-set + cache.
    const [childrenByPath, setChildrenByPath] = useState({});
    const [loadingPaths, setLoadingPaths] = useState(() => new Set());
    const [errorByPath, setErrorByPath] = useState({});
    const [selectedPath, setSelectedPath] = useState(null);

    const publishRef = useRef(publishEvent);
    publishRef.current = publishEvent;

    const fetchDir = useCallback(
        async (path) => {
            if (!isConnected) return;
            setLoadingPaths((prev) => {
                const next = new Set(prev);
                next.add(path);
                return next;
            });
            setErrorByPath((prev) => {
                if (!(path in prev)) return prev;
                const next = { ...prev };
                delete next[path];
                return next;
            });
            try {
                const res = await callTool("list_directory", { path });
                const text = extractMcpText(res);
                const mcpErr = isMcpError(res, text);
                if (mcpErr) {
                    setErrorByPath((prev) => ({ ...prev, [path]: mcpErr }));
                    return;
                }
                const entries = parseDirectoryEntries(text);
                setChildrenByPath((prev) => ({ ...prev, [path]: entries }));
            } catch (err) {
                setErrorByPath((prev) => ({
                    ...prev,
                    [path]: err?.message || "list_directory failed",
                }));
            } finally {
                setLoadingPaths((prev) => {
                    const next = new Set(prev);
                    next.delete(path);
                    return next;
                });
            }
        },
        [isConnected, callTool]
    );

    // Auto-load the root on first connect.
    useEffect(() => {
        if (isConnected && rootPath && childrenByPath[rootPath] === undefined) {
            fetchDir(rootPath);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, rootPath]);

    const handleToggle = useCallback(
        (path) => {
            // If the path is currently expanded (has children entry),
            // collapse by deleting the key. Otherwise fetch + expand.
            setChildrenByPath((prev) => {
                if (prev[path] !== undefined) {
                    const next = { ...prev };
                    delete next[path];
                    return next;
                }
                return prev;
            });
            if (childrenByPath[path] === undefined) {
                fetchDir(path);
            }
        },
        [childrenByPath, fetchDir]
    );

    const handleSelectFile = useCallback((path, name) => {
        setSelectedPath(path);
        publishRef.current("fileSelected", { path, name });
    }, []);

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection status. */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        !isConnected && !isConnecting
                            ? "bg-gray-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : loadingPaths.size > 0
                            ? "bg-blue-500 animate-pulse"
                            : "bg-green-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                {rootPath && (
                    <span className="text-gray-600 truncate">({rootPath})</span>
                )}
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* No-path / not-connected / root-error / tree states.
                Each is mutually exclusive so the user always sees a
                concrete next step. */}
            {!isConnected && (
                <div className="text-xs text-gray-500 italic">
                    Connect the Filesystem provider in Settings to browse files.
                    The provider's allowed directories control which paths can
                    be opened.
                </div>
            )}

            {isConnected && !rootPath && (
                <div className="text-xs text-gray-500 italic">
                    Set Root path in this widget's settings to an absolute
                    directory the Filesystem provider has access to (e.g.
                    `/Users/me/projects` on macOS).
                </div>
            )}

            {isConnected && rootPath && errorByPath[rootPath] && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    Could not list <span className="font-mono">{rootPath}</span>
                    : {errorByPath[rootPath]}
                </div>
            )}

            {isConnected && rootPath && !errorByPath[rootPath] && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <DirectoryNode
                        path={rootPath}
                        name={rootPath}
                        depth={0}
                        maxDepth={maxDepth}
                        expanded={childrenByPath[rootPath] !== undefined}
                        childrenByPath={childrenByPath}
                        loadingPaths={loadingPaths}
                        errorByPath={errorByPath}
                        selectedPath={selectedPath}
                        onToggle={handleToggle}
                        onSelectFile={handleSelectFile}
                    />
                </div>
            )}

            {/* Footer: refresh-root button. Useful when files change
                under the widget — the lazy-load cache doesn't auto-
                invalidate. */}
            {isConnected && rootPath && (
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span>
                        {Object.keys(childrenByPath).length === 0
                            ? "not yet loaded"
                            : `${
                                  Object.keys(childrenByPath).length
                              } folder(s) loaded`}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            // Drop the entire cache + re-fetch root.
                            // Folders the user had expanded will need
                            // to be re-opened — acceptable tradeoff
                            // for a fully fresh view.
                            setChildrenByPath({});
                            setErrorByPath({});
                            fetchDir(rootPath);
                        }}
                        disabled={loadingPaths.size > 0}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loadingPaths.size > 0 ? "Loading…" : "Refresh"}
                    </button>
                </div>
            )}
        </div>
    );
}

export const FilesystemDirectoryViewer = ({
    title = "Files",
    rootPath = "",
    maxDepth = 3,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <FilesystemDirectoryViewerContent
                    title={title}
                    rootPath={(rootPath || "").trim()}
                    maxDepth={Math.max(1, Number(maxDepth) || 3)}
                />
            </Panel>
        </Widget>
    );
};
