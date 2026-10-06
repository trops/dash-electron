/**
 * EventSenderWidget
 *
 * Event publishing via the DashboardPublisher pub/sub system.
 * Publishes "buttonClicked" and "messageSent" events that can be subscribed
 * to by other widgets (e.g., EventReceiverWidget).
 *
 * @package DashSamples
 */
import { useState, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    SectionLabel,
    Caption2,
    InputText,
    ThemeContext,
} from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function EventSenderContent({ title }) {
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
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
                <Button onClick={handleButtonClick}>Click Me</Button>
                <Caption2 className="text-sm">Clicks: {clickCount}</Caption2>
            </div>

            {/* Message Publisher */}
            <div className="flex flex-wrap items-center gap-2">
                <InputText
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 min-w-0"
                    inputClassName="text-sm"
                />
                <Button onClick={handleSendMessage} disabled={!message.trim()}>
                    Send
                </Button>
            </div>

            {/* Event Log */}
            <div className="flex-1 min-h-0">
                <SectionLabel className="mb-1">Published Events</SectionLabel>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <Caption2 block className="italic">
                            No events published yet. Click the button or send a
                            message.
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
                                    {entry.eventName}
                                </span>{" "}
                                <span
                                    className={
                                        currentTheme?.["text-primary-medium"] ||
                                        ""
                                    }
                                >
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

export const EventSenderWidget = ({ title = "Event Sender", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <EventSenderContent title={title} />
            </Panel>
        </Widget>
    );
};
