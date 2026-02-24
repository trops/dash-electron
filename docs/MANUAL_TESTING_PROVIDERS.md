# Manual Testing: Step-by-Step Provider Creation

This guide walks through manually testing the provider creation workflow with dummy credentials.

## Prerequisites

-   App is running (`npm run dev`)
-   Electron window is visible
-   No errors in console

## Test Scenario: Create and Use an Algolia Provider

### Part 1: Create Provider Via UI

**Expected UI Flow:**

1. User accesses provider/settings interface
2. Clicks "Create New Provider"
3. Form appears with fields:
    - Provider Name (text input)
    - Provider Type (dropdown: algolia, slack, etc.)
    - Type-specific credentials (dynamic fields)

**Dummy Credentials to Enter:**

```
Provider Name: My Test Algolia
Provider Type: algolia

Credentials:
  App ID: testapp_987654321
  API Key: test_key_that_is_not_real_12345
  Index Name: products_demo
```

**Expected Result:**

-   Form validates
-   User clicks "Save"
-   Loading indicator appears
-   Success message shown: "Provider saved successfully"
-   Provider appears in provider list

### Part 2: Verify Provider Saved

**Check on File System:**

```bash
# List providers file
ls -la ~/.userData/Dashboard/[YOUR_APP_ID]/

# Should see: providers.json

# View file (will be encrypted but should have structure)
cat ~/.userData/Dashboard/[YOUR_APP_ID]/providers.json
# Output shows: { "My Test Algolia": { type: "algolia", credentials: "...", ... } }
```

**Check in Application:**

1. Look for provider list/registry in UI
2. Should show "My Test Algolia" with type "algolia"
3. Status should show "Ready"

### Part 3: Create Widget and Select Provider

**Steps:**

1. Add new widget to dashboard (e.g., TestProviderWidget)
2. Widget appears but shows "⚠️ No providers selected"
3. Open widget settings
4. Look for provider selection dropdown
5. Select "My Test Algolia"
6. Save widget configuration

**Expected Result:**

-   Widget updates
-   Shows "✅ 1 Provider Available"
-   Displays provider information:
    ```
    Name: My Test Algolia
    Type: algolia
    Credentials: (expandable)
    Status: ✓ Ready to Use
    ```

### Part 4: Verify Credentials Are Accessible

**Expand Credentials Section:**
Click on "Click to expand credentials" to verify:

```javascript
{
  "appId": "testapp_987654321",
  "apiKey": "test_key_that_is_not_real_12345",
  "indexName": "products_demo"
}
```

**Key Verification Points:**

-   ✓ Values are decrypted (readable, not encrypted)
-   ✓ Matches what you entered originally
-   ✓ No null/undefined values
-   ✓ All credential fields present

### Part 5: Test Multiple Providers

**Create Second Provider:**

```
Provider Name: Production Algolia
Provider Type: algolia

Credentials:
  App ID: prod_app_123456789
  API Key: prod_api_key_secure_999
  Index Name: products_live
```

**Create Two Widgets:**

1. Widget A: Select "My Test Algolia"
2. Widget B: Select "Production Algolia"

**Verify Each Widget Shows Correct Provider:**

-   Widget A displays testapp credentials
-   Widget B displays prod_app credentials
-   Both work independently
-   No cross-contamination

## Test Scenario: Error Handling

### Scenario 1: Invalid Provider Name

**Steps:**

1. Try to create provider with empty name
2. Try to create provider with special characters

**Expected:**

-   Form validation error shown
-   Save button disabled
-   Error message explains requirement

### Scenario 2: Missing Credentials

**Steps:**

1. Try to save provider with empty credentials
2. Leave required fields blank

**Expected:**

-   Form validation error
-   Required fields highlighted
-   Save prevented

### Scenario 3: Reload App After Create

**Steps:**

1. Create provider
2. Close application completely
3. Reopen application
4. Check if provider still exists

**Expected:**

-   Provider loads on app startup
-   Available immediately
-   Credentials intact and decrypted
-   Widget accessing provider shows data

## Console Logging Points

### Expected Log Messages

**During App Startup:**

```
[1] "loading providers ... dashApi, credentials"
[2] "loaded providers ..."
[3] Console shows array of provider objects
```

**When Creating Provider:**

```
[1] "handleProviderSelect called with event..."
[2] "invoking PROVIDER_SAVE..."
[3] "Provider saved..." (from main process)
[4] "PROVIDER_SAVE_COMPLETE received"
```

