/**
 * GongWidget
 *
 * Browse Gong call transcripts and AI-generated summaries via gongio-mcp.
 * Requires a Gong MCP provider to be configured.
 *
 * @package Gong
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Button3,
    Caption2,
    InputText,
    Panel,
    StatusBadge,
    SubHeading2,
    SubHeading3,
    ThemeContext,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { CallList } from "./components/CallList";
import { CallSummary } from "./components/CallSummary";
import { CallTranscript } from "./components/CallTranscript";
import { parseMcpResponse, parseGongTextEntries } from "../utils/mcpUtils";

/**
 * RawResponsePanel — shows the raw MCP response so the user always sees
 * *something*, even when structured parsing fails.
 */
function RawResponsePanel({ raw, label }) {
    const [expanded, setExpanded] = useState(false);
    const { currentTheme } = useContext(ThemeContext);
    if (!raw) return null;
    return (
        <div className="mt-2">
            <button
                onClick={() => setExpanded((p) => !p)}
                className="underline opacity-70 hover:opacity-100"
            >
                <Caption2>
                    {expanded ? "Hide" : "Show"} raw response
                    {label ? ` (${label})` : ""}
                </Caption2>
            </button>
            {expanded && (
                <pre
                    className={`mt-1 p-2 border rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap ${
                        currentTheme?.["bg-primary-dark"] || ""
                    } ${currentTheme?.["border-primary-dark"] || ""} ${
                        currentTheme?.["text-primary-medium"] || ""
                    }`}
                >
                    {typeof raw === "string"
                        ? raw
                        : JSON.stringify(raw, null, 2)}
                </pre>
            )}
        </div>
    );
}

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
    const [rawResponse, setRawResponse] = useState(null);

    const handleLoadCalls = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        setRawResponse(null);
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
            const {
                data,
                error: mcpError,
                raw,
            } = parseMcpResponse(res, {
                arrayKeys: ["calls", "records"],
                textParser: parseGongTextEntries,
            });

            // Always store the raw response for debug display
            setRawResponse(raw);

            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }

            // If data is an array, use it directly
            if (Array.isArray(data)) {
                setCalls(data);
                return;
            }

            // If data is an object but not an array, display it as a single
            // "call" entry so the user sees *something* and can click into it
            if (data && typeof data === "object") {
                setCalls([data]);
                return;
            }

            // If data is a non-empty string, show as a single text entry
            if (typeof data === "string" && data.trim()) {
                setCalls([{ title: data.slice(0, 120), _raw: data }]);
                return;
            }

            setCalls([]);
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
                <StatusBadge
                    compact
                    state={
                        isConnected
                            ? "success"
                            : isConnecting
                            ? "pending"
                            : error
                            ? "error"
                            : "neutral"
                    }
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {view === "list" && (
                <>
                    {/* Filters */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <InputText
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleLoadCalls()
                                }
                                placeholder="Search calls..."
                                height="h-7"
                                padding="px-2 py-1"
                                className="flex-1 min-w-0"
                                inputClassName="text-xs"
                            />
                            <Button
                                size="sm"
                                onClick={handleLoadCalls}
                                disabled={!isConnected || loading}
                            >
                                {loading ? "Loading..." : "Load Calls"}
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <InputText
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
                                height="h-7"
                                padding="px-2 py-1"
                                className="flex-1 min-w-0"
                                inputClassName="text-xs"
                            />
                            <InputText
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
                                height="h-7"
                                padding="px-2 py-1"
                                className="flex-1 min-w-0"
                                inputClassName="text-xs"
                            />
                        </div>
                    </div>

                    {/* Call List */}
                    <CallList calls={calls} onSelectCall={handleSelectCall} />

                    {/* Raw response debug — always available when there's data */}
                    <RawResponsePanel raw={rawResponse} label="list_calls" />
                </>
            )}

            {view === "detail" && selectedCall && (
                <>
                    <Button3
                        size="sm"
                        onClick={handleBack}
                        className="self-start"
                    >
                        Back to Calls
                    </Button3>

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
                        <Caption2 block className="font-medium">
                            Summary
                        </Caption2>
                        <CallSummary
                            summary={summary}
                            loading={detailLoading.summary}
                        />
                    </div>

                    {/* Transcript */}
                    <div className="space-y-1">
                        <Caption2 block className="font-medium">
                            Transcript
                        </Caption2>
                        <CallTranscript
                            transcript={transcript}
                            loading={detailLoading.transcript}
                            onLoadMore={handleLoadMoreTranscript}
                        />
                    </div>
                </>
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
