# Dash-Electron — Electron App Template

## Project Overview

Dash-electron is a thin Electron application template built on two core packages:

-   **[@trops/dash-core](https://github.com/trops/dash-core)** — Core framework: contexts, hooks, models, controllers, APIs, widget system, provider architecture
-   **[@trops/dash-react](https://github.com/trops/dash-react)** — UI component library: Panel, Button, Widget, Workspace, ThemeContext, etc.

This template provides the application shell, template-specific widgets, and Electron main process wiring. All framework logic lives in `@trops/dash-core`.

**What this template adds:**

-   Electron main process (`electron.js`) with IPC handler registration
-   Preload bridge (`preload.js`) using `defaultMainApi` from dash-core
-   App entry point (`Dash.js`) with widget registration and external widget loading
-   Template-specific widgets (`src/Widgets/DashSamples/`)
-   Template-specific API extensions (algolia, openai, menuItems, plugins)
-   Build/packaging scripts for Electron .dmg distribution

## Product Requirements Documentation

**Location:** `docs/requirements/`

Before implementing features, check for relevant Product Requirements Documents (PRDs):

### Workflow

**1. Check if PRD exists**

```bash
ls docs/requirements/prd/
```

**2. Read PRD before implementing**

-   PRDs define WHY features exist and WHO they're for
-   User stories contain acceptance criteria (what defines success)
-   User workflows show expected behavior with concrete examples

**3. When implementing user stories:**

-   [ ] Read related PRD for full context (problem statement, personas)
-   [ ] Review acceptance criteria - each criterion should be testable
-   [ ] Check technical notes for implementation hints and constraints
-   [ ] Review user workflows for expected behavior and time estimates
-   [ ] Consider edge cases documented in stories
-   [ ] Consult technical docs linked from PRD for architecture details

**4. Testing PRD acceptance criteria:**

```bash
npm run test:prd layout-builder-hybrid
npm run test:prd layout-builder-hybrid --checklist
npm run prd:coverage layout-builder-hybrid
```

### Creating New PRDs

```bash
npm run prdize "Feature Name"
npm run prdize "Feature Name" --dry-run
```

**See:** [docs/requirements/README.md](docs/requirements/README.md) for complete PRD documentation

## Architecture

Dash-electron is a thin scaffold. The core architecture (widgets, workspaces, providers, contexts, MCP, widget API) is defined in `@trops/dash-core`.

**Technology Stack:**

-   **Runtime**: Electron 39 + Node.js v18/v20/v22
-   **Core Framework**: @trops/dash-core (contexts, hooks, models, controllers)
-   **UI Library**: @trops/dash-react (components, ThemeContext)
-   **Styling**: TailwindCSS 3
-   **Build**: Create React App (craco) + Rollup (widgets)
-   **Packaging**: Electron Forge

**For complete architecture docs, see:** [@trops/dash-core documentation](https://github.com/trops/dash-core)

## Directory Structure

Only template-specific files live here. Everything else comes from `@trops/dash-core`.

```
./
├── src/
│   ├── Dash.js                 # Main app: widget registration, external widget loading
│   ├── index.js                # React entry point (HashRouter + Dash)
│   ├── index.css               # Tailwind CSS input
│   ├── Mock/                   # Mock data for development
│   └── Widgets/                # Template-specific widgets
│       ├── DashSamples/        # Sample widgets
│       │   ├── widgets/        # Widget components + .dash.js configs
│       │   ├── workspaces/     # Workspace container
│       │   └── contexts/       # Widget-local contexts
│       └── index.js            # Widget barrel export
├── public/
│   ├── electron.js             # Electron main process (IPC handler registration)
│   ├── preload.js              # Context bridge (defaultMainApi from dash-core)
│   ├── index.html              # HTML shell
│   └── tailwind.css            # Built CSS output
├── scripts/                    # Build, validation, and utility scripts
│   ├── widgetize.js            # Generate new widget scaffold
│   ├── validate.sh             # Automated validation
│   ├── prdize.js               # Generate PRD from template
│   └── setup.sh                # Environment setup
├── docs/                       # Documentation
├── e2e/                        # Playwright end-to-end tests
├── package.json
├── craco.config.js             # React build configuration
├── rollup.config.mjs           # Widget bundling config
└── tailwind.config.js          # TailwindCSS config
```

## Development Workflow

### Environment Setup

**Prerequisites:**

-   Node.js v18, v20, or v22 (NOT v24+)
-   Python 3 (for node-gyp)
-   XCode (for packaging)

**Initial Setup:**

```bash
cp .env.default .env
# Edit .env as needed
npm run setup
```

### Development Commands

```bash
# Start dev server + Electron with hot reload
npm run dev

# Build production version
npm run build

# Package widgets for distribution
npm run package-widgets

# Create Mac .dmg distributable
npm run package

# Generate new widget scaffold
node ./scripts/widgetize MyWidget

# Prettify code
npm run prettify

# Bump version
npm run bump
```

### Hot Reload Development

When you run `npm run dev`:

1. Tailwind CSS watcher starts (rebuilds on class changes)
2. React dev server starts at http://localhost:3000
3. Electron app launches and connects to dev server
4. File changes automatically reload without restart
5. DevTools are available for debugging

## Key Files and Locations

### Dash.js — Main App Component

**File:** [src/Dash.js](src/Dash.js)

-   Imports all local widgets from `src/Widgets/` and registers them with `ComponentManager`
-   Creates `ElectronDashboardApi` instance from `@trops/dash-core`
-   Loads installed external widgets via two-phase loading (CJS bundles first, config fallback second)
-   Renders `DashboardStage` from `@trops/dash-core` with the API and credentials
-   Listens for widget install/load events for hot reload

### index.js — Entry Point

**File:** [src/index.js](src/index.js)

Renders the React app with `HashRouter` wrapping the `Dash` component.

### electron.js — Main Process

**File:** [public/electron.js](public/electron.js)

Creates the Electron `BrowserWindow` and registers all IPC handlers. Imports controllers and events from `@trops/dash-core/electron`, then wires them to `ipcMain.handle()` calls. Includes both core handlers (workspaces, themes, providers, MCP, registry) and template-specific handlers (algolia, openai, menuItems, plugins).

### preload.js — Context Bridge

**File:** [public/preload.js](public/preload.js)

Exposes the main API to the renderer process:

```javascript
const { defaultMainApi } = require("@trops/dash-core/electron");
contextBridge.exposeInMainWorld("mainApi", defaultMainApi);
```

### Widgets/ — Template-Specific Widgets

**Location:** [src/Widgets/](src/Widgets/)

Contains `DashSamples` with sample widgets: SampleThemeViewerWidget, SampleNotepadWidget, SampleEventSenderWidget, SampleEventReceiverWidget, SampleSlackWidget, SampleGitHubWidget, SampleGmailWidget, SampleReaderWidget.

## Template-Specific Extensions

The `electron.js` main process registers template-specific IPC handlers beyond what `@trops/dash-core` provides:

**Algolia** — Search index management:

```javascript
ipcMain.handle(ALGOLIA_LIST_INDICES, (e, app) => listIndices(mainWindow, app));
ipcMain.handle(ALGOLIA_BROWSE_OBJECTS, (e, msg) => browseObjectsToFile(...));
```

**OpenAI** — Image description:

```javascript
ipcMain.handle(OPENAI_DESCRIBE_IMAGE, (e, msg) => describeImage(...));
```

**Menu Items** — Custom menu persistence:

```javascript
ipcMain.handle(MENU_ITEMS_LIST, (e, msg) => listMenuItemsForApplication(...));
ipcMain.handle(MENU_ITEMS_SAVE, (e, msg) => saveMenuItemForApplication(...));
```

**Plugins** — pluggable-electron plugin installation:

```javascript
ipcMain.handle("plugin-install", (e, msg) => pluginInstall(...));
```

## Widget System

Widgets are React components registered with `ComponentManager` from `@trops/dash-core`. Each widget has a `.dash.js` config file defining its component, type, workspace, and user-configurable properties.

**Creating a new widget:**

```bash
node ./scripts/widgetize MyAwesomeWidget
# Creates: src/Widgets/MyAwesomeWidget/{widgets/, workspaces/, index.js}
```

**For complete widget system docs, see:** [dash-core Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md)

## Provider System

Two provider classes: `"credential"` (encrypted API keys) and `"mcp"` (MCP server connections).

**Critical:** Providers are read from `AppContext.providers`, NOT `DashboardContext.providers`. DashboardContext.providers is structurally empty due to component tree ordering.

**For complete provider docs, see:** [dash-core Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)

## MCP Provider System

MCP (Model Context Protocol) providers spawn stdio child processes exposing tools to widgets. The lifecycle is managed by `useMcpProvider` hook and `mcpController` from `@trops/dash-core`.

**For complete MCP docs, see:** [dash-core Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)

## Important Patterns

### Import Rules

**ThemeContext** must come from `@trops/dash-react` to avoid dual context instances:

```javascript
// CORRECT
import { ThemeContext } from "@trops/dash-react";

// WRONG - creates dual context
import { ThemeContext } from "./Context/ThemeContext";
```

**FontAwesomeIcon** must come from `@trops/dash-react`:

```javascript
// CORRECT
import { FontAwesomeIcon } from "@trops/dash-react";

// WRONG - duplicates the dependency
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
```

### Using dash-react Components

```javascript
import {
    Panel,
    Panel2,
    Panel3,
    Heading,
    SubHeading,
    Button,
    ButtonIcon,
    Widget,
    Workspace,
    Modal,
    Notification,
    LayoutContainer,
    ErrorBoundary,
    FontAwesomeIcon,
} from "@trops/dash-react";
```

**For more patterns (context providers, widget communication, data persistence), see:** [dash-core Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md)

## Build and Deploy

### Widget Distribution

```bash
npm run package-widgets   # Bundle widgets with Rollup
npm version patch         # Version bump
git push origin master    # Triggers auto-publish
```

### Electron App Distribution

```bash
# 1. Set up Apple Developer credentials in .env
# 2. Build and package
npm run package

# 3. Notarize with Apple
npm run apple-notarize
npm run apple-staple
```

**Output:** `/out/make/YourApp.dmg`

## Validation and Testing

### When to Validate

**Always validate after:**

-   Modifying source code in `src/`
-   Changing build configuration (rollup, craco, tailwind)
-   Updating dependencies
-   Adding or modifying widgets

### Pre-Commit Validation

```bash
npm run prettify
npm run build:css
npm run build 2>&1 | head -50
```

### Quick Validation Script

```bash
./scripts/validate.sh
```

Or manually:

```bash
npm run prettify && npm run build:css && timeout 30 bash -c 'BROWSER=none npm start'
```

### Runtime Validation

```bash
npm run dev
```

**In Terminal:** "Compiled successfully!" appears, no red errors, Electron process starts.

**In Electron Window:** Application window opens, dashboard renders, no blank panels.

**In DevTools Console:** Theme loading messages appear, no NULL theme or module resolution errors.

### Automated Validation (Claude Code)

```bash
# Quick (30 seconds)
npm run prettify && npm run build:css

# Full (60 seconds)
npm run prettify && npm run build:css && timeout 30 bash -c 'BROWSER=none npm start'
```

**Success criteria:** No errors, "Compiled successfully!" message, process completes without crashing.

## Code Style and Conventions

Same conventions as `@trops/dash-core`:

-   **React components:** PascalCase (e.g., `MyWidget.js`)
-   **Widget configs:** `{ComponentName}.dash.js`
-   **Utilities:** camelCase (e.g., `layout.js`)
-   **Formatting:** Prettier (`.prettierrc`), 4-space indentation
-   **Run `npm run prettify` before committing**

## Environment Variables

**Optional:**

-   `REACT_APP_IDENTIFIER` — App identifier (defaults to package name)
-   `REACT_APP_APPLE_*` — Apple signing credentials for packaging
-   `REACT_APP_GOOGLE_*` — Google API credentials

**Files:**

-   `.env` — Your local environment (not committed)
-   `.env.default` — Template with all variables

## Version Management

**Current Versions:**

-   dash-electron: 0.0.58
-   @trops/dash-core: ^0.1.3
-   @trops/dash-react: latest
-   Node.js: v18/v20/v22
-   Electron: ^39.0.0
-   React: ^18.2.0

**Bumping Versions:**

```bash
npm run bump       # Patch (0.0.X)
npm run bump-tag   # With git tag
```

## Related Projects

### @trops/dash-core

**Location:** `~/Development/dash-core/dash-core/`
**Package:** `@trops/dash-core`
**Purpose:** Core framework — contexts, hooks, models, controllers, APIs, widget system, provider architecture

-   Two export paths: `@trops/dash-core` (renderer, ESM+CJS) and `@trops/dash-core/electron` (CJS only)
-   [Documentation](https://github.com/trops/dash-core)

### @trops/dash-react

**Location:** `~/Development/dash-react/dash-react/`
**Package:** `@trops/dash-react`
**Purpose:** UI component library (Panel, Button, Widget, Workspace, ThemeContext, FontAwesomeIcon, etc.)

### dash (original monolith)

**Location:** `~/Development/dash/dash/`
**Purpose:** Original monolithic app, preserved as safety net. Not actively developed.

### Development Sync

When working across projects:

```bash
# Terminal 1 - rebuild dash-core
cd ~/Development/dash-core/dash-core && npm run build

# Terminal 2 - rebuild dash-react
cd ~/Development/dash-react/dash-react && npm run build

# Terminal 3 - reinstall and run dash-electron
cd ~/Development/dash-electron/dash-electron && npm install && npm run dev
```

## Troubleshooting

**Theme not loading / NULL theme:** Verify ThemeContext is imported from `@trops/dash-react`, not a local file.

**`electron-rebuild` fails:** Ensure Python 3, XCode Command Line Tools, and Node.js v18/v20/v22 are installed.

**Can't install @trops packages:** Ensure `.npmrc` has `@trops:registry=https://npm.pkg.github.com`. Run `npm run setup` to regenerate.

**Hot reload not working:** Check React dev server is running at http://localhost:3000. Restart `npm run dev`. Clear cache: `rm -rf ~/Library/Application Support/{appId}`.

**Blank Electron window:** Clear cache `rm -rf node_modules/.cache` and restart `npm run dev`.

## Resources

**Local Documentation:**

-   [Documentation Index](./docs/INDEX.md)
-   [Quick Start Guide](./docs/QUICK_START.md)
-   [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md)
-   [Main App Integration](./docs/MAIN_APP_INTEGRATION.md)

**Core Framework Documentation (dash-core):**

-   [Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md)
-   [Widget API](https://github.com/trops/dash-core/blob/master/docs/WIDGET_API.md)
-   [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md)
-   [Widget Registry](https://github.com/trops/dash-core/blob/master/docs/WIDGET_REGISTRY.md)
-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)
-   [Testing Guide](https://github.com/trops/dash-core/blob/master/docs/TESTING.md)
