/**
 * GongCallDetail
 *
 * Call metadata and participants for a Gong call.
 * Listens for callSelected events to load call details via get_call.
 *
 * @package Gong
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    AlertBanner,
    Caption2,
    Skeleton,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongCallDetailContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const loadCall = useCallback(
        async (callId) => {
            if (!callId) return;
            if (!isConnected) {
                setErrorMsg(
                    "Gong provider not connected. Assign the Gong MCP provider to this widget."
                );
                return;
            }
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

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            if (payload.id) loadCall(payload.id);
        },
        [loadCall]
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

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        listenerStatus === "listening"
                            ? statusTokens.success.solidBg
                            : statusTokens.warning.solidBg
                    }`}
                />
                <Caption2>
                    {listenerStatus === "listening"
                        ? "Listening for callSelected"
                        : "No event listeners configured"}
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {loading && (
                <div className="space-y-2">
                    <Skeleton width="w-3/4" height="h-3" rounded="rounded" />
                    <Skeleton width="w-1/2" height="h-3" rounded="rounded" />
                    <Skeleton width="w-2/3" height="h-3" rounded="rounded" />
                </div>
            )}

            {call ? (
                <div className="space-y-3 text-xs">
                    {/* Markdown text response from gongio-mcp */}
                    {typeof call.description === "string" ? (
                        <pre
                            className={`whitespace-pre-wrap overflow-auto max-h-96 text-xs leading-relaxed ${bodyText}`}
                        >
                            {call.description}
                        </pre>
                    ) : (
                        <>
                            {(call.title || call.metaData?.title) && (
                                <SubHeading3
                                    title={call.title || call.metaData?.title}
                                />
                            )}

                            {/* Metadata fields */}
                            <div className="space-y-1.5">
                                {renderField(
                                    "URL",
                                    call.url || call.metaData?.url,
                                    bodyText
                                )}
                                {renderField(
                                    "Direction",
                                    call.direction,
                                    bodyText
                                )}
                                {renderField("Scope", call.scope, bodyText)}
                                {renderField("System", call.system, bodyText)}
                                {renderField(
                                    "Duration",
                                    formatDuration(
                                        call.duration ?? call.metaData?.duration
                                    ),
                                    bodyText
                                )}
                                {renderField(
                                    "Date",
                                    call.started || call.metaData?.started,
                                    bodyText
                                )}
                                {renderField(
                                    "Language",
                                    call.language,
                                    bodyText
                                )}
                            </div>

                            {/* Participants */}
                            {call.parties?.length > 0 && (
                                <div>
                                    <Caption2
                                        block
                                        className="font-medium mb-1"
                                    >
                                        Participants ({call.parties.length})
                                    </Caption2>
                                    <div className="space-y-1">
                                        {call.parties.map((p, i) => (
                                            <div
                                                key={i}
                                                className={`flex flex-wrap items-center gap-2 px-2 py-1 rounded ${
                                                    currentTheme?.[
                                                        "bg-primary-dark"
                                                    ] || ""
                                                }`}
                                            >
                                                <span
                                                    className={`font-medium ${bodyText}`}
                                                >
                                                    {p.name ||
                                                        p.emailAddress ||
                                                        "Unknown"}
                                                </span>
                                                {p.title && (
                                                    <Caption2>
                                                        {p.title}
                                                    </Caption2>
                                                )}
                                                {p.affiliation && (
                                                    <span
                                                        className={`text-xs ${
                                                            currentTheme?.[
                                                                "text-secondary-medium"
                                                            ] || ""
                                                        }`}
                                                    >
                                                        {p.affiliation}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                !loading &&
                !errorMsg && (
                    <Caption2 block className="italic">
                        {listenerStatus === "no listeners assigned"
                            ? "No event listeners configured. Wire callSelected from a Gong Call Search or Library Folders widget."
                            : "Select a call from Gong Call Search to view details."}
                    </Caption2>
                )
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

function renderField(label, value, valueClassName = "") {
    if (!value) return null;
    return (
        <div>
            <Caption2 className="font-medium">{label}: </Caption2>
            <span className={valueClassName}>{String(value)}</span>
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
