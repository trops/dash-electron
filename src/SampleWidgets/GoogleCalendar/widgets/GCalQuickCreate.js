/**
 * GCalQuickCreate
 *
 * Quick-create form for Google Calendar events.
 * Uses the `create-event` tool to create new events.
 *
 * @package Google Calendar
 */
import { useState, useContext } from "react";
import {
    Button,
    Panel,
    SubHeading2,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
    InputText,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import { extractMcpText } from "../utils/mcpUtils";

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function defaultStartTime() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
}

function defaultEndTime() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 2);
    return now.toTimeString().slice(0, 5);
}

function GCalQuickCreateContent({ title }) {
    const {
        isConnected,
        isConnecting,
        error,
        tools,
        callTool,
        status,
        provider,
        connect,
        disconnect,
    } = useMcpProvider("google-calendar");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const [eventTitle, setEventTitle] = useState("");
    const [date, setDate] = useState(todayStr());
    const [startTime, setStartTime] = useState(defaultStartTime());
    const [endTime, setEndTime] = useState(defaultEndTime());
    const [location, setLocation] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [result, setResult] = useState(null);
    const [debugLog, setDebugLog] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!eventTitle.trim() || !date || !startTime || !endTime) return;

        setLoading(true);
        setErrorMsg(null);
        setResult(null);

        const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
        const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

        const args = {
            summary: eventTitle.trim(),
            start: startDateTime,
            end: endDateTime,
        };
        if (location.trim()) args.location = location.trim();

        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "create-event",
            args,
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("create-event", args);
            entry.response = res;
            entry.duration = Date.now() - start;

            if (res?.isError) {
                const errText = extractMcpText(res);
                throw new Error(
                    errText || "create-event tool returned an error"
                );
            }

            setResult("success");
            setEventTitle("");
            setLocation("");
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setErrorMsg(err.message);
            setResult("error");
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection Status */}
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

            {/* Create Form */}
            <form onSubmit={handleSubmit} className="space-y-2">
                <InputText
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Event title"
                    required
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <InputText
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <div className="flex flex-wrap gap-2">
                    <InputText
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Caption2 className="self-center">to</Caption2>
                    <InputText
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                </div>
                <InputText
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location (optional)"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <Button
                    type="submit"
                    size="sm"
                    block
                    disabled={loading || !isConnected || !eventTitle.trim()}
                >
                    {loading ? "Creating..." : "Create Event"}
                </Button>

                {result === "success" && (
                    <AlertBanner
                        variant="success"
                        size="compact"
                        message="Event created successfully"
                    />
                )}
                {result === "error" && !errorMsg && (
                    <AlertBanner
                        variant="error"
                        size="compact"
                        message="Failed to create event"
                    />
                )}
            </form>

            <McpReauthBanner
                error={errorMsg}
                provider={provider}
                catalogId="google-calendar"
                connect={connect}
                disconnect={disconnect}
                onReauthComplete={() => setErrorMsg(null)}
            />

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
            )}

            <McpDebugLog entries={debugLog} />
        </div>
    );
}

export const GCalQuickCreate = ({ title = "Quick Create", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GCalQuickCreateContent title={title} />
            </Panel>
        </Widget>
    );
};
