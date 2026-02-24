# Provider Context Integration - Complete Implementation

## Architecture Overview

Providers are fully integrated into the application context system, making them accessible to widgets through `AppContext.providers`.

> **Important:** Widgets access providers via `AppContext.providers`, NOT `DashboardContext.providers`. DashboardContext.providers is structurally empty because DashboardWrapper renders before AppWrapper finishes loading providers. This is a known architectural detail — always use AppContext for provider access.

## Data Flow

### Initialization (App Startup)

1. **Dash.js** (main app) - Renders Dashboard with ElectronDashboardApi
2. **DashboardWrapper** (dash-react) - Wraps children with contexts
3. **AppWrapper** (dash-react) - Initializes:
    - Settings via `dashApi.listSettings()`
    - **Providers via `dashApi.listProviders()`**
4. **Provider List Complete** - AppWrapper receives decrypted providers
    - Main app's `providerApi.listProvidersForApplication()` calls IPC handler
    - Main process's `providerController.listProviders()` decrypts all providers
    - Returns array: `[{ name, type, credentials, providerClass, mcpConfig? }, ...]`
5. **Store in AppContext** - AppWrapper stores providers in state
6. **Widget Access** - Widgets access providers via AppContext:

    **Credential providers:**

    ```javascript
    const app = useContext(AppContext);
    const providers = app.providers; // { "Algolia Production": {...}, ... }
    const myProvider = providers["Algolia Production"];
    const { credentials } = myProvider;
    ```

    **MCP providers:**

    ```javascript
    const { callTool, tools, isConnected } = useMcpProvider("slack");
    // Hook reads from AppContext.providers internally
    ```

## Files Modified

### dash-react Library

#### 1. `src/Context/DashboardContext.js`

-   Added `providers: {}` to context default value
-   Widgets and components can now access `useDashboard().dashboard.providers`

#### 2. `src/Context/DashboardWrapper.js`

-   Added import of `AppContext`
-   In `getValue()`, now reads `appContext?.providers` and passes to DashboardContext
-   Providers flow through: AppContext → DashboardContext → Dashboard/Widgets

#### 3. `src/Context/App/AppWrapper.js`

-   Added `providers` state: `const [providers, setProviders] = useState({})`
-   Added `isLoadingProviders` state to track loading status
-   Added `useEffect` to load providers on mount (after settings)
-   Implemented `loadProviders()` - Calls `dashApi.listProviders()`
-   Implemented `handleGetProvidersComplete()` - Converts array to object keyed by name
-   Implemented `handleGetProvidersError()` - Gracefully handles errors
-   Updated `getValue()` to include `providers: providers`
-   Providers now available to child components via AppContext

### Main App (dash/dash)

#### 1. `public/lib/api/providerApi.js`

-   Added dual-method approach:
    -   **Promise-based**: `listProviders()`, `saveProvider()`, `getProvider()`, `deleteProvider()`
    -   **Event-based**: `listProvidersForApplication()`, etc. (for ElectronDashboardApi compatibility)
-   Event-based methods use `ipcRenderer.invoke()` internally, then emit events via `ipcRenderer.send()`
-   This bridges the old event-listener pattern with modern IPC approach

## How Widgets Access Providers

### Method 1: Credential Providers (via AppContext)

```javascript
import { useContext } from "react";
import { AppContext } from "../Context/App/AppContext";

function MyWidget({ selectedProviders }) {
    const app = useContext(AppContext);
    const providers = app.providers;

    const selectedProviderName = selectedProviders?.algolia; // "Algolia Production"
    const provider = providers[selectedProviderName]; // Full provider object with credentials
    const { appId, apiKey } = provider.credentials;

    return <AlgoliaSearch appId={appId} apiKey={apiKey} />;
}
```

### Method 2: MCP Providers (via useMcpProvider hook)

