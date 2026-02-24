# Provider System Live Testing Guide

## Current Status

✅ **Development Environment Running**

-   React Dev Server: http://localhost:3000
-   Electron App: Running
-   Provider API: Fully initialized
-   Test Widget: Ready to use

## Quick Start Testing

### Step 1: Verify the App is Running

The Electron window should be visible with the Dash dashboard interface. You should see:

-   Main dashboard
-   Widget registry/manager
-   Settings/Configuration options

### Step 2: Create a Test Provider

1. **Access Provider Creation UI** - Look for a settings or provider management interface
2. **Create Provider with Dummy Credentials**:

    ```
    Provider Name: Test Algolia
    Type: algolia
    Credentials:
    - appId: demo_12345
    - apiKey: test_key_only_demo
    - indexName: demo_index
    ```

    Or create another test provider:

    ```
    Provider Name: Test Slack
    Type: slack
    Credentials:
    - webhook: https://hooks.slack.com/services/XXX/YYY/ZZZ (dummy)
    - token: xoxb-test-token-only
    ```

3. **Verify Save** - Provider should be encrypted and saved to:
    ```
    ~/.userData/Dashboard/{appId}/providers.json
    ```

### Step 3: Add Test Widget to Dashboard

1. **Widget Name**: TestProviderWidget
2. **Add to Dashboard**: Drag or create a new widget instance
3. **Configure Widget**: In widget settings, select the "Test Algolia" provider
4. **Save Configuration**: Provider selection stored in workspace

### Step 4: Verify Provider Access

The widget should:

1. Load successfully
2. Display "✅ 1 Provider Available"
3. Show provider name: "Test Algolia"
4. Show provider type: "algolia"
5. Display expandable credentials section
6. Show "✓ Ready to Use" status

### Step 5: Monitor Console Output

Open DevTools (F12) and check console for:

```javascript
// During app startup
"loading providers ... dashApi, credentials";
"loaded providers ...";

// When AppWrapper initializes
"loaded settings ...";
"loaded providers ...";

// When widget renders
"useWidgetProviders called successfully";
```

## Expected Behavior

### Provider Creation Flow

```
1. User clicks "Create Provider"
   ↓
2. ProviderForm collects name + credentials
   ↓
3. Form submits: { name: "Test Algolia", credentials: {...} }
   ↓
4. Dashboard.handleProviderSelect() called
   ↓
5. providerApi.saveProvider() sends to main process
   ↓
6. Main process encrypts and saves to providers.json
   ↓
7. Success message shown to user
```

### Provider Loading Flow

```
1. App starts
   ↓
2. AppWrapper mounts
   ↓
3. loadProviders() called in useEffect
   ↓
4. dashApi.listProviders() invokes IPC
   ↓
5. Main process decrypts providers.json
   ↓
6. AppWrapper receives decrypted providers
   ↓
7. DashboardContext.providers populated
   ↓
8. Widget can access via useWidgetProviders()
```

### Widget Access Flow

```
1. TestProviderWidget renders
   ↓
2. useWidgetProviders() called
   ↓
3. Hook gets widget ID from context
   ↓
4. Hook reads workspace.selectedProviders[widgetId]
   ↓
5. Hook looks up provider by name in dashboard.providers
   ↓
6. Hook returns { providers, hasProvider, getProvider }
   ↓
7. Widget displays provider information
```

## Key Files to Monitor

### Logs to Watch

1. **Main Process Logs** (Electron console):

    ```
    [Provider] Loaded X providers
    [Provider] Decrypted provider: Test Algolia
    ```

2. **Renderer Logs** (DevTools console):

    ```
    AppWrapper: loading providers
    DashboardWrapper: providers loaded
    useWidgetProviders: found provider algolia
    ```

3. **File Monitoring**:
    ```bash
    # Watch providers file
    tail -f ~/.userData/Dashboard/[appId]/providers.json
    ```

