---
name: dash-widget-builder
description: >
    Build widgets for this Dash Electron dashboard project.
    Use this skill whenever the user wants to create a new widget, build a dashboard
    integration (Algolia, Slack, Google Drive, Gmail, Contentful, etc.), connect a
    widget to an MCP server, choose dash-react UI components for a widget layout,
    package widgets for npm distribution, or submit a widget to the Dash Registry.
    Also trigger when the user mentions "widget", "dash widget", "provider",
    "@ai-built", ".dash.js", "dash-react", "dash-core", "MCP", or asks to build a
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

## Before You Start — Read the Context You're Given First

**Skip discovery if the user already gave you context.** If the user (or the
calling environment) already specified what to build and which provider to use,
go straight to Phase 3 (Build). Don't `ls` or `cat` user files first — that's
a common cause of "AI gives me a project tour instead of widget code."

You'll know you have enough context when you can answer all three:

1. **What does the widget do?** (e.g., "list Algolia query rules with inline edit")
2. **Which provider does it use, and which class?** (e.g., `algolia` / `credential`)
   See [provider-classes](#provider-classes-credential-vs-mcp) below.
3. **Single task or multi-widget?** Widgets are single-purpose by design — see
   [Single-Purpose Widget Rule](#single-purpose-widget-rule). If the request
   spans multiple jobs, split it.

If any of those is unclear, ask **one** short clarifying question before scanning.

### When discovery IS appropriate

If you genuinely have no context (e.g., the user said only "I want a widget"),
then a brief look at existing patterns helps:

```bash
# What AI-built widgets already exist? (platform-specific path)
# macOS:   ~/Library/Application Support/Dash/widgets/@ai-built/
# Windows: %APPDATA%/Dash/widgets/@ai-built/
# Linux:   ~/.config/Dash/widgets/@ai-built/
ls "$HOME/Library/Application Support/Dash/widgets/@ai-built/" 2>/dev/null

# Study sample patterns
ls src/SampleWidgets/
cat src/SampleWidgets/*/widgets/*.dash.js
```

The `src/SampleWidgets/` directory contains reference widget implementations.
Use them ONLY to confirm structural conventions — do **not** copy entire widgets
or describe them back to the user. The user wants a new widget, not a tour.

---

## Single-Purpose Widget Rule

A Dash widget is a **small, single-purpose UI unit** that shares dashboard
real-estate with other widgets. The user assembles workflows by dropping multiple
widgets on a dashboard and wiring them together via cross-widget events — the
"assembly line" pattern.

### HARD RULES — enforced by the validator at compile time

-   **NO `<Modal>`, `<Dialog>`, or `<Drawer>` inside a widget.** Those are
    app-level chrome. Popping them from inside a widget hijacks dashboard
    real-estate, fights z-index against actual app modals, and produces the
    runtime "open prop must be boolean" error. **Compile fails** if these tags
    appear in widget JSX.

-   **Multi-step UX renders INLINE.** A "click button to reveal a form" pattern
    uses a collapsible `<Card>` in the widget's flat surface, NOT a Modal:

    ```jsx
    {
        showForm && (
            <Card>
                {/* the form, inline — scrolls with the rest of the widget */}
            </Card>
        );
    }
    ```

-   **One widget = one job.** "Manage Algolia rules" is one job (list + inline
    create/edit form). "Manage rules + index settings + analytics + records" is
    four jobs — emit four widgets, one per job, and tell the user which events
    flow between them.

-   **Cross-widget coordination uses `useWidgetEvents`.** When two genuinely-
    separate widgets need to talk, widget A publishes an event on user action,
    widget B listens and renders. Example: a "Rule List" widget publishes
    `ruleSelected` on row-click; a sibling "Rule Editor" widget listens for
    `ruleSelected` and shows the form for that id. The user wires the two
    together via Settings → Configure → Event Handlers.

When emitting multiple widgets (multi-file output via `File:` markers), name
the events explicitly in your chat response — one line per event, naming the
publisher widget, the listener widget, and what data flows.

---

## Primitive Palette — what dash-react gives you, when to reach for each

The Dash chrome (sidebar, modals, settings, popovers) looks cohesive because
every UI element comes from a `@trops/dash-react` primitive whose color is
delivered via `ThemeContext`. Widgets must follow the same rule, or theme
switches stop propagating and the widget visibly drifts from the chrome.

This table is the lookup. **If a use case has a primitive listed, use it. Do
not hand-roll the equivalent with raw Tailwind.**

| Use case                                                | Primitive                                       | Notes                                                                         |
| ------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Section title inside a widget                           | `SubHeading2`                                   | Never raw `Heading` — that's H1, only for full pages.                         |
| Sub-section label                                       | `SubHeading3`                                   |                                                                               |
| Big number for a stat widget                            | `Heading2` or `StatCard`                        | `StatCard` for label + value + change/trend in one.                           |
| Body text                                               | `Paragraph` / `Paragraph2` / `Paragraph3`       |                                                                               |
| Small inline label / meta text                          | `Caption` / `Caption2` / `Caption3`             | Replaces hand-rolled `<span className="text-gray-500">`.                      |
| Action button (primary CTA)                             | `Button`                                        | Centered text, primary color.                                                 |
| Action button (secondary, default)                      | `Button2`                                       | Chrome-default. Use this when in doubt.                                       |
| Action button (tertiary, dismissive)                    | `Button3`                                       | Light/ghost styling.                                                          |
| Status pill (open/closed/pending/success/error/warning) | `StatusBadge`                                   | `state` prop drives the color. `compact` mode for the connection-dot pattern. |
| Categorical label                                       | `Tag` / `Tag2` / `Tag3`                         |                                                                               |
| Error region                                            | `Alert` / `Alert2`                              | Themed banner with title + message + optional onClose.                        |
| Empty list / no-results state                           | `EmptyState`                                    | `title` + `description` + optional `children` (e.g. a Button).                |
| In-flight loading list                                  | `Skeleton.Text`                                 | `lines={N}` for repeated rows.                                                |
| In-flight loading card                                  | `Skeleton.Card`                                 |                                                                               |
| Single stat tile                                        | `StatCard`                                      | `label` + `value` + `helpText`.                                               |
| Text input                                              | `InputText`                                     | `value` + `onChange` + `placeholder` + optional `label`.                      |
| Search input                                            | `SearchInput`                                   |                                                                               |
| Checkbox / switch / radio                               | `Checkbox` / `Switch` / `RadioGroup`            |                                                                               |
| List with clickable rows                                | `Menu` + `MenuItem`                             | MenuItem takes `selected` + `onClick`.                                        |
| Tabular data                                            | `Table` (with `data` + `columns`) or `DataList` |                                                                               |
| Container with header/footer                            | `Panel` / `Panel2` / `Panel3`                   | Auto-sizes to fill height.                                                    |
| Card surface                                            | `Card` / `Card2` / `Card3`                      |                                                                               |

For the canonical _shape_ of each pattern, the codebase ships four exemplar
widgets that pass the post-cohesion acceptance bar — read these before
authoring a similar widget:

-   `src/SampleWidgets/Slack/widgets/SlackListChannels.js` — list with status indicator + events
-   `src/SampleWidgets/GitHub/widgets/GitHubPRList.js` — list with per-row state badges
-   `src/SampleWidgets/Gmail/widgets/GmailUnreadCount.js` — single-stat tile
-   `src/SampleWidgets/Algolia/widgets/AlgoliaRulesList.js` — search + paginated list

---

## Color Rule — non-negotiable, audit-enforced

**No widget code may use Tailwind color utility classes
(`bg-{color}-{shade}`, `text-{color}-{shade}`, `border-{color}-{shade}`,
or any `hover:` variant of those).** All color must be delivered by a
`@trops/dash-react` primitive that reads `ThemeContext`. Theme-neutral
utilities (spacing, sizing, flex/grid, `opacity-N`, transitions,
animations) remain allowed.

The acceptance scorecard greps emitted widget code against this rule and
flags violations. Common violations and their fixes:

| Violation                                                                      | Fix                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `<button className="bg-purple-600 hover:bg-purple-500 ...">Refresh</button>`   | `<Button2 title="Refresh" onClick={...} size="sm" />`             |
| `<span className="bg-green-900/50 text-green-400 ...">open</span>`             | `<StatusBadge state="open" label="open" />`                       |
| `<div className="bg-red-900/30 border-red-700 text-red-300 ...">{error}</div>` | `<Alert2 title="Failed to load" message={error} />`               |
| `<p className="text-gray-600 italic">No results</p>`                           | `<EmptyState title="No results" description="..." />`             |
| `<input className="bg-gray-800 border-gray-600 text-gray-200 ...">`            | `<InputText value={x} onChange={fn} placeholder="..." />`         |
| `<div className="text-gray-500 font-mono">{status}</div>` (status dot pattern) | `<StatusBadge state={mapStatus(state)} label={status} compact />` |

If you need a color the existing primitives don't offer, that's a
dash-react gap — flag it in your chat response, don't paper over it with
hardcoded Tailwind. The user can add the primitive to dash-react in a
follow-up; mid-pour widgets stay clean.

---

## Workflow — Building a Widget

When the user asks to build a widget, follow these phases in order. Each phase has a
dedicated reference document — read it before starting that phase.

### Phase 1: Scaffold

**Read:** `references/widget-development.md` (Sections 1-2)

Run the scaffold generator with `--output-dir` to target the `@ai-built/` directory:

```bash
# Resolve the @ai-built/ target path
AI_BUILT_DIR="$HOME/Library/Application Support/Dash/widgets/@ai-built"

node ./scripts/widgetize <WidgetName> --output-dir "$AI_BUILT_DIR"
```

This creates:

```
~/Library/Application Support/Dash/widgets/@ai-built/<WidgetName>/
├── contexts/
│   ├── <WidgetName>Context.js
│   └── index.js
├── widgets/
│   ├── <WidgetName>.js
│   └── <WidgetName>.dash.js
├── index.js
└── dash.json                    # Auto-generated package manifest
```

The `--output-dir` flag also auto-generates `dash.json` and sets `workspace: "ai-built"`
in the `.dash.js` config. Without the flag, `widgetize` defaults to `src/Widgets/`.

For **multiple widgets in the same integration** (e.g., SlackChannels + SlackMessages),
scaffold once, then manually add additional widget files in the same `widgets/`
directory. Give them the same `workspace` key in their `.dash.js` files.

### Phase 2: Provider Research (MCP OR Credential)

**Read:** `references/mcp-integration.md`

**This is the most important phase.** Before writing widget code, decide which
**provider class** the widget uses. Two equal paths:

#### Provider classes: credential vs MCP

| Class        | When to use                                                                                                                                                                 | Hook                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `credential` | Service has a custom MCP server in dash-electron's main process exposing direct IPC methods (Algolia, OpenAI, etc.). Widget calls `window.mainApi.<service>.<method>(...)`. | `useWidgetProviders` + `useProviderClient` |
| `mcp`        | Service is reached via a generic MCP server (Slack, Google Drive, GitHub, etc.). Widget calls `mcp.callTool(name, args)`.                                                   | `useMcpProvider`                           |

If the user has already pre-selected a provider (e.g., "build with algolia
(credential)"), use that class directly. Otherwise, decide based on what's
available:

1. **If the user names a service** — check the project's `providerApiRegistry`
   first (see [Available IPC Methods](#available-ipc-methods-on-windowmainapi)
   below). If the service is registered there, it's `credential`-class with
   direct IPC.
2. **Otherwise** — research available MCP servers (npmjs.com, MCP Registry,
   GitHub). It's `mcp`-class.
3. **Map provider capabilities → widget features** (e.g., `search` method →
   search bar + results list).
4. **Declare the provider in `.dash.js`** with the matching `providerClass`:

    ```js
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ];
    //                                              ^^^^^^^^^^ — must match the hook
    ```

**Do not skip this phase.** Choosing the wrong class locks the widget out of
the right hook and produces silent runtime errors.

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

`@ai-built/` widgets are loaded at runtime by the widget registry — testing
is what happens AFTER the user installs the widget. Your job during the
build conversation is to **finish the code**; the user does the testing.

> ⚠️ **Do NOT run `npm run dev`, `npm run start`, or any other shell command
> to "test the widget."** The Dash app is already running — that's where the
> widget builder modal you're talking to lives. Spawning another dev server
> would conflict with the running one and cause duplicate-port errors. There
> is nothing for you to spin up. Output the widget code; the user clicks
> **Install**; the widget shows in the picker. That's the entire test loop.

How widget loading actually works (no restart, no rebuild):

-   **Modal flow** (the user is building inside the Dash app's Widget Builder
    modal): clicking **Install** registers the widget and broadcasts
    `widget:installed` to every open window. The widget picker refreshes in
    place; the modal stays open so the user can iterate.
-   **Terminal flow** (the user ran `widgetize --output-dir` writing to
    `@ai-built/`): the user opens the Dash app's widget picker. The registry
    scans `@ai-built/` on picker-open and the new widget appears. If it
    doesn't, the user clicks the picker's refresh affordance.

The user, NOT you, will then verify these things in the dashboard:

-   Widget appears in the widget picker and renders
-   Provider connection (MCP or credential IPC) establishes correctly
-   Data flows from the provider into the widget UI
-   User interactions trigger the right provider calls
-   Widget state persists across reloads via `api.storeData`
-   Error states render visibly (no silent `setData([])` after a `catch`)
-   Themed components inherit the user's chosen theme

If the user reports a problem in any of those, treat that as the signal to
edit the widget — don't pre-emptively run the app yourself.

### Phase 5: Package & Distribute

**Read:** `references/packaging.md`

1. Run `npm run package-widgets` to bundle
2. Create a `manifest.json` for the dash-registry
3. Submit to the registry or publish as an npm package

---

## Quick Reference — Common Patterns

> **Component prop names are exact.** dash-react components silently ignore
> unknown props and render with empty defaults. See
> [`references/dash-react-components.md`](references/dash-react-components.md)
> for the full prop reference. Common gotchas: `<Heading title="..." />` not
> `text=`; `<Button title="..." />` not `text=`; `<EmptyState title="..."
description="..." />` not `message=`.

### Minimal Widget

```javascript
import React from "react";
import { Panel, SubHeading2, Paragraph } from "@trops/dash-react";

export default function MyWidget({
    title = "Hello",
    subtitle = "I'm a widget",
}) {
    return (
        <Panel>
            <SubHeading2 title={title} />
            <Paragraph text={subtitle} />
        </Panel>
    );
}
```

> **Heading variant rule:** `Heading` is H1 — only for full pages, never
> inside a widget cell. Use `SubHeading2` for the widget's title and
> `SubHeading3` for sub-section labels. `Heading2` / `Heading3` are
> allowed only for numeric display in stat widgets.

> **Hooks come from `react`**, NEVER from `@trops/dash-react`:
>
> ```js
> import React, { useState, useEffect } from "react"; // CORRECT
> ```

### Widget with MCP Data (`mcp` provider class)

```javascript
import React, { useState, useEffect } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
} from "@trops/dash-react";
import { useMcpProvider } from "@trops/dash-core";

export default function SearchWidget({ query = "" }) {
    const { callTool, tools, isConnected, error } = useMcpProvider("algolia");
    const [results, setResults] = useState(null);

    useEffect(() => {
        // Gate on BOTH isConnected AND tools.length — connection becomes
        // ready before the server's tools list is loaded.
        if (!isConnected || tools.length === 0) return;
        let cancelled = false;
        callTool("search", { query })
            .then((r) => {
                if (cancelled) return;
                // Defensive: tool responses are external — never assume shape.
                setResults(Array.isArray(r?.results) ? r.results : []);
            })
            .catch(() => {
                if (!cancelled) setResults([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, query, callTool]);

    return (
        <Panel>
            <SubHeading2 title="Search results" />
            {error && (
                <Alert2
                    title="Search failed"
                    message={error.message || String(error)}
                />
            )}
            {!error && results === null && <Skeleton.Text lines={4} />}
            {!error && results && results.length === 0 && (
                <EmptyState
                    title="No results"
                    description={`No matches for "${query}".`}
                />
            )}
            {!error && results && results.length > 0 && (
                <Menu>
                    {results.map((item) => (
                        <MenuItem key={item.id}>{item.title}</MenuItem>
                    ))}
                </Menu>
            )}
        </Panel>
    );
}
```

### Widget with Credentialed IPC (`credential` provider class)

```javascript
import React, { useState, useEffect } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    EmptyState,
    Skeleton,
    Alert2,
} from "@trops/dash-react";
import { useWidgetProviders, useProviderClient } from "@trops/dash-core";

export default function AlgoliaIndexList({ title = "Algolia indices" }) {
    // Hooks first — Rules of Hooks. getProvider returns null when the
    // provider isn't configured yet, and useProviderClient(null) is safe
    // (returns a null-shaped handle).
    const { hasProvider, getProvider } = useWidgetProviders();
    const provider = getProvider("algolia");
    const pc = useProviderClient(provider);
    // pc is { providerHash, providerName, dashboardAppId } — pass these
    // three to every IPC method (see Available IPC Methods section).

    const [indices, setIndices] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!pc?.providerHash) return; // bail INSIDE the effect, not above
        let cancelled = false;
        window.mainApi.algolia
            .listIndices({
                providerHash: pc.providerHash,
                dashboardAppId: pc.dashboardAppId,
                providerName: pc.providerName,
            })
            .then((rows) => {
                if (cancelled) return;
                setIndices(Array.isArray(rows) ? rows : []);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [pc?.providerHash]);

    // Conditional render goes AFTER all hooks have run.
    if (!hasProvider("algolia")) {
        return (
            <Panel>
                <EmptyState
                    title="No Algolia provider"
                    description="Configure one in Settings → Providers"
                />
            </Panel>
        );
    }
    if (error)
        return (
            <Panel>
                <Alert2
                    title="Failed to load indices"
                    message={error.message || String(error)}
                />
            </Panel>
        );
    if (indices === null)
        return (
            <Panel>
                <Skeleton.Text lines={4} />
            </Panel>
        );
    return (
        <Panel>
            <SubHeading2 title={title} />
            <Menu>
                {indices.map((idx) => (
                    <MenuItem key={idx.name}>{idx.name}</MenuItem>
                ))}
            </Menu>
        </Panel>
    );
}
```

### Widget .dash.js Configuration

```javascript
import { MyWidget } from "./MyWidget";

export default {
    component: MyWidget,
    canHaveChildren: false,
    workspace: "ai-built",
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

### dash.json Package Manifest

Auto-generated by `widgetize --output-dir`, or create manually:

```json
{
    "name": "@ai-built/mywidget",
    "displayName": "My Widget",
    "version": "1.0.0",
    "description": "Widget: MyWidget",
    "author": "AI Assistant",
    "widgets": [
        {
            "name": "MyWidget",
            "displayName": "My Widget",
            "description": ""
        }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

---

## Available IPC Methods on `window.mainApi`

For `credential`-class providers, the renderer calls into the Electron main
process via `window.mainApi.<service>.<method>(...)`. **You may only call
methods that exist** — the project ships a `providerApiRegistry.js` that the
post-compile validator checks. Hallucinated method names (`getRules`,
`createRule`, `updateRule`) are rejected at compile time.

### Looking up the methods for a service

The registry lives at:

```
src/AiAssistant/providerApiRegistry.js
```

Each entry lists the method name, the args object shape, and a one-line
description. Example for Algolia (current as of v0.0.700):

| Method                              | Args                                             | Description                                                         |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `listIndices`                       | `{ providerHash, dashboardAppId, providerName }` | List every index in the configured Algolia application.             |
| `search`                            | `{ ..., indexName, query, options }`             | Run a search against an index.                                      |
| `browseObjectsToFile`               | `{ ..., indexName, toFilename, query }`          | Stream every record matching `query` into a JSON file (for export). |
| `partialUpdateObjectsFromDirectory` | `{ ..., indexName, dir, createIfNotExists }`     | Bulk-update records from JSON files in `dir`.                       |
| `getSettings` / `setSettings`       | `{ ..., indexName, settings? }`                  | Read or replace index settings.                                     |
| `getAnalyticsForQuery`              | `{ ..., indexName, query }`                      | Fetch analytics for a single query.                                 |
| `searchRules`                       | `{ ..., indexName, query, hitsPerPage, page }`   | List/search query rules on an index.                                |
| `saveRule`                          | `{ ..., indexName, rule }`                       | Create or update (upsert) a single query rule.                      |
| `deleteRule`                        | `{ ..., indexName, objectID }`                   | Delete a query rule by `objectID`.                                  |

(`...` = the credentials triplet `providerHash, dashboardAppId, providerName`.)

If you need a method that's not in the registry, **ask the user** — adding new
IPC methods is a separate change to dash-electron's main process. Don't
hallucinate; the validator will reject the build and you'll have to redo it.

---

## Cross-Widget Events — `useWidgetEvents`

If the widget has a meaningful interaction worth sharing across the dashboard
— a row clicked, a query changed, a file opened, a value submitted — publish
an event so other widgets can react. Skip for read-only / static widgets where
there's nothing to broadcast.

### API

```jsx
import { useWidgetEvents } from "@trops/dash-core";
import { Panel } from "@trops/dash-react";

export default function MyWidget() {
    const { publishEvent } = useWidgetEvents();
    return (
        <Panel>
            <ul>
                {items.map((item) => (
                    <li
                        key={item.id}
                        onClick={() =>
                            publishEvent("itemSelected", {
                                id: item.id,
                                name: item.name,
                            })
                        }
                    >
                        {item.name}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
```

The hook auto-scopes the event to `<component>[<id>].<eventName>` on the wire
— you only supply the suffix. `useWidgetEvents` is a hook, so it MUST be
called at the top of the component above any conditional return (Rules of
Hooks).

### Naming convention

Plain **camelCase** verbs/states: `itemSelected`, `queryChanged`,
`templateChanged`, `indexSelected`, `valueSubmitted`, `searchQuerySelected`.

-   NOT kebab-case (`item-selected`)
-   NOT colon-prefixed (`filebrowser:itemSelected`)

The component scope is added automatically by the hook.

### Declaration

ALSO list each event in the `.dash.js` config's `events: [...]` array — a
plain array of **strings**, not objects:

```js
events: ["itemSelected", "queryChanged"],
```

The framework reads bare names; the object form (`{ name, description }`) is
wrong and breaks downstream tooling.

### Tell the user

When you add events, list them at the end of your chat response — one line
per event, name + trigger:

> Emits `itemSelected` when a row is clicked. Connect another widget to it
> by adding an event handler in Settings → Configure → Event Handlers.

DO NOT publish events the user can't see in your response.

---

## Scheduled Tasks — `useScheduler`

If the widget benefits from running on a schedule — refreshing data
periodically, polling an external source, generating a recurring report —
expose a scheduled task. The user configures WHEN it runs via Settings →
Schedule (cron / interval); the widget just exposes a named handler the
framework calls on the configured cadence.

### API

```jsx
import { useScheduler } from "@trops/dash-core";
import { Panel } from "@trops/dash-react";

export default function MyWidget() {
    const { tasks } = useScheduler({
        refreshData: () => {
            // Fetch fresh data from a provider, update state, etc.
        },
        generateReport: () => {
            // Build + emit a periodic snapshot.
        },
    });
    return <Panel>{/* render */}</Panel>;
}
```

`useScheduler` is a hook — call it at the top of the component above any
conditional return.

### Naming convention

Plain camelCase verbs/nouns: `refreshData`, `generateReport`, `pollStatus`,
`syncCache`. Same rules as event names — the task key IS the JS identifier.

### Declaration

ALSO list each task in `.dash.js` `scheduledTasks: [...]`:

```js
scheduledTasks: [
  { key: "refreshData", handler: "refreshData", displayName: "Refresh Data", description: "Fetch the latest data from the source" },
  { key: "generateReport", handler: "generateReport", displayName: "Generate Report", description: "Build a periodic snapshot" },
],
```

`key` must match a key in the `useScheduler({...})` call; `handler` is
usually identical to `key`; `displayName` is the human label for Settings →
Schedule; `description` explains what the task does.

### Tell the user

When you add scheduled tasks, list them at the end of your chat response:

> Added scheduled task `refreshData` (refreshes the data). Open Settings →
> Schedule to set a cadence (cron or interval) and enable it.

DO NOT add scheduled tasks the user can't see in your response — the user
has to know to configure the cadence.

---

## Defensive Coding Rules

Widget code runs in the browser (renderer process). Rules:

-   **No Node-only APIs.** No `process.cwd()`, `process.env` (except
    `process.env.NODE_ENV`), `__dirname`, `__filename`, `require()`, no imports
    of `fs` / `path` / `os` / `child_process` / `crypto` / `stream` /
    `child_process`. Use literal strings or read from props / userConfig.
-   **Defensive on every external response.** MCP tool responses, IPC
    responses, props, fetched values — never assume a field exists. Guard
    before calling string/array methods (`typeof x === "string"`,
    `Array.isArray(y)`, optional chaining). Errors like "Cannot read properties
    of undefined" on first render are NOT acceptable.
-   **Never silently swallow errors.** A `catch` block MUST render the error
    to the user via `<Alert2 title="..." message={err.message} />` — NOT just
    `setData([])` followed by a blank state. An empty array as the _result of
    a caught exception_ is a silent failure.
-   **Hooks first, conditional render after.** Call all hooks at the top of
    the component, then any early-return for "not configured" / "loading"
    states. Putting an early-return ABOVE a hook crashes the app the moment
    the condition flips.
-   **`userConfig` values are LIVE props, not initial state.** When the user
    edits a userConfig field — via the dashboard's Settings → Configure
    dialog on an installed widget, or via the widget builder's "Apply to
    preview" in Test Inputs — the widget receives a new prop value and
    re-renders. **Don't freeze the prop in `useState(propName)` like this:**

    ```jsx
    // ❌ Broken: captures the value at FIRST RENDER only.
    // Future userConfig saves and Test Input applies are ignored.
    export default function MyWidget({ selectedIndex = "" }) {
        const [currentIndex, setCurrentIndex] = useState(selectedIndex);
        // ...
    }
    ```

    Two correct patterns:

    ```jsx
    // ✅ Pattern A: read the prop directly. Simplest when the prop
    //    drives an effect.
    export default function MyWidget({ selectedIndex = "" }) {
        const [data, setData] = useState(null);
        useEffect(() => {
            if (!selectedIndex) return;
            // fetch / load using selectedIndex directly
        }, [selectedIndex]);
        // render against `selectedIndex` directly, no local mirror needed
    }

    // ✅ Pattern B: sync prop → state when the prop changes. Use this
    //    when you also need a setter for in-widget overrides (e.g.,
    //    a dropdown that lets the user change index without leaving
    //    the widget).
    export default function MyWidget({ selectedIndex = "" }) {
        const [currentIndex, setCurrentIndex] = useState(selectedIndex);
        useEffect(() => {
            setCurrentIndex(selectedIndex);
        }, [selectedIndex]);
    }
    ```

    The frozen-prop bug is invisible in production because users typically
    save once and don't re-edit. The widget builder's live preview makes it
    visible immediately because every "Apply to preview" click is a prop
    update.

---

## Install-Time Permission Gate

When a user installs an `@ai-built/*` widget, the modal scans the widget's
code for `window.mainApi.<service>.<method>(` calls and shows an install-time
permission modal listing every method with grant/deny checkboxes. **Denied
methods throw at runtime** — the widget runs, but those specific calls fail.

Implications for widget design:

-   **Make method use deliberate.** A widget that calls `algolia.deleteRule`
    on mount is a worse UX than one that calls it only on a button click —
    the user is more likely to grant the permission they understand.
-   **Mention destructive methods in your chat response.** When you write a
    widget that calls `saveRule` / `deleteRule` / `partialUpdateObjects` /
    etc., say so in plain language so the user isn't surprised by the consent
    modal.
-   **Don't assume permissions.** A widget that fails because the user denied
    `deleteRule` should render a clear "permission denied" state, not crash.

---

## Reference Documents

Read these as needed during each phase:

| File                                                                         | When to Read                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`references/dash-react-components.md`](references/dash-react-components.md) | Before writing JSX — exact prop names + Tailwind safelist                    |
| [`references/mcp-integration.md`](references/mcp-integration.md)             | Phase 2 — MCP research, `useMcpProvider`, credential providers, IPC patterns |
| [`references/widget-development.md`](references/widget-development.md)       | Phases 1 & 3 — file structure, `.dash.js`, widget API, contexts, debugging   |
| [`references/packaging.md`](references/packaging.md)                         | Phase 5 — `package-widgets`, npm publishing, registry manifest               |

**Always read `references/dash-react-components.md` before writing widget
JSX.** The wrong prop name renders an empty component with no error — the #1
cause of "preview is black" bugs.
