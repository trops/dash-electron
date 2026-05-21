<!-- scenario: 10-notepad-noprovider -->
<!-- userPrompt: A notepad — text area that auto-saves to userPrefs. -->
<!-- exitCode: 0 -->
<!-- durationMs: 49340 -->

I'll build a self-contained notepad widget. Here's the design:

-   **Storage:** Uses the per-widget `api.storeData` / `api.readData` so the note persists across reloads (no provider needed).
-   **Auto-save:** 500 ms debounce after the last keystroke; shows a live "Saving…/Saved" indicator.
-   **All-primitive UI:** `Panel` + `SubHeading2` + `TextArea` + `Caption3`. No raw color classes.

### `Notepad.js`

```jsx
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
```

### `Notepad.dash.js`

```javascript
import Notepad from "./Notepad";

export default {
    component: Notepad,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Notepad",
            displayName: "Title",
            instructions: "Title shown above the note area.",
            required: false,
        },
        placeholder: {
            type: "text",
            defaultValue: "Start typing…",
            displayName: "Placeholder",
            instructions: "Placeholder text shown when the note is empty.",
            required: false,
        },
    },
};
```

**Notes:**

-   No `providers` array — fully self-contained.
-   Persistence uses the widget's own storage namespace via `api.storeData("notepad-text", …)`, so each placed instance of the widget has its own independent note.
-   The first render after mount waits for the load to complete before the auto-save effect kicks in, so we never accidentally overwrite stored text with the empty initial state.

Click **Install** below to register the widget; it'll appear in the picker right away.