## Testing Different Scenarios

### Scenario 1: Single Provider, Single Widget

```
✓ Create 1 provider
✓ Add 1 widget
✓ Select provider in widget
✓ Verify widget displays provider
```

### Scenario 2: Multiple Providers, Different Types

```
✓ Create "Test Algolia" provider
✓ Create "Test Slack" provider
✓ Add widget, select Algolia
✓ Add another widget, select Slack
✓ Both widgets show correct providers
```

### Scenario 3: Widget Without Provider

```
✓ Add widget
✓ Don't select any provider
✓ Widget shows "No providers selected"
✓ Message guides user to configure
```

### Scenario 4: Update Provider

```
✓ Create provider
✓ Verify it works in widget
✓ Update provider name/credentials
✓ Widget automatically shows updated info
```

### Scenario 5: Delete Provider

```
✓ Create provider
✓ Add to widget
✓ Delete provider
✓ Widget shows error or "not found"
```

## Data to Check

### In DevTools Console

Check `window.mainApi.providers`:

```javascript
// Should have these methods
window.mainApi.providers.listProviders(appId);
window.mainApi.providers.saveProvider(appId, name, type, creds);
window.mainApi.providers.getProvider(appId, name);
window.mainApi.providers.deleteProvider(appId, name);
```

### In React Components

Check context data:

```javascript
// In any widget
const { dashboard } = useDashboard();
console.log(dashboard.providers); // Should show all providers
console.log(dashboard.providers["Test Algolia"]); // Specific provider
```

## Troubleshooting

### Issue: "No providers selected" message

**Check**:

1. Did you create a provider?
2. Did you select it in widget settings?
3. Is workspace.selectedProviders[widgetId] set?

**Fix**:

1. Create provider via UI
2. Edit widget settings
3. Select provider from dropdown
4. Save widget configuration

### Issue: Credentials not showing

**Check**:

1. Is provider fully decrypted?
2. Are credentials in `~/.userData/Dashboard/{appId}/providers.json`?
3. Check for decryption errors in console

**Fix**:

1. Verify file exists and has content
2. Check console for errors
3. Restart app to reload providers

### Issue: Widget shows error

**Check**:

1. Is widget inside DashboardWrapper?
2. Does widget have valid UUID?
3. Is useWidgetProviders() called properly?

**Fix**:

1. Check React component hierarchy
2. Verify widget registration
3. Reload app

## Performance Testing

### Load Test: Many Providers

1. Create 10+ test providers
2. Monitor app startup time
3. Monitor memory usage
4. Check if all providers load correctly

### Load Test: Many Widgets

1. Create 10+ widgets in dashboard
2. Each selecting different providers
3. Verify all widgets load correctly
4. Check performance/responsiveness

## Success Criteria

-   [x] App starts and runs electron dev environment
-   [ ] Can create a provider through UI
-   [ ] Provider is encrypted and saved
-   [ ] Provider appears in DashboardContext
-   [ ] TestProviderWidget successfully loads
-   [ ] Widget displays provider information
-   [ ] Credentials are properly decrypted
-   [ ] Widget shows "Ready to Use" status
-   [ ] Multiple providers work independently
-   [ ] Multiple widgets with different providers work together

## Next Steps After Verification

1. **Create additional test widgets** - Test with different provider types
2. **Test error scenarios** - Missing providers, corrupted files, etc.
3. **Performance testing** - Many providers, many widgets
4. **Integration testing** - Full end-to-end workflows
5. **Production testing** - Test in built/packaged app

## Reference Documentation

See these files for more details:

-   `PROVIDER_CONTEXT_INTEGRATION.md` - Context initialization
-   `WIDGET_PROVIDER_ACCESS.md` - Hook usage patterns
-   `PROVIDER_API_SETUP.md` - API implementation details
-   `TESTING_PROVIDERS.md` - Detailed testing procedures
