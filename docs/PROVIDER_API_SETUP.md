# Provider API Implementation - Main App (dash/dash)

## Summary

The main app (dash/dash) now has full support for provider (credentials) management. Users can create providers through the dash-react UI, and the main app will securely store their encrypted credentials.

## Files Created

### 1. `/public/lib/events/providerEvents.js`

Event constants for IPC communication between renderer and main process:

-   `PROVIDER_SAVE` - Save a new provider
-   `PROVIDER_LIST` - List all providers
-   `PROVIDER_GET` - Get a specific provider
-   `PROVIDER_DELETE` - Delete a provider

### 2. `/public/lib/api/providerApi.js`

Renderer process API for communicating with the main process. Exposes four methods:

-   `saveProvider(appId, providerName, providerType, credentials)` - Save encrypted credentials
-   `listProviders(appId)` - Get list of all available providers with decrypted credentials
-   `getProvider(appId, providerName)` - Get specific provider with decrypted credentials
-   `deleteProvider(appId, providerName)` - Delete a provider

### 3. `/public/lib/controller/providerController.js`

Main process controller for provider management:

-   **Encryption:** Uses Electron's `safeStorage.encryptString()` to encrypt credentials
-   **Storage:** Saves encrypted providers to `~/.userData/Dashboard/{appId}/providers.json`
-   **Format:** Each provider stored as:
    ```json
    {
        "providerName": {
            "type": "algolia",
            "credentials": "base64-encrypted-json",
            "dateCreated": "2026-02-08T...",
            "dateUpdated": "2026-02-08T..."
        }
    }
    ```
-   **Methods:**
    -   `saveProvider(win, appId, providerName, providerType, credentials)`
    -   `listProviders(win, appId)` - Returns all providers with decrypted credentials
    -   `getProvider(win, appId, providerName)` - Returns single provider with credentials
    -   `deleteProvider(win, appId, providerName)`

## Files Modified

### 1. `/public/lib/events/index.js`

-   Added import: `const providerEvents = require("./providerEvents");`
-   Added to exports: `...providerEvents`

### 2. `/public/lib/api/mainApi.js`

-   Added import: `const providerApi = require("./providerApi");`
-   Added to mainApi object: `providers: providerApi`
-   Now available in renderer as `window.mainApi.providers`

### 3. `/public/lib/controller/index.js`

-   Added imports for all provider functions
-   Added to module exports: `saveProvider, listProviders, getProvider, deleteProvider`

### 4. `/public/electron.js`

-   Added imports for provider controller functions and events
-   Registered 4 IPC handlers:
    -   `ipcMain.handle(PROVIDER_SAVE, ...)` - Save new provider with encrypted credentials
    -   `ipcMain.handle(PROVIDER_LIST, ...)` - List all providers
    -   `ipcMain.handle(PROVIDER_GET, ...)` - Get specific provider
    -   `ipcMain.handle(PROVIDER_DELETE, ...)` - Delete provider

## Data Flow

### Creating a New Provider

1. **dash-react UI** (`ProviderForm.js`): User enters provider name and credentials, submits form
2. **ProviderSelector callback**: Receives `{ name: "Algolia Production", credentials: {...} }`
3. **Dashboard.js**: Calls `providerApi.saveProvider(appId, name, type, credentials)`
4. **Renderer IPC**: Invokes `PROVIDER_SAVE` event with all data
5. **Main Process** (`electron.js`): Routes to `providerController.saveProvider()`
6. **Controller**: Encrypts credentials, saves to `providers.json`, notifies renderer
7. **Workspace**: Provider NAME is saved to `workspace.selectedProviders[widgetId][type]`
8. **Credentials**: Only encrypted file is saved, never stored in workspace

### Loading Providers (App Startup)

1. Main process calls `listProviders()` (needs to be integrated into app initialization)
2. Controller reads `providers.json`
3. Decrypts all credentials using `safeStorage.decryptString()`
4. Returns array of providers with decrypted credentials
5. ProviderContext is populated with decrypted providers
6. Widgets can request credentials by provider name at runtime

### Widget Gets Credentials

1. Widget checks `selectedProviders[widgetId]["algolia"]` = "Algolia Production"
2. Widget requests provider details from ProviderContext
3. ProviderContext looks up "Algolia Production" in in-memory cache
4. Returns decrypted credentials to widget for API calls

## Integration Checklist

### Still Needed in dash/dash

-   [ ] Call `providerController.listProviders()` during app startup to initialize ProviderContext
-   [ ] Implement ProviderContextProvider in main app to hold decrypted providers in memory
-   [ ] Pass ProviderContext through to widget components during initialization
-   [ ] Handle errors from `PROVIDER_SAVE_ERROR`, `PROVIDER_LIST_ERROR`, etc.

### dash-react Library (COMPLETE)

-   [x] ProviderErrorBoundary detects missing providers
-   [x] ProviderForm collects name + credentials
-   [x] ProviderSelector shows UI for creating/selecting providers
-   [x] Dashboard.js handles `onProviderSelect` callbacks
-   [x] selectedProviders stored in workspace with widget-specific keys
-   [x] Widget rendering passes selectedProviders and onProviderSelect

## API Usage Examples

### From dash-react (renderer process)

```javascript
import { providerApi } from "./api/providerApi";

// Save a new provider
providerApi.saveProvider(appId, "Algolia Production", "algolia", {
    appId: "ABC123",
    apiKey: "secret",
    indexName: "products",
});

// List all available providers
providerApi.listProviders(appId).then((providers) => {
    // providers = [
    //   { name: "Algolia Production", type: "algolia", credentials: {...} },
    //   { name: "Slack Dev", type: "slack", credentials: {...} }
    // ]
});

// Get specific provider with credentials
providerApi.getProvider(appId, "Algolia Production").then((provider) => {
    // provider = { name, type, credentials }
});

// Delete provider
providerApi.deleteProvider(appId, "Algolia Production");
```

### From ProviderContext (widget runtime)

```javascript
const { providers, getProvider, hasProvider } = useContext(ProviderContext);

if (hasProvider("Algolia Production")) {
    const provider = getProvider("Algolia Production");
    const { appId, apiKey } = provider.credentials;
    // Use credentials for API calls
}
```

## Security Considerations

1. **Encryption in Transit:** Uses Electron's native `safeStorage` API
2. **Storage Location:** `~/.userData/Dashboard/{appId}/providers.json` is user-specific
3. **Credentials Never in Workspace:** Only provider NAMES stored in workspace.json
4. **In-Memory Decryption:** Credentials decrypted once at startup and held in ProviderContext
5. **No Logging:** Credentials not logged to console or files
6. **File Permissions:** Stored in user's home directory with standard OS permissions

## Testing

All syntax checks pass:

-   ✓ providerApi.js
-   ✓ providerController.js
-   ✓ providerEvents.js
-   ✓ mainApi.js (updated)
-   ✓ events/index.js (updated)
-   ✓ controller/index.js (updated)
-   ✓ electron.js (updated with IPC handlers)

## Next Steps

1. Integrate ProviderContext initialization into app startup (main.js or app.js)
2. Test end-to-end: Create provider → Save to file → Load at startup → Use in widget
3. Add error handling UI for provider operations
4. Consider adding provider edit/update functionality
5. Document provider credential schema for each provider type (Algolia, Slack, etc.)
