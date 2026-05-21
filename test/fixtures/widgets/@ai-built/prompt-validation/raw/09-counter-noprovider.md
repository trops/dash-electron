<!-- scenario: 09-counter-noprovider -->
<!-- userPrompt: A counter with + and - buttons and a reset. No data source. -->
<!-- exitCode: 0 -->
<!-- durationMs: 26926 -->

A clean self-contained counter — no provider, just local state. Increment, decrement, and reset buttons follow the Button/Button2/Button3 hierarchy (primary/secondary/dismissive), and the big number uses `Heading2` per the stat-widget convention.

**File: Counter.js**

```jsx
import React, { useState } from "react";
import {
    Panel,
    SubHeading2,
    Heading2,
    Button,
    Button2,
    Button3,
    Caption,
} from "@trops/dash-react";

export default function Counter({
    title = "Counter",
    initialValue = 0,
    step = 1,
}) {
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
    const safeInitial = Number.isFinite(initialValue) ? initialValue : 0;

    const [count, setCount] = useState(safeInitial);

    const increment = () => setCount((c) => c + safeStep);
    const decrement = () => setCount((c) => c - safeStep);
    const reset = () => setCount(safeInitial);

    return (
        <Panel>
            <div className="flex flex-col items-center justify-center gap-6 p-4">
                <SubHeading2 title={title} />

                <Heading2 title={String(count)} />

                <Caption text={`Step: ${safeStep}`} />

                <div className="flex flex-row items-center gap-3">
                    <Button2 title="−" onClick={decrement} size="sm" />
                    <Button title="+" onClick={increment} size="sm" />
                </div>

                <Button3 title="Reset" onClick={reset} size="sm" />
            </div>
        </Panel>
    );
}
```

**File: Counter.dash.js**

```javascript
import Counter from "./Counter";

export default {
    component: Counter,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Counter",
            displayName: "Title",
            instructions: "The label shown above the counter",
            required: false,
        },
        initialValue: {
            type: "number",
            defaultValue: 0,
            displayName: "Initial Value",
            instructions:
                "The starting value (also the value Reset returns to)",
            required: false,
        },
        step: {
            type: "number",
            defaultValue: 1,
            displayName: "Step Size",
            instructions: "How much each + / − click adjusts the counter",
            required: false,
        },
    },
};
```

**Notes:**

-   No `providers` array — fully self-contained, no external services or IPC.
-   All color comes from dash-react primitives (`Button` / `Button2` / `Button3` / `Heading2` / `SubHeading2` / `Caption` / `Panel`) so it tracks the user's theme.
-   Only theme-neutral utilities used in the wrapper div (`flex`, `gap-*`, `p-4`) — no Tailwind color classes.
-   `initialValue` and `step` are read defensively in case the user clears the field in Configure.
-   State is in-memory only; closing/reopening the widget resets to `initialValue`. If you want it to survive reloads, say the word and I'll wire it to `api.storeData` / `api.readData`.
