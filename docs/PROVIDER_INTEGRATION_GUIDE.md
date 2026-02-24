# Provider Integration Guide

## Overview

This guide documents how to integrate the provider detection system (ProviderErrorBoundary, MissingProviderPrompt) with the main dash application's persistent storage layer, enabling users to select and save their provider configurations per dashboard view.

## Architecture

### Current Flow (Without Provider Persistence)

```
Main App Dashboard.js
  ↓ dashApi.listWorkspaces()
  ↓ (loads from ~/.userData/Dashboard/{appId}/workspaces.json)
Workspace Object: { id, displayName, layout[], ... }
  ↓ LayoutBuilder receives workspace
  ↓
WidgetFactory.render() instantiates widgets
  ↓ Widget wraps with ProviderErrorBoundary
  ↓
ProviderErrorBoundary checks for required providers
  ↓ (if missing, shows MissingProviderPrompt)
User selects provider in UI
  ⚠️ Currently lost - not persisted!
```

### Target Flow (With Provider Persistence)

```
Main App Dashboard.js
  ↓ dashApi.listWorkspaces()
  ↓ (loads from workspaces.json)
Workspace Object: { id, displayName, layout[], selectedProviders: {...}, ... }
  ↓ LayoutBuilder receives workspace
  ↓ (passes workspace.selectedProviders to WidgetFactory)
  ↓
WidgetFactory.render() instantiates widgets
  ↓ passes selectedProviders to Widget props
  ↓
Widget wraps with ProviderErrorBoundary
  ↓ ProviderErrorBoundary checks required vs selected
  ↓ (pre-populates with saved selections if available)
  ↓
User selects/creates provider in MissingProviderPrompt
  ↓
ProviderErrorBoundary calls onProviderSelect callback
  ↓ (widget passes callback up to LayoutBuilder/Dashboard)
  ↓
Dashboard.js captures callback: workspaceApi.saveWorkspaceForApplication()
  ↓ (sends IPC: WORKSPACE_SAVE with updated selectedProviders)
  ↓
workspaceController.js saves to workspaces.json
  ↓
Persistence: ~./userData/Dashboard/{appId}/workspaces.json updated
```

## Required Changes

### 1. Workspace Schema Extension

**File:** `dash/public/lib/controller/workspaceController.js` (backend schema definition)
**File:** `dash-react/src/Models/WorkspaceModel.js` (library schema)

Add `selectedProviders` property to workspace objects:

```javascript
{
  "id": "dashboard-id",
  "displayName": "Dashboard Name",
  "layout": [...],
  "selectedProviders": {
    "algolia": "Algolia Production",  // provider type -> selected provider name
    "slack": "Slack Dev",
    "custom_api": "API Provider v1"
  },
  "administration": { ... },
  "date_created": "2026-02-08",
  "date_edited": "2026-02-08"
}
```

**Note:** `selectedProviders` maps provider type → provider name (string). This allows:

-   Multiple widgets requiring different provider types
-   Users to have different provider selections per dashboard
-   Easy querying: "which provider is selected for [type]?"

### 2. LayoutBuilder → Widget Props Flow

**File:** `dash-react/src/Layout/Builder/LayoutBuilder.js`

LayoutBuilder already receives `workspace` prop. It must pass `selectedProviders` down to widgets:

```javascript
// In LayoutBuilder, when rendering layout items:
// Currently: <Widget {...widgetParams} />
// Target:   <Widget {...widgetParams} selectedProviders={workspace.selectedProviders} />
```

**Implementation Location:** In LayoutBuilder's rendering logic, extract selectedProviders from workspace:

```javascript
const selectedProviders = workspace?.selectedProviders || {};
// Pass to widget renderer through layout item params or context
```

### 3. WidgetFactory Enhancement

**File:** `dash-react/src/Widget/WidgetFactory.js`

The `render()` method receives `params`. Add selectedProviders to params:

```javascript
// In WidgetFactory.render():
const selectedProviders = params?.selectedProviders || {};
// ... continue with widget instantiation, passing selectedProviders prop
```

### 4. Widget.js Integration

**File:** `dash-react/src/Widget/Widget.js`

Already integrated with ProviderErrorBoundary. Needs enhancement:

