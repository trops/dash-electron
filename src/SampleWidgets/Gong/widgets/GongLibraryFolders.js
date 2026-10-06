/**
 * GongLibraryFolders
 *
 * Browse Gong call library folders. Click a call to publish callSelected.
 * Uses list_workspaces, list_library_folders, and get_library_folder_calls.
 *
 * @package Gong
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Button2,
    Caption2,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongLibraryFoldersContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const selectedRow = `${currentTheme?.["bg-secondary-dark"] || ""} ${
        currentTheme?.["text-secondary-light"] || ""
    }`;
    const { publishEvent } = useWidgetEvents();

    const [workspaces, setWorkspaces] = useState([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleLoadWorkspaces = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await callTool("list_workspaces", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["workspaces"],
            });
            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }
            setWorkspaces(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    }, [callTool]);

    const handleSelectWorkspace = useCallback(
        async (ws) => {
            const wsId = ws.id || ws.workspaceId || "";
            setSelectedWorkspace(wsId);
            setSelectedFolder(null);
            setFolders([]);
            setCalls([]);
            setLoading(true);
            setErrorMsg(null);
            try {
                const res = await callTool("list_library_folders", {
                    workspaceId: wsId,
                });
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["folders"],
                });
                if (mcpError) {
                    setErrorMsg(mcpError);
                    return;
                }
                setFolders(Array.isArray(data) ? data : []);
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [callTool]
    );

    const handleSelectFolder = useCallback(
        async (folder) => {
            const folderId = folder.id || folder.folderId || "";
            setSelectedFolder(folderId);
            setCalls([]);
            setLoading(true);
            setErrorMsg(null);
            try {
                const res = await callTool("get_library_folder_calls", {
                    folderId,
                });
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["calls"],
                });
                if (mcpError) {
                    setErrorMsg(mcpError);
                    return;
                }
                setCalls(Array.isArray(data) ? data : []);
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [callTool]
    );

    const handleSelectCall = useCallback(
        (call) => {
            const id = call.id || call.callId || "";
            publishEvent("callSelected", {
                id,
                title: call.title || call.name || "",
                date: call.date || "",
                duration: call.duration || null,
                scope: call.scope || "",
            });
        },
        [publishEvent]
    );

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

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

            {/* Workspaces */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Workspaces" />
                    <Button2
                        size="xs"
                        onClick={handleLoadWorkspaces}
                        disabled={!isConnected || loading}
                    >
                        {loading && !selectedWorkspace ? "Loading..." : "Load"}
                    </Button2>
                </div>
                {workspaces.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {workspaces.map((ws, i) =>
                            selectedWorkspace === (ws.id || ws.workspaceId) ? (
                                <Button
                                    key={ws.id || i}
                                    size="sm"
                                    onClick={() => handleSelectWorkspace(ws)}
                                >
                                    {ws.name || ws.id || "Workspace"}
                                </Button>
                            ) : (
                                <Button2
                                    key={ws.id || i}
                                    size="sm"
                                    onClick={() => handleSelectWorkspace(ws)}
                                >
                                    {ws.name || ws.id || "Workspace"}
                                </Button2>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Folders */}
            {folders.length > 0 && (
                <div className="space-y-1">
                    <SubHeading3 title="Folders" />
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {folders.map((folder, i) => (
                            <button
                                key={folder.id || i}
                                onClick={() => handleSelectFolder(folder)}
                                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                    selectedFolder ===
                                    (folder.id || folder.folderId)
                                        ? selectedRow
                                        : `${surface} ${rowHover} ${bodyText}`
                                }`}
                            >
                                <span>
                                    {folder.name || folder.id || "Folder"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Calls in folder */}
            {calls.length > 0 && (
                <div className="space-y-1">
                    <SubHeading3 title={`Calls (${calls.length})`} />
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {calls.map((call, i) => (
                            <button
                                key={call.id || call.callId || i}
                                onClick={() => handleSelectCall(call)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${surface} ${rowHover}`}
                            >
                                <div className={`truncate ${bodyText}`}>
                                    {call.title || call.name || "Untitled"}
                                </div>
                                {call.curatorNotes && (
                                    <Caption2 block className="truncate mt-0.5">
                                        {call.curatorNotes}
                                    </Caption2>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {workspaces.length === 0 && !loading && (
                <Caption2 block className="italic">
                    Click Load to browse Gong library folders.
                </Caption2>
            )}

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

export const GongLibraryFolders = ({ title = "Call Library", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongLibraryFoldersContent title={title} />
            </Panel>
        </Widget>
    );
};
