# Provider Integration (MCP and Credential)

> **Two equal paths.** A widget connects to an external service via either
> MCP (`useMcpProvider`) or direct IPC (`useWidgetProviders` +
> `useProviderClient`). The path depends on what the project ships for that
> service. **Don't assume MCP is always the answer** — Algolia, OpenAI, and
> several others are credential-class providers with direct IPC.

## Table of Contents

1. Provider Class — Credential vs MCP
2. Why Both Architectures Exist
3. MCP Research Strategy
4. The MCP Architecture in Dash
5. Using `useMcpProvider` in Widgets (mcp class)
6. Using `useWidgetProviders` + IPC in Widgets (credential class)
7. Provider Configuration for Credentials
8. Mapping Provider Capabilities to Widget UI
9. Common Services and Their Provider Class

---

## 1. Provider Class — Credential vs MCP

Every widget that uses an external service declares one of two `providerClass`
values in its `.dash.js`:

| Class        | Hook                                       | When                                                                                        | IPC surface                                         |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `credential` | `useWidgetProviders` + `useProviderClient` | Service has a custom MCP server in dash-electron's main process exposing direct IPC methods | `window.mainApi.<service>.<method>(...)`            |
| `mcp`        | `useMcpProvider`                           | Service is reached via a generic MCP server                                                 | `mcp.callTool(name, args)` / `mcp.getResource(uri)` |

