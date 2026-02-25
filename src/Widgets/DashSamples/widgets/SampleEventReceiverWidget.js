/**
 * SampleEventReceiverWidget
 *
 * Demonstrates event listening via the DashboardPublisher pub/sub system.
 * Registers an "onEventReceived" handler that receives events published by
 * other widgets (e.g., SampleEventSenderWidget).
 *
 * Evolved from EventHandlerWidget.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function SampleEventReceiverContent({ title }) {
    const { listen, listeners } = useWidgetEvents();
    const [eventLog, setEventLog] = useState([]);
    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);

    handlerRef.current = useCallback((data) => {
        setEventLog((prev) => [
            {
                event: data.event,
                message: data.message,
                uuid: data.uuid,
                timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 49),
        ]);
    }, []);

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;

            if (hasListeners) {
                const handlers = {
                    onEventReceived: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
                setListenerStatus("listening");
            } else {
                setListenerStatus("no listeners assigned");
            }
        } else {
            setListenerStatus("not configured");
        }
    }, [listeners, listen]);

    const listenerSummary = [];
    if (listeners && typeof listeners === "object") {
        Object.entries(listeners).forEach(([handlerKey, events]) => {
            if (Array.isArray(events)) {
                events.forEach((eventName) => {
                    listenerSummary.push({ handler: handlerKey, eventName });
                });
            }
        });
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Listener Status */}
            <div className="text-xs">
                <div className="text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Listener Status
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            listenerStatus === "listening"
                                ? "bg-green-400"
                                : "bg-yellow-500"
                        }`}
                    />
                    <span className="text-gray-400">{listenerStatus}</span>
                </div>
                {listenerSummary.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                        {listenerSummary.map((sub, i) => (
                            <div
                                key={i}
                                className="text-xs font-mono text-indigo-400"
                            >
                                {sub.handler} &larr; {sub.eventName}
                            </div>
                        ))}
                    </div>
                )}
                {listenerSummary.length === 0 && (
                    <div className="mt-1 text-xs text-gray-600 italic">
                        No listeners assigned. Use the layout builder to wire
                        events from SampleEventSenderWidget.
                    </div>
                )}
            </div>

            {/* Received Events Log */}
            <div className="flex-1 min-h-0">
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Received Events ({eventLog.length})
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No events received yet. Publish an event from the
                            SampleEventSenderWidget.
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
                                <span className="text-indigo-400">
                                    {entry.event}
                                </span>{" "}
                                <span className="text-gray-400">
                                    {JSON.stringify(entry.message)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export const SampleEventReceiverWidget = ({
    title = "Event Receiver",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleEventReceiverContent title={title} />
            </Panel>
        </Widget>
    );
};
