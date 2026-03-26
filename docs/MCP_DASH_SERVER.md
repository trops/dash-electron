# MCP Dash Server — Complete Reference

The MCP Dash Server is a built-in Model Context Protocol server that lets external LLM clients — Claude Desktop, Cursor, or any MCP-compatible agent — connect to your running Dash instance and control dashboards, widgets, themes, and providers programmatically.

**Quick links:** [Setup](#setup) | [Tools](#tools-19) | [Prompts](#prompts-3) | [Resources](#resources-5) | [Workflows](#common-workflows) | [Security](#security) | [Troubleshooting](#troubleshooting)

---

## Setup

### 1. Enable the Server

1. Run `npm run dev` to start the Dash application
2. Open **Settings** (click the user icon in the sidebar)
3. Go to **MCP Server**
4. Toggle **On**
5. Copy the **Bearer token** displayed

### 2. Configure Your MCP Client

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
    "mcpServers": {
        "dash": {
            "url": "http://127.0.0.1:3141/mcp",
            "headers": {
                "Authorization": "Bearer YOUR_TOKEN_HERE"
            }
        }
    }
}
```

Replace `YOUR_TOKEN_HERE` with the token from Settings. Restart Claude Desktop.

#### Cursor

Add an MCP server in Cursor settings with:

-   **URL:** `http://127.0.0.1:3141/mcp`
-   **Header:** `Authorization: Bearer YOUR_TOKEN_HERE`

#### Any MCP Client

The server uses the Streamable HTTP transport. Connect to:

-   **Endpoint:** `http://127.0.0.1:{port}/mcp`
-   **Default port:** `3141` (configurable in Settings)
-   **Auth:** Bearer token in the `Authorization` header
-   **Health check:** `GET /health` returns `{ status: "ok" }`

### 3. Verify Connection

Once connected, your LLM client should show the Dash MCP server with its tools, prompts, and resources.

---

## Tools (19)

### Dashboard Tools

#### `list_dashboards`

List all dashboards with their IDs, names, and widget counts.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

**Example response:**

```json
{
    "dashboards": [
        {
            "id": 1,
            "name": "DevOps",
            "widgetCount": 4,
            "active": true
        },
        {
            "id": 2,
            "name": "Analytics",
            "widgetCount": 2,
            "active": false
        }
    ]
}
```

---

#### `get_dashboard`

Get full details of a dashboard including layout, widgets, and theme.

| Parameter     | Type   | Required | Description                                    |
| ------------- | ------ | -------- | ---------------------------------------------- |
| `dashboardId` | string | No       | Dashboard ID. Omit to get the active dashboard |

**Example response:**

```json
{
    "dashboard": {
        "id": 1,
        "name": "DevOps",
        "layout": [
            {
                "id": 1,
                "component": "LayoutGridContainer",
                "parentId": 0,
                "config": { "columns": 2 }
            },
            {
                "id": 2,
                "component": "SlackWidget",
                "parentId": 1,
                "config": { "title": "Slack Feed" }
            }
        ],
        "theme": "Nordic Frost",
        "widgetCount": 1
    }
}
```

---

#### `create_dashboard`

Create a new empty dashboard.

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `name`    | string | **Yes**  | Display name for the dashboard |

**Returns:** The new dashboard ID. Use `add_widget` to populate it.

---

#### `delete_dashboard`

Delete a dashboard by ID. Cannot delete the last remaining dashboard.

| Parameter     | Type   | Required | Description                   |
| ------------- | ------ | -------- | ----------------------------- |
| `dashboardId` | string | **Yes**  | ID of the dashboard to delete |

---

#### `get_app_stats`

Get counts of dashboards, widgets, themes, and providers.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

**Example response:**

```json
{
    "dashboards": 3,
    "widgets": 12,
    "themes": 5,
    "providers": 2
}
```

---

### Widget Tools

#### `add_widget`

Add a widget to a dashboard by component name. Call `list_widgets` or `search_widgets` first to discover available names.

| Parameter     | Type   | Required | Description                                       |
| ------------- | ------ | -------- | ------------------------------------------------- |
| `widgetName`  | string | **Yes**  | Component name (e.g., `"SlackWidget"`, `"Clock"`) |
| `dashboardId` | string | No       | Dashboard ID. Omit to use the active dashboard    |

