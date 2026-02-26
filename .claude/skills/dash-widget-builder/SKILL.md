---
name: dash-widget-builder
description: >
    Build widgets for this Dash Electron dashboard project.
    Use this skill whenever the user wants to create a new widget, build a dashboard
    integration (Algolia, Slack, Google Drive, Gmail, Contentful, etc.), connect a
    widget to an MCP server, choose dash-react UI components for a widget layout,
    package widgets for npm distribution, or submit a widget to the Dash Registry.
    Also trigger when the user mentions "widget", "dash widget", "provider",
    "widgetize", ".dash.js", "dash-react", "dash-core", "MCP", or asks to build a
    dashboard panel/tile/card that integrates with an external service.
    Even if the user just says "I want to build a widget for [service]" — use this skill.
---

# Dash Widget Builder

Build, test, and distribute widgets for this
[Dash Electron](https://github.com/trops/dash-electron) dashboard project.

> This skill lives inside the project. It knows the project structure and can
> reference existing widgets, sample code, and scaffold templates directly.

## Ecosystem Overview

Dash is a **four-repo ecosystem**:

| Repo                                                    | Purpose                                             | Key Exports                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [dash-electron](https://github.com/trops/dash-electron) | Electron app template — this project                | Scaffold, dev server, packaging                                                             |
| [dash-core](https://github.com/trops/dash-core)         | Framework internals — widget system, MCP, providers | `useMcpProvider`, `useWidgetProviders`, `useDashboard`, `ComponentManager`, `mcpController` |
| [dash-react](https://github.com/trops/dash-react)       | UI component library                                | `Widget`, `Panel`, `Heading`, `Button`, `Menu`, `ThemeContext`, `FontAwesomeIcon`, etc.     |
| [dash-registry](https://github.com/trops/dash-registry) | Widget marketplace & project scaffolding            | Manifest validation, registry index                                                         |

## How Widgets Work — The Big Picture

A Dash widget is a **React component that acts as a UI shell** for data from external
services. The architecture is:

```
┌─────────────────────────────────────────────────┐
│  Electron App (Providers Settings)              │
│  ┌──────────────────────────────────────────┐   │
│  │ "Slack" provider: MCP URL, auth token    │   │
│  │ "Algolia" provider: MCP URL, API key     │   │
│  │  (configured once, shared to all widgets)│   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│  Electron Main Process                          │
│  ┌─────────────┐   │   ┌────────────────────┐  │
│  │ mcpController│───┘   │ MCP Server Catalog │  │
│  │ (IPC broker) │───────│ (Slack, etc.)      │  │
│  └──────┬──────┘       └────────────────────┘  │
│         │ IPC                                    │
├─────────┼───────────────────────────────────────┤
│  Renderer Process                                │
│         │                                        │
│  ┌──────▼──────┐                                 │
│  │useMcpProvider│  ← Hook from dash-core         │
│  └──────┬──────┘                                 │
│     ┌───┴───────────────┐                        │
│  ┌──▼─────────┐  ┌──────▼──────┐                 │
│  │ Widget A    │  │ Widget B    │  ← All widgets  │
│  │ (channels)  │  │ (messages)  │    sharing same  │
│  └─────────────┘  └─────────────┘    provider      │
└─────────────────────────────────────────────────┘
```

**Key insights**:

-   Widgets are loaded at runtime without recompiling Electron
-   **Providers are app-level** — the user configures MCP connections (URL, auth tokens)
    once in the Electron app's Providers settings. Any widget that specifies it needs
    that provider gets the shared connection automatically.
-   **Every widget declares its own `providers` array** in its `.dash.js` file. The
    Electron app handles deduplication and credential sharing at runtime.
-   **Widgets just call `mcp.callTool()`** — no wrapper components or context setup needed.

---

## Before You Start — Scan This Project

Before building any widgets, scan the existing project to understand what's here:

```bash
# What widgets already exist?
ls src/Widgets/

# Look at existing .dash.js files for conventions
cat src/Widgets/*/widgets/*.dash.js

# Check the scaffold template for the generated structure
ls scripts/template/
```

This tells you the workspace naming conventions, userConfig patterns, and provider
declarations already in use. Match them in your new widgets.

The `src/Widgets/DashSamples/` directory contains reference widget implementations
you can study for patterns.

---

## Workflow — Building a Widget

When the user asks to build a widget, follow these phases in order. Each phase has a
dedicated reference document — read it before starting that phase.

### Phase 1: Scaffold

**Read:** `references/widget-development.md` (Sections 1-2)

Run the scaffold generator:

```bash
node ./scripts/widgetize <WidgetName>
```

This creates:

```
src/Widgets/<WidgetName>/
├── contexts/
│   ├── <WidgetName>Context.js
│   └── index.js
├── widgets/
│   ├── <WidgetName>.js
│   └── <WidgetName>.dash.js
└── index.js
```

For **multiple widgets in the same integration** (e.g., SlackChannels + SlackMessages),
scaffold once, then manually add additional widget files in the same `widgets/`
directory. Give them the same `workspace` key in their `.dash.js` files.

### Phase 2: MCP Research

**Read:** `references/mcp-integration.md`

**This is the most important phase.** Before writing any widget code:

1. Identify what external service the widget needs (Algolia, Slack, Google Drive, etc.)
2. Research available MCP servers — check npmjs.com, the MCP Registry, GitHub
3. Understand what tools the MCP server exposes
4. Map MCP tools → widget features (e.g., `search` tool → search bar + results list)
5. Determine what credentials the MCP server needs → feeds into the `providers` array

**Do not skip this phase.** The MCP server's capabilities directly determine what the
widget can do and which dash-react components are the right fit.

### Phase 3: Build the Widget

**Read:** `references/widget-development.md` (Sections 4-10)

Write the widget code using the scaffold from Phase 1 and the MCP mapping from Phase 2:

1. Configure the `.dash.js` file — `workspace` grouping key, `userConfig`, `providers` array
2. Write the widget component — use `@trops/dash-react` components to present MCP data,
   wire up `useMcpProvider` to call MCP tools
3. Set up the widget's context if needed — for sharing state with sub-components
4. Implement widget communication (pub/sub) if multiple widgets coordinate
5. Use `api.storeData` / `api.readData` for persisting widget state

### Phase 4: Test

**Read:** `references/widget-development.md` (Section 11)

```bash
npm run dev
```

Verify:

-   MCP connection establishes correctly
-   Data flows from MCP server → widget UI
-   User interactions trigger the right MCP tool calls
-   Widget state persists across reloads via `api.storeData`
-   Error states handled gracefully (MCP server down, auth failures, etc.)
-   Themed components inherit the user's chosen colors

### Phase 5: Package & Distribute

**Read:** `references/packaging.md`

1. Run `npm run package-widgets` to bundle
2. Create a `manifest.json` for the dash-registry
3. Submit to the registry or publish as an npm package

---

## Quick Reference — Common Patterns

### Minimal Widget

```javascript
import { Widget, Panel, Heading, SubHeading } from "@trops/dash-react";

export const MyWidget = ({
    title = "Hello",
    subtitle = "I'm a widget",
    api,
    ...props
}) => {
    return (
        <Widget {...props}>
            <Panel>
                <Heading text={title} />
                <SubHeading text={subtitle} />
            </Panel>
        </Widget>
    );
};
```

### Widget with MCP Data

```javascript
import { useState } from "react";
import { Widget, Panel, Heading, Menu, MenuItem } from "@trops/dash-react";
import { useMcpProvider } from "@trops/dash-core";

export const SearchWidget = ({ api, ...props }) => {
    const mcp = useMcpProvider("algolia");
    const [results, setResults] = useState([]);

    const handleSearch = async (query) => {
        const response = await mcp.callTool("search", { query });
        setResults(response.results);
    };

    return (
        <Widget {...props}>
            <Panel>
                <Heading text="Search" />
                <Menu>
                    {results.map((item) => (
                        <MenuItem key={item.id}>{item.title}</MenuItem>
                    ))}
                </Menu>
            </Panel>
        </Widget>
    );
};
```

### Widget .dash.js Configuration

```javascript
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
    },
    providers: [
        {
            type: "my-service",
            providerClass: "credential",
            required: true,
            credentialSchema: {
                apiKey: {
                    type: "password",
                    required: true,
                    displayName: "API Key",
                },
            },
        },
    ],
};
```

---

## Reference Documents

Read these as needed during each phase:

| File                               | When to Read                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `references/mcp-integration.md`    | Phase 2 — MCP research, `useMcpProvider`, IPC patterns, provider config           |
| `references/widget-development.md` | Phases 1 & 3 — dash-react components, `.dash.js`, widget API, contexts, debugging |
| `references/packaging.md`          | Phase 5 — `package-widgets`, npm publishing, registry manifest                    |

**Always read `references/mcp-integration.md` before writing widget code.**
The MCP server's available tools determine the widget's features and UI layout.
