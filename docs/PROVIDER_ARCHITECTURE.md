# Provider Architecture - Three-Tier Storage Model

## Overview

The provider system uses a three-tier architecture to separate concerns and enhance security:

1. **Workspace Configuration** (workspaces.json) - Provider NAMES only
2. **Encrypted Credentials** (providers.json) - Actual credentials
3. **Runtime Context** (ProviderContext) - Resolved provider instances

## Data Structure

### Tier 1: Workspace Configuration

**File:** `~/.userData/Dashboard/{appId}/workspaces.json`

```javascript
{
  "id": "dashboard-1",
  "displayName": "Analytics Dashboard",
  "layout": [...],
  "selectedProviders": {
    // Widget-specific provider selections
    "widget-widget-123": {
      "algolia": "Algolia Production",    // provider type -> provider name
      "slack": "Slack Dev"
    },
    "widget-widget-456": {
      "algolia": "Algolia Production",
      "customApi": "MyAPI v2"
    }
  }
}
```

**Key Points:**

-   Only stores **provider NAMES** (lookup keys)
-   Keyed by **widget ID** for widget-specific selection
-   Human-readable, non-sensitive data
-   Easy to version control and sync

### Tier 2: Encrypted Credentials

**File:** `~/.userData/Dashboard/{appId}/providers.json` (encrypted)

```javascript
{
  "Algolia Production": {
    "type": "algolia",
    "credentials": {
      "appId": "ABC123",
      "apiKey": "***encrypted***",
      "indexName": "production_index"
    }
  },
  "Slack Dev": {
    "type": "slack",
    "credentials": {
      "webhook": "https://hooks.slack.com/***encrypted***",
      "token": "***encrypted***"
    }
  },
  "MyAPI v2": {
    "type": "customApi",
    "credentials": {
      "endpoint": "https://api.example.com",
      "apiKey": "***encrypted***"
    }
  },
  "Slack MCP": {
    "type": "slack",
    "providerClass": "mcp",
    "mcpConfig": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-slack"],
      "envMapping": {
        "SLACK_BOT_TOKEN": "token"
      }
    },
    "credentials": {
      "token": "***encrypted***"
    }
  }
}
```

**Key Points:**

-   Stores **actual credentials** (encrypted in Electron)
-   Keyed by **provider name** for lookup
-   Sensitive data protected by Electron secure storage
-   Shared across all workspaces (one credential pool)

### Tier 3: Runtime Context

**In-Memory:** `AppContext.providers`

> **Note:** Providers live in `AppContext.providers`, NOT `DashboardContext.providers`. DashboardContext.providers is structurally empty due to component tree ordering.

```javascript
// AppContext.providers (loaded by AppWrapper at startup)
{
  "Algolia Production": { name: "Algolia Production", type: "algolia", providerClass: "credential", credentials: {...} },
  "Slack Dev": { name: "Slack Dev", type: "slack", providerClass: "credential", credentials: {...} },
  "MyAPI v2": { name: "MyAPI v2", type: "customApi", providerClass: "credential", credentials: {...} },
  "Slack MCP": { name: "Slack MCP", type: "slack", providerClass: "mcp", mcpConfig: {...}, credentials: {...} }
}
```

**Key Points:**

-   Loaded at app startup from providers.json into AppContext
-   Provides runtime lookup of credentials
-   Credential providers: accessed via `useContext(AppContext).providers`
-   MCP providers: accessed via `useMcpProvider("type")` hook (reads AppContext internally)
-   Updated when new providers are created

## Data Flow

### 1. Rendering with Existing Provider Selection

```
Dashboard.js loads workspace
  ↓
workspace.selectedProviders = {
  "widget-123": { "algolia": "Algolia Production" }
}
  ↓
LayoutBuilder → LayoutGridContainer
  ↓
renderComponentContainer extracts widget-specific selections:
  widgetSpecificSelections = workspace.selectedProviders[widgetId]
  // = { "algolia": "Algolia Production" }
  ↓
Widget receives: selectedProviders = { "algolia": "Algolia Production" }
  ↓
ProviderErrorBoundary checks AppContext.providers
  ↓
AppContext.providers["Algolia Production"]
  ↓
Returns { name, type, credentials }
  ↓
Widget renders normally with credentials available
```

### 2. User Selects New Provider

```
Widget requires provider but none selected
  ↓
ProviderErrorBoundary shows MissingProviderPrompt
  ↓
User opens ProviderSelector
  ↓
Lists existing providers from ProviderContext
OR
User creates new provider via ProviderForm
  ↓
ProviderForm collects credentials
  ↓
onProviderSelect callback fires:
  {
    name: "Algolia Production",
    credentials: { appId, apiKey, indexName }
  }
  ↓
Main app (dash/dash):
  1. Save credentials to providers.json (encrypted)
  2. Update ProviderContext with new provider
  3. Save provider NAME to workspace.selectedProviders
  ↓
ProviderErrorBoundary callback:
  {
    widgetId: "widget-123",
    selectedProviders: { "algolia": "Algolia Production" }
  }
  ↓
Dashboard.js.handleProviderSelect():
  workspace.selectedProviders[widgetId] = selectedProviders
  ↓
dashApi.saveWorkspace() persists to workspaces.json
```

### 3. MCP Provider: Widget Connects to MCP Server