**Returns:** The widget instance ID (use with `configure_widget` or `remove_widget`).

**Tip:** Call this multiple times to add multiple widgets. Each call appends to the dashboard.

---

#### `remove_widget`

Remove a widget instance from a dashboard.

| Parameter     | Type   | Required | Description                                      |
| ------------- | ------ | -------- | ------------------------------------------------ |
| `widgetId`    | string | **Yes**  | ID of the widget instance (from `get_dashboard`) |
| `dashboardId` | string | No       | Dashboard ID. Omit to use the active dashboard   |

---

#### `configure_widget`

Update a widget's configuration. The config object is merged into the existing config (partial update).

| Parameter     | Type   | Required | Description                                    |
| ------------- | ------ | -------- | ---------------------------------------------- |
| `widgetId`    | string | **Yes**  | ID of the widget instance                      |
| `config`      | object | **Yes**  | Configuration to merge into existing config    |
| `dashboardId` | string | No       | Dashboard ID. Omit to use the active dashboard |

**Tip:** Use `get_dashboard` to see current widget configs and discover valid config keys.

**Example:**

```json
{
    "widgetId": "2",
    "config": {
        "title": "PR Activity",
        "showClosed": false
    }
}
```

---

#### `list_widgets`

List all available widgets from the registry.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

**Returns:** Widget name, display name, description, icon, and provider requirements for each available widget.

---

#### `search_widgets`

Search the widget registry by keyword.

| Parameter | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `query`   | string | **Yes**  | Keyword to match against names, descriptions, tags |

**Example:**

```json
{ "query": "slack" }
```

**Returns:** Matching widgets with name, description, and provider info. Use the `name` field with `add_widget`.

---

### Theme Tools

#### `list_themes`

List all saved themes with their names and active state.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

---

#### `get_theme`

Get full details of a theme including all color values and shade mappings.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `name`    | string | **Yes**  | Name of the theme to get |

---

#### `create_theme`

Create a new theme from a colors object.

| Parameter | Type   | Required | Description                          |
| --------- | ------ | -------- | ------------------------------------ |
| `name`    | string | **Yes**  | Display name for the theme           |
| `colors`  | object | **Yes**  | Color role keys mapped to hex values |

**Color roles:**

| Role        | Maps to                                    | Example     |
| ----------- | ------------------------------------------ | ----------- |
| `primary`   | Buttons, links, active states, focus rings | `"#3b82f6"` |
| `secondary` | Backgrounds, cards, panels, containers     | `"#10b981"` |
| `tertiary`  | Accents, badges, highlights, notifications | `"#f59e0b"` |

**Example:**

```json
{
    "name": "Corporate Blue",
    "colors": {
        "primary": "#3b82f6",
        "secondary": "#10b981",
        "tertiary": "#f59e0b"
    }
}
```

**Tip:** After creating, use `apply_theme` to activate it.

---

#### `create_theme_from_url`

Extract brand colors from a website URL and generate a matching theme. Loads the page in a hidden browser, extracts colors from meta tags, CSS variables, computed styles, and favicons.

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `url`     | string | **Yes**  | Website URL (must start with `http://` or `https://`) |
| `name`    | string | No       | Theme name. If omitted, derived from the URL hostname |

**Example:**

```json
{ "url": "https://stripe.com" }
```

**Note:** Takes a few seconds to process. Works best with pages that have visible brand colors. After creation, use `apply_theme` to activate.

---

#### `apply_theme`

Apply a saved theme to the active dashboard.

| Parameter | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `name`    | string | **Yes**  | Name of the theme to apply |

**Tip:** Use `list_themes` to see available themes, or create one first with `create_theme` or `create_theme_from_url`.

---

### Provider Tools

#### `list_providers`

List all configured providers with their names, types, and classes. Credential secrets are never returned.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

---

#### `add_provider`

Add a new provider configuration. Supports credential providers (API keys) and MCP providers (server connections).

