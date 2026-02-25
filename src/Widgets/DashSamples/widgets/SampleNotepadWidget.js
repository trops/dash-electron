/**
 * SampleNotepadWidget
 *
 * Demonstrates widget data persistence with api.storeData() and api.readData().
 * Features auto-save, manual save/load/clear, and publishes a "noteSaved" event
 * on each save.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function SampleNotepadContent({ title, placeholder, autoSave, api, uuid }) {
    const { publishEvent } = useWidgetEvents();
    const [content, setContent] = useState("");
    const [status, setStatus] = useState("idle");
    const [lastSaved, setLastSaved] = useState(null);
    const autoSaveTimer = useRef(null);

    // Load data on mount
    useEffect(() => {
        if (!api || !uuid) return;
        setStatus("loading");
        api.readData({
            uuid,
            callbackComplete: (data) => {
                if (data?.content !== undefined) {
                    setContent(data.content);
                    setLastSaved(data.savedAt || null);
                }
                setStatus("idle");
            },
            callbackError: () => {
                setStatus("idle");
            },
        });
    }, [api, uuid]);

    const save = useCallback(() => {
        if (!api || !uuid) return;
        const savedAt = new Date().toISOString();
        setStatus("saving");
        api.storeData({
            data: { content, savedAt },
            uuid,
            append: false,
            callbackComplete: () => {
                setLastSaved(savedAt);
                setStatus("saved");
                if (publishEvent) {
                    publishEvent("noteSaved", {
                        content,
                        savedAt,
                        length: content.length,
                    });
                }
                setTimeout(() => setStatus("idle"), 1500);
            },
            callbackError: () => {
                setStatus("error");
                setTimeout(() => setStatus("idle"), 2000);
            },
        });
    }, [api, uuid, content, publishEvent]);

    // Auto-save
    useEffect(() => {
        if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
        if (autoSave === "off" || !api || !uuid) return;
        const ms = autoSave === "5s" ? 5000 : 30000;
        autoSaveTimer.current = setInterval(() => {
            save();
        }, ms);
        return () => clearInterval(autoSaveTimer.current);
    }, [autoSave, save, api, uuid]);

    const handleLoad = () => {
        if (!api || !uuid) return;
        setStatus("loading");
        api.readData({
            uuid,
            callbackComplete: (data) => {
                if (data?.content !== undefined) {
                    setContent(data.content);
                    setLastSaved(data.savedAt || null);
                }
                setStatus("idle");
            },
            callbackError: () => {
                setStatus("error");
                setTimeout(() => setStatus("idle"), 2000);
            },
        });
    };

    const handleClear = () => {
        setContent("");
        setStatus("idle");
    };

    const statusColors = {
        idle: "bg-gray-500",
        loading: "bg-blue-400 animate-pulse",
        saving: "bg-yellow-400 animate-pulse",
        saved: "bg-green-400",
        error: "bg-red-400",
    };

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} />
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${statusColors[status]}`}
                    />
                    <span className="text-xs text-gray-400">{status}</span>
                </div>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-h-[100px] w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={save}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-medium transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={handleLoad}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-xs font-medium transition-colors"
                    >
                        Load
                    </button>
                    <button
                        onClick={handleClear}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-xs font-medium transition-colors"
                    >
                        Clear
                    </button>
                </div>
                {lastSaved && (
                    <span className="text-xs text-gray-500">
                        Last saved: {new Date(lastSaved).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {autoSave !== "off" && (
                <div className="text-xs text-gray-600">
                    Auto-save: {autoSave === "5s" ? "every 5s" : "every 30s"}
                </div>
            )}
        </div>
    );
}

export const SampleNotepadWidget = ({
    title = "Sample Notepad",
    placeholder = "Type your notes here...",
    autoSave = "off",
    api,
    uuid,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleNotepadContent
                    title={title}
                    placeholder={placeholder}
                    autoSave={autoSave}
                    api={api}
                    uuid={uuid}
                />
            </Panel>
        </Widget>
    );
};
