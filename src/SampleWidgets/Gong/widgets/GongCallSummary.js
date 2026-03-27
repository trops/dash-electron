/**
 * GongCallSummary
 *
 * AI-generated summary for a Gong call.
 * Listens for callSelected events to load the summary.
 *
 * @package Gong
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { CallSummary } from "./components/CallSummary";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongCallSummaryContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { listen, listeners } = useWidgetEvents();

    const [callTitle, setCallTitle] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const loadSummary = useCallback(
        async (callId) => {
            if (!callId || !isConnected) return;
            setLoading(true);
            setErrorMsg(null);
            setSummary(null);
            try {
                const res = await callTool("get_call_summary", { callId });
                const { data, error: mcpError } = parseMcpResponse(res);
                if (mcpError) {
                    setErrorMsg(mcpError);
                } else {
                    setSummary(data);
                }
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            if (payload.id) {
                setCallTitle(payload.title || null);
                loadSummary(payload.id);
            }
        },
        [loadSummary]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                setListenerStatus("listening");
                listen(listeners, {
                    callSelected: (data) => handlerRef.current(data),
                });
            } else {
                setListenerStatus("no listeners assigned");
            }
        }
    }, [listeners, listen]);

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

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        listenerStatus === "listening"
                            ? "bg-green-500"
                            : "bg-yellow-500"
                    }`}
                />
                <span className="text-gray-500">
                    {listenerStatus === "listening"
                        ? "Listening for callSelected"
                        : "No event listeners configured"}
                </span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {callTitle && <SubHeading3 title={callTitle} />}

            <CallSummary summary={summary} loading={loading} />

            {!summary && !loading && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    {listenerStatus === "no listeners assigned"
                        ? "No event listeners configured. Wire callSelected from a Gong Call Search or Library Folders widget."
                        : "Select a call from Gong Call Search to view its summary."}
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

export const GongCallSummary = ({ title = "Call Summary", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongCallSummaryContent title={title} />
            </Panel>
        </Widget>
    );
};
