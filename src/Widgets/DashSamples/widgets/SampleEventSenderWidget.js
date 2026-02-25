/**
 * SampleEventSenderWidget
 *
 * Demonstrates event publishing via the DashboardPublisher pub/sub system.
 * Publishes "buttonClicked" and "messageSent" events that can be subscribed
 * to by other widgets (e.g., SampleEventReceiverWidget).
 *
 * Evolved from EventPublisherWidget.
 *
 * @package DashSamples
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function SampleEventSenderContent({ title }) {
    const { publishEvent } = useWidgetEvents();
    const [clickCount, setClickCount] = useState(0);
    const [message, setMessage] = useState("");
    const [eventLog, setEventLog] = useState([]);

    const addToLog = useCallback((eventName, payload) => {
        setEventLog((prev) => [
            { eventName, payload, timestamp: new Date().toLocaleTimeString() },
            ...prev.slice(0, 49),
        ]);
    }, []);

    const handleButtonClick = useCallback(() => {
        const newCount = clickCount + 1;
        setClickCount(newCount);
        const payload = {
            clickCount: newCount,
            timestamp: Date.now(),
        };
        if (publishEvent) {
            publishEvent("buttonClicked", payload);
        }
        addToLog("buttonClicked", payload);
    }, [clickCount, publishEvent, addToLog]);

    const handleSendMessage = useCallback(() => {
        if (!message.trim()) return;
        const payload = {
            text: message.trim(),
            timestamp: Date.now(),
        };
        if (publishEvent) {
            publishEvent("messageSent", payload);
        }
        addToLog("messageSent", payload);
        setMessage("");
    }, [message, publishEvent, addToLog]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") {
                handleSendMessage();
            }
        },
        [handleSendMessage]
    );

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Button Click Publisher */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleButtonClick}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
                >
                    Click Me
                </button>
                <span className="text-sm text-gray-400">
                    Clicks: {clickCount}
                </span>
            </div>

            {/* Message Publisher */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors"
                >
                    Send
                </button>
            </div>

            {/* Event Log */}
            <div className="flex-1 min-h-0">
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Published Events
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No events published yet. Click the button or send a
                            message.
                        </div>
                    ) : (
                        eventLog.map((entry, i) => (
                            <div
                                key={i}
                                className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1"
                            >
                                <span className="text-gray-500">
                                    {entry.timestamp}
                                </span>{" "}
                                <span className="text-emerald-400">
                                    {entry.eventName}
                                </span>{" "}
                                <span className="text-gray-400">
                                    {JSON.stringify(entry.payload)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export const SampleEventSenderWidget = ({
    title = "Event Sender",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleEventSenderContent title={title} />
            </Panel>
        </Widget>
    );
};