Look up the project's `src/AiAssistant/providerApiRegistry.js` to see which
services are `credential`-class and what methods they expose. Anything not in
the registry is `mcp`-class (or doesn't exist yet — ask the user).

---

## 2. Why Both Architectures Exist

---

Dash widgets are installed into the Electron app at runtime — they load without
recompiling the application. This means widgets can't bundle native dependencies
or make direct API calls easily. Instead, they communicate through one of two
broker layers in the Electron main process:

-   **MCP servers** (Model Context Protocol) for generic services. Same shape as
    the broader MCP ecosystem; widgets call `mcp.callTool(...)` and
    `mcp.getResource(...)`.
-   **Custom main-process IPC** for `credential`-class services where dash-electron
    ships a tailored backend (Algolia, OpenAI, etc.). Widgets call
    `window.mainApi.<service>.<method>(...)`. The IPC surface is registered in
    `src/AiAssistant/providerApiRegistry.js` and validated at compile time.

Both architectures provide:

-   **Runtime extensibility** — install new widgets without rebuilding
-   **Credential isolation** — the main process holds secrets, widgets never see raw keys
-   **Uniform interface within each class** — every MCP-class service looks the same to widget code; every credential-class service follows the same `useProviderClient` triplet pattern
-   **Offline capability** — both layers can cache responses

**Bottom line**: Before writing widget code, decide which class your service is
(see Section 1) and look up its capabilities. **Don't reach for `useMcpProvider`
by default** — if the service is `credential`-class, the MCP hook returns
nothing useful and you'll waste a build cycle.

---

## 3. MCP Research Strategy

When the user says "I want a widget for [Service X]", follow this process:

### Step 1: Search for existing MCP servers

Search in this order of preference:

1. **Official MCP servers** — Check https://github.com/modelcontextprotocol/servers
2. **npm registry** — Search npmjs.com for `mcp-server-[service]` or `@modelcontextprotocol/server-[service]`
3. **Community servers** — Search GitHub for `mcp server [service]`
4. **dash-core catalog** — Check the `electron/mcp/` directory in dash-core for
   pre-configured server definitions

### Step 2: Evaluate the MCP server

For each candidate MCP server, determine:

-   What **tools** does it expose? (These become widget actions)
-   What **resources** does it expose? (These become widget data sources)
-   What **credentials** does it need? (API keys, OAuth tokens, etc.)
-   Is it an **SSE (HTTP)** or **stdio** transport?
-   Is it actively maintained?

### Step 3: Map tools to widget features

Create a mapping table before writing code:

```
MCP Server: slack-mcp-server (korotovsky)
├── Tool: conversations_search_messages → Widget: Search bar + message list
├── Tool: conversations_add_message     → Widget: Compose panel
├── Tool: channels_list                 → Widget: Channel sidebar
├── Tool: conversations_history         → Widget: Message timeline
└── Credentials: SLACK_MCP_XOXB_TOKEN / SLACK_MCP_XOXP_TOKEN /
    (SLACK_MCP_XOXC_TOKEN + SLACK_MCP_XOXD_TOKEN)  — pick ONE mode
```

### Step 4: Document the provider requirements

List what credentials/config the MCP server needs. These will be configured through
Dash's provider system (see Section 5).

---

## 4. The MCP Architecture in Dash

```
Widget (renderer)          Main Process              External Service
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ useMcpProvider│────►│ mcpController       │     │              │
│  .callTool() │ IPC │  ├─ manages lifecycle│────►│ MCP Server   │
│  .getResource│◄────│  ├─ routes requests  │◄────│ (Slack, etc) │
│              │     │  └─ injects creds    │     │              │
└──────────────┘     └─────────────────────┘     └──────────────┘
```

**Key components from dash-core:**

| Component            | Layer            | Import Path                 | Role                                             |
| -------------------- | ---------------- | --------------------------- | ------------------------------------------------ |
| `mcpController`      | Electron (main)  | `@trops/dash-core/electron` | Manages MCP server lifecycle, routes IPC calls   |
| `useMcpProvider`     | Renderer (React) | `@trops/dash-core`          | Hook that gives widgets access to MCP tools      |
| `useWidgetProviders` | Renderer (React) | `@trops/dash-core`          | Hook for accessing provider credentials directly |
| `useDashboard`       | Renderer (React) | `@trops/dash-core`          | Hook for dashboard-level state and utilities     |
| `providerController` | Electron (main)  | `@trops/dash-core/electron` | Manages provider credentials securely            |
| `ProviderContext`    | Renderer (React) | `@trops/dash-core`          | React context for provider data                  |

---

## 5. Using `useMcpProvider` in Widgets (mcp class)

The `useMcpProvider` hook is the primary way widgets interact with MCP servers:

```javascript
import { useMcpProvider } from "@trops/dash-core";

export const MyWidget = ({ api, ...props }) => {
    // Connect to the MCP server by name
    const mcp = useMcpProvider("algolia");

    // Call a tool
    const handleSearch = async (query) => {
        const result = await mcp.callTool("search", {
            index: "products",
            query: query,
        });
        // result contains the MCP tool response
    };

    // Get a resource
    const loadData = async () => {
        const resource = await mcp.getResource("index://products");
        // resource contains the MCP resource data
    };

    // ...render UI with results
};
```

The hook handles:

-   Connection lifecycle (connect/disconnect with the MCP server)
-   Request routing through the main process IPC bridge
-   Error handling and reconnection
-   Credential injection (the widget never sees raw API keys)

---

## 6. Using `useWidgetProviders` + IPC in Widgets (credential class)

For services that ship a custom main-process backend in dash-electron — Algolia,
OpenAI, etc. — the widget calls `window.mainApi.<service>.<method>(...)`
directly. The pattern:

```javascript
import React, { useState, useEffect } from "react";
import {
    Panel,
    Heading,
    EmptyState,
    ErrorMessage,
    Skeleton,
} from "@trops/dash-react";
import { useWidgetProviders, useProviderClient } from "@trops/dash-core";

export default function AlgoliaIndexList({ title = "Algolia indices" }) {
    // Hooks first — Rules of Hooks. getProvider returns null when the provider
    // isn't configured yet, and useProviderClient(null) is safe (returns a
    // null-shaped handle).
    const { hasProvider, getProvider } = useWidgetProviders();
    const provider = getProvider("algolia");
    const pc = useProviderClient(provider);
    // pc.providerHash, pc.providerName, pc.dashboardAppId — pass these three
    // to every IPC method call. The credentials triplet identifies which
    // configured provider's credentials the main process should use.

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
                if (!cancelled) setIndices(Array.isArray(rows) ? rows : []);
            })
            .catch((err) => {
                if (!cancelled) setError(err);
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
                <ErrorMessage message={error.message || String(error)} />
            </Panel>
        );
    if (indices === null)
        return (
            <Panel>
                <Skeleton />
            </Panel>
        );
    return (
        <Panel>
            <Heading title={title} />
            {/* render indices */}
        </Panel>
    );
}
```

### The credentials triplet

`useProviderClient(provider)` returns `{ providerHash, providerName,
dashboardAppId }`. **Always pass all three to the IPC method**. The main
process uses them to look up the matching configured provider's credentials.

### Method names are validated at compile time

Every `window.mainApi.<service>.<method>(` call is checked against
`src/AiAssistant/providerApiRegistry.js`. **Hallucinated method names are
rejected at compile time** with a "Send error to AI" affordance for the user
to ask for a corrected version. Don't invent names — look up the registry first
(see SKILL.md "Available IPC Methods" section).

---

## 7. Provider Configuration — App-Level, Not Widget-Level

This is a common misconception to get right: **providers are configured once in the
Electron app, not in individual widgets.**

### How it works

1. The user opens the Dash Electron app's **Providers** settings
2. They add a provider (e.g., "Slack") with its MCP server URL and auth credentials
3. The Electron app stores this securely via `providerController`
4. **Any widget** that specifies it needs the "Slack" provider automatically gets
   access to the shared MCP connection

### What the widget does

The widget simply declares which provider it needs in its `.dash.js` `userConfig`,
then calls `useMcpProvider()` in the component. It never handles credentials or
connection setup:

```javascript
// In the widget component — that's it
const mcp = useMcpProvider("slack");
const channels = await mcp.callTool("list_channels", {});
```

The connection is already established by the Electron app. Multiple widgets can
share the same provider at runtime — a SlackChannels widget and a SlackMessages
widget both call `useMcpProvider("slack")` and share the same underlying MCP
connection. However, **every widget must declare its own `providers` array in its
`.dash.js` file** — the Electron app handles deduplication and credential sharing,
but each widget independently declares what it needs.

### What the widget does NOT do

-   Does not handle credential storage or injection
-   Does not manage MCP server lifecycle
-   Does not see raw API keys or tokens

**Important**: Providers are read from `AppContext.providers`, NOT `DashboardContext.providers`.
This is due to component tree ordering — DashboardWrapper renders before providers load.

For full provider architecture details, see:
https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md
https://github.com/trops/dash-core/blob/master/docs/WIDGET_PROVIDER_CONFIGURATION.md

---

## 8. Mapping Provider Capabilities to Widget UI

This is the creative part — deciding which dash-react components best represent the
data from each MCP tool. Here are common patterns:

| MCP Tool Type         | Widget UI Pattern         | dash-react Components                    |
| --------------------- | ------------------------- | ---------------------------------------- |
| `search` / `query`    | Search bar + results list | `Panel`, `InputText`, list rendering     |
| `list` / `get_all`    | Scrollable list or table  | `Panel`, `Menu`, `MenuItem`              |
| `get` / `read`        | Detail view / card        | `Panel`, `Heading`, `SubHeading`, `Text` |
| `create` / `write`    | Input + submit            | `InputText`, `CodeEditor`, `Button`      |
| `update` / `edit`     | Inline edit or modal      | `Modal`, `InputText`, `Button`           |
| `delete` / `remove`   | Confirmation dialog       | `Modal`, `Button`                        |
| `subscribe` / `watch` | Live-updating feed        | `Panel` with polling or event listeners  |
| `auth` / `connect`    | Settings/config panel     | Provider system (not widget UI)          |

### Example: Mapping a Google Drive MCP server

```
MCP Tool: list_files       → Panel with file list, using Menu + MenuItem
MCP Tool: get_file         → Detail Panel with Heading, Text, file preview
MCP Tool: search_files     → Search input + results list
MCP Tool: create_file      → Modal with Form for new file
MCP Tool: upload_file      → Drag-drop zone in Panel
MCP Resource: file://...   → Embedded file viewer using CodeRenderer
```

### Choosing the right dash-react component

The dash-react library provides these categories:

**Layout**: `Panel`, `DashPanel`, `Container`, `LayoutContainer`, `Header`, `SubHeader`,
`Footer`, `MainLayout`, `MainSection`, `MainContent`, `Workspace`, `Widget`

**Interactive**: `Button`, `ButtonIcon`, `Menu`, `MenuItem`, `Toggle`, `Modal`,
`Notification`, `SlidePanelOverlay`, `Tag`

**Input**: `InputText`, `CodeEditor`, `CodeRenderer`

**Utility**: `ErrorBoundary`, `ErrorMessage`, `Text`, `Draggable`

**All imported from `@trops/dash-react`** — never from `@dash/Common` or local paths.

When in doubt:

-   **Data display** → `Panel` + `Heading` + `Text`
-   **Lists** → `Menu` + `MenuItem` (for nav-like lists) or custom list in `Panel`
-   **Actions** → `Button` or `ButtonIcon`
-   **Rich content** → `CodeEditor` / `CodeRenderer`
-   **Overlays** → `Modal` or `SlidePanelOverlay`

---

## 9. Common Services and Their Provider Class

> **Authoritative source.** This table is illustrative — the project's
> `src/AiAssistant/providerApiRegistry.js` is the source of truth for which
> services are `credential`-class and what methods they expose. Always check
> the registry first.

| Service          | Typical class | Notes                                                                                                                                     |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Algolia          | `credential`  | Direct IPC: `listIndices`, `search`, `getSettings`, `setSettings`, `searchRules`, `saveRule`, `deleteRule`.                               |
| OpenAI / ChatGPT | `credential`  | Direct IPC for chat / embeddings.                                                                                                         |
| Slack            | `mcp`         | `slack-mcp-server` (korotovsky) — `conversations_search_messages`, `conversations_add_message`, `channels_list`, `conversations_history`. |
| Google Drive     | `mcp`         | `@modelcontextprotocol/server-google-drive` — `list_files`, `get_file`, `search_files`.                                                   |
| GitHub           | `mcp`         | `@modelcontextprotocol/server-github` — `search_repos`, `get_file_contents`, `create_issue`.                                              |
| Gmail            | `mcp`         | Community / Google Workspace MCP servers.                                                                                                 |
| Contentful       | `mcp`         | Community servers — `get_entries`, `get_content_types`.                                                                                   |

**Research is essential.** Don't assume these exact package names or tool
names — always search npm and GitHub for the current, actively-maintained
MCP server for the target service. The MCP ecosystem evolves quickly.

**For credential-class services**, the registry tells you which methods
exist; assume nothing beyond it. If the user asks for a method that's not in
the registry, ask before fabricating one — adding new IPC methods is a
separate change to dash-electron's main process.
