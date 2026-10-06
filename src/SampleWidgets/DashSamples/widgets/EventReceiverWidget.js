/**
 * EventReceiverWidget
 *
 * Event listening via the DashboardPublisher pub/sub system.
 * Registers an "onEventReceived" handler that receives events published by
 * other widgets (e.g., EventSenderWidget).
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SectionLabel,
    Caption2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function EventReceiverContent({ title }) {
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
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
                <SectionLabel className="mb-1">Listener Status</SectionLabel>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            listenerStatus === "listening"
                                ? statusTokens.success.solidBg
                                : statusTokens.warning.solidBg
                        }`}
                    />
                    <Caption2>{listenerStatus}</Caption2>
                </div>
                {listenerSummary.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                        {listenerSummary.map((sub, i) => (
                            <div
                                key={i}
                                className={`text-xs font-mono ${
                                    currentTheme?.["text-secondary-medium"] ||
                                    ""
                                }`}
                            >
                                {sub.handler} &larr; {sub.eventName}
                            </div>
                        ))}
                    </div>
                )}
                {listenerSummary.length === 0 && (
                    <Caption2 block className="mt-1 italic">
                        No listeners assigned. Use the layout builder to wire
                        events from EventSenderWidget.
                    </Caption2>
                )}
            </div>

            {/* Received Events Log */}
            <div className="flex-1 min-h-0">
                <SectionLabel className="mb-1">
                    Received Events ({eventLog.length})
                </SectionLabel>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <Caption2 block className="italic">
                            No events received yet. Publish an event from the
                            EventSenderWidget.
                        </Caption2>
                    ) : (
                        eventLog.map((entry, i) => (
                            <div
                                key={i}
                                className={`text-xs font-mono rounded px-2 py-1 ${
                                    currentTheme?.["bg-primary-dark"] || ""
                                }`}
                            >
                                <Caption2 className="font-mono">
                                    {entry.timestamp}
                                </Caption2>{" "}
                                <span
                                    className={
                                        currentTheme?.[
                                            "text-secondary-medium"
                                        ] || ""
                                    }
                                >
                                    {entry.event}
                                </span>{" "}
                                <span
                                    className={
                                        currentTheme?.["text-primary-medium"] ||
                                        ""
                                    }
                                >
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

export const EventReceiverWidget = ({ title = "Event Receiver", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <EventReceiverContent title={title} />
            </Panel>
        </Widget>
    );
};
