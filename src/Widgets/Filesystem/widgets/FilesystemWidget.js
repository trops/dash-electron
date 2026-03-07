/**
 * FilesystemWidget
 *
 * Browse and search files on the local filesystem via the Filesystem MCP provider.
 * Requires a Filesystem MCP provider to be configured.
 *
 * @package Filesystem
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";

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

function getEntryIcon(name, isDir) {
    if (isDir) return "folder";
    const ext = name.split(".").pop()?.toLowerCase();
    if (["js", "ts", "jsx", "tsx", "py", "rb", "go", "rs"].includes(ext))
        return "file-code";
    if (["md", "txt", "doc", "docx", "rtf"].includes(ext)) return "file-lines";
    if (["json", "yaml", "yml", "toml", "xml"].includes(ext))
        return "file-code";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext))
        return "image";
    if (["pdf"].includes(ext)) return "file-pdf";
    return "file";
}

function parseDirectoryEntries(text) {
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
        const trimmed = line.trim();
        const isDir = trimmed.startsWith("[DIR]") || trimmed.endsWith("/");
        const name = trimmed
            .replace(/^\[DIR\]\s*/, "")
            .replace(/^\[FILE\]\s*/, "")
            .replace(/\/$/, "");
        return { name, isDir };
    });
}

function Breadcrumb({ currentPath, onNavigate }) {
    if (!currentPath) return null;

    const parts = currentPath.split("/").filter(Boolean);
    const crumbs = parts.map((part, i) => ({
        label: part,
        path: "/" + parts.slice(0, i + 1).join("/"),
    }));

    return (
        <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
            <button
                onClick={() => onNavigate(null)}
                className="hover:text-emerald-400 transition-colors"
            >
                ~
            </button>
            {crumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                    <span className="text-gray-600">/</span>
                    <button
                        onClick={() => onNavigate(crumb.path)}
                        className={`hover:text-emerald-400 transition-colors ${
                            i === crumbs.length - 1 ? "text-gray-200" : ""
                        }`}
                    >
                        {crumb.label}
                    </button>
                </span>
            ))}
        </div>
    );
}

function FilesystemContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("filesystem");

    const [currentPath, setCurrentPath] = useState(null);
    const [entries, setEntries] = useState([]);
    const [fileContent, setFileContent] = useState(null);
    const [viewingFile, setViewingFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [allowedDirs, setAllowedDirs] = useState([]);

    const loadAllowedDirs = useCallback(async () => {
        try {
            const res = await callTool("list_allowed_directories", {});
            const text = extractMcpText(res);
            console.log(
                "[FilesystemWidget] list_allowed_directories response:",
                text
            );
            const lines = text.split("\n").filter((line) => line.trim());
            // Keep lines that look like absolute paths
            const dirs = lines
                .map((l) => l.trim())
                .filter((l) => l.startsWith("/"));
            if (dirs.length > 0) {
                setAllowedDirs(dirs);
            } else {
                // No paths parsed — show raw response as error for debugging
                setErrorMsg("Could not parse allowed directories: " + text);
            }
        } catch (err) {
            setErrorMsg(err.message);
        }
    }, [callTool]);

    useEffect(() => {
        if (isConnected && allowedDirs.length === 0) {
            loadAllowedDirs();
        }
    }, [isConnected, allowedDirs.length, loadAllowedDirs]);

    const handleListDirectory = async (path) => {
        setLoading(true);
        setErrorMsg(null);
        setFileContent(null);
        setViewingFile(null);
        setSearchResults(null);
        try {
            const res = await callTool("list_directory", { path });
            const text = extractMcpText(res);

            if (res?.isError) {
                setErrorMsg(
                    typeof text === "string" ? text : "Failed to list directory"
                );
                return;
            }

            const parsed = parseDirectoryEntries(text);
            setEntries(parsed);
            setCurrentPath(path);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReadFile = async (path) => {
        setLoading(true);
        setErrorMsg(null);
        setSearchResults(null);
        try {
            const res = await callTool("read_file", { path });
            const text = extractMcpText(res);

            if (res?.isError) {
                setErrorMsg(
                    typeof text === "string" ? text : "Failed to read file"
                );
                return;
            }

            setFileContent(text);
            setViewingFile(path);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !currentPath) return;
        setLoading(true);
        setErrorMsg(null);
        setFileContent(null);
        setViewingFile(null);
        try {
            const res = await callTool("search_files", {
                path: currentPath,
                pattern: searchQuery.trim(),
            });
            const text = extractMcpText(res);

            if (res?.isError) {
                setErrorMsg(typeof text === "string" ? text : "Search failed");
                return;
            }

            const lines = text.split("\n").filter((l) => l.trim());
            setSearchResults(lines);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEntryClick = (entry) => {
        const fullPath = currentPath + "/" + entry.name;
        if (entry.isDir) {
            handleListDirectory(fullPath);
        } else {
            handleReadFile(fullPath);
        }
    };

    const handleBreadcrumbNavigate = (path) => {
        if (path) {
            handleListDirectory(path);
        } else {
            setCurrentPath(null);
            setEntries([]);
            setFileContent(null);
            setViewingFile(null);
            setSearchResults(null);
        }
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
            {currentPath && (
                <div className="space-y-2">
                    <SubHeading3 title="Search Files" />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
                            placeholder="Search by filename pattern..."
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!isConnected || loading}
                            className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        >
                            Search
                        </button>
                    </div>
                </div>
            )}

            {/* Breadcrumb */}
            {currentPath && (
                <Breadcrumb
                    currentPath={currentPath}
                    onNavigate={handleBreadcrumbNavigate}
                />
            )}

            {/* Allowed Directories (root view) */}
            {!currentPath && !fileContent && allowedDirs.length > 0 && (
                <div className="space-y-2">
                    <SubHeading3 title="Allowed Directories" />
                    <div className="space-y-1">
                        {allowedDirs.map((dir, i) => (
                            <button
                                key={i}
                                onClick={() => handleListDirectory(dir)}
                                disabled={loading}
                                className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-40"
                            >
                                <span className="text-emerald-400 text-[10px]">
                                    folder
                                </span>
                                <span className="text-gray-300 truncate font-mono">
                                    {dir}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Directory Listing */}
            {currentPath &&
                !fileContent &&
                !searchResults &&
                entries.length > 0 && (
                    <div className="space-y-1 overflow-y-auto">
                        {entries
                            .sort((a, b) => {
                                if (a.isDir && !b.isDir) return -1;
                                if (!a.isDir && b.isDir) return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map((entry, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleEntryClick(entry)}
                                    disabled={loading}
                                    className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-40"
                                >
                                    <span className="text-emerald-400 text-[10px]">
                                        {getEntryIcon(entry.name, entry.isDir)}
                                    </span>
                                    <span className="text-gray-300 truncate">
                                        {entry.name}
                                        {entry.isDir ? "/" : ""}
                                    </span>
                                </button>
                            ))}
                    </div>
                )}

            {/* Search Results */}
            {searchResults && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3
                            title={`Results (${searchResults.length})`}
                        />
                        <button
                            onClick={() => setSearchResults(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-48">
                        {searchResults.map((result, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    const isDir = result.endsWith("/");
                                    if (isDir) {
                                        handleListDirectory(
                                            result.replace(/\/$/, "")
                                        );
                                    } else {
                                        handleReadFile(result);
                                    }
                                }}
                                className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 truncate font-mono transition-colors"
                            >
                                {result}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* File Content View */}
            {fileContent && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3
                            title={viewingFile?.split("/").pop() || "File"}
                        />
                        <button
                            onClick={() => {
                                setFileContent(null);
                                setViewingFile(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Back
                        </button>
                    </div>
                    <pre className="p-2 bg-black/30 border border-gray-700 rounded text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                        {fileContent}
                    </pre>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-xs text-gray-500 animate-pulse">
                    Loading...
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

export const FilesystemWidget = ({ title = "Filesystem", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <FilesystemContent title={title} />
            </Panel>
        </Widget>
    );
};