```javascript
export const Widget = ({
    requiredProviders = [],
    selectedProviders = {}, // ← NEW: from workspace config
    onProviderSelect = null, // ← Already exists
    ...props
}) => {
    return (
        <ProviderErrorBoundary
            requiredProviders={requiredProviders}
            selectedProviders={selectedProviders} // ← Pass down
            widgetId={props.id}
            onProviderSelect={onProviderSelect} // ← Already exists
        >
            {children}
        </ProviderErrorBoundary>
    );
};
```

### 5. ProviderErrorBoundary Enhancement

**File:** `dash-react/src/Provider/ProviderErrorBoundary.js`

Already receives `onProviderSelect` callback. Needs to:

1. Accept `selectedProviders` prop
2. Pre-populate MissingProviderPrompt with saved selections
3. Pass selected provider name to callback

```javascript
class ProviderErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasProviderError: false,
            missingProviders: [],
            selectedProviders: props.selectedProviders || {}, // ← NEW
        };
    }

    handleProviderSelect = (providerType, providerName) => {
        // Update local state
        this.setState((prev) => ({
            selectedProviders: {
                ...prev.selectedProviders,
                [providerType]: providerName,
            },
        }));

        // Call parent callback
        if (this.props.onProviderSelect) {
            this.props.onProviderSelect({
                widgetId: this.props.widgetId,
                selectedProviders: {
                    ...this.state.selectedProviders,
                    [providerType]: providerName,
                },
            });
        }
    };
}
```

### 6. MissingProviderPrompt Enhancement

**File:** `dash-react/src/Provider/MissingProviderPrompt.js`

Pre-populate provider selections:

```javascript
export const MissingProviderPrompt = ({
    requiredProviders = [],
    selectedProviders = {}, // ← NEW: existing selections
    onProviderSelect = null,
    ...props
}) => {
    const getInitialSelectedProvider = (providerType) => {
        return selectedProviders[providerType] || null;
    };

    // When showing ProviderSelector, pass initial value:
    return (
        <ProviderSelector
            requiredProviders={missingProviders}
            initialSelectedProvider={getInitialSelectedProvider(providerType)}
            onSelect={handleSelect}
        />
    );
};
```

### 7. Dashboard.js → Workspace Save Integration

**File:** `dash-react/src/Dashboard/Dashboard.js`

Add handler for provider selection:

```javascript
export const Dashboard = ({ dashApi, credentials, ...props }) => {
    // ... existing state ...

    const handleProviderSelect = (event) => {
        // event = { widgetId, selectedProviders: {...} }
        const { widgetId, selectedProviders } = event;

        // Update workspace selectedProviders
        setWorkspaceSelected((prevWorkspace) => ({
            ...prevWorkspace,
            selectedProviders: selectedProviders,
        }));

        // Persist to main app
        dashApi.saveWorkspace(
            credentials.appId,
            {
                ...workspaceSelected,
                selectedProviders: selectedProviders,
            },
            handleWorkspaceSaveComplete,
            handleWorkspaceSaveError
        );
    };

    // Pass handler down through LayoutBuilder
    return (
        <LayoutBuilder
            workspace={workspaceSelected}
            onProviderSelect={handleProviderSelect} // ← NEW
            {...otherProps}
        />
    );
};
```

### 8. LayoutBuilder → Widget Wiring

**File:** `dash-react/src/Layout/Builder/LayoutBuilder.js`

Pass provider selection callback through to widgets:

```javascript
export const LayoutBuilder = ({
    workspace,
    onProviderSelect = null, // ← NEW
    ...props
}) => {
    // ... existing code ...

    // When rendering widgets via LayoutGridContainer/WidgetFactory:
    // Ensure params include callback:
    const widgetParams = {
        ...existingParams,
        onProviderSelect: onProviderSelect,
    };
};
```

## Implementation Checklist

### Phase 1: Schema & Storage (1 day)

-   [ ] Update `WorkspaceModel.js` to include `selectedProviders` in valid properties
-   [ ] Update workspace schema documentation in `dash/public/lib/controller/workspaceController.js`
-   [ ] Ensure `workspaceApi.saveWorkspaceForApplication()` preserves selectedProviders

### Phase 2: Props Flow (1 day)

-   [ ] Update `Dashboard.js` to pass selectedProviders to LayoutBuilder
-   [ ] Update `LayoutBuilder.js` to pass selectedProviders through layout rendering
-   [ ] Update `WidgetFactory.render()` to include selectedProviders in widget params
-   [ ] Update `Widget.js` props to accept and pass selectedProviders

### Phase 3: Provider UI Integration (1 day)

