/**
 * GongLibraryFolders
 *
 * Browse Gong call library folders. Click a call to publish callSelected.
 * Uses list_workspaces, list_library_folders, and get_library_folder_calls.
 *
 * @package Gong
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongLibraryFoldersContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
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

            {/* Workspaces */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Workspaces" />
                    <button
                        onClick={handleLoadWorkspaces}
                        disabled={!isConnected || loading}
                        className="px-2 py-1 text-[10px] rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white"
                    >
                        {loading && !selectedWorkspace ? "Loading..." : "Load"}
                    </button>
                </div>
                {workspaces.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {workspaces.map((ws, i) => (
                            <button
                                key={ws.id || i}
                                onClick={() => handleSelectWorkspace(ws)}
                                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                    selectedWorkspace ===
                                    (ws.id || ws.workspaceId)
                                        ? "bg-emerald-700 text-white"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                            >
                                {ws.name || ws.id || "Workspace"}
                            </button>
                        ))}
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
                                        ? "bg-emerald-900/40 border border-emerald-600"
                                        : "bg-white/5 hover:bg-white/10"
                                }`}
                            >
                                <span className="text-gray-300">
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
                                className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                            >
                                <div className="text-gray-300 truncate">
                                    {call.title || call.name || "Untitled"}
                                </div>
                                {call.curatorNotes && (
                                    <div className="text-gray-500 truncate mt-0.5">
                                        {call.curatorNotes}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {workspaces.length === 0 && !loading && (
                <div className="text-xs text-gray-600 italic">
                    Click Load to browse Gong library folders.
                </div>
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
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
