# Testing the Provider System with Dummy Credentials

## Application Status

✅ React dev server running on http://localhost:3000
✅ Electron app started
✅ Provider API initialized and ready

## Testing Workflow

### Step 1: Create a Dummy Provider in the Dashboard

The application should now be running. To test the provider system:

1. **Open the Dashboard** - The Electron window should be visible
2. **Navigate to Dashboard Settings** - Look for a settings or configuration menu
3. **Create a Test Provider** - Use dummy credentials:

```javascript
{
  name: "Test Algolia",
  type: "algolia",
  credentials: {
    appId: "DUMMY_APP_ID_12345",
    apiKey: "dummy_api_key_test_only",
    indexName: "test_index"
  }
}
```

### Step 2: Verify Provider is Saved

The provider should be:

1. Encrypted and saved to `~/.userData/Dashboard/{appId}/providers.json`
2. Stored in memory in `DashboardContext.providers`
3. Available to widgets via `useWidgetProviders()` hook

### Step 3: Create a Test Widget

Create a simple widget that uses the provider:

```javascript
// TestAlgoliaWidget.js
import React from "react";
import { useWidgetProviders } from "@trops/dash-react";

export function TestAlgoliaWidget() {
    const { providers, hasProvider, getProvider } = useWidgetProviders();

    return (
        <div className="p-4 bg-gray-50 rounded">
            <h2>Provider Test Widget</h2>

            {!hasProvider("algolia") ? (
                <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
                    <p>❌ No Algolia provider selected for this widget</p>
                    <p className="text-sm mt-2">
                        Select a provider in widget settings
                    </p>
                </div>
            ) : (
                <div className="p-4 bg-green-100 border border-green-300 rounded">
                    <p>✅ Algolia provider found!</p>
                    <details className="mt-4">
                        <summary className="cursor-pointer font-semibold">
                            Provider Details
                        </summary>
                        <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto">
                            {JSON.stringify(getProvider("algolia"), null, 2)}
                        </pre>
                    </details>
                </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-semibold mb-2">All Providers:</p>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(providers, null, 2)}
                </pre>
            </div>
        </div>
    );
}
```

### Step 4: Monitor Console for Provider Loading

Watch the console for these logs:

```javascript
// AppWrapper loading providers
"loading providers ... dashApi, credentials";
"loaded providers ... [array of provider objects]";

// Provider context initialization
"Loaded 1 providers";

// Widget access
"useWidgetProviders called successfully";
```

## Expected Data Structures

### When Provider Loads

```javascript
// Dashboard.providers contains:
{
  "Test Algolia": {
    name: "Test Algolia",
    type: "algolia",
    credentials: {
      appId: "DUMMY_APP_ID_12345",
      apiKey: "dummy_api_key_test_only",
      indexName: "test_index"
    },
    dateCreated: "2026-02-08T...",
    dateUpdated: "2026-02-08T..."
  }
}
```

### When Widget Reads Providers

```javascript
// Widget selectedProviders from workspace:
selectedProviders = {
  algolia: "Test Algolia"  // Just the name
}

// useWidgetProviders returns:
{
  providers: {
    algolia: {
      // Full provider object with credentials
      name: "Test Algolia",
      type: "algolia",
      credentials: { appId, apiKey, indexName },
      ...
    }
  },
  hasProvider: (type) => boolean,
  getProvider: (type) => provider | null
}
```

## Verification Checklist

-   [ ] Provider created successfully via UI
-   [ ] Provider saved to providers.json (encrypted)
-   [ ] Console shows "loaded providers" message
-   [ ] Dashboard.providers contains the provider
-   [ ] Widget can read selectedProviders from workspace
-   [ ] useWidgetProviders hook returns provider data
-   [ ] Credentials are decrypted and accessible
-   [ ] Widget displays provider information correctly

## Troubleshooting

### Provider Not Loading

**Issue**: "loaded providers ... []" - Empty providers array

**Check**:

1. Is `~/.userData/Dashboard/{appId}/providers.json` created?
2. Are there providers in the file?
3. Check console for decryption errors

### Widget Can't Access Provider

**Issue**: `useWidgetProviders()` throws error

**Check**:

1. Is widget inside `<Widget>` component?
2. Is `<Widget>` inside DashboardWrapper?
3. Does workspace have `selectedProviders[widgetId]` set?

### Credentials Not Decrypted

**Issue**: Provider object has encrypted credentials

**Check**:

1. Verify `safeStorage.isEncryptionAvailable()` returns true
2. Check main process logs for decryption errors
3. Verify credentials are base64-encoded in file

## Files Being Used

-   `src/Context/App/AppWrapper.js` - Loads providers on mount
-   `src/Context/DashboardWrapper.js` - Passes to DashboardContext
-   `src/hooks/useWidgetProviders.js` - Widget access to providers
-   `public/lib/api/providerApi.js` - IPC communication
-   `public/lib/controller/providerController.js` - Encryption/storage
-   `public/electron.js` - IPC handlers

## Next Steps After Testing

1. Create more complex test widgets with different provider types
2. Test provider updates and deletions
3. Test widget switching between different provider configurations
4. Test error scenarios (missing providers, corrupted file, etc.)
5. Test performance with multiple providers and widgets
