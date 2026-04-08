/**
 * GongCallSearch
 *
 * Search and browse Gong calls. Publishes callSelected when a call is clicked.
 *
 * @package Gong
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { CallList } from "./components/CallList";
import { parseMcpResponse, parseGongTextEntries } from "../utils/mcpUtils";

function GongCallSearchContent({ title, defaultDaysBack }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("gong");
    const { publishEvent } = useWidgetEvents();

    const [calls, setCalls] = useState([]);
    const [selectedCallId, setSelectedCallId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const handleLoadCalls = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const days = parseInt(defaultDaysBack) || 30;
            const from =
                fromDate ||
                new Date(Date.now() - days * 86400000).toISOString();
            const to = toDate || new Date().toISOString();

            const toolName = searchQuery.trim() ? "search_calls" : "list_calls";
            const args = { fromDateTime: from, toDateTime: to };
            if (searchQuery.trim()) args.query = searchQuery.trim();

            const res = await callTool(toolName, args);
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["calls", "records"],
                textParser: parseGongTextEntries,
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
    }, [callTool, searchQuery, fromDate, toDate, defaultDaysBack]);

    const handleSelectCall = useCallback(
        (call) => {
            const id = call.id || call.metaData?.id || call.callId || "";
            setSelectedCallId(id);
            const payload = {
                id,
                title:
                    call.title ||
                    call.metaData?.title ||
                    call.subject ||
                    call.name ||
                    "",
                date: call.started || call.date || call.metaData?.started || "",
                duration: call.duration ?? call.metaData?.duration ?? null,
                scope: call.scope || "",
            };
            try {
                publishEvent("callSelected", payload);
            } catch (err) {
                console.error("[GongCallSearch] publishEvent error:", err);
            }
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

            {/* Search & Filters */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleLoadCalls()
                        }
                        placeholder="Search calls..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                        onClick={handleLoadCalls}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "Load Calls"}
                    </button>
                </div>
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={fromDate ? fromDate.slice(0, 10) : ""}
                        onChange={(e) =>
                            setFromDate(
                                e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : ""
                            )
                        }
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                        type="date"
                        value={toDate ? toDate.slice(0, 10) : ""}
                        onChange={(e) =>
                            setToDate(
                                e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : ""
                            )
                        }
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                    />
                </div>
            </div>

            <CallList
                calls={calls}
                onSelectCall={handleSelectCall}
                selectedId={selectedCallId}
            />

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

export const GongCallSearch = ({
    title = "Gong Calls",
    defaultDaysBack = "30",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongCallSearchContent
                    title={title}
                    defaultDaysBack={defaultDaysBack}
                />
            </Panel>
        </Widget>
    );
};
