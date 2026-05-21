import React, { useState, useEffect, useRef } from "react";
import { Panel, SubHeading2, TextArea, Caption3 } from "@trops/dash-react";

export default function Notepad({
    title = "Notepad",
    placeholder = "Start typing…",
    api,
}) {
    const [text, setText] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [status, setStatus] = useState("idle"); // idle | saving | saved
    const saveTimer = useRef(null);

    // Load persisted text on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stored = await api?.readData?.("notepad-text");
                if (cancelled) return;
                if (typeof stored === "string") setText(stored);
            } catch {
                // Start empty if storage read fails.
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [api]);

    // Debounced auto-save whenever `text` changes after initial load.
    useEffect(() => {
        if (!loaded || !api?.storeData) return;
        setStatus("saving");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await api.storeData("notepad-text", text);
                setStatus("saved");
            } catch {
                setStatus("idle");
            }
        }, 500);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [text, loaded, api]);

    // dash-react inputs sometimes pass the raw value, sometimes a
    // synthetic event — handle both shapes defensively.
    const handleChange = (eOrValue) => {
        const v =
            typeof eOrValue === "string"
                ? eOrValue
                : eOrValue?.target?.value ?? "";
        setText(v);
    };

    const statusLabel =
        status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "";

    return (
        <Panel>
            <div className="flex items-center justify-between mb-2">
                <SubHeading2 title={title} />
                <Caption3 text={statusLabel} />
            </div>
            <TextArea
                value={text}
                onChange={handleChange}
                placeholder={placeholder}
                rows={12}
            />
        </Panel>
    );
}