```javascript
import { useMcpProvider } from "../hooks/useMcpProvider";

function MyWidget() {
    const { callTool, tools, isConnected, error } = useMcpProvider("slack");

    // Hook internally reads from AppContext.providers
    // Finds the MCP provider, connects to MCP server, filters tools

    if (!isConnected) return <p>Connecting...</p>;
    if (error) return <p>Error: {error}</p>;

    const handleSend = async () => {
        const result = await callTool("send_message", {
            channel: "#general",
            text: "Hello!",
        });
    };

    return <button onClick={handleSend}>Send</button>;
}
```

### Method 3: Combining with Widget Props

Widget receives:

-   `selectedProviders` - Provider NAMES selected for this widget (from workspace)
-   Access to `providers` via `AppContext` - Provider objects with credentials

```javascript
function MyWidget({ selectedProviders }) {
    const app = useContext(AppContext);

    // Look up the actual credentials
    const providerName = selectedProviders?.algolia;
    const provider = app.providers[providerName];

    if (!provider) {
        return <MissingProviderMessage />;
    }

    return <WidgetContent credentials={provider.credentials} />;
}
```

## Initialization Sequence Diagram

```
App Startup
    ↓
Dash.js renders Dashboard
    ↓
Dashboard wraps with DashboardWrapper
    ↓
DashboardWrapper wraps with AppWrapper
    ↓
AppWrapper.useEffect (on mount)
    ├─ loadSettings() → dashApi.listSettings()
    └─ loadProviders() → dashApi.listProviders()
    ↓
Main app receives IPC:
    ├─ WORKSPACE_LIST → settings
    └─ PROVIDER_LIST → providers from providerController
    ↓
Main process (electron.js):
    └─ providerController.listProviders()
        ├─ Reads providers.json
        ├─ Decrypts all credentials
        └─ Returns: { providers: [...] }  (both credential and mcp providers)
    ↓
AppWrapper receives data:
    ├─ setSettings()
    └─ setProviders()  →  stored in AppContext.providers
    ↓
Widgets render with providers available via AppContext
    ├─ Credential widgets: useContext(AppContext).providers
    └─ MCP widgets: useMcpProvider("type") → reads AppContext.providers internally
```

## State Management

### AppContext (from AppWrapper)

```javascript
{
  providers: {
    "Algolia Production": {
      name: "Algolia Production",
      type: "algolia",
      credentials: { appId: "...", apiKey: "..." }
    },
    "Slack Dev": {
      name: "Slack Dev",
      type: "slack",
      credentials: { webhook: "...", token: "..." }
    }
  }
}
```

### DashboardContext (from DashboardWrapper)

> **Note:** `DashboardContext.providers` is structurally empty at runtime. Providers are stored in `AppContext.providers` and should always be accessed from there.

```javascript
{
  providers: {},  // Empty — use AppContext.providers instead
  dashApi: ElectronDashboardApi,
  widgetApi: WidgetApi,
  // ... other properties
}
```

## Error Handling

-   If `listProviders()` fails, AppWrapper catches error and sets empty providers object
-   Widget rendering continues but shows no providers available
-   MCP connection errors are surfaced via `useMcpProvider` hook's `error` state

## Implementation Status

1. ✅ Provider API created with event-listener methods
2. ✅ IPC handlers registered in electron.js
3. ✅ AppWrapper loads providers on startup
4. ✅ Providers stored in AppContext
5. ✅ End-to-end flow verified: Create provider → Save → Load at startup → Widget access
6. ✅ MCP provider support: useMcpProvider hook, mcpController, McpServerPicker

## Testing Checklist

-   [x] Create a new provider via ProviderForm
-   [x] Verify it's saved to `~/.userData/Dashboard/{appId}/providers.json`
-   [x] Reload app
-   [x] Verify `app.providers` contains the provider (via AppContext)
-   [x] Widget can access credentials and use for API calls
-   [x] Error handling works if providers.json is missing or corrupted
-   [x] MCP provider: useMcpProvider connects, lists tools, calls tools

## Code Quality

-   All syntax validated ✓
-   Event-listener and Promise patterns both supported ✓
-   Graceful error handling ✓
-   Follows existing patterns in codebase ✓
-   No breaking changes to existing APIs ✓
