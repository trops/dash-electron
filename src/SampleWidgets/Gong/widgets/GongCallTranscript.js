/**
 * GongCallTranscript
 *
 * Speaker-attributed transcript for a Gong call.
 * Listens for callSelected events to load the transcript.
 *
 * @package Gong
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { CallTranscript } from "./components/CallTranscript";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongCallTranscriptContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { listen, listeners } = useWidgetEvents();

    const [callId, setCallId] = useState(null);
    const [callTitle, setCallTitle] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const loadTranscript = useCallback(
        async (id) => {
            if (!id || !isConnected) return;
            setLoading(true);
            setErrorMsg(null);
            setTranscript(null);
            try {
                const res = await callTool("get_call_transcript", {
                    callId: id,
                });
                const { data, error: mcpError } = parseMcpResponse(res);
                if (mcpError) {
                    setErrorMsg(mcpError);
                } else {
                    setTranscript(data);
                }
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    const handleLoadMore = useCallback(
        async (cursor) => {
            if (!callId) return;
            setLoading(true);
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
                setLoading(false);
            }
        },
        [callTool, callId]
    );

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            if (payload.id) {
                setCallId(payload.id);
                setCallTitle(payload.title || null);
                loadTranscript(payload.id);
            }
        },
        [loadTranscript]
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

            <CallTranscript
                transcript={transcript}
                loading={loading}
                onLoadMore={handleLoadMore}
            />

            {!transcript && !loading && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    {listenerStatus === "no listeners assigned"
                        ? "No event listeners configured. Wire callSelected from a Gong Call Search or Library Folders widget."
                        : "Select a call from Gong Call Search to view its transcript."}
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

export const GongCallTranscript = ({ title = "Call Transcript", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongCallTranscriptContent title={title} />
            </Panel>
        </Widget>
    );
};
