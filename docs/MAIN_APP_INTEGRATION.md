# Main App Integration Checklist

This document outlines what the Electron app (dash-electron) needs to implement to work with the provider system from `@trops/dash-core` and `@trops/dash-react`.

## 1. Provider Storage APIs

### 1.1 Save Provider (When user creates new provider)

**API:** `dashboardController.saveProvider(appId, providerName, providerType, credentials)`

**Location:** `dash/public/lib/controller/providerController.js` (new file)

**Responsibility:**

1. Encrypt credentials using Electron secure storage
2. Save encrypted credentials to `~/.userData/Dashboard/{appId}/providers.json`
3. Update ProviderContext in-memory

**Example:**

```javascript
function saveProvider(appId, providerName, providerType, credentials) {
    try {
        // 1. Encrypt credentials
        const encrypted = secureStorage.encrypt(JSON.stringify(credentials));

        // 2. Read existing providers
        const filePath =
            app.getPath("userData") + `/Dashboard/${appId}/providers.json`;
        let providers = readJson(filePath) || {};

        // 3. Add/update provider
        providers[providerName] = {
            type: providerType,
            credentials: encrypted,
            dateCreated: new Date().toISOString(),
        };

        // 4. Save to file
        writeJson(filePath, providers);

        // 5. Update ProviderContext (in-memory)
        ProviderContext.addProvider(providerName, providerType, credentials);

        return { success: true, providerName };
    } catch (error) {
        console.error("Error saving provider:", error);
        return { success: false, error: error.message };
    }
}
```

### 1.2 Load Providers (When app starts)

**Location:** Main Electron process (during app initialization)

**Responsibility:**

1. Read encrypted providers.json
2. Decrypt all credentials
3. Initialize ProviderContext with providers

**Example:**

```javascript
async function initializeProviderContext(appId) {
    try {
        const filePath =
            app.getPath("userData") + `/Dashboard/${appId}/providers.json`;
        const encrypted = readJson(filePath) || {};

        const providers = {};
        Object.entries(encrypted).forEach(([name, data]) => {
            const credentials = JSON.parse(
                secureStorage.decrypt(data.credentials)
            );
            providers[name] = {
                type: data.type,
                credentials,
                dateCreated: data.dateCreated,
            };
        });

        // Initialize ProviderContext (make available to renderer process)
        ProviderContext.init(providers);
    } catch (error) {
        console.error("Error loading providers:", error);
    }
}
```

### 1.3 Get Provider (When widget needs credentials)

**API:** `ProviderContext.getProvider(providerName)`

**Returns:**

```javascript
{
  name: "Algolia Production",
  type: "algolia",
  credentials: {
    appId: "ABC123",
    apiKey: "***actual-key***",
    indexName: "production"
  }
}
```

### 1.4 List Providers (For ProviderSelector UI)

**API:** `ProviderContext.listProviders()`

**Returns:**

```javascript
[
    {
        name: "Algolia Production",
        type: "algolia",
        credentials: { appId, apiKey, indexName },
    },
    {
        name: "Slack Dev",
        type: "slack",
        credentials: { webhook, token },
    },
];
```

## 2. IPC Handler Integration

### 2.1 Register new IPC handler for saving providers

**Location:** `dash/public/lib/events/providerEvents.js` (new file)

```javascript
const { ipcMain } = require("electron");

function registerProviderHandlers() {
    // Save new provider
    ipcMain.handle(
        "PROVIDER_SAVE",
        (event, appId, providerName, providerType, credentials) => {
            return providerController.saveProvider(
                appId,
                providerName,
                providerType,
                credentials
            );
        }
    );

    // List providers
    ipcMain.handle("PROVIDER_LIST", (event, appId) => {
        return ProviderContext.listProviders();
    });

    // Get provider details
    ipcMain.handle("PROVIDER_GET", (event, appId, providerName) => {
        return ProviderContext.getProvider(providerName);
    });
}

module.exports = { registerProviderHandlers };
```

## 3. Frontend API Integration

### 3.1 Create Provider API in Electron main process

**Location:** `electron/api/providerApi.js` (in @trops/dash-core)

```javascript
export const providerApi = {
    saveProvider: (
        appId,
        providerName,
        providerType,
        credentials,
        onSuccess,
        onError
    ) => {
        if (window.mainApi?.invoke) {
            window.mainApi
                .invoke(
                    "PROVIDER_SAVE",
                    appId,
                    providerName,
                    providerType,
                    credentials
                )
                .then(onSuccess)
                .catch(onError);
        }
    },

    listProviders: (appId, onSuccess, onError) => {
        if (window.mainApi?.invoke) {
            window.mainApi
                .invoke("PROVIDER_LIST", appId)
                .then(onSuccess)
                .catch(onError);
        }
    },

    getProvider: (appId, providerName, onSuccess, onError) => {
        if (window.mainApi?.invoke) {
            window.mainApi
                .invoke("PROVIDER_GET", appId, providerName)
                .then(onSuccess)
                .catch(onError);
        }
    },
};
```

### 3.2 Update Dashboard component to use provider API

**Location:** `dash/src/Dashboard.js` (or wherever provider selection happens)