```
MCP Widget mounts with providerClass: "mcp"
  ↓
useMcpProvider("slack") hook initializes
  ↓
Hook reads AppContext.providers
  ↓
Finds provider with providerClass: "mcp" and mcpConfig
  ↓
Calls dashApi.mcpStartServer(providerName, mcpConfig, credentials)
  ↓ IPC to main process
mcpController.startServer()
  ├─ Resolves env vars from credentials using mcpConfig.envMapping
  ├─ Spawns child process: npx -y @anthropic/mcp-server-slack
  ├─ Connects via stdio transport
  └─ Returns: { tools: [...], resources: [...] }
  ↓
Hook filters tools by allowedTools (if specified in .dash.js)
  ↓
Widget renders with tools list, calls callTool("send_message", args)
  ↓ IPC to main process
mcpController.callTool() validates allowedTools, forwards to child process
  ↓
Result returned to widget (30-second timeout)
  ↓
On unmount: dashApi.mcpStopServer() → mcpController kills child process
```

## Implementation Details

### ProviderErrorBoundary

-   **Receives:** `selectedProviders = { "algolia": "Algolia Production", ... }`
-   **Looks up:** ProviderContext.listProviders() for credentials
-   **Sends callback:** `{ widgetId, selectedProviders }`

### MissingProviderPrompt

-   **Receives:** `selectedProviders` (names only)
-   **Shows:** Providers from ProviderContext (with credentials to display in UI)
-   **Filters:** Excludes already-selected providers from "missing" list

### ProviderForm

-   **Collects:** User-entered credentials
-   **Callback:** `onSubmit(credentials)` → handled by main app
-   **Main app responsibility:**
    1. Encrypt and save to providers.json
    2. Update ProviderContext
    3. Return provider name for workspace storage

### Widget-Specific Selection

```javascript
// In LayoutGridContainer.renderComponentContainer():
const widgetSpecificSelections = workspace?.selectedProviders?.[id] || {};
// id = "widget-widget-123"
// Result: { "algolia": "Algolia Production", "slack": "Slack Dev" }
```

This allows:

-   Widget A uses "Algolia Production"
-   Widget B uses "Algolia Dev"
-   Widget C uses "MyAPI v2"
-   All in the same dashboard

## Security Model

1. **Credentials never in workspace.json** - Only names
2. **Credentials encrypted in providers.json** - Uses Electron secure storage
3. **Credentials in-memory only in ProviderContext** - Decrypted at runtime
4. **Credentials passed to widgets at render time** - Not persisted in component

## API Integration Points

### Dash Main App (dash/dash)

1. **Load providers at startup:**

    ```javascript
    const encrypted = readFile("~/.userData/Dashboard/{appId}/providers.json");
    const decrypted = electronSecureStorage.decrypt(encrypted);
    ProviderContext.init(decrypted);
    ```

2. **Save new provider:**

    ```javascript
    dashboardApi.saveProvider(name, type, credentials);
    // Encrypts credentials
    // Saves to providers.json
    // Updates ProviderContext
    // Returns success
    ```

3. **Widget loads provider by name:**
    ```javascript
    const provider = ProviderContext.getProvider("Algolia Production");
    // Returns { type, credentials, ... }
    ```

### Dash-React Library

1. **ProviderErrorBoundary:**

    - Accepts `selectedProviders: { type: "name", ... }`
    - Checks ProviderContext.listProviders()
    - Shows MissingProviderPrompt if missing

2. **MissingProviderPrompt:**

    - Shows available providers from ProviderContext
    - User selects or creates provider
    - Calls onProviderSelect callback

3. **Dashboard.handleProviderSelect:**
    - Receives selected provider name
    - Updates workspace.selectedProviders[widgetId]
    - Persists via workspaceApi.saveWorkspace()

## Example Scenario

**Setup:**

-   Dashboard "Analytics" with 2 widgets: Search, Results
-   Both need Algolia provider

**Step 1: User opens dashboard**

```
workspace.selectedProviders = {} (empty)
Both widgets show MissingProviderPrompt
```

**Step 2: User creates provider "Algolia Production"**

```
ProviderForm collects: { appId, apiKey, indexName }
Main app saves:
  - providers.json: "Algolia Production": { credentials: {...} }
  - ProviderContext updated
Callback received by Dashboard:
  { widgetId: "widget-search", selectedProviders: { algolia: "Algolia Production" } }
workspace.selectedProviders["widget-search"] = { algolia: "Algolia Production" }
Persisted to workspaces.json
```

**Step 3: Results widget needs different provider "Algolia Dev"**

```
User selects different provider in Results widget
Callback received:
  { widgetId: "widget-results", selectedProviders: { algolia: "Algolia Dev" } }
workspace.selectedProviders["widget-results"] = { algolia: "Algolia Dev" }
```

**Step 4: Dashboard reloads**

```
workspace.selectedProviders = {
  "widget-search": { algolia: "Algolia Production" },
  "widget-results": { algolia: "Algolia Dev" }
}
Search widget receives: selectedProviders = { algolia: "Algolia Production" }
Results widget receives: selectedProviders = { algolia: "Algolia Dev" }
Both look up credentials from ProviderContext and render normally
```

## Benefits

1. **Security:** Credentials encrypted, not in config files
2. **Flexibility:** Different widgets can use different providers
3. **Clarity:** Clear separation of concerns across tiers
4. **Persistence:** Provider selections survive app restart
5. **Reusability:** Credentials defined once, used by multiple widgets
6. **Auditability:** Easy to see which provider each widget uses