| Parameter       | Type     | Required | Description                                                               |
| --------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `name`          | string   | **Yes**  | Unique display name (e.g., `"My GitHub"`)                                 |
| `type`          | string   | **Yes**  | Provider type (e.g., `"github"`, `"slack"`, `"algolia"`)                  |
| `credentials`   | object   | **Yes**  | Credentials object. Encrypted at rest, never returned                     |
| `providerClass` | string   | No       | `"credential"` (default) or `"mcp"`                                       |
| `mcpConfig`     | object   | No       | MCP server config (transport, command, args, envMapping). For `mcp` class |
| `allowedTools`  | string[] | No       | Restrict which MCP tools are available. For `mcp` class                   |

**Common provider credentials:**

| Service | Type      | Credentials                                |
| ------- | --------- | ------------------------------------------ |
| GitHub  | `github`  | `{ token: "ghp_..." }`                     |
| Slack   | `slack`   | `{ botToken: "xoxb-...", teamId: "T..." }` |
| Algolia | `algolia` | `{ appId: "...", apiKey: "..." }`          |
| Notion  | `notion`  | `{ apiKey: "ntn_..." }`                    |
| OpenAI  | `openai`  | `{ apiKey: "sk-..." }`                     |

**Example (credential provider):**

```json
{
    "name": "My GitHub",
    "type": "github",
    "credentials": { "token": "ghp_abc123" },
    "providerClass": "mcp"
}
```

**Example (MCP provider with tool scoping):**

```json
{
    "name": "Slack Read-Only",
    "type": "slack",
    "credentials": { "botToken": "xoxb-...", "teamId": "T..." },
    "providerClass": "mcp",
    "allowedTools": ["list_channels", "read_channel"]
}
```

---

#### `remove_provider`

Remove a provider and its stored credentials permanently.

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `name`    | string | **Yes**  | Name of the provider to remove |

---

### Guide Tools

#### `get_setup_guide`

Get a contextual setup guide with step-by-step instructions.

| Parameter | Type   | Required | Description                                                              |
| --------- | ------ | -------- | ------------------------------------------------------------------------ |
| `topic`   | string | No       | One of: `"dashboard"`, `"theme"`, `"provider"`, `"widget"`, `"overview"` |

Omit `topic` or use `"overview"` for a general capabilities guide.

---

## Prompts (3)

Prompts are guided entry points that appear as suggested actions in MCP clients like Claude Desktop. They return structured messages that guide the LLM through multi-step workflows using the tools above.

### `build-dashboard`

Build a new dashboard step by step. Guides through widget discovery, dashboard creation, widget addition, and configuration.

| Argument      | Required | Description                                                                                     |
| ------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `description` | **Yes**  | Describe the dashboard you want (e.g., "a DevOps dashboard with Slack and GitHub")              |
| `style`       | No       | `"minimal"` (few key widgets), `"detailed"` (comprehensive), or `"monitoring"` (status-focused) |

**How it works:** Returns a plan that the LLM executes by calling `search_widgets`, `list_providers`, `create_dashboard`, `add_widget`, and `configure_widget` in sequence.

**Example usage in Claude Desktop:**

> Use the `build-dashboard` prompt with: "a customer support dashboard with Slack messages and GitHub issues"

---

### `design-theme`

Create a custom color theme. Supports brand colors, website URL extraction, or manual color selection.

| Argument       | Required | Description                                              |
| -------------- | -------- | -------------------------------------------------------- |
| `brandName`    | No       | Brand or company name (e.g., "Stripe")                   |
| `primaryColor` | No       | Primary color as hex or name (e.g., "#3b82f6" or "blue") |
| `url`          | No       | Website URL to extract brand colors from                 |

**How it works:** Based on the provided arguments, returns instructions for using `create_theme` (from colors) or `create_theme_from_url` (from URL), followed by `apply_theme`.

**Example usage:**

> Use the `design-theme` prompt with url: "https://stripe.com"

---

### `setup-provider`

Connect an external service to Dash. Guides through getting credentials and configuring the provider.

| Argument  | Required | Description                                                                 |
| --------- | -------- | --------------------------------------------------------------------------- |
| `service` | No       | Service to connect (e.g., "slack", "github", "algolia", "notion", "openai") |

**How it works:** If a specific service is provided, returns step-by-step instructions for obtaining credentials and the exact `add_provider` call to make. If no service is specified, lists all available services.