**When Widget Loads:**

```
[1] "useWidgetProviders called"
[2] "Widget found selected providers for this widget"
[3] Widget renders with provider data
```

### Where to Monitor

**Renderer Process (DevTools):**

```javascript
// Open DevTools: F12 or Cmd+Option+I
// Go to Console tab
// You should see all the above messages
```

**Main Process (Electron):**

```
// Look at the Electron startup terminal window
// Provider controller logs will appear here
// Encryption/decryption operations logged
```

## Data Structure Verification

### In File System

**File: ~/.userData/Dashboard/[appId]/providers.json**

Before encryption (what you see in code):

```javascript
{
  "My Test Algolia": {
    type: "algolia",
    credentials: {
      appId: "testapp_987654321",
      apiKey: "test_key_that_is_not_real_12345",
      indexName: "products_demo"
    },
    dateCreated: "2026-02-08T10:30:00.000Z",
    dateUpdated: "2026-02-08T10:30:00.000Z"
  }
}
```

In file (what you see with cat):

```javascript
{
  "My Test Algolia": {
    type: "algolia",
    credentials: "<base64-encrypted-json-string>",
    dateCreated: "2026-02-08T10:30:00.000Z",
    dateUpdated: "2026-02-08T10:30:00.000Z"
  }
}
```

### In DashboardContext

**What widget receives:**

```javascript
dashboard.providers = {
    "My Test Algolia": {
        name: "My Test Algolia",
        type: "algolia",
        credentials: {
            appId: "testapp_987654321",
            apiKey: "test_key_that_is_not_real_12345",
            indexName: "products_demo",
        },
        dateCreated: "2026-02-08T10:30:00.000Z",
        dateUpdated: "2026-02-08T10:30:00.000Z",
    },
};
```

### In Workspace

**What's stored:**

```javascript
workspace.selectedProviders = {
    "WIDGET-abc123": {
        algolia: "My Test Algolia", // Just the NAME, not credentials
    },
    "WIDGET-xyz789": {
        algolia: "Production Algolia",
    },
};
```

## Timing Expectations

| Operation                    | Expected Time |
| ---------------------------- | ------------- |
| Create provider              | < 1 second    |
| Save provider                | < 2 seconds   |
| App startup (load providers) | < 3 seconds   |
| Widget access provider       | < 50ms        |
| Encrypt credentials          | < 100ms       |
| Decrypt all providers        | < 200ms       |

## Success Checklist

After completing all steps, check off:

-   [ ] Provider created successfully
-   [ ] Provider file exists on filesystem
-   [ ] Provider appears in application UI
-   [ ] Widget added to dashboard
-   [ ] Widget shows provider selected
-   [ ] Widget displays provider info
-   [ ] Credentials section expandable
-   [ ] Credentials match what was entered
-   [ ] Second provider created independently
-   [ ] Two widgets show different providers
-   [ ] App restarted, provider still exists
-   [ ] No errors in console
-   [ ] All timing within expected ranges

## Troubleshooting Common Issues

### "Provider not found" error

**Cause**: Widget selectedProviders references deleted/renamed provider

**Fix**:

1. Verify provider still exists in list
2. Update widget to select valid provider
3. Save widget configuration

### Credentials show as "[object Object]"

**Cause**: Credentials not properly decrypted

**Fix**:

1. Check if decryption errors in console
2. Verify file has proper base64 encoding
3. Restart app to reload
4. Check electron safe storage logs

### Widget shows error on load

**Cause**: useWidgetProviders() called outside Widget context

**Fix**:

1. Verify widget is inside <Widget> component
2. Check that DashboardWrapper wraps everything
3. Verify widget has valid UUID in context

### Multiple widgets all show same provider

**Cause**: selectedProviders not properly isolated by widget ID

**Fix**:

1. Verify workspace.selectedProviders has widget ID keys
2. Check that each widget has unique ID
3. Restart app
4. Reconfigure widget selections

## Next Testing Phase

After manual testing confirms provider system works:

1. **Automated Testing** - Create jest tests
2. **Integration Testing** - Test full workflows
3. **Load Testing** - Test with many providers
4. **Error Testing** - Force error scenarios
5. **Production Testing** - Test in built app

---

**Questions?** Check the detailed documentation:

-   `PROVIDER_CONTEXT_INTEGRATION.md` - How data flows
-   `WIDGET_PROVIDER_ACCESS.md` - Hook usage
-   `PROVIDER_API_SETUP.md` - API details
