# Widget-Specific Provider Access Patterns

## Overview

Widgets can now access their selected providers in multiple ways. Each widget receives `selectedProviders` (provider NAMES) from the workspace, and can look up the actual provider objects with credentials through hooks.

## Architecture

```
Workspace Structure:
selectedProviders: {
  "WIDGET-abc123": {
    "algolia": "Algolia Production",
    "slack": "Slack Dev"
  },
  "WIDGET-xyz789": {
    "algolia": "Algolia Staging"
  }
}

DashboardContext.providers:
{
  "Algolia Production": {
    name: "Algolia Production",
    type: "algolia",
    credentials: { appId: "...", apiKey: "..." }
  },
  "Algolia Staging": {
    name: "Algolia Staging",
    type: "algolia",
    credentials: { appId: "...", apiKey: "..." }
  },
  "Slack Dev": {
    name: "Slack Dev",
    type: "slack",
    credentials: { webhook: "...", token: "..." }
  }
}

Widget gets:
selectedProviders: {
  "algolia": "Algolia Production",  // Provider NAME
  "slack": "Slack Dev"
}
```

## Approach 1: useWidgetProviders Hook (Recommended for Widgets)

**Best for:** Widgets that need their selected providers
**Automatic:** Uses widget ID from context automatically

```javascript
import { useWidgetProviders } from "@trops/dash-react";

function MyAlgoliaWidget() {
    const { providers, hasProvider, getProvider } = useWidgetProviders();

    // Check if provider is available
    if (!hasProvider("algolia")) {
        return <div>Algolia provider not configured</div>;
    }

    // Get provider by type
    const algoliaProvider = getProvider("algolia");
    const { appId, apiKey } = algoliaProvider.credentials;

    // Or access all providers at once
    const slackProvider = providers.slack; // undefined if not selected

    // Initialize Algolia client
    const algoliasearch = require("algoliasearch");
    const client = algoliasearch(appId, apiKey);

    return <SearchResults client={client} />;
}
```

### Helper Methods

```javascript
const { providers, hasProvider, getProvider } = useWidgetProviders();

// Check if a provider type is available
hasProvider("algolia"); // true/false

// Get a specific provider by type
getProvider("algolia"); // { name, type, credentials } or null

// Access all selected providers
providers; // { algolia: {...}, slack: {...} }
```

## Approach 2: useDashboard Hook with widgetId Parameter

**Best for:** Non-widget components that need widget-specific providers
**Manual:** Pass widget ID explicitly

```javascript
import { useDashboard } from "@trops/dash-react";

function MyComponent({ widgetId }) {
    const { dashboard, widgetProviders } = useDashboard(widgetId);

    if (!widgetProviders?.algolia) {
        return <div>No Algolia provider for this widget</div>;
    }

    const { credentials } = widgetProviders.algolia;
    const { appId, apiKey } = credentials;

    return <SearchResults appId={appId} apiKey={apiKey} />;
}
```

## Approach 3: useDashboard Hook (All Providers)

**Best for:** Dashboard-level components that need access to all providers
**Provides:** All available providers

```javascript
import { useDashboard } from "@trops/dash-react";

function DashboardToolbar() {
    const { dashboard } = useDashboard();

    // Access ALL providers
    const allProviders = dashboard.providers;
    // {
    //   "Algolia Production": {...},
    //   "Algolia Staging": {...},
    //   "Slack Dev": {...}
    // }

    return (
        <select>
            {Object.entries(allProviders).map(([name, provider]) => (
                <option key={name}>
                    {name} ({provider.type})
                </option>
            ))}
        </select>
    );
}
```

## Approach 4: Direct Props (Legacy Pattern)

**Best for:** Parent passing selectedProviders and credentials to child
**Manual:** Parent must look up and pass down

```javascript
// Parent widget component
function ParentWidget({ selectedProviders }) {
    const { dashboard } = useDashboard();

    // Look up selected providers by name
    const algoliaName = selectedProviders.algolia;
    const algoliaProvider = dashboard.providers[algoliaName];

    return (
        <ChildComponent
            selectedProviders={selectedProviders}
            credentials={algoliaProvider?.credentials}
        />
    );
}

// Child component
function ChildComponent({ selectedProviders, credentials }) {
    if (!credentials) {
        return <div>Provider not available</div>;
    }

    const { appId, apiKey } = credentials;
    // Use credentials...
}
```

## Complete Widget Example

