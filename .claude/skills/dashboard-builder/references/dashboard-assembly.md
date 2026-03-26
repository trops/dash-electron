# Dashboard Assembly Reference

Technical reference for building dashboards in Dash. Covers the dashboard config schema, widget discovery, event wiring, provider dependencies, and the layout system.

---

## Dashboard Config Schema

A dashboard (workspace) is a JSON object with this structure:

```javascript
{
    id: 1,                     // Unique numeric ID (auto-generated)
    name: "My Dashboard",      // Display name
    type: "workspace",         // Always "workspace" for dashboards
    label: "My Dashboard",     // Sidebar label
    layout: [                  // Array of layout items
        {
            id: 1,
            order: 0,
            component: "LayoutGridContainer", // Container type
            parentId: 0,
            config: { columns: 2, rows: 1 },
        },
        {
            id: 2,
            order: 1,
            component: "SlackWidget",        // Widget component name
            parentId: 1,                     // Parent container ID
            config: { title: "Slack Feed" },
        },
    ],
    menuId: 1,                 // Sidebar menu item ID
    version: 1,                // Config version (auto-incremented on save)
}
```

### Layout Item Types

| Component             | Type      | Purpose                       |
| --------------------- | --------- | ----------------------------- |
| `LayoutGridContainer` | Container | Grid layout with rows/columns |
| `Container`           | Container | Simple container              |
| Any widget name       | Widget    | Actual widget component       |

### Layout Rules

-   Every dashboard starts with a root container (`parentId: 0`)
-   Widgets reference their parent container via `parentId`
-   `order` determines position within a container
-   Widget IDs must be unique within the dashboard

---

## Widget Discovery

### Registry Search (MCP)

```
search_widgets("slack")   // Returns matching widgets with metadata
list_widgets()            // Returns all available widgets
```

Each result includes:

-   `name` — component name (used with `add_widget`)
-   `displayName` — human-readable name
-   `description` — what the widget does
-   `providers` — required service connections (type, providerClass, required)

### Local Widgets

Check `src/SampleWidgets/` for reference implementations:

| Directory         | Widgets                                                                                                      | Provider                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `Slack/`          | SlackWidget, SlackChannelMessages, SlackListChannels, SlackPostMessage, SlackSearchMessages, SlackUserStatus | slack (MCP)                   |
| `GitHub/`         | GitHubWidget, GitHubRepoList, GitHubPRList, GitHubIssueList, GitHubIssueDetail                               | github (MCP)                  |
| `Gmail/`          | GmailWidget, GmailInbox, GmailCompose, GmailSearch, GmailMessageView                                         | gmail (MCP)                   |
| `GoogleCalendar/` | GoogleCalendarWidget, GCalUpcoming, GCalEventDetail, GCalQuickCreate                                         | google-calendar (MCP)         |
| `GoogleDrive/`    | GoogleDriveWidget, GDriveFileList, GDriveFileSearch, GDriveFilePreview                                       | google-drive (MCP)            |
| `Algolia/`        | AlgoliaSearchWidget, AlgoliaAnalyticsWidget, + 12 more                                                       | algolia (credential)          |
| `Notion/`         | NotionWidget                                                                                                 | notion (MCP)                  |
| `Chat/`           | ChatAnthropicWidget, ChatClaudeCodeWidget                                                                    | anthropic/openai (credential) |
| `Clock/`          | AnalogClockWidget, DigitalClockWidget, FlipClockWidget, MinimalTextClockWidget                               | none                          |
| `DashSamples/`    | NotepadWidget, EventSenderWidget, EventReceiverWidget, ThemeViewerWidget, + more                             | none                          |
| `Filesystem/`     | FilesystemWidget                                                                                             | filesystem (MCP)              |
| `Gong/`           | GongWidget                                                                                                   | gong (credential)             |

### Widget Grouping by Workspace

Widgets that share a `workspace` key in their `.dash.js` config are related and often work together. For example, all Slack widgets share `workspace: "slack"`.

---

## Event Wiring

### The Pub/Sub System

Widgets communicate through a publish/subscribe event system:

1. **Publisher** declares events in `.dash.js`:

    ```javascript
    events: ["search-completed", "item-selected"],
    ```

2. **Subscriber** declares event handlers in `.dash.js`:

    ```javascript
    eventHandlers: ["search-completed"],
    ```

3. **Publisher** sends events at runtime:

    ```javascript
    api.publishEvent("search-completed", { query: "test", count: 42 });
    ```

