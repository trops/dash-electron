/**
 * GoogleDriveWidget
 *
 * Browse and search files in Google Drive via the Google Drive MCP provider.
 * Requires a Google Drive MCP provider to be configured.
 *
 * @package GoogleDrive
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
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

function GoogleDriveContent({ title }) {
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

    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const rowSurface = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

    const [searchQuery, setSearchQuery] = useState("");
    const [files, setFiles] = useState([]);
    const [rawText, setRawText] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setErrorMsg(null);
        setRawText(null);
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

            setFiles(list);
            if (list.length === 0 && typeof text === "string" && text.trim()) {
                setRawText(text);
            }
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setErrorMsg(err.message);
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
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
            <div className="space-y-2">
                <SubHeading3 title="Search Files" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Google Drive..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {files.map((file, i) => (
                        <div
                            key={file.id || i}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs ${rowSurface}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${accentText}`}>
                                    {getFileIcon(file.mimeType)}
                                </span>
                                <span className={`truncate ${bodyText}`}>
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
                        </div>
                    ))}
                </div>
            )}

            {/* Raw text fallback when no files could be parsed */}
            {rawText && files.length === 0 && (
                <div
                    className={`p-2 rounded text-xs whitespace-pre-wrap ${rowSurface} ${bodyText}`}
                >
                    {rawText}
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

            {/* Error */}
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

export const GoogleDriveWidget = ({ title = "Google Drive", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GoogleDriveContent title={title} />
            </Panel>
        </Widget>
    );
};
