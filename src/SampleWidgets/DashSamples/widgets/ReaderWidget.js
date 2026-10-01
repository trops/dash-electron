/**
 * ReaderWidget
 *
 * Receives "noteSaved" events from NotepadWidget and displays
 * all received notes in a scrollable log.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, Button3, SectionLabel } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function ReaderContent({ title }) {
    const { listen, listeners } = useWidgetEvents();
    const [notes, setNotes] = useState([]);
    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);

    handlerRef.current = useCallback((data) => {
        const payload = data.message || {};
        setNotes((prev) => [
            {
                content: payload.content || "",
                savedAt: payload.savedAt || new Date().toISOString(),
                length: payload.length || 0,
                receivedAt: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 99),
        ]);
    }, []);

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;

            if (hasListeners) {
                const handlers = {
                    onNoteSaved: (data) => handlerRef.current(data),
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

    const handleClear = () => {
        setNotes([]);
    };

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} />
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            listenerStatus === "listening"
                                ? "bg-green-400"
                                : "bg-yellow-500"
                        }`}
                    />
                    <span className="text-xs text-gray-400">
                        {listenerStatus}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs">
                <SectionLabel as="span">Notes ({notes.length})</SectionLabel>
                {notes.length > 0 && (
                    <Button3 onClick={handleClear} size="sm">
                        Clear
                    </Button3>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {notes.length === 0 ? (
                    <div className="text-xs text-gray-600 italic">
                        No notes received yet. Save a note in NotepadWidget.
                    </div>
                ) : (
                    notes.map((note, i) => (
                        <div
                            key={i}
                            className="bg-gray-800/50 rounded-md px-3 py-2 border border-gray-700/50"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-teal-400 font-medium">
                                    {new Date(
                                        note.savedAt
                                    ).toLocaleTimeString()}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {note.length} chars
                                </span>
                            </div>
                            <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                                {note.content || (
                                    <span className="text-gray-600 italic">
                                        (empty)
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export const ReaderWidget = ({ title = "Note Reader", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <ReaderContent title={title} />
            </Panel>
        </Widget>
    );
};
