# Widget Development

## Table of Contents

1. Widget Anatomy
2. The `.dash.js` Configuration File
3. Widget Grouping with the `workspace` Key
4. Widget Components and dash-react
5. The Widget API (`api` prop)
6. Widget Communication (Pub/Sub)
7. Provider Integration
8. Context / Dependency Injection
9. Sharing State Between Widgets
10. Component Import Rules
11. Debugging & Testing
12. Existing Widget Examples

---

## 1. Widget Anatomy

The **widget file is the only required component**. There are no workspace wrapper
components — widgets connect to MCP providers directly through the app-level provider
system.

When you run `widgetize`, it generates:

```
src/Widgets/MyWidget/
├── contexts/
│   ├── MyWidgetContext.js     # ← React context for intra-widget state
│   └── index.js               # Context exports
├── widgets/
│   ├── MyWidget.js            # ← THE CORE FILE — your React component
│   └── MyWidget.dash.js       # ← Configuration — metadata + userConfig
└── index.js                    # Barrel exports
```

For most widgets, you work on these files:

-   **MyWidget.js** — The React component. This is where you build the UI, call
    `useMcpProvider`, and present data with dash-react components.
-   **MyWidget.dash.js** — Metadata: what component to render, which `workspace` group
    it belongs to, provider requirements, and user-configurable options.
-   **MyWidgetContext.js** — A React context for sharing state between the widget
    component and its own sub-components (e.g., an API client, custom hooks, or
    local state). See Section 8 for usage patterns.

**Multi-widget groups**: If you need multiple widgets that coordinate (e.g., a
channel list + message viewer), run `widgetize` once for the first widget, then
manually create additional widget files in the same `widgets/` directory. Give them
the same `workspace` key in their `.dash.js` files to group them together. They
share the same provider connection automatically — no wrapper component needed.

---

## 2. The `.dash.js` Configuration File

This is how the Dash framework knows about your widget:

```javascript
// MyWidget.dash.js
import { MyWidget } from "./MyWidget";

export default {
    component: MyWidget,
    canHaveChildren: false,
    workspace: "my-widget-workspace",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "My Widget",
            displayName: "Title",
            instructions: "The title shown at the top of the widget",
            required: true,
        },
        subtitle: {
            type: "text",
            defaultValue: "",
            displayName: "Subtitle",
            required: false,
        },
    },
};
```

### userConfig Field Types

| Type         | Description     | Extra Properties              |
| ------------ | --------------- | ----------------------------- |
| `"text"`     | Text input      | —                             |
| `"number"`   | Numeric input   | `min`, `max`                  |
| `"boolean"`  | Toggle switch   | —                             |
| `"select"`   | Dropdown select | `options: [{ label, value }]` |
| `"color"`    | Color picker    | —                             |
| `"password"` | Masked input    | —                             |

### Field Properties

| Property       | Type    | Required | Description                 |
| -------------- | ------- | -------- | --------------------------- |
| `type`         | string  | Yes      | Field type (see above)      |
| `defaultValue` | any     | No       | Default value               |
| `displayName`  | string  | No       | Label shown in config UI    |
| `instructions` | string  | No       | Help text shown below field |
| `required`     | boolean | No       | Whether field is required   |

Values from `userConfig` are passed as props to the widget component — so if you
define `title` in userConfig, it arrives as `props.title` in the widget.

**The `workspace` key**: A string that groups related widgets together in the
dashboard. Multiple widgets with the same `workspace` value (e.g., `"slack"`) are
treated as part of the same integration. This is purely a grouping mechanism — it
does not create a wrapper component or React context.

**The `canHaveChildren` key**: Set to `false` for widgets. Only set to `true` for
layout containers that wrap other components.

---

## 3. Widget Grouping with the `workspace` Key

The `workspace` key in `.dash.js` groups related widgets together in the dashboard.
This is a metadata string, not a component — there is no workspace wrapper component.

### How grouping works

All widgets with the same `workspace` value are treated as part of the same integration:

```javascript
// SlackChannels.dash.js
export default {
    component: SlackChannels,
    workspace: "slack",           // ← Same group
    type: "widget",
    // ...
};

// SlackMessages.dash.js
export default {
    component: SlackMessages,
    workspace: "slack",           // ← Same group
    type: "widget",
    // ...
};
```

These two widgets will be grouped together in the dashboard UI. They share the same
MCP provider connection automatically (both call `useMcpProvider("slack")`), and they
can communicate via pub/sub events (see Section 6).

