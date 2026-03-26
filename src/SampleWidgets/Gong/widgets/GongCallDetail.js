/**
 * GongCallDetail
 *
 * Call metadata and participants for a Gong call.
 * Listens for callSelected events to load call details via get_call.
 *
 * @package Gong
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongCallDetailContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { listen, listeners } = useWidgetEvents();

    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const loadCall = useCallback(
        async (callId) => {
            if (!callId || !isConnected) return;
            setLoading(true);
            setErrorMsg(null);
            setCall(null);
            try {
                const res = await callTool("get_call", { callId });
                const { data, error: mcpError } = parseMcpResponse(res);
                if (mcpError) {
                    setErrorMsg(mcpError);
                } else {
                    setCall(
                        typeof data === "string" ? { description: data } : data
                    );
                }
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            if (data.id) loadCall(data.id);
        },
        [loadCall]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                listen(listeners, {
                    callSelected: (data) => handlerRef.current(data),
                });
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

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {loading && (
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                    <div className="h-3 bg-gray-700 rounded w-2/3" />
                </div>
            )}

            {call ? (
                <div className="space-y-3 text-xs">
                    {(call.title || call.metaData?.title) && (
                        <SubHeading3
                            title={call.title || call.metaData?.title}
                        />
                    )}

                    {/* Metadata fields */}
                    <div className="space-y-1.5 text-gray-400">
                        {renderField("URL", call.url || call.metaData?.url)}
                        {renderField("Direction", call.direction)}
                        {renderField("Scope", call.scope)}
                        {renderField("System", call.system)}
                        {renderField(
                            "Duration",
                            formatDuration(
                                call.duration ?? call.metaData?.duration
                            )
                        )}
                        {renderField(
                            "Date",
                            call.started || call.metaData?.started
                        )}
                        {renderField("Language", call.language)}
                    </div>

                    {/* Participants */}
                    {call.parties?.length > 0 && (
                        <div>
                            <div className="text-gray-400 font-medium mb-1">
                                Participants ({call.parties.length})
                            </div>
                            <div className="space-y-1">
                                {call.parties.map((p, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded"
                                    >
                                        <span className="text-gray-300 font-medium">
                                            {p.name ||
                                                p.emailAddress ||
                                                "Unknown"}
                                        </span>
                                        {p.title && (
                                            <span className="text-gray-500">
                                                {p.title}
                                            </span>
                                        )}
                                        {p.affiliation && (
                                            <span className="text-emerald-500 text-[10px]">
                                                {p.affiliation}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Raw fallback for unexpected structures */}
                    {typeof call.description === "string" && (
                        <pre className="whitespace-pre-wrap text-gray-300 overflow-auto max-h-48 bg-gray-800/50 rounded p-2">
                            {call.description}
                        </pre>
                    )}
                </div>
            ) : (
                !loading &&
                !errorMsg && (
                    <div className="text-xs text-gray-600 italic">
                        Select a call from Gong Call Search to view details.
                    </div>
                )
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

function renderField(label, value) {
    if (!value) return null;
    return (
        <div>
            <span className="text-gray-500 font-medium">{label}: </span>
            <span className="text-gray-300">{String(value)}</span>
        </div>
    );
}

function formatDuration(seconds) {
    if (seconds == null) return null;
    const m = Math.round(seconds / 60);
    return `${m}m`;
}

export const GongCallDetail = ({ title = "Call Detail", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongCallDetailContent title={title} />
            </Panel>
        </Widget>
    );
};
