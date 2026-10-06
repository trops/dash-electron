/**
 * FilesystemWidget
 *
 * Browse and search files on the local filesystem via the Filesystem MCP provider.
 * Requires a Filesystem MCP provider to be configured.
 *
 * @package Filesystem
 */
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Button,
    Button3,
    AlertBanner,
    Caption2,
    InputText,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { extractMcpText, isMcpError } from "../utils/mcpUtils";

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
    const { currentTheme } = useContext(ThemeContext);
    if (!currentPath) return null;
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    const parts = currentPath.split("/").filter(Boolean);
    const crumbs = parts.map((part, i) => ({
        label: part,
        path: "/" + parts.slice(0, i + 1).join("/"),
    }));

    return (
        <div
            className={`flex items-center gap-1 text-xs flex-wrap ${bodyText}`}
        >
            <button
                onClick={() => onNavigate(null)}
                className="opacity-70 hover:underline transition-colors"
            >
                ~
            </button>
            {crumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                    <span className="opacity-50">/</span>
                    <button
                        onClick={() => onNavigate(crumb.path)}
                        className={`hover:underline transition-colors ${
                            i === crumbs.length - 1
                                ? "font-medium"
                                : "opacity-70"
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
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    // Theme-driven surfaces so rows follow light/dark themes.
    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

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
            const errorMsg = isMcpError(res, text);
            if (errorMsg) {
                setErrorMsg(errorMsg);
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
            const errorMsg = isMcpError(res, text);
            if (errorMsg) {
                setErrorMsg(errorMsg);
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
            const errorMsg = isMcpError(res, text);
            if (errorMsg) {
                setErrorMsg(errorMsg);
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
            {currentPath && (
                <div className="space-y-2">
                    <SubHeading3 title="Search Files" />
                    <div className="flex flex-wrap items-center gap-2">
                        <InputText
                            type="text"
                            value={searchQuery}
                            onChange={(value) => setSearchQuery(value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
                            placeholder="Search by filename pattern..."
                            className="flex-1 min-w-0"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={!isConnected || loading}
                            size="sm"
                        >
                            Search
                        </Button>
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
                                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-40 ${rowSurface}`}
                            >
                                <span className={`text-xs ${accentText}`}>
                                    folder
                                </span>
                                <span
                                    className={`truncate font-mono ${bodyText}`}
                                >
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
                                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-40 ${rowSurface}`}
                                >
                                    <span className={`text-xs ${accentText}`}>
                                        {getEntryIcon(entry.name, entry.isDir)}
                                    </span>
                                    <span className={`truncate ${bodyText}`}>
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
                        <Button3
                            onClick={() => setSearchResults(null)}
                            size="sm"
                        >
                            Clear
                        </Button3>
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
                                className={`w-full text-left px-2 py-1.5 rounded text-xs truncate font-mono transition-colors ${rowSurface} ${bodyText}`}
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
                        <Button3
                            onClick={() => {
                                setFileContent(null);
                                setViewingFile(null);
                            }}
                            size="sm"
                        >
                            Back
                        </Button3>
                    </div>
                    <pre
                        className={`p-2 border rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono ${
                            currentTheme?.["bg-primary-dark"] || ""
                        } ${
                            currentTheme?.["border-primary-dark"] || ""
                        } ${bodyText}`}
                    >
                        {fileContent}
                    </pre>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <Caption2 block className="animate-pulse">
                    Loading...
                </Caption2>
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

export const FilesystemWidget = ({ title = "Filesystem", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <FilesystemContent title={title} />
            </Panel>
        </Widget>
    );
};
