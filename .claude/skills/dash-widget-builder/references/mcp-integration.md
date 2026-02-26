# MCP Integration

## Table of Contents

1. Why MCP is Central to Dash Widgets
2. MCP Research Strategy
3. The MCP Architecture in Dash
4. Using `useMcpProvider` in Widgets
5. Provider Configuration for Credentials
6. Mapping MCP Tools to Widget UI
7. Common MCP Servers and Their Tools

---

## 1. Why MCP is Central to Dash Widgets

Dash widgets are installed into the Electron app at runtime — they load without
recompiling the application. This means widgets can't bundle native dependencies or
make direct API calls easily. Instead, they communicate through **MCP (Model Context
Protocol)** servers, which the Electron main process brokers.

This architecture provides:

-   **Runtime extensibility** — install new widgets without rebuilding
-   **Credential isolation** — the main process holds secrets, widgets never see raw keys
-   **Uniform interface** — every external service looks the same to widget code
-   **Offline capability** — MCP servers can cache and queue requests

**Bottom line**: Before writing any widget code, you need to know which MCP server
provides the data and what tools it exposes. This research phase is not optional.

---

## 2. MCP Research Strategy

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
MCP Server: @modelcontextprotocol/server-slack
├── Tool: search_messages    → Widget: Search bar + message list
├── Tool: send_message       → Widget: Compose panel
├── Tool: list_channels      → Widget: Channel sidebar
├── Resource: channel_history → Widget: Message timeline
└── Credential: SLACK_TOKEN  → Provider: OAuth setup
```

### Step 4: Document the provider requirements

List what credentials/config the MCP server needs. These will be configured through
Dash's provider system (see Section 5).

---

## 3. The MCP Architecture in Dash

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

## 4. Using `useMcpProvider` in Widgets

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

## 5. Provider Configuration — App-Level, Not Widget-Level

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

## 6. Mapping MCP Tools to Widget UI

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

## 7. Common MCP Servers and Their Tools

When researching MCP servers, these are common ones that Dash widgets integrate with.
Always verify current availability — MCP servers are actively developed and new ones
appear frequently.

| Service          | MCP Server (typical)                        | Key Tools                                           |
| ---------------- | ------------------------------------------- | --------------------------------------------------- |
| Algolia          | `@modelcontextprotocol/server-algolia`      | `search`, `browse_index`, `get_object`              |
| Slack            | `@modelcontextprotocol/server-slack`        | `search_messages`, `send_message`, `list_channels`  |
| Google Drive     | `@modelcontextprotocol/server-google-drive` | `list_files`, `get_file`, `search_files`            |
| GitHub           | `@modelcontextprotocol/server-github`       | `search_repos`, `get_file_contents`, `create_issue` |
| Contentful       | Community servers                           | `get_entries`, `get_content_types`, `search`        |
| Gmail            | Community / Google workspace                | `search_emails`, `get_email`, `send_email`          |
| OpenAI / ChatGPT | Various community servers                   | `chat_completion`, `create_embedding`               |

**Research is essential.** Don't assume these exact package names or tool names — always
search npm and GitHub to find the current, actively-maintained MCP server for the target
service. The MCP ecosystem evolves quickly.