### What the workspace key does NOT do

-   Does not create a React context or wrapper component
-   Does not establish MCP connections (that's the app-level provider system)
-   Does not share state between widgets (use pub/sub events or `api.storeData` for that)

---

## 4. Widget Components and dash-react

### Widget Component Structure

```javascript
// MyWidget.js
import React, { useState, useEffect, useContext } from "react";
import { Widget, Panel, Heading, SubHeading } from "@trops/dash-react";
import { ThemeContext } from "@trops/dash-react";

export const MyWidget = ({
    // User config props (from .dash.js userConfig)
    title = "My Widget",
    subtitle = "",
    // Injected props
    api,
    ...props
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const [data, setData] = useState(null);

    // Load saved data on mount
    useEffect(() => {
        api.readData({
            callbackComplete: (savedData) => setData(savedData),
            callbackError: (err) => console.error("Load failed:", err),
        });
    }, []);

    const handleSave = () => {
        api.storeData({ timestamp: Date.now(), title });
    };

    return (
        <Widget {...props}>
            <Panel>
                <Heading text={title} />
                {subtitle && <SubHeading text={subtitle} />}
                <button onClick={handleSave}>Save</button>
            </Panel>
        </Widget>
    );
};
```

**Always wrap your widget content in `<Widget {...props}>`** — this provides the
standard widget chrome (drag handle, resize, etc.) and passes through framework props.

### dash-react Component Reference

Import all UI components from `@trops/dash-react`:

```javascript
import {
    Widget,
    Panel,
    DashPanel,
    Heading,
    SubHeading,
    Button,
    ButtonIcon,
    InputText,
    Menu,
    MenuItem,
    Toggle,
    Modal,
    Notification,
    SlidePanelOverlay,
    Tag,
    CodeEditor,
    CodeRenderer,
    Container,
    LayoutContainer,
    Header,
    SubHeader,
    Footer,
    MainLayout,
    MainSection,
    MainContent,
    ErrorBoundary,
    ErrorMessage,
    Text,
    Draggable,
} from "@trops/dash-react";
```

### Common Layout Patterns

**Simple data display:**

```javascript
<Widget {...props}>
    <Panel>
        <Heading text={title} />
        <SubHeading text={subtitle} />
        <Text>Some content here</Text>
    </Panel>
</Widget>
```

**List with actions:**

```javascript
<Widget {...props}>
    <Panel>
        <Heading text="Items" />
        <Menu>
            {items.map((item) => (
                <MenuItem key={item.id} onClick={() => handleSelect(item)}>
                    {item.name}
                </MenuItem>
            ))}
        </Menu>
    </Panel>
</Widget>
```

**Search interface:**

```javascript
<Widget {...props}>
    <Panel>
        <Heading text="Search" />
        <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
        />
        {results.map((result) => (
            <DashPanel key={result.id}>
                <Heading text={result.title} />
                <Text>{result.description}</Text>
            </DashPanel>
        ))}
    </Panel>
</Widget>
```

**Detail view with actions:**

```javascript
<Widget {...props}>
    <Panel>
        <Header>
            <Heading text={item.title} />
            <ButtonIcon icon="edit" onClick={handleEdit} />
        </Header>
        <MainContent>
            <Text>{item.body}</Text>
        </MainContent>
        <Footer>
            <Button onClick={handleSave}>Save</Button>
            <Button onClick={handleDelete}>Delete</Button>
        </Footer>
    </Panel>
</Widget>
```

---

## 5. The Widget API (`api` prop)

Every widget receives an `api` prop from the framework. This provides:

### Data Persistence

```javascript
// Save data (auto-persisted to Electron storage)
api.storeData({ key: "value", items: [1, 2, 3] });

// Load data
api.readData({
    callbackComplete: (data) => console.log("Loaded:", data),
    callbackError: (err) => console.error("Error:", err),
});
```

### Event Publishing (see Section 6)

```javascript
api.publishEvent("search-completed", { query: "test", results: 42 });
```

### Event Listening (see Section 6)

```javascript
api.registerListeners(["search-completed", "item-selected"], {
    "search-completed": (payload) => {
        console.log("Search:", payload.query);
    },
    "item-selected": (payload) => {
        console.log("Selected:", payload.id);
    },
});
```

---

## 6. Widget Communication (Pub/Sub)

Widgets communicate through a publish/subscribe event system. This is useful when
multiple widgets need to coordinate — e.g., a channel list widget publishes a
selection that a messages widget listens to.

**Publishing:**

```javascript
// In SlackChannels widget
const handleSelect = (channel) => {
    api.publishEvent("slack-channel-selected", {
        channelId: channel.id,
        channelName: channel.name,
    });
};
```

**Listening:**

```javascript
// In SlackMessages widget
useEffect(() => {
    api.registerListeners(["slack-channel-selected"], {
        "slack-channel-selected": (payload) => {
            setChannelId(payload.channelId);
            setChannelName(payload.channelName);
        },
    });
}, []);
```

**Event naming convention**: Use kebab-case, scoped to your widget namespace:
`"algolia-search-results"`, `"slack-channel-selected"`, `"drive-file-opened"`.

---

## 7. Provider Integration

Widgets can declare provider requirements directly in their `.dash.js` configuration.
This tells the framework what external service credentials the widget needs.

### Declaring Provider Requirements in `.dash.js`

```javascript
// SlackWidget.dash.js
export default {
    component: SlackWidget,
    canHaveChildren: false,
    workspace: "slack",
    type: "widget",
    userConfig: {
        /* ... */
    },
    providers: [
        {
            type: "slack",
            providerClass: "credential",
            required: true,
            credentialSchema: {
                token: {
                    type: "password",
                    required: true,
                    displayName: "Bot Token",
                },
            },
        },
    ],
};
```

### Accessing Provider Credentials in the Widget

Use the `useWidgetProviders` hook from `@trops/dash-core`:

```javascript
import { useWidgetProviders } from "@trops/dash-core";

export const SlackWidget = (props) => {
    const { providers } = useWidgetProviders();
    const slackToken = providers?.slack?.credentials?.token;
    // Use token to call APIs directly, or use useMcpProvider for MCP
};
```

### Provider vs MCP

There are two ways widgets talk to external services:

-   **`useMcpProvider`** — For MCP-based services. The widget calls MCP tools and never
    sees raw credentials. This is the preferred approach for most integrations.
-   **`useWidgetProviders`** — For direct credential access. The widget gets the raw
    token/key and makes API calls itself. Use this when no MCP server exists for the
    service, or when you need direct API access.

Both approaches use the same app-level provider system — credentials are configured
once in the Electron app's Settings → Providers.

**Important**: Read providers from `AppContext.providers`, NOT `DashboardContext.providers`.
This is due to component tree ordering — DashboardWrapper renders before providers load.

For full provider architecture details, see:

-   [WIDGET_PROVIDER_CONFIGURATION.md](https://github.com/trops/dash-core/blob/master/docs/WIDGET_PROVIDER_CONFIGURATION.md)
-   [PROVIDER_ARCHITECTURE.md](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)

---

## 8. Context / Dependency Injection

The `widgetize` scaffold generates a `contexts/` folder with a default context.
This is for **intra-widget** state — sharing data between the widget component and
its own sub-components (custom hooks, API clients, local state).

### The generated context

```javascript
// contexts/MyWidgetContext.js (generated by widgetize)
import { createContext } from "react";

export const MyWidgetContext = createContext({
    // Add your API client, shared state, or custom hooks here
    // All sub-components of the widget can access this context
});
```

### Using the context in a widget

```javascript
// MyWidget.js — provide context to sub-components
import { MyWidgetContext } from "../contexts/MyWidgetContext";
import { useMyApi } from "./hooks/useMyApi";

export const MyWidget = (props) => {
    const myApi = useMyApi();
    return (
        <MyWidgetContext.Provider value={{ myApi }}>
            <MyWidgetContent />
        </MyWidgetContext.Provider>
    );
};

// A sub-component — consume context
import { useContext } from "react";
import { MyWidgetContext } from "../contexts/MyWidgetContext";

const MyWidgetContent = () => {
    const { myApi } = useContext(MyWidgetContext);
    return <div>{/* Use myApi */}</div>;
};
```

### When to use context

-   Sharing an API client or custom hook across multiple sub-components within a widget
-   Local widget state that multiple child components need to read
-   Injecting dependencies into deeply nested sub-components

### When NOT to use context

-   **Cross-widget communication** — use pub/sub events (Section 6)
-   **MCP access** — just call `useMcpProvider()` directly in any component
-   **Persisted state** — use `api.storeData` / `api.readData`

---

## 9. Sharing State Between Widgets

Since providers and MCP connections are managed at the Electron app level, you
**do not need** React Context to share MCP access between widgets. Multiple widgets
can each call `useMcpProvider("slack")` independently and they share the same
underlying connection automatically.

For coordinating between widgets, use these approaches in order of preference:

### Option 1: Pub/Sub Events (recommended)

Best for "widget A tells widget B something happened" — see Section 6.

### Option 2: Persisted State via `api.storeData`

Best for data that should survive reloads:

```javascript
// Widget A saves
api.storeData({ selectedChannelId: "C123" });

// Widget B reads
api.readData({
    callbackComplete: (data) => {
        setChannelId(data.selectedChannelId);
    },
});
```

### Option 3: Custom Layout Container with Context (rare)

Only needed for tightly-coupled, transient shared state. Create a layout container
with `canHaveChildren: true` that wraps child widgets in a React context:

```javascript
// SlackLayout.js — a layout container
import { useState } from "react";
import { SlackContext } from "./SlackContext";

export const SlackLayout = ({ children }) => {
    const [selectedItem, setSelectedItem] = useState(null);
    return (
        <SlackContext.Provider value={{ selectedItem, setSelectedItem }}>
            {children}
        </SlackContext.Provider>
    );
};

// SlackLayout.dash.js
export default {
    component: SlackLayout,
    canHaveChildren: true, // Layout container that wraps child widgets
    workspace: "slack",
    type: "widget",
};
```

For most widgets, **pub/sub events are simpler** than context for coordinating
between widgets.

---

## 10. Component Import Rules

**This is critical — incorrect imports cause hard-to-debug issues.**

```javascript
// UI components — ALWAYS from @trops/dash-react
import { Panel, Button, Heading, Widget } from "@trops/dash-react";
import { ThemeContext } from "@trops/dash-react";
import { FontAwesomeIcon } from "@trops/dash-react";

// Core hooks and utilities — ALWAYS from @trops/dash-core
import {
    useWidgetProviders,
    useMcpProvider,
    useDashboard,
} from "@trops/dash-core";
```

**Rules:**

-   **Never** import `FontAwesomeIcon` directly from `@fortawesome/*` — always use
    the `@trops/dash-react` re-export.
-   **Never** import `ThemeContext` from a local path — always from `@trops/dash-react`
    to avoid dual context instances.
-   **Never** import `useWidgetProviders` or `useMcpProvider` from a local path —
    always from `@trops/dash-core`.

---

## 11. Debugging & Testing

### Development Mode

```bash
npm run dev
```

1. React dev server starts with hot module reloading
2. Electron app launches
3. Widget changes auto-reload without restart

### Debugging

**Browser DevTools:** Electron → View → Toggle Developer Tools

```javascript
// Console: Check widget registration
ComponentManager.config("MyWidget");

// Console: Check providers
window.dashApi.listProviders();
```

**React Developer Tools:** Install the React DevTools extension to inspect component
hierarchy, props, and context.

### Testing Checklist

-   [ ] Widget renders correctly in dashboard
-   [ ] User config fields appear in edit modal
-   [ ] Default values applied correctly
-   [ ] Data persistence works (save → reload → data present)
-   [ ] Events publish and listeners receive
-   [ ] Provider credentials accessible (if applicable)
-   [ ] MCP tools callable and data renders
-   [ ] Error boundary catches widget errors gracefully

### Hot Module Reloading

During development (`npm run dev`), changes to widget files automatically reload.
No manual restart needed. State may reset on reload — use `api.storeData` for
persistence across reloads.

### Troubleshooting

**Widget not appearing**: Check `ComponentManager.config("MyWidget")` in DevTools
Console. Ensure `index.js` exports the widget.

**Widget shows blank**: Check DevTools Console for errors. Verify all imports resolve
(no `Module not found`). Ensure `<Widget {...props}>` wrapper is used.

**Data not persisting**: Use `api.storeData()` / `api.readData()` (not localStorage).
Check Console for IPC errors. Verify Electron main process is running.

**Provider not available**: Ensure `.dash.js` has correct `providers` array. Check
that the provider exists in Settings → Providers. Use `useWidgetProviders()` hook.
Verify using `AppContext.providers` (not `DashboardContext.providers`).

---

## 12. Existing Widget Examples

The `src/Widgets/` directory in dash-electron contains reference implementations.
When building a new widget, review these for patterns around:

-   How `.dash.js` files are configured
-   How widgets consume the `api` prop
-   How MCP data flows into dash-react components
-   How provider credentials are accessed

The `packages/trops/dash-samples/` directory in dash-registry also contains
sample widget manifests showing the expected metadata format.