4. **Subscriber** listens at runtime:
    ```javascript
    api.registerListeners(["search-completed"], {
        "search-completed": (payload) => {
            console.log("Search for:", payload.query);
        },
    });
    ```

### Common Event Patterns

| Pattern               | Publisher Event                           | Subscriber Behavior                  |
| --------------------- | ----------------------------------------- | ------------------------------------ |
| List → Detail         | `item-selected` (with item ID)            | Loads and displays the selected item |
| Search → Results      | `search-completed` (with query + results) | Updates display with results         |
| Filter → Display      | `filter-changed` (with filter criteria)   | Re-filters displayed data            |
| Action → Notification | `action-completed` (with status)          | Shows success/error notification     |

### Tips

-   Event names should be kebab-case: `search-completed`, not `searchCompleted`
-   Payloads should be plain objects (no functions, no circular refs)
-   Widgets can both publish and listen to events
-   Events are dashboard-scoped — they don't cross dashboards

---

## Provider Setup

### Provider Types

| Service         | Type              | Class        | Credentials                                    |
| --------------- | ----------------- | ------------ | ---------------------------------------------- |
| GitHub          | `github`          | `mcp`        | `{ token: "ghp_..." }`                         |
| Slack           | `slack`           | `mcp`        | `{ botToken: "xoxb-...", teamId: "T..." }`     |
| Algolia         | `algolia`         | `credential` | `{ appId: "...", apiKey: "..." }`              |
| Notion          | `notion`          | `mcp`        | `{ apiKey: "ntn_..." }`                        |
| OpenAI          | `openai`          | `credential` | `{ apiKey: "sk-..." }`                         |
| Google Drive    | `google-drive`    | `mcp`        | `{ credentialsJson: "..." }`                   |
| Gmail           | `gmail`           | `mcp`        | `{ credentialsJson: "..." }`                   |
| Google Calendar | `google-calendar` | `mcp`        | `{ credentialsJson: "..." }`                   |
| Brave Search    | `brave-search`    | `mcp`        | `{ apiKey: "..." }`                            |
| Gong            | `gong`            | `credential` | `{ accessKey: "...", accessKeySecret: "..." }` |
| Filesystem      | `filesystem`      | `mcp`        | `{ allowedDirectories: "/path/to/dir" }`       |

### Adding via MCP

```
add_provider({
    name: "My GitHub",
    type: "github",
    credentials: { token: "ghp_..." },
    providerClass: "mcp"
})
```

### Checking Widget Requirements

Before adding a widget, check if it requires a provider:

1. Search or list widgets — look at the `providers` field
2. If `required: true`, the provider must be configured before the widget functions
3. Use `list_providers` to see what's already connected

---

## Layout System

### Grid Layouts

The `LayoutGridContainer` is the primary layout mechanism:

```javascript
{
    id: 1,
    component: "LayoutGridContainer",
    parentId: 0,
    config: {
        columns: 2,   // Number of columns
        rows: 1,       // Number of rows
    },
}
```

Widgets placed inside a grid container are arranged left-to-right, top-to-bottom based on their `order` value.

### Nesting

Containers can be nested for complex layouts:

```
LayoutGridContainer (2 cols)
├── SlackWidget (order: 0)
├── LayoutGridContainer (1 col, order: 1)
│   ├── GitHubPRList (order: 0)
│   └── GitHubIssueList (order: 1)
```

### Editing Layouts

-   **In-app:** Use the Layout Builder (edit mode) to drag, resize, and rearrange
-   **Via MCP:** Add widgets with `add_widget` — they append to the root container
-   **Programmatic:** Construct the `layout` array directly (for `publishKitchenSink.js` pattern)

---

## Dashboard Distribution

### Registry

Publish from the app: Settings > Dashboards > Publish to Registry.

When users install a dashboard from the registry:

-   The dashboard config is extracted and saved
-   Missing widget dependencies are auto-resolved from the registry
-   Missing providers are flagged for the user to configure

### ZIP

Export from the app: Settings > Dashboards > Export.

The ZIP contains:

-   `.dashboard.json` — full layout + widget configs + event wiring
-   `manifest.json` — metadata (name, version, description, dependencies)

Recipients install via: Settings > Dashboards > Import from File.

### Kitchen Sink Pattern

For programmatic dashboard publishing, see `scripts/publishKitchenSink.js`:

1. Build a dashboard config object with hardcoded layout
2. Build a manifest with widget dependencies listed
3. Create a ZIP with both files
4. Publish to registry via shared auth module (`scripts/lib/registryAuth.js`)