```javascript
import { providerApi } from "./api/providerApi";

function handleProviderSelect(event) {
    const { widgetId, selectedProviders } = event;

    // Provider selection (provider NAMES) are handled by dash-react
    // and saved to workspace.selectedProviders via workspaceApi

    // But if a NEW provider was created, we need to save credentials:
    if (event.newProviderCredentials) {
        providerApi.saveProvider(
            credentials.appId,
            event.newProviderName,
            event.newProviderType,
            event.newProviderCredentials,
            (result) => {
                console.log("Provider saved:", result);
                // Now workspace can reference this provider by name
            },
            (error) => {
                console.error("Failed to save provider:", error);
            }
        );
    }

    // Save workspace with provider selections (names only)
    saveWorkspaceWithProviders(widgetId, selectedProviders);
}
```

## 4. ProviderContext Implementation

### 4.1 ProviderContext for dash-react library

**Location:** `dash-react/src/Context/ProviderContext.js` (enhance existing)

```javascript
import React from "react";

export const ProviderContext = React.createContext({
    providers: {},

    // List all available providers
    listProviders: () => [],

    // Get provider by name (with credentials)
    getProvider: (name) => null,

    // Check if provider exists
    hasProvider: (name) => false,

    // Get providers by type
    getProvidersByType: (type) => [],
});

export const ProviderContextProvider = ({ children }) => {
    const [providers, setProviders] = React.useState({});

    const listProviders = React.useCallback(() => {
        return Object.entries(providers).map(([name, data]) => ({
            name,
            type: data.type,
            credentials: data.credentials,
        }));
    }, [providers]);

    const getProvider = React.useCallback(
        (name) => {
            return providers[name] || null;
        },
        [providers]
    );

    const hasProvider = React.useCallback(
        (name) => {
            return name in providers;
        },
        [providers]
    );

    const getProvidersByType = React.useCallback(
        (type) => {
            return Object.entries(providers)
                .filter(([_, data]) => data.type === type)
                .map(([name, data]) => ({
                    name,
                    type: data.type,
                    credentials: data.credentials,
                }));
        },
        [providers]
    );

    // Called by main app to initialize providers
    const initProviders = React.useCallback((providerData) => {
        setProviders(providerData);
    }, []);

    // Called by main app when new provider is created
    const addProvider = React.useCallback((name, type, credentials) => {
        setProviders((prev) => ({
            ...prev,
            [name]: { type, credentials },
        }));
    }, []);

    const value = {
        providers,
        listProviders,
        getProvider,
        hasProvider,
        getProvidersByType,
        initProviders,
        addProvider,
    };

    return (
        <ProviderContext.Provider value={value}>
            {children}
        </ProviderContext.Provider>
    );
};
```

## 5. File Structure

After implementation, the structure should be:

```
dash/
  public/
    lib/
      api/
        providerApi.js (new) ← Frontend API for IPC
        workspaceApi.js (existing)
      controller/
        providerController.js (new) ← Backend provider persistence
        workspaceController.js (existing)
      events/
        providerEvents.js (new) ← IPC handler registration

~/.userData/Dashboard/{appId}/
  workspaces.json ← Provider NAMES only
  providers.json ← Encrypted credentials (new file)
```

## 6. Encryption Strategy

Use Electron's `safeStorage` API (available in Electron 13.3+):

```javascript
const { safeStorage } = require("electron");

// Encrypt
const encrypted = safeStorage.encryptString(JSON.stringify(credentials));

// Decrypt
const decrypted = JSON.parse(safeStorage.decryptString(encrypted));
```

Alternative (if older Electron version):

-   Use `crypto` module with master key stored in OS keychain
-   Or use `@electron/secure-storage` package

## 7. Testing Checklist

-   [ ] Provider created via ProviderForm saves to providers.json encrypted
-   [ ] Provider name saved to workspace.selectedProviders[widgetId]
-   [ ] App restart loads providers and ProviderContext is populated
-   [ ] Widget receives selectedProviders with names, not credentials
-   [ ] Widget can look up credentials via ProviderContext.getProvider()
-   [ ] Different widgets can have different provider selections
-   [ ] Multiple widgets can share same provider selection
-   [ ] Creating new provider while widget shown updates in real-time
-   [ ] Workspace JSON clean (no credentials exposed)

## 8. Security Considerations

1. **Never expose credentials in workspace.json** ✓
2. **Always encrypt credentials in providers.json** ✓
3. **Decrypt credentials only at runtime in ProviderContext** ✓
4. **Clear credentials from memory when app closes** (implement)
5. **Validate provider names before lookup** (implement)
6. **Log provider access for audit** (implement)
7. **Implement credential rotation** (future)
8. **Support credential updates** (future)

## Integration Points Summary

```
dash-react ProviderForm.onSubmit()
    ↓
Dashboard.handleProviderSelect()
    ↓
providerApi.saveProvider() ← IPC call
    ↓
Main process: PROVIDER_SAVE handler
    ↓
providerController.saveProvider()
    ↓
Encrypt + save to providers.json
Update ProviderContext
    ↓
Return success to frontend
    ↓
workspaceApi.saveWorkspace() (save provider NAME)
    ↓
Widget can now look up provider by name
```
