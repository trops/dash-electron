/**
 * GCalQuickCreate
 *
 * Quick-create form for Google Calendar events.
 * Uses the `create-event` tool to create new events.
 *
 * @package Google Calendar
 */
import { useState } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { McpDebugLog } from "../../Google/components/McpDebugLog";
import { McpReauthBanner } from "../../Google/components/McpReauthBanner";

function extractMcpText(res) {
    if (typeof res === "string") return res;
    if (res?.content && Array.isArray(res.content)) {
        return res.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
    }
    return JSON.stringify(res, null, 2);
}

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

            {/* Create Form */}
            <form onSubmit={handleSubmit} className="space-y-2">
                <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Event title"
                    required
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-gray-500 text-xs self-center">
                        to
                    </span>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location (optional)"
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={loading || !isConnected || !eventTitle.trim()}
                    className="w-full px-3 py-1.5 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Creating..." : "Create Event"}
                </button>

                {result === "success" && (
                    <div className="p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs">
                        Event created successfully
                    </div>
                )}
                {result === "error" && !errorMsg && (
                    <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                        Failed to create event
                    </div>
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
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
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
