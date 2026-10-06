/**
 * NotepadWidget
 *
 * Widget data persistence with api.storeData() and api.readData().
 * Features auto-save, manual save/load/clear, and publishes a "noteSaved" event
 * on each save.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    Button3,
    Caption2,
    TextArea,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

function NotepadContent({ title, placeholder, autoSave, api, uuid }) {
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
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
        idle: currentTheme?.["bg-primary-medium"] || "",
        loading: `${statusTokens.info.solidBg} animate-pulse`,
        saving: `${statusTokens.warning.solidBg} animate-pulse`,
        saved: statusTokens.success.solidBg,
        error: statusTokens.error.solidBg,
    };

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} />
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${statusColors[status]}`}
                    />
                    <Caption2>{status}</Caption2>
                </div>
            </div>

            <TextArea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-h-24 w-full"
                inputClassName="flex-1 text-sm resize-none"
            />

            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                    <Button2 onClick={handleLoad} size="sm">
                        Load
                    </Button2>
                    <Button3 onClick={handleClear} size="sm">
                        Clear
                    </Button3>
                </div>
                {lastSaved && (
                    <Caption2>
                        Last saved: {new Date(lastSaved).toLocaleTimeString()}
                    </Caption2>
                )}
            </div>

            {autoSave !== "off" && (
                <Caption2 block>
                    Auto-save: {autoSave === "5s" ? "every 5s" : "every 30s"}
                </Caption2>
            )}
        </div>
    );
}

export const NotepadWidget = ({
    title = "Notepad",
    placeholder = "Type your notes here...",
    autoSave = "off",
    api,
    uuid,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <NotepadContent
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
