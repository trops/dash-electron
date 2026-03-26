/**
 * GongWidget
 *
 * Browse Gong call transcripts and AI-generated summaries via gongio-mcp.
 * Requires a Gong MCP provider to be configured.
 *
 * @package Gong
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { CallList } from "./components/CallList";
import { CallSummary } from "./components/CallSummary";
import { CallTranscript } from "./components/CallTranscript";
import { parseMcpResponse, parseGongTextEntries } from "../utils/mcpUtils";

function GongContent({ title, defaultDaysBack }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("gong");

    const [view, setView] = useState("list");
    const [calls, setCalls] = useState([]);
    const [selectedCall, setSelectedCall] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [transcript, setTranscript] = useState(null);
    const [summary, setSummary] = useState(null);
    const [detailLoading, setDetailLoading] = useState({
        transcript: false,
        summary: false,
    });

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
        async (call) => {
            setSelectedCall(call);
            setView("detail");
            setSummary(null);
            setTranscript(null);
            setDetailLoading({ transcript: true, summary: true });

            const callId = call.id || call.metaData?.id || call.callId;

            // Load summary and transcript in parallel
            callTool("get_call_summary", { callId })
                .then((res) => {
                    const { data, error: mcpError } = parseMcpResponse(res);
                    if (mcpError) {
                        setSummary({ error: mcpError });
                    } else {
                        setSummary(data);
                    }
                })
                .catch((err) => setSummary({ error: err.message }))
                .finally(() =>
                    setDetailLoading((prev) => ({ ...prev, summary: false }))
                );

            callTool("get_call_transcript", { callId })
                .then((res) => {
                    const { data, error: mcpError } = parseMcpResponse(res);
                    if (mcpError) {
                        setTranscript({ error: mcpError });
                    } else {
                        setTranscript(data);
                    }
                })
                .catch((err) => setTranscript({ error: err.message }))
                .finally(() =>
                    setDetailLoading((prev) => ({
                        ...prev,
                        transcript: false,
                    }))
                );
        },
        [callTool]
    );

    const handleLoadMoreTranscript = useCallback(
        async (cursor) => {
            const callId =
                selectedCall?.id ||
                selectedCall?.metaData?.id ||
                selectedCall?.callId;
            setDetailLoading((prev) => ({ ...prev, transcript: true }));
            try {
                const res = await callTool("get_call_transcript", {
                    callId,
                    cursor,
                });
                const { data, error: mcpError } = parseMcpResponse(res);
                if (mcpError) {
                    setErrorMsg(mcpError);
                    return;
                }
                const newSegments = Array.isArray(data)
                    ? data
                    : data?.segments || data?.transcript || [];
                setTranscript((prev) => ({
                    ...(typeof data === "object" && !Array.isArray(data)
                        ? data
                        : {}),
                    segments: [
                        ...(prev?.segments || prev?.transcript || []),
                        ...newSegments,
                    ],
                }));
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setDetailLoading((prev) => ({ ...prev, transcript: false }));
            }
        },
        [callTool, selectedCall]
    );

    const handleBack = () => {
        setView("list");
        setSelectedCall(null);
        setSummary(null);
        setTranscript(null);
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

            {view === "list" && (
                <>
                    {/* Filters */}
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
                                            ? new Date(
                                                  e.target.value
                                              ).toISOString()
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
                                            ? new Date(
                                                  e.target.value
                                              ).toISOString()
                                            : ""
                                    )
                                }
                                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Call List */}
                    <CallList calls={calls} onSelectCall={handleSelectCall} />
                </>
            )}

            {view === "detail" && selectedCall && (
                <>
                    <button
                        onClick={handleBack}
                        className="self-start px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                    >
                        Back to Calls
                    </button>

                    <SubHeading3
                        title={
                            selectedCall.title ||
                            selectedCall.metaData?.title ||
                            selectedCall.subject ||
                            selectedCall.name ||
                            "Call Details"
                        }
                    />

                    {/* Summary */}
                    <div className="space-y-1">
                        <div className="text-xs text-gray-400 font-medium">
                            Summary
                        </div>
                        <CallSummary
                            summary={summary}
                            loading={detailLoading.summary}
                        />
                    </div>

                    {/* Transcript */}
                    <div className="space-y-1">
                        <div className="text-xs text-gray-400 font-medium">
                            Transcript
                        </div>
                        <CallTranscript
                            transcript={transcript}
                            loading={detailLoading.transcript}
                            onLoadMore={handleLoadMoreTranscript}
                        />
                    </div>
                </>
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

export const GongWidget = ({
    title = "Gong Calls",
    defaultDaysBack = "30",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongContent title={title} defaultDaysBack={defaultDaysBack} />
            </Panel>
        </Widget>
    );
};
