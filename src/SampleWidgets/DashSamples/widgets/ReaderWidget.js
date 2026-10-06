/**
 * ReaderWidget
 *
 * Receives "noteSaved" events from NotepadWidget and displays
 * all received notes in a scrollable log.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button3,
    SectionLabel,
    Caption2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function ReaderContent({ title }) {
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
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
                                ? statusTokens.success.solidBg
                                : statusTokens.warning.solidBg
                        }`}
                    />
                    <Caption2>{listenerStatus}</Caption2>
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
                    <Caption2 block className="italic">
                        No notes received yet. Save a note in NotepadWidget.
                    </Caption2>
                ) : (
                    notes.map((note, i) => (
                        <div
                            key={i}
                            className={`rounded-md px-3 py-2 border ${
                                currentTheme?.["bg-primary-dark"] || ""
                            } ${currentTheme?.["border-primary-dark"] || ""}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={`text-xs font-medium ${
                                        currentTheme?.[
                                            "text-secondary-medium"
                                        ] || ""
                                    }`}
                                >
                                    {new Date(
                                        note.savedAt
                                    ).toLocaleTimeString()}
                                </span>
                                <Caption2>{note.length} chars</Caption2>
                            </div>
                            <div
                                className={`text-sm whitespace-pre-wrap break-words ${
                                    currentTheme?.["text-primary-medium"] || ""
                                }`}
                            >
                                {note.content || (
                                    <Caption2 className="italic">
                                        (empty)
                                    </Caption2>
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
