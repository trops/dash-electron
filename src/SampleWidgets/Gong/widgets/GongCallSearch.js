/**
 * GongCallSearch
 *
 * Search and browse Gong calls. Publishes callSelected when a call is clicked.
 *
 * @package Gong
 */
import { useState, useCallback, useContext } from "react";
import {
    Button,
    Panel,
    SubHeading2,
    AlertBanner,
    Caption2,
    InputText,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { CallList } from "./components/CallList";
import { parseMcpResponse, parseGongTextEntries } from "../utils/mcpUtils";

function GongCallSearchContent({ title, defaultDaysBack }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("gong");
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

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

            {/* Search & Filters */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleLoadCalls()
                        }
                        placeholder="Search calls..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
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
                        onChange={(value) =>
                            setFromDate(
                                value ? new Date(value).toISOString() : ""
                            )
                        }
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <InputText
                        type="date"
                        value={toDate ? toDate.slice(0, 10) : ""}
                        onChange={(value) =>
                            setToDate(
                                value ? new Date(value).toISOString() : ""
                            )
                        }
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                </div>
            </div>

            <CallList
                calls={calls}
                onSelectCall={handleSelectCall}
                selectedId={selectedCallId}
            />

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