-   [ ] Update `ProviderErrorBoundary.js` to accept and track selectedProviders
-   [ ] Update `MissingProviderPrompt.js` to show pre-selected providers
-   [ ] Implement provider selection callback in ProviderErrorBoundary

### Phase 4: Persistence Wiring (1 day)

-   [ ] Add `handleProviderSelect` callback in `Dashboard.js`
-   [ ] Wire callback through LayoutBuilder to ProviderErrorBoundary
-   [ ] Test: Select provider → Callback fires → Workspace saves → Reload dashboard → Provider still selected

## Testing Strategy

### Unit Tests

-   [ ] WorkspaceModel sanitizes selectedProviders correctly
-   [ ] ProviderErrorBoundary tracks selectedProviders in state
-   [ ] MissingProviderPrompt displays pre-selected values

### Integration Tests

1. **Load Dashboard with Existing Providers:**

    - Load workspace with selectedProviders in localStorage
    - Verify Widget pre-populates provider selector
    - Verify ProviderErrorBoundary doesn't show error for pre-selected providers

2. **Select New Provider:**

    - Show MissingProviderPrompt
    - Select/create new provider
    - Verify onProviderSelect callback fires
    - Verify Dashboard captures and saves

3. **Persist Across Reload:**

    - Select provider A
    - Reload dashboard/browser
    - Verify provider A is still selected
    - Verify ProviderErrorBoundary doesn't show error

4. **Multiple Widgets:**
    - Dashboard with 2+ widgets requiring different providers
    - Select different providers for each
    - Verify each saved independently
    - Reload and verify selections persist

## File Summary

### Files to Modify

| File                                                | Change                                              | Priority | Effort    |
| --------------------------------------------------- | --------------------------------------------------- | -------- | --------- |
| `src/Models/WorkspaceModel.js`                      | Add `selectedProviders` to validWorkspaceProperties | High     | 1 line    |
| `src/Dashboard/Dashboard.js`                        | Add provider selection callback handler             | High     | ~20 lines |
| `src/Layout/Builder/LayoutBuilder.js`               | Pass selectedProviders to widget rendering          | High     | ~10 lines |
| `src/Widget/WidgetFactory.js`                       | Include selectedProviders in widget params          | High     | ~5 lines  |
| `src/Widget/Widget.js`                              | Accept and forward selectedProviders prop           | High     | ~5 lines  |
| `src/Provider/ProviderErrorBoundary.js`             | Track selectedProviders in state, use in callback   | Medium   | ~30 lines |
| `src/Provider/MissingProviderPrompt.js`             | Pre-populate with selectedProviders                 | Medium   | ~20 lines |
| `dash/public/lib/controller/workspaceController.js` | Document selectedProviders in schema                | Low      | ~5 lines  |

**Total Estimated Changes:** ~100 lines across 8 files

## Example: Complete Flow

```javascript
// 1. Main app loads workspace with saved provider selection
const workspace = {
    id: "dash-1",
    displayName: "Analytics Dashboard",
    layout: [...],
    selectedProviders: {
        algolia: "Algolia Production"
    }
};

// 2. LayoutBuilder receives workspace, passes to widgets
<LayoutBuilder workspace={workspace} onProviderSelect={handleProviderSelect} />

// 3. WidgetFactory includes selectedProviders in params
const params = { id, selectedProviders: workspace.selectedProviders };

// 4. Widget receives and passes to ProviderErrorBoundary
<Widget
    id="widget-1"
    requiredProviders={[{ type: "algolia" }]}
    selectedProviders={{ algolia: "Algolia Production" }}
    onProviderSelect={handleProviderSelect}
/>

// 5. ProviderErrorBoundary sees provider is selected, doesn't error
// 6. Widget renders normally
// 7. User later changes provider → callback fires → workspace saved

// 8. Next load: same provider is pre-selected
```

## Notes

-   **Backward Compatibility:** Workspaces without `selectedProviders` will default to `{}`. Existing workspaces will work but show provider prompts until user selects.
-   **Provider Lookup:** The provider name stored is just a string (e.g., "Algolia Production"). Resolution to actual credentials happens in ProviderContext or ProviderManager.
-   **Multi-Provider:** Each widget can require different providers. The workspace selectedProviders is a global map for the entire view.
-   **IPC Communication:** Main dash app's `workspaceController.js` already persists the full workspace object, so no backend changes needed—just pass selectedProviders along with other properties.
