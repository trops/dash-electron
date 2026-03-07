/**
 * GoogleDriveWidget
 *
 * Browse and search files in Google Drive via the Google Drive MCP provider.
 * Requires a Google Drive MCP provider to be configured.
 *
 * @package GoogleDrive
 */
import { useState } from "react";
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

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
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

function GoogleDriveContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("google-drive");

    const [searchQuery, setSearchQuery] = useState("");
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setErrorMsg(null);
        setSelectedFile(null);
        setFileContent(null);
        try {
            const res = await callTool("search", {
                query: searchQuery.trim(),
            });
            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (res?.isError) {
                setErrorMsg(typeof parsed === "string" ? parsed : text);
                return;
            }

            let list = Array.isArray(parsed)
                ? parsed
                : parsed?.files || parsed?.results || parsed?.items || [];
            setFiles(list);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFile = async (file) => {
        const fileId = file.id || file.fileId;
        if (!fileId) return;

        setSelectedFile(file);
        setFileContent(null);
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await callTool("read_file", {
                file_id: fileId,
            });
            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (res?.isError) {
                setErrorMsg(typeof parsed === "string" ? parsed : text);
                return;
            }

            setFileContent(
                typeof parsed === "string"
                    ? parsed
                    : JSON.stringify(parsed, null, 2)
            );
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
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
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && !fileContent && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {files.map((file, i) => (
                        <button
                            key={file.id || i}
                            onClick={() => handleSelectFile(file)}
                            className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-[10px]">
                                    {getFileIcon(file.mimeType)}
                                </span>
                                <span className="text-gray-300 truncate">
                                    {file.name || file.title || "Untitled"}
                                </span>
                            </div>
                            {file.modifiedTime && (
                                <div className="text-gray-600 text-[10px] mt-0.5 ml-5">
                                    Modified:{" "}
                                    {new Date(
                                        file.modifiedTime
                                    ).toLocaleDateString()}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* File Content */}
            {fileContent && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3
                            title={
                                selectedFile?.name ||
                                selectedFile?.title ||
                                "File"
                            }
                        />
                        <button
                            onClick={() => {
                                setFileContent(null);
                                setSelectedFile(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Back
                        </button>
                    </div>
                    <div className="p-2 bg-white/5 rounded text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
                        {fileContent}
                    </div>
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

export const GoogleDriveWidget = ({ title = "Google Drive", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GoogleDriveContent title={title} />
            </Panel>
        </Widget>
    );
};
