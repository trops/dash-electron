---
description: Build dashboards by assembling widgets, wiring events, and configuring providers. Use this skill when the user wants to create a dashboard, assemble widgets into a layout, connect services, wire events between widgets, or publish a dashboard configuration. Trigger on "create a dashboard", "build a dashboard", "dashboard layout", "assemble widgets", "dashboard config", "wire events", "dashboard for [service]".
---

# Dashboard Builder

Build a complete dashboard by discovering widgets, assembling a layout, wiring inter-widget events, and optionally publishing to the registry.

**Before starting:** Read [dashboard-assembly.md](references/dashboard-assembly.md) for the dashboard config schema, widget discovery patterns, and event wiring conventions.

---

## Phase 1: Discover

**Goal:** Find the right widgets for the user's use case and check provider availability.

1. **Understand the user's goal** — ask what they want to monitor, manage, or track.

2. **Search the widget registry** for matching widgets:

    - If the MCP Dash server is running and connected, use `search_widgets` and `list_widgets` tools
    - Otherwise, check `src/SampleWidgets/` for available widget packages:
        ```bash
        ls src/SampleWidgets/
        ```
    - For each matching widget, note:
        - Component name (used in `add_widget`)
        - Provider requirements (which services it needs)
        - Events it publishes/listens to (for wiring in Phase 3)

3. **Check existing providers:**

    - MCP route: use `list_providers` tool
    - Manual route: check Settings > Providers in the running app

4. **Present a widget selection plan** to the user:
    - List the widgets to add
    - Note any providers that need to be configured
    - Identify widgets that can communicate via events
    - **Wait for user approval before proceeding**

---

## Phase 2: Assemble

**Goal:** Create the dashboard and populate it with widgets.

### Via MCP (if the Dash MCP server is available)

1. Create the dashboard:
    ```
    create_dashboard("Dashboard Name")
    ```
2. Add each widget:
    ```
    add_widget(widgetName, dashboardId)
    ```
3. Configure each widget with appropriate defaults:
    ```
    configure_widget(widgetId, { title: "...", ...config })
    ```

### Via Code (for built-in widgets)

1. Widgets must already exist in `src/Widgets/` or `src/SampleWidgets/`
2. Register them in `src/Widgets/index.js`
3. Start the dev server: `npm run dev`
4. Use the in-app Dashboard Wizard or Layout Builder to add widgets manually

### Set up missing providers

For each required provider not yet configured:

-   MCP route: `add_provider(name, type, credentials)`
-   Manual route: Settings > Providers > Add Provider

Refer to the [provider setup section](references/dashboard-assembly.md#provider-setup) for credential guides per service.

---

## Phase 3: Wire

**Goal:** Connect widgets that should communicate via events.

1. **Identify event pairs** — widgets that publish events other widgets should listen to:

    - **List + Detail pattern**: list widget publishes `item-selected`, detail widget listens
    - **Search + Results pattern**: search widget publishes `search-completed`, results widget listens
    - **Filter + Display pattern**: filter widget publishes `filter-changed`, display widgets listen

2. **Configure event wiring** in the widget's `.dash.js` config:

    ```javascript
    // Publisher declares events
    events: ["search-completed"],

    // Subscriber declares event handlers
    eventHandlers: ["search-completed"],
    ```

3. **Implement event handling** in the widget component:

    ```javascript
    // Publisher
    api.publishEvent("search-completed", { query, results });

    // Subscriber
    api.registerListeners(["search-completed"], {
        "search-completed": (payload) => {
            /* handle */
        },
    });
    ```

4. **Test the flow** with `npm run dev` — trigger an event in one widget and verify the subscriber reacts.

---

## Phase 4: Publish (Optional)

**Goal:** Export the dashboard for distribution.

### To the Registry (from the app)

1. Go to Settings > Dashboards
2. Select the dashboard
3. Click **Publish to Registry**
4. Authenticate, add description and tags, submit

### As a ZIP (for offline sharing)

1. Go to Settings > Dashboards
2. Select the dashboard
3. Click **Export** — saves a `.dashboard.json` ZIP
4. Share via email, Slack, or file share

### Programmatic Publishing

For scripted publishing, follow the pattern in `scripts/publishKitchenSink.js`:

1. Build a dashboard config object (layout, widgets, event wiring, theme)
2. Create a ZIP with `manifest.json` + `.dashboard.json`
3. Use the registry auth module to publish

---

## Quick Reference

| Task              | MCP Tool                         | Manual Path                     |
| ----------------- | -------------------------------- | ------------------------------- |
| Create dashboard  | `create_dashboard`               | Sidebar > New Dashboard         |
| Find widgets      | `search_widgets`, `list_widgets` | `ls src/SampleWidgets/`         |
| Add widget        | `add_widget`                     | Layout Builder > Add Widget     |
| Configure widget  | `configure_widget`               | Widget > Settings               |
| Check providers   | `list_providers`                 | Settings > Providers            |
| Add provider      | `add_provider`                   | Settings > Providers > Add      |
| Apply theme       | `apply_theme`                    | Settings > Themes               |
| Export dashboard  | —                                | Settings > Dashboards > Export  |
| Publish dashboard | —                                | Settings > Dashboards > Publish |