**Supported services:** GitHub, Slack, Algolia, Notion, OpenAI, Google Drive, Gmail, Google Calendar, Brave Search, Gong, Filesystem

**Example usage:**

> Use the `setup-provider` prompt with service: "slack"

---

## Resources (5)

Resources provide read-only snapshots of application state. MCP clients can read these to understand the current context.

| Resource         | URI                        | Description                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------------- |
| Active Dashboard | `dash://dashboards/active` | Current active dashboard — layout, widgets, theme, and widget count |
| All Dashboards   | `dash://dashboards`        | Summary of all dashboards — IDs, names, widget counts, active state |
| All Themes       | `dash://themes`            | All saved themes — names, active state, and color definitions       |
| All Providers    | `dash://providers`         | All configured providers — names, types, classes (no secrets)       |
| App Info         | `dash://app/info`          | Application info — version, appId, and aggregate counts             |

---

## Common Workflows

### Build a Dashboard from Scratch

```
1. search_widgets("slack")           → find Slack widgets
2. search_widgets("github")          → find GitHub widgets
3. list_providers()                   → check existing connections
4. create_dashboard("DevOps")        → create the dashboard (returns ID)
5. add_widget("SlackWidget")         → add Slack widget (returns instance ID)
6. add_widget("GitHubPRList")        → add GitHub PR widget
7. configure_widget(id, config)       → set titles and options
8. create_theme_from_url("https://...")  → create a matching theme
9. apply_theme("theme-name")         → apply the theme
```

### Create and Apply a Theme

```
1. create_theme("Ocean", { primary: "#0ea5e9", secondary: "#0f172a", tertiary: "#f59e0b" })
2. apply_theme("Ocean")
```

Or from a website:

```
1. create_theme_from_url("https://stripe.com")
2. list_themes()                     → find the generated theme name
3. apply_theme("stripe.com")
```

### Connect a Service

```
1. add_provider({
     name: "GitHub",
     type: "github",
     credentials: { token: "ghp_..." },
     providerClass: "mcp"
   })
2. list_providers()                  → verify it's connected
```

### Inspect Current State

```
1. get_app_stats()                   → overview of everything
2. get_dashboard()                   → active dashboard details
3. list_widgets()                    → what's available to add
4. list_themes()                     → what themes exist
5. list_providers()                  → what services are connected
```

---

## Security

-   **Localhost only** — the server binds to `127.0.0.1` and is never exposed to the network
-   **Bearer token** — every request must include the `Authorization` header with the correct token
-   **No secrets in responses** — credential values are never returned by any tool or resource
-   **Encrypted storage** — all provider credentials are encrypted at rest
-   **Rate limiting** — 60 requests per minute per IP to prevent abuse
-   **Token regeneration** — generate a new token at any time from Settings > MCP Server

---

## Configuration

| Setting | Default             | Location              |
| ------- | ------------------- | --------------------- |
| Port    | `3141`              | Settings > MCP Server |
| Token   | Auto-generated UUID | Settings > MCP Server |
| Enabled | Off                 | Settings > MCP Server |

The server auto-starts when enabled and the app launches. It shuts down gracefully when the app closes.

---

## Troubleshooting

| Problem                                | Cause                                | Solution                                                          |
| -------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Claude Desktop doesn't show Dash tools | Config not loaded                    | Restart Claude Desktop after editing config. Check JSON syntax    |
| "Unauthorized" errors                  | Token mismatch                       | Copy the token from Settings > MCP Server. Ensure no extra spaces |
| "Connection refused"                   | Server not running                   | Ensure `npm run dev` is running and MCP Server is enabled         |
| Tools return empty results             | No data in the app                   | Create dashboards, install widgets, or add themes first           |
| `create_theme_from_url` fails          | URL unreachable or no visible colors | Try a different URL. Works best with pages that have brand colors |
| Rate limit errors                      | Too many requests                    | Wait 1 minute. Limit is 60 requests/minute                        |
| Port conflict                          | Another service on 3141              | Change the port in Settings > MCP Server                          |

---

**Related Documentation:**

-   [Developer Guide](./DEVELOPER_GUIDE.md) — Section 8 covers MCP Dash Server overview
-   [README](../README.md#mcp-dash-server) — Quick setup guide
-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md) — How providers work under the hood
