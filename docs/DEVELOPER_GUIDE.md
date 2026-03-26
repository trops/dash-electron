# Dash Developer Guide

The complete guide to building widgets, dashboards, and themes with Dash. This document covers the full development lifecycle for all three asset types across all distribution channels.

**Quick links:** [Script Reference](./SCRIPTS.md) | [Quick Start](./QUICK_START.md) | [README](../README.md)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Widget Development Lifecycle](#3-widget-development-lifecycle)
4. [Dashboard Development Lifecycle](#4-dashboard-development-lifecycle)
5. [Theme Development Lifecycle](#5-theme-development-lifecycle)
6. [Distribution Channels](#6-distribution-channels)
7. [Cross-Repo Development](#7-cross-repo-development)
8. [MCP Dash Server](#8-mcp-dash-server)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Introduction

### What is Dash?

Dash is an Electron-based dashboard framework built with React. It provides a widget system with dependency injection, theming, and a provider system for managing external service integrations (Slack, GitHub, Gmail, Algolia, and more) through the Model Context Protocol (MCP).

### The Three Repos

| Repo                                                    | Branch   | Purpose                                          |
| ------------------------------------------------------- | -------- | ------------------------------------------------ |
| [dash-electron](https://github.com/trops/dash-electron) | `master` | Template app -- where you build your dashboard   |
| [dash-core](https://github.com/trops/dash-core)         | `master` | Framework -- widget system, providers, MCP, APIs |
| [dash-react](https://github.com/trops/dash-react)       | `main`   | UI library -- 50+ themed React components        |

**dash-electron** is the repo you clone and build on. It depends on dash-core (framework) and dash-react (components), which are installed as npm packages. You only need the other repos if you are modifying the framework itself (see [Cross-Repo Development](#7-cross-repo-development)).

### The Three Asset Types

| Asset     | What it is                                           | File format                |
| --------- | ---------------------------------------------------- | -------------------------- |
| Widget    | React component + `.dash.js` config                  | `.js` + `.dash.js`         |
| Dashboard | Workspace configuration with layout, widgets, events | `.dashboard.json` (in ZIP) |
| Theme     | Color palette with Tailwind color token mappings     | `.theme.json` (in ZIP)     |

### The Three Distribution Channels

| Channel  | Use case                          | Update system | Install path                     |
| -------- | --------------------------------- | ------------- | -------------------------------- |
| Registry | Primary path for end users        | Yes           | Discover tab / Dashboard Wizard  |
| ZIP      | Offline, private, or team sharing | No            | Settings > [asset type] > Import |
| Built-in | Custom apps with compiled widgets | No            | `src/Widgets/` at build time     |

---

## 2. Getting Started

### Prerequisites

-   **Node.js** v18, v20, or v22 (LTS). Use [nvm](https://github.com/nvm-sh/nvm) for version management.
-   **Python 3** -- required for `node-gyp` native module compilation
-   **XCode** -- required for packaging Electron applications
-   **npm** -- for installing dependencies

### Setup

1. **Create your repo** from the template:

    On GitHub, click **Use this template > Create a new repository** from [trops/dash-electron](https://github.com/trops/dash-electron).

2. **Clone and install:**

    ```bash
    git clone https://github.com/your-org/your-dashboard.git
    cd your-dashboard
    npm run setup
    ```

3. **Start developing:**

    ```bash
    npm run dev
    ```

    This launches the React dev server (port 3000), Tailwind CSS watcher, and the Electron app with hot reload.

4. **Verify:** The app opens with an empty state. You can create a blank dashboard, use the Wizard, or start building widgets.

For detailed setup troubleshooting, see [QUICK_START.md](./QUICK_START.md).

---

## 3. Widget Development Lifecycle

Widgets are the core building blocks of Dash dashboards. The full lifecycle is: **Create > Develop > Test > Package > Publish > Distribute**.

### 3.1 Create

Scaffold a new widget:

```bash
npm run widgetize MyWidget
```

This creates:

```
src/Widgets/MyWidget/
├── widgets/
│   ├── MyWidget.js              # React component
│   └── MyWidget.dash.js         # Configuration & metadata
├── contexts/
│   ├── MyWidgetContext.js        # React context (optional)
│   └── index.js
└── index.js                      # Barrel export
```

The scaffold is automatically wired into `src/Widgets/index.js`.

### 3.2 Develop

Start the dev server:

```bash
npm run dev
```

Changes auto-reload without restarting the app. Open DevTools with `Cmd+Shift+I` to debug.

#### Widget Component

Every widget receives an `api` prop for data persistence and event communication:

```javascript
import { Widget, Panel, Heading, SubHeading } from "@trops/dash-react";

export const MyWidget = ({ title = "Hello", api, ...props }) => {
    // Store data (persisted to disk)
    const handleSave = () => api.storeData({ timestamp: Date.now() });

    // Read data
    useEffect(() => {
        api.readData({
            callbackComplete: (data) => console.log("Loaded:", data),
            callbackError: (err) => console.error(err),
        });
    }, []);

    return (
        <Widget {...props}>
            <Panel>
                <Heading text={title} />
                <button onClick={handleSave}>Save</button>
            </Panel>
        </Widget>
    );
};
```

#### Widget Configuration (`.dash.js`)

```javascript
import { MyWidget } from "./MyWidget";

const widgetDefinition = {
    component: MyWidget,
    type: "widget",
    workspace: "my-workspace",
    displayName: "My Widget",
    description: "A short description of what this widget does",
    icon: "star",

    // User-configurable fields (shown in Settings)
    userConfig: {
        title: {
            type: "text", // text | number | boolean | select | color | password
            defaultValue: "My Widget",
            displayName: "Title",
            instructions: "The widget title",
            required: true,
        },
    },

    // Provider requirements (MCP or credential-based)
    providers: [
        {
            type: "slack",
            providerClass: "mcp", // "mcp" or "credential"
            required: true,
        },
    ],

    // Inter-widget events
    events: ["search-completed"],
    eventHandlers: ["item-selected"],

    // Default styles (Tailwind classes)
    styles: {
        backgroundColor: "bg-white dark:bg-gray-900",
        borderColor: "border-gray-200",
    },
};

export default widgetDefinition;
```

**userConfig types:** `text`, `number`, `boolean`, `select` (requires `options` array), `color`, `password`

#### MCP Integration

Access external services through the MCP provider system:

```javascript
import { useMcpProvider } from "@trops/dash-core";

export const SlackWidget = ({ api, ...props }) => {
    const mcp = useMcpProvider("slack");

    const searchMessages = async (query) => {
        const result = await mcp.callTool("search_messages", { query });
        return result;
    };

    // mcp provides: isConnected, isConnecting, error, tools, resources,
    //               callTool(), readResource(), connect(), disconnect()
};
```

#### Widget Communication (Pub/Sub)

Widgets communicate through events:

```javascript
// Publisher
api.publishEvent("search-completed", { query: "test", results: 42 });

// Subscriber
api.registerListeners(["search-completed"], {
    "search-completed": (payload) => console.log("Query:", payload.query),
});
```

#### Import Rules

All UI components **must** come from `@trops/dash-react`. All core hooks **must** come from `@trops/dash-core`:

```javascript
// CORRECT
import { Widget, Panel, Button, ThemeContext } from "@trops/dash-react";
import { FontAwesomeIcon } from "@trops/dash-react";
import { useMcpProvider, useDashboard } from "@trops/dash-core";

// WRONG - creates dual context instances or duplicates dependencies
import { ThemeContext } from "./Context/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
```

**Deep-dive:** [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md) | [Widget API](https://github.com/trops/dash-core/blob/master/docs/WIDGET_API.md) | [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)

### 3.3 Test

#### In-App Testing

With `npm run dev` running, add your widget to a dashboard and verify:

-   Widget renders correctly
-   User config fields appear in the edit modal
-   Default values are applied
-   Data persistence works (save > reload > data is present)
-   Events publish and listeners receive
-   Provider credentials are accessible
-   MCP tools return data
-   Error boundary catches widget errors

#### Automated Tests

```bash
npm run test:widgets     # Widget integration tests
npm run test:e2e         # Playwright end-to-end tests
npm run test:all         # Both
```

#### Visual Inspection

Capture a screenshot of the running app:

```bash
npm run screenshot                                    # Full window
npm run screenshot -- --click "Home"                  # Navigate to workspace
npm run screenshot -- --selector ".sidebar" /tmp/s.png  # Element only
```

See the [navigation map](../CLAUDE.md) for feature-area-specific screenshot commands.

### 3.4 Package

Bundle widgets for distribution:

```bash
# Bundle all widgets in src/Widgets/ via Rollup
npm run package-widgets

# Bundle + create distributable ZIP with dash.json metadata
npm run package-zip

# Package a single widget
npm run package-zip -- --widget MyWidget
```

**Output:** `widgets-{name}-v{version}.zip` in the project root, containing:

```
dist/               # Bundled CJS + ESM files
configs/            # .dash.js config files
dash.json           # Package metadata (name, version, widgets, workspaces)
```

### 3.5 Publish

#### To the Registry

```bash
# Publish all widgets
npm run publish-to-registry -- --all

# Publish a single widget
npm run publish-to-registry -- --widget MyWidget

# Preview manifest without publishing
npm run publish-to-registry -- --dry-run

# Override registry name
npm run publish-to-registry -- --widget MyWidget --name custom-name

# Custom source directory
npm run publish-to-registry -- --all --dir src/SampleWidgets
```

The publish pipeline:

1. Builds manifest from `.dash.js` metadata
2. Validates against registry schema
3. Authenticates via OAuth device flow (opens browser)
4. Bundles widgets via Rollup
5. Creates ZIP with `packageZip.js`
6. Uploads ZIP + manifest to registry API

**Flags:** `--widget <Name>`, `--all`, `--dir <path>`, `--dry-run`, `--name <name>`, `--republish`

#### As an npm Package

1. Update `package.json` with your widget package name and version
2. Bundle: `npm run package-widgets`
3. Publish: `npm publish` (or push to GitHub for automated publishing)
4. Consumers import and register:

    ```javascript
    import * as MyWidgets from "@your-org/my-widgets/dist";
    import { ComponentManager } from "@trops/dash-core";

    Object.keys(MyWidgets).forEach((name) => {
        ComponentManager.registerWidget(MyWidgets[name], name);
    });
    ```

**Deep-dive:** [Widget Registry](https://github.com/trops/dash-core/blob/master/docs/WIDGET_REGISTRY.md)

### 3.6 Distribute

| Channel  | How to create                                   | How recipients install                              |
| -------- | ----------------------------------------------- | --------------------------------------------------- |
| Registry | `npm run publish-to-registry`                   | Discover tab > Install                              |
| ZIP      | `npm run package-zip`                           | Settings > Widgets > Install from ZIP               |
| npm      | `npm publish`                                   | `npm install` + `ComponentManager.registerWidget()` |
| Built-in | Place in `src/Widgets/`, export from `index.js` | Compiled into the app bundle                        |

**Sharing ZIPs:** Email, Slack, internal file share, CDN, or any file transfer method. Recipients install via Settings > Widgets > Install from ZIP.

---

## 4. Dashboard Development Lifecycle

Dashboards are workspace configurations that combine widgets, grid layouts, event wiring, and theme assignments.

### 4.1 Create

#### Using the Dashboard Wizard (Recommended)

The built-in Wizard guides you through:

1. Choose a creation method (blank, from template, from registry)
2. Browse and select widgets from the registry
3. Auto-installs selected widgets
4. Creates the dashboard with a configured grid layout

Access the Wizard from the empty state or the sidebar.

#### Using the MCP Dash Server

If you have the MCP Dash Server enabled (see [Section 8](#8-mcp-dash-server)), create dashboards programmatically:

```
# From Claude Desktop, Cursor, or any MCP client:
create_dashboard("My DevOps Dashboard")
add_widget(dashboardId, "SlackWidget")
add_widget(dashboardId, "GitHubWidget")
configure_widget(widgetId, { title: "PR Activity" })
```

#### Blank Dashboard

Click "New Dashboard" from the sidebar or empty state. Add widgets manually via the widget dropdown in the layout builder.

### 4.2 Configure

#### Layout

Dashboards use a grid-based layout system. In edit mode:

-   Drag widgets to reposition
-   Resize grid cells
-   Add/remove rows and columns
-   Nest containers for complex layouts

#### Event Wiring

Connect widgets through the pub/sub system:

1. Open a widget's settings
2. Under "Event Handlers", select which events the widget listens to
3. Map each event to a handler function

Example: A search widget publishes `search-completed`; a results widget listens for it and updates its display.

#### Provider Requirements

When a dashboard uses widgets that need providers (Slack, GitHub, etc.), users configure credentials in Settings > Providers. The dashboard automatically connects widgets to their configured providers.

### 4.3 Export

#### From the App

1. Go to **Settings > Dashboards**
2. Click on a dashboard
3. Click **Export** to save a `.dashboard.json` ZIP

The exported ZIP contains:

-   Dashboard layout configuration
-   Widget dependencies (component names, not code)
-   Event wiring between widgets
-   Theme assignment (if any)

#### Sharing Dashboard ZIPs

Share the exported ZIP via email, Slack, or file share. Recipients install via **Settings > Dashboards > Import from File**.

When importing, any missing widget dependencies are flagged and can be resolved from the registry.

### 4.4 Publish

#### From the App

1. Go to **Settings > Dashboards**
2. Click on a dashboard
3. Click **Publish to Registry**
4. Authenticate via OAuth (if not already authenticated)
5. Add a description, tags, and icon
6. Submit

Published dashboards appear in the Discover tab for other users.

**Deep-dive:** [Dashboard Marketplace PRD](https://github.com/trops/dash-core/blob/master/docs/requirements/prd/dashboard-marketplace.md)

### 4.5 Distribute

| Channel  | How to create                      | How recipients install                   |
| -------- | ---------------------------------- | ---------------------------------------- |
| Registry | Publish from Settings > Dashboards | Discover tab > Dashboards > Install      |
| ZIP      | Export from Settings > Dashboards  | Settings > Dashboards > Import from File |

**Auto-dependency resolution:** When a user installs a dashboard from the registry, any missing widget dependencies are automatically installed. ZIP-imported dashboards show missing widgets and offer registry lookup.

---

## 5. Theme Development Lifecycle

Themes define the color palette for the entire Dash application -- 85+ themed components from buttons to cards to navigation.

### 5.1 Create

#### From the Theme Editor (In-App)

1. Go to **Settings > Themes**
2. Click **Create New Theme**
3. Choose a method:
    - **Presets** -- 15 built-in color combinations
    - **Random** -- algorithmically generated
    - **Custom** -- pick primary, secondary, and tertiary colors manually
4. Name your theme and save

#### From the CLI (`themeize`)

Create a theme from color names without the running app:

```bash
# Explicit colors
npm run themeize "Corporate Blue" --primary blue --secondary slate --tertiary amber

# Color harmony (auto-generates secondary/tertiary)
npm run themeize "Ocean" --primary cyan --harmony triadic

# Random theme
npm run themeize "Surprise" --random

# List valid color names
npm run themeize -- --list-colors
```

**Output:** `themes/{name}.theme.json` -- installable via Settings > Themes > Install from ZIP, or publishable via `npm run publish-themes -- --from-file themes/{name}.theme.json`.

**Harmony strategies:** `complementary`, `triadic`, `analogous`, `split-complementary`

#### From a Website URL (MCP)

With the MCP Dash Server enabled:

```
create_theme_from_url("https://your-company.com")
```

This extracts brand colors from the website and generates a matching theme.

#### From Color Values (MCP)

```
create_theme({ primary: "#3b82f6", secondary: "#10b981", tertiary: "#f59e0b" })
```

### 5.2 Customize

Themes use Tailwind CSS color tokens mapped to component roles:

| Token     | Maps to                                    | Example   |
| --------- | ------------------------------------------ | --------- |
| Primary   | Buttons, links, active states, focus rings | `blue`    |
| Secondary | Backgrounds, cards, panels, containers     | `emerald` |
| Tertiary  | Accents, badges, highlights, notifications | `amber`   |

Each token generates a full shade scale (100-900) for both light and dark mode. The theme engine automatically derives hover, active, disabled, and focus states.

**Preview:** Toggle theme preview in the Theme editor to see changes in real-time without applying them globally.

### 5.3 Export

#### From the App

1. Go to **Settings > Themes**
2. Select a theme
3. Click **Publish** -- the ZIP is saved locally before publishing to the registry

#### Batch Export (Curated Themes)

```bash
# Save all 10 curated themes as local ZIPs
npm run publish-themes -- --local
```

Output: `themes/theme-{name}-v{version}.zip` files.

### 5.4 Publish

#### From the App

1. Go to **Settings > Themes**
2. Select a theme
3. Click **Publish to Registry**
4. Authenticate via OAuth
5. Submit

#### From the CLI

```bash
# Publish all 10 curated themes
npm run publish-themes

# Publish a single curated theme
npm run publish-themes -- --theme nordic-frost

# Publish a custom theme created with themeize
npm run publish-themes -- --from-file themes/corporate-blue.theme.json

# Publish all .theme.json files in a directory
npm run publish-themes -- --from-file themes/

# Preview without publishing
npm run publish-themes -- --dry-run
```

**Flags:** `--theme <name>`, `--from-file <path>`, `--dry-run`, `--local`, `--republish`

### 5.5 Distribute

| Channel  | How to create                        | How recipients install               |
| -------- | ------------------------------------ | ------------------------------------ |
| Registry | Publish from app or `publish-themes` | Discover tab > Themes > Install      |
| ZIP      | Export from app or `--local` flag    | Settings > Themes > Install from ZIP |

**Sharing ZIPs:** Theme ZIPs are small (manifest.json + .theme.json). Share via email, Slack, or file share. Recipients install via Settings > Themes > Install from ZIP.

---

## 6. Distribution Channels

### 6.1 Registry (Primary Channel)

The Dash Registry is the primary distribution channel. It supports three package types: **widgets**, **dashboards**, and **themes**.

**How it works:**

1. Publishers authenticate via OAuth device flow (browser-based, no stored credentials)
2. Assets are uploaded as ZIPs with manifest metadata
3. The registry assigns scoped identifiers: `@scope/name` (e.g., `@trops/slack`)
4. Users browse the Discover tab or Dashboard Wizard to find and install assets
5. Installed registry assets participate in the update system -- the app checks for new versions

**Authentication:** All registry operations (search, install, publish) require OAuth authentication. The device code flow opens your browser, you authorize, and the token is used for the current session.

**Update system:** `registryController.checkUpdates()` matches installed widgets to registry packages by scoped ID and notifies users when newer versions are available. Only registry-installed assets get updates -- ZIP and built-in assets are developer-managed.

**Deep-dive:** [Widget Installation Model PRD](https://github.com/trops/dash-core/blob/master/docs/requirements/prd/widget-installation-model.md)

### 6.2 ZIP (Offline / Private)

ZIP distribution is for offline, private, or team-internal sharing. No registry account required.

**ZIP structure by asset type:**

| Asset     | ZIP contents                                            | Created by                          |
| --------- | ------------------------------------------------------- | ----------------------------------- |
| Widget    | `dist/` (bundles) + `configs/` (.dash.js) + `dash.json` | `npm run package-zip`               |
| Dashboard | `.dashboard.json` (layout, widgets, events, theme)      | Settings > Dashboards > Export      |
| Theme     | `manifest.json` + `{name}.theme.json`                   | `npm run publish-themes -- --local` |

**Sharing methods:**

-   Email attachment
-   Slack file upload
-   Internal file share (Google Drive, SharePoint, etc.)
-   CDN or static hosting (download link)
-   Git repository (committed ZIP files)

**Installing ZIPs:**

| Asset     | Install path                             |
| --------- | ---------------------------------------- |
| Widget    | Settings > Widgets > Install from ZIP    |
| Dashboard | Settings > Dashboards > Import from File |
| Theme     | Settings > Themes > Install from ZIP     |

**Security:** All ZIP extractions are validated against path traversal attacks. Entries with `..` segments, absolute paths, or paths that resolve outside the target directory are rejected.

### 6.3 Built-in (Developer Bundled)

For developers who ship custom Dash applications with widgets compiled into the app bundle.

**How it works:**

1. Place widgets in `src/Widgets/MyWidget/`
2. Export from `src/Widgets/index.js`
3. `Dash.js` auto-registers all exports with `ComponentManager.registerWidget()`
4. Widgets are compiled into the app bundle -- no download or extraction needed

**When to use built-in:**

-   You are building a private dashboard app for your team
-   You need widgets available without internet access
-   You want full control over widget versions (no registry updates)

**Trade-offs:**

-   No automatic updates (you manage versions through app releases)
-   App bundle grows with each widget
-   Users cannot install/uninstall individual widgets

**Default state:** The dash-electron template ships with an empty `src/Widgets/index.js`. The registration loop runs but registers nothing. Developers add their own widgets as needed.

**Reference implementations:** See `src/SampleWidgets/` for 12 full working examples (Slack, Gmail, GitHub, Algolia, etc.). These are not compiled into the app -- they exist purely as developer reference.

---

## 7. Cross-Repo Development

When your changes require modifying the framework (dash-core) or UI library (dash-react) alongside dash-electron, follow the cross-repo workflow.

### When You Need Cross-Repo

-   Adding a new hook or API to dash-core
-   Adding or modifying a component in dash-react
-   Fixing a framework bug that affects your widget
-   Adding a new provider type

### Workflow

1. **Sync all repos:**

    ```bash
    cd ~/Development/dash-core/dash-core && git pull origin master
    cd ~/Development/dash-react/dash-react && git pull origin main
    cd ~/Development/dash-electron/dash-electron && git pull origin master
    ```

2. **Make changes in the dependency repo first** (dash-core or dash-react). Run its CI:

    ```bash
    cd ~/Development/dash-core/dash-core
    npm run ci
    ```

3. **Link the local version into dash-electron:**

    ```bash
    # Link dash-core
    npm run link-core -- ~/Development/dash-core/dash-core

    # Link dash-react
    npm run link-react -- ~/Development/dash-react/dash-react
    ```

4. **Test in dash-electron:**

    ```bash
    npm run dev
    ```

5. **Unlink when done:**

    ```bash
    npm run unlink-core    # Restores published version
    npm run unlink-react   # Restores published version
    ```

6. **Ship the dependency repo first.** Wait for npm publish to complete before updating dash-electron.

**Important:** Never modify dash-electron to work around a missing dash-core change. Fix it at the source.

**Deep-dive:** See the cross-repo-dev skill at `.claude/skills/cross-repo-dev/SKILL.md`.

---

## 8. MCP Dash Server

Dash includes a built-in MCP server that lets external LLM clients (Claude Desktop, Cursor, or any MCP-compatible agent) control dashboards, widgets, themes, and providers programmatically.

### Setup

1. Open **Settings > MCP Server**
2. Toggle the server **On**
3. Copy the bearer token

### Connect

Add to your MCP client config (e.g., `claude_desktop_config.json`):

```json
{
    "mcpServers": {
        "dash": {
            "url": "http://127.0.0.1:3141/mcp",
            "headers": {
                "Authorization": "Bearer YOUR_TOKEN_HERE"
            }
        }
    }
}
```

### Available Tools

| Category  | Tools                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| Dashboard | `list_dashboards`, `get_dashboard`, `create_dashboard`, `delete_dashboard`, `get_app_stats` |
| Widget    | `add_widget`, `remove_widget`, `configure_widget`, `list_widgets`, `search_widgets`         |
| Theme     | `list_themes`, `get_theme`, `create_theme`, `create_theme_from_url`, `apply_theme`          |
| Provider  | `list_providers`, `add_provider`, `remove_provider`                                         |

### Available Resources

| URI                        | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `dash://dashboards/active` | Current active dashboard with layout and widgets |
| `dash://dashboards`        | Summary of all dashboards                        |
| `dash://themes`            | All saved themes                                 |
| `dash://providers`         | All configured providers (no secrets)            |
| `dash://app/info`          | Application info -- version, appId, counts       |

**Security:** Localhost-only binding, bearer token required, no secrets in responses, 60 req/min rate limit.

**Full API reference:** [MCP_DASH_SERVER.md](./MCP_DASH_SERVER.md) — all 19 tools, 3 prompts, 5 resources, setup, and usage examples.

---

## 9. CI/CD Pipeline

All releases go through `scripts/ci.sh` -- the only approved release path. Manual git commands (`git commit`, `git push`, `git tag`, `gh pr`) are not permitted.

### Commands

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run ci`         | Validate only (Prettier, Tailwind, ESLint, build)                    |
| `npm run ci:commit`  | Validate + commit + version bump                                     |
| `npm run ci:push`    | Validate + commit + version bump + push                              |
| `npm run ci:pr`      | Validate + commit + version bump + push + create PR                  |
| `npm run ci:release` | Validate + commit + version bump + push + PR + merge + tag + cleanup |

Each flag is **cumulative** -- `ci:release` runs all prior steps automatically.

### Usage

```bash
# Validate your changes before committing
npm run ci

# Full release: validate, commit, push, PR, merge, tag, cleanup
npm run ci:release -- -m "feat(widgets): add Slack integration"
```

### What ci.sh Does

1. Ensures Node 20 via nvm
2. Updates `@trops/dash-core` and `@trops/dash-react` to latest
3. Runs Prettier (auto-formats)
4. Rebuilds Tailwind CSS (if `src/index.css` or `tailwind.config.js` changed)
5. Runs CI build (ESLint warnings treated as errors)
6. Runs widget integration tests
7. Commits with message
8. Bumps patch version
9. Rebases on latest remote
10. Pushes to branch
11. Creates PR
12. Merges PR
13. Creates git tag
14. Cleans up branch

**Important:** Never run `npm run build:css` manually. Tailwind CSS is only rebuilt by ci.sh when source files have changed.

**Full script reference:** [SCRIPTS.md](./SCRIPTS.md)

---

## 10. Troubleshooting & FAQ

### Common Issues

| Problem                                      | Cause                                          | Solution                                                                     |
| -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Widget doesn't appear after scaffold         | Missing export in `src/Widgets/index.js`       | Check that `widgetize` added the export; restart `npm run dev`               |
| "Cannot find module" after linking           | Symlink not preserved                          | `npm run dev` includes `--preserve-symlinks`; don't use `npm start` directly |
| ThemeContext is undefined                    | Imported from local path instead of dash-react | Use `import { ThemeContext } from "@trops/dash-react"`                       |
| Provider not available in widget             | Reading from wrong context                     | Use `AppContext.providers`, NOT `DashboardContext.providers`                 |
| MCP tool returns error                       | Provider not configured or server not running  | Check Settings > Providers; verify MCP server is listed in catalog           |
| Hot reload not working                       | Port 3000 occupied from previous session       | Kill process: `lsof -ti:3000 \| xargs kill -9`                               |
| `npm run ci` fails on Prettier               | Unformatted code                               | Run `npm run prettify` first                                                 |
| ZIP install fails silently                   | Invalid ZIP structure or path traversal        | Ensure ZIP contains `dash.json` or `package.json` at root                    |
| Widget shows in Discover but not installable | App missing required providers                 | Toggle "Show all packages" in Discover, or configure the required provider   |

### Widget Doesn't Render Checklist

1. Is the widget exported from `src/Widgets/index.js`?
2. Does the `.dash.js` file export a default object with a `component` property?
3. Does the component import from `@trops/dash-react` (not local paths)?
4. Is `npm run dev` running (not just `npm start`)?
5. Check DevTools console for errors (`Cmd+Shift+I`)
6. If using MCP, is the provider configured in Settings > Providers?

### Provider Setup Checklist

1. Go to Settings > Providers
2. Add the provider type (e.g., Slack, GitHub)
3. Enter credentials (API token, OAuth token, etc.)
4. Verify the provider shows as "Connected"
5. In your widget, use `useMcpProvider("type")` and check `isConnected`

### Getting Help

-   **Widget examples:** Browse `src/SampleWidgets/` for 12 working implementations
-   **Component library:** See [dash-react README](https://github.com/trops/dash-react)
-   **Framework docs:** See [dash-core docs](https://github.com/trops/dash-core/tree/master/docs)
-   **Claude Code:** Open Claude Code in the project and describe what you want to build -- the built-in `dash-widget-builder` skill activates automatically

---

**Related Documentation:**

-   [Script Reference](./SCRIPTS.md) -- Complete npm script documentation
-   [Quick Start](./QUICK_START.md) -- Setup and common commands
-   [Development Workflow](./DEVELOPMENT_WORKFLOW.md) -- File detection, hot reload, debugging
-   [dash-core Documentation Index](https://github.com/trops/dash-core/blob/master/docs/INDEX.md) -- Framework reference
-   [dash-react README](https://github.com/trops/dash-react) -- Component library