```javascript
import React from "react";
import { useWidgetProviders } from "@trops/dash-react";
import algoliasearch from "algoliasearch";

export function AlgoliaSearchWidget() {
    // Get this widget's selected providers with credentials
    const { providers, hasProvider } = useWidgetProviders();

    // Validate provider is available
    if (!hasProvider("algolia")) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p>Algolia provider not configured for this widget.</p>
                <p className="text-sm text-gray-600">
                    Please select an Algolia provider in the dashboard settings.
                </p>
            </div>
        );
    }

    // Get the provider for this widget
    const algoliaProvider = providers.algolia;
    const { appId, apiKey, indexName } = algoliaProvider.credentials;

    // Initialize search client
    const client = algoliasearch(appId, apiKey);
    const index = client.initIndex(indexName);

    // Render widget
    return (
        <div className="p-4">
            <h2>Search {indexName}</h2>
            <SearchUI index={index} />
        </div>
    );
}

// Or with error handling
export function SafeAlgoliaSearchWidget() {
    try {
        const { providers, getProvider } = useWidgetProviders();

        const algolia = getProvider("algolia");
        if (!algolia) {
            return <MissingProviderUI />;
        }

        return <SearchResults credentials={algolia.credentials} />;
    } catch (error) {
        return <ErrorUI error={error} />;
    }
}
```

## Provider Resolution Flow

```
Widget receives:
  - uuid: "abc123"
  - selectedProviders: { algolia: "Algolia Production" }

useWidgetProviders() does:
  1. Get widget ID from WidgetContext: "abc123"
  2. Read workspace.selectedProviders[widgetId]: { algolia: "Algolia Production" }
  3. Look up in dashboard.providers by name: { algolia: {...credentials...} }
  4. Return: { providers: {...}, hasProvider(), getProvider() }

Widget uses:
  const algolia = providers.algolia
  const { appId, apiKey } = algolia.credentials
```

## Type Definitions

### Provider Object

```javascript
{
  name: string,           // "Algolia Production"
  type: string,           // "algolia"
  credentials: object,    // { appId, apiKey, indexName }
  dateCreated: string,    // ISO timestamp
  dateUpdated: string     // ISO timestamp
}
```

### useWidgetProviders Return

```javascript
{
  providers: {
    [providerType]: Provider  // "algolia" → Provider object
  },
  hasProvider: (type: string) => boolean,
  getProvider: (type: string) => Provider | null
}
```

### useDashboard Return (with widgetId)

```javascript
{
  app: AppContext,
  dashboard: DashboardContext,
  theme: ThemeContext,
  widgetProviders: {          // Only when widgetId provided
    [providerType]: Provider
  }
}
```

## Migration Guide

### Old Pattern (Global Algolia)

```javascript
// Before: App had one global Algolia client
const algoliasearch = require("algoliasearch");
const client = algoliasearch(GLOBAL_APP_ID, GLOBAL_API_KEY);
```

### New Pattern (Widget-Specific Algolia)

```javascript
// After: Each widget gets its selected Algolia provider
import { useWidgetProviders } from "@trops/dash-react";

function MyAlgoliaWidget() {
    const { providers } = useWidgetProviders();
    const algolia = providers.algolia;

    if (!algolia) {
        return <div>Configure Algolia in widget settings</div>;
    }

    const { appId, apiKey } = algolia.credentials;
    const client = algoliasearch(appId, apiKey);
    // Use client...
}
```

## Error Scenarios

### Provider Not Selected

```javascript
const { getProvider } = useWidgetProviders();
const algolia = getProvider("algolia"); // null if not selected
```

### Provider Not Found

```javascript
// If selectedProviders references a deleted provider
// getProvider returns null because dashboard.providers[name] is undefined
```

### Outside Widget Context

```javascript
// Will throw error if not inside <Widget>
const { providers } = useWidgetProviders(); // ❌ Error!

// Use useDashboard() and pass widgetId instead
const { widgetProviders } = useDashboard(widgetId); // ✓ Works
```

## Best Practices

1. **Use useWidgetProviders in widgets** - Automatic widget ID detection
2. **Validate providers exist** - Always check `hasProvider()` before using
3. **Store credentials securely** - Never log or pass to API endpoints unencrypted
4. **Handle missing providers gracefully** - Show UI instead of crashing
5. **Access credentials only when needed** - Don't destructure early

```javascript
// ✓ Good
function MyWidget() {
    const { hasProvider, getProvider } = useWidgetProviders();

    if (!hasProvider("algolia")) {
        return <SelectProviderUI />;
    }

    const algolia = getProvider("algolia");
    return <SearchUI credentials={algolia.credentials} />;
}

// ❌ Avoid
function MyWidget() {
    const { providers } = useWidgetProviders();
    const { credentials } = providers.algolia; // Crashes if algolia not selected
    return <SearchUI credentials={credentials} />;
}
```

## Files Modified

-   `src/hooks/useDashboard.js` - Enhanced to support widgetId parameter
-   `src/hooks/useWidgetProviders.js` - NEW convenience hook for widgets
-   `src/hooks/index.js` - Added export for useWidgetProviders
