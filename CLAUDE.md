# Dash - Electron Dashboard Framework

## Project Overview

Dash is an Electron-based dashboard application framework built with React. It provides a widget-based architecture with dependency injection, theming, and a provider system for managing external service integrations.

**Key Features:**

-   Widget-based dashboard architecture
-   Hot reload support during development
-   Theme system with light/dark variants
-   Provider system for external API integrations
-   Widget distribution via npm packages
-   Secure credential management through Electron

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
# View all acceptance criteria for a PRD
npm run test:prd layout-builder-hybrid

# Generate manual verification checklist
npm run test:prd layout-builder-hybrid --checklist

# Check test coverage
npm run prd:coverage layout-builder-hybrid
```

### Documentation Hierarchy

```
PRDs (requirements) → Architecture Docs (design) → Implementation Guides (code)
```

**PRDs answer:**

-   **Why** are we building this? (Problem Statement, Context)
-   **Who** is it for? (User Personas)
-   **What** defines success? (Acceptance Criteria, Success Metrics)
-   **When** should it be done? (Implementation Phases: P0/P1/P2)

**Technical docs answer:**

-   **How** is it built? (Architecture, design patterns)
-   **Where** is the code? (File locations, code structure)
-   **What** are the APIs? (Function signatures, parameters)

### Creating New PRDs

```bash
# Create new PRD from template
npm run prdize "Feature Name"

# Dry run (preview without creating)
npm run prdize "Feature Name" --dry-run
```

**See:** [docs/requirements/README.md](docs/requirements/README.md) for complete PRD documentation

## Architecture

### Core Concepts

1. **Widgets** - Reusable React components that display data or functionality
2. **Workspaces** - Container components that host related widgets
3. **Providers** - Manage external service credentials and API clients
4. **Contexts** - React Context-based dependency injection
5. **Widget API** - Event publishing, data storage, and widget communication
6. **MCP Providers** - Model Context Protocol servers that expose tools to widgets via stdio transport

### Technology Stack

-   **Runtime**: Electron 18 + Node.js v18/v20/v22
-   **UI Framework**: React 18
-   **UI Library**: [@trops/dash-react](https://github.com/trops/dash-react) (internal component library)
-   **Styling**: TailwindCSS 3
-   **Build**: Create React App (craco) + Rollup (widgets)
-   **Packaging**: Electron Forge

## Directory Structure

```
./
├── src/
│   ├── Api/                    # Electron IPC API clients
│   ├── ComponentManager.js     # Widget registration system
│   ├── Components/             # Reusable app components
│   ├── Context/                # React Context providers
│   │   ├── ThemeWrapper.js     # Theme provider (uses @trops/dash-react ThemeContext)
│   │   ├── AppContext.js       # Application state
│   │   ├── DashboardContext.js # Dashboard configuration
│   │   └── ProviderContext.js  # External service credentials
│   ├── Dash.js                 # Main app component
│   ├── Mock/                   # Mock data for development
│   ├── Models/                 # Data models and utilities
│   ├── Widget/                 # Core widget components
│   ├── Widgets/                # Your custom widgets go here
│   ├── hooks/                  # Custom React hooks
│   │   ├── useMcpProvider.js   # MCP server connection and tool calling
│   │   ├── useDashboard.js     # Dashboard context access
│   │   └── useWidgetProviders.js # Widget provider resolution
│   ├── utils/                  # Utility functions
│   └── index.js                # App entry point
├── public/
│   ├── electron.js             # Electron main process
│   └── lib/
│       ├── controller/
│       │   ├── mcpController.js    # MCP server lifecycle (spawn, connect, call)
│       │   └── providerController.js # Provider CRUD and encryption
│       ├── mcp/
│       │   └── mcpServerCatalog.json # MCP server definitions (transport, args, env)
│       └── api/
│           ├── mcpApi.js           # MCP IPC handlers
│           └── providerApi.js      # Provider IPC handlers
├── scripts/                    # Build and utility scripts
├── docs/                       # Documentation
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
# 1. Create .env file
cp .env.default .env

# 2. Edit .env and set any needed environment variables (e.g., Apple signing credentials)

# 3. Install dependencies
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

1. React dev server starts at http://localhost:3000
2. Electron app launches and connects to dev server
3. File changes automatically reload without restart
4. DevTools are available for debugging

## Key Files and Locations

### Theme System

**Critical Fix Applied:** ThemeWrapper imports ThemeContext from `@trops/dash-react`, NOT local context

-   **Why**: Prevents dual context instances between dash and dash-react
-   **File**: [src/Context/ThemeWrapper.js](src/Context/ThemeWrapper.js:3)
-   **Import**: `import { ThemeContext } from "@trops/dash-react";`

**Theme Files:**

-   [src/Context/ThemeWrapper.js](src/Context/ThemeWrapper.js) - Theme provider and theme loading logic
-   [src/Models/ThemeModel.js](src/Models/ThemeModel.js) - Theme data model and generation
-   Theme data stored in Electron app directory: `~/Library/Application Support/{appId}/themes/`

**Using Themes in Components:**

```javascript
import { useContext } from "react";
import { ThemeContext } from "@trops/dash-react";

function MyComponent() {
    const { currentTheme, themeVariant, changeThemeVariant } =
        useContext(ThemeContext);
    // currentTheme contains CSS class mappings like 'bg-primary-dark'
}
```

### Widget Registration

**ComponentManager** ([src/ComponentManager.js](src/ComponentManager.js))

-   Registers widgets and workspaces
-   Resolves widget configurations
-   Manages widget lifecycle

**Widget Definition Pattern:**

```javascript
// MyWidget.dash.js
import { MyWidget } from "./MyWidget";

export default {
    component: MyWidget,
    canHaveChildren: false,
    workspace: "my-workspace-name",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "My Widget",
            displayName: "Title",
            required: true,
        },
    },
};
```

**MCP Widget Definition Pattern:**

```javascript
// McpTestWidget.dash.js
import { McpTestWidget } from "./McpTestWidget";

export default {
    component: McpTestWidget,
    canHaveChildren: false,
    workspace: "McpTestWorkspace-workspace",
    type: "widget",
    providers: [
        {
            type: "slack",
            providerClass: "mcp", // MCP provider (not credential)
            required: true,
            // Optional: restrict which tools the widget can call
            // allowedTools: ["send_message", "list_channels"],
        },
    ],
    userConfig: {
        title: {
            type: "text",
            defaultValue: "MCP Test",
            displayName: "Title",
            required: false,
        },
    },
};
```

### API Integration

**Electron IPC API** ([src/Api/](src/Api/))

-   `DashApi.js` - Main dashboard API
-   `ElectronDashboardApi.ts` - Typed API with MCP methods (`mcpStartServer`, `mcpStopServer`, `mcpCallTool`, `mcpReadResource`)
-   Communication between React renderer and Electron main process
-   Available via `window.dashApi`

**Widget API** (injected into widgets via props)

```javascript
// Available in widget components
api.storeData(data); // Save widget data
api.readData({ callbackComplete, callbackError });
api.publishEvent(eventName, payload);
api.registerListeners(events, handlers);
```

## Build and Deploy

### Widget Distribution

**Package widgets as npm package:**

```bash
# 1. Bundle widgets
npm run package-widgets

# 2. Version bump
npm version patch

# 3. Push to GitHub (triggers auto-publish)
git push origin master
```

### Electron App Distribution

**Create Mac .dmg:**

```bash
# 1. Set up Apple Developer credentials in .env
# 2. Build and package
npm run package

# 3. Notarize with Apple
npm run apple-notarize
npm run apple-staple
```

**Output:** `/out/make/YourApp.dmg`

## Common Tasks

### Creating a New Widget

```bash
# Generate scaffold
node ./scripts/widgetize MyAwesomeWidget

# This creates:
# src/Widgets/MyAwesomeWidget/
# ├── widgets/
# │   ├── MyAwesomeWidget.js
# │   └── MyAwesomeWidget.dash.js
# ├── workspaces/
# │   ├── MyAwesomeWidgetWorkspace.js
# │   └── MyAwesomeWidgetWorkspace.dash.js
# └── index.js
```

### Using dash-react Components

```javascript
import {
    Panel,
    Panel2,
    Panel3, // Card containers
    Heading,
    SubHeading, // Typography
    Button,
    ButtonIcon, // Buttons
    Menu,
    MenuItem, // Menus
    Modal,
    Notification, // Overlays
    Widget,
    Workspace, // Widget containers
    LayoutContainer, // Layout utilities
    ErrorBoundary, // Error handling
    FontAwesomeIcon, // Icons (see rule below)
} from "@trops/dash-react";
```

### Icons

**Rule: Always import `FontAwesomeIcon` from `@trops/dash-react` — never directly from `@fortawesome/*`.**

`@trops/dash-react` re-exports `FontAwesomeIcon` and the full FontAwesome Free icon set (solid + brand). Importing directly from `@fortawesome` packages would duplicate the icon library and risk version mismatches.

```javascript
// CORRECT — single source of truth via dash-react
import { FontAwesomeIcon } from "@trops/dash-react";

// WRONG — bypasses dash-react, duplicates the dependency
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
```

**Usage pattern:**

```javascript
<FontAwesomeIcon icon="compass" className="h-3.5 w-3.5" />
```

### Updating dash-react Dependency

```bash
# 1. Update version in package.json
# "dependencies": {
#   "@trops/dash-react": "^0.1.XXX"
# }

# 2. Install
npm install

# 3. Rebuild native modules
npm run rebuild
```

## Important Patterns

### Context Provider Pattern

**Workspace provides context, widgets consume:**

```javascript
// MyWorkspace.js
import { MyContext } from "./MyContext";
import { useMyApi } from "./hooks/useMyApi";

export const MyWorkspace = ({ children }) => {
    const myApi = useMyApi();

    return (
        <MyContext.Provider value={{ myApi }}>{children}</MyContext.Provider>
    );
};

// MyWidget.js
import { useContext } from "react";
import { MyContext } from "../MyContext";

export const MyWidget = (props) => {
    const { myApi } = useContext(MyContext);
    return <div>{/* Use myApi */}</div>;
};
```

### Widget Communication

**Publish/Subscribe Pattern:**

```javascript
// Widget A - Publishes event
api.publishEvent("user-action", { data: "value" });

// Widget B - Listens for event
useEffect(() => {
    api.registerListeners(["user-action"], {
        "user-action": (payload) => {
            console.log("Received:", payload.data);
        },
    });
}, []);
```

### Data Persistence

**Widget data auto-saves to Electron:**

```javascript
// Save
api.storeData({ myData: "value" });

// Load
api.readData({
    callbackComplete: (data) => setState(data),
    callbackError: (err) => console.error(err),
});
```

### MCP Provider System

The MCP (Model Context Protocol) provider system enables widgets to connect to external tools via MCP servers.

**Two Provider Classes:**

-   `"credential"` (default) - Traditional API key/token providers stored encrypted in providers.json
-   `"mcp"` - MCP server providers that spawn stdio child processes exposing tools

**Key Files:**

-   [src/hooks/useMcpProvider.js](src/hooks/useMcpProvider.js) - Hook for connecting to MCP servers and calling tools
-   [public/lib/controller/mcpController.js](public/lib/controller/mcpController.js) - Main process: spawns MCP server child processes
-   [public/lib/mcp/mcpServerCatalog.json](public/lib/mcp/mcpServerCatalog.json) - Defines available MCP servers (transport, command, args, env mapping)
-   [src/Components/Provider/McpServerPicker.js](src/Components/Provider/McpServerPicker.js) - UI for selecting MCP servers during provider creation
-   [src/Api/ElectronDashboardApi.ts](src/Api/ElectronDashboardApi.ts) - MCP API methods (mcpStartServer, mcpStopServer, mcpCallTool)

**Critical:** Providers are read from `AppContext.providers`, NOT `DashboardContext.providers`. DashboardContext.providers is structurally empty due to component tree ordering (DashboardWrapper renders before providers are loaded).

**MCP Lifecycle:**

1. Widget mounts → `useMcpProvider("slack")` hook runs
2. Hook reads provider from `AppContext.providers` (with `mcpConfig` and credentials)
3. Calls `dashApi.mcpStartServer()` → IPC → `mcpController` spawns stdio child process
4. Server returns available tools → hook filters by `allowedTools` if specified
5. Widget calls `callTool("send_message", args)` → 30-second timeout per call
6. On unmount, hook calls `mcpStopServer()` to clean up child process

**Tool Scoping:** Enforced at both the hook level (client-side filter) and main process level (mcpController validates allowedTools).

**Reference Widget:** `src/Widgets/McpTest/` - End-to-end MCP test widget connecting to Slack via MCP.

### Custom Hooks

-   [src/hooks/useMcpProvider.js](src/hooks/useMcpProvider.js) - MCP server connection, tool listing, tool calling
-   [src/hooks/useDashboard.js](src/hooks/useDashboard.js) - Access DashboardContext values
-   [src/hooks/useWidgetProviders.js](src/hooks/useWidgetProviders.js) - Resolve widget provider requirements

## Troubleshooting

### Theme Issues

**Problem:** Components showing NULL theme or transparent backgrounds

**Solution:** Ensure ThemeContext is imported from `@trops/dash-react`:

```javascript
// ✅ CORRECT
import { ThemeContext } from "@trops/dash-react";

// ❌ WRONG - creates dual context
import { ThemeContext } from "./Context/ThemeContext";
```

### Build Issues

**Problem:** `electron-rebuild` fails

**Solution:**

-   Ensure Python 3 is installed
-   Ensure XCode Command Line Tools installed
-   Check Node.js version (must be v18/v20/v22)

**Problem:** Can't install @trops/dash-react

**Solution:**

-   Ensure `.npmrc` has the registry line: `@trops:registry=https://npm.pkg.github.com`
-   Run `npm run setup` to regenerate `.npmrc`

### Hot Reload Not Working

**Problem:** Changes don't reflect in Electron app

**Solution:**

-   Check React dev server is running (http://localhost:3000)
-   Restart `npm run dev`
-   Clear Electron cache: `rm -rf ~/Library/Application Support/{appId}`

## Related Projects

### dash-react

**Location:** `../dash-react/dash-react` (sibling directory)
**Purpose:** UI component library used by Dash
**Package:** `@trops/dash-react`

**Key points:**

-   Provides all UI components (Panel, Button, etc.)
-   Exports ThemeContext (MUST be used by dash)
-   Built with Rollup
-   Published to GitHub Packages

**Documentation:**

-   [dash-react README](../dash-react/README.md)
-   [Component Overview](../dash-react/docs/)

### Development Sync

When working on both projects:

```bash
# Terminal 1 - dash-react (rebuild on changes)
cd ../dash-react/dash-react
npm run build

# Terminal 2 - dash (reinstall updated package)
npm install
npm run dev
```

## Code Style and Conventions

### File Naming

-   React components: PascalCase (e.g., `MyWidget.js`)
-   Widget configs: `{ComponentName}.dash.js`
-   Utilities: camelCase (e.g., `layout.js`)
-   Contexts: PascalCase with suffix (e.g., `ThemeContext.js`)

### Component Structure

```javascript
// Imports
import React, { useContext, useState } from "react";
import { Panel, Heading } from "@trops/dash-react";
import { ThemeContext } from "@trops/dash-react";

// Component
export const MyWidget = ({
    // User config props (from .dash.js)
    title = "Default",
    subtitle = "",
    // Injected props
    api,
    ...props
}) => {
    // Context
    const { currentTheme } = useContext(ThemeContext);

    // State
    const [data, setData] = useState(null);

    // Effects
    useEffect(() => {
        // Setup
    }, []);

    // Handlers
    const handleClick = () => {};

    // Render
    return (
        <Widget {...props}>
            <Panel>
                <Heading title={title} />
            </Panel>
        </Widget>
    );
};
```

### Formatting

-   Use Prettier (configured in `.prettierrc`)
-   Run `npm run prettify` before committing
-   4-space indentation
-   No semicolons enforced (but used throughout)

## Environment Variables

**Optional:**

-   `REACT_APP_IDENTIFIER` - App identifier (defaults to package name)
-   `REACT_APP_APPLE_*` - Apple signing credentials for packaging
-   `REACT_APP_GOOGLE_*` - Google API credentials

**Files:**

-   `.env` - Your local environment (not committed)
-   `.env.default` - Template with all variables

## Version Management

**Current Versions:**

-   Dash: 0.0.58
-   dash-react: ^0.1.187
-   Node.js: v18/v20/v22
-   Electron: ^18.1.0
-   React: ^18.2.0

**Bumping Versions:**

```bash
# Patch (0.0.X)
npm run bump

# With git tag
npm run bump-tag
```

## Validation and Testing

### When to Validate

**Always validate after:**

-   Modifying source code in `src/`
-   Changing build configuration (rollup, craco, tailwind)
-   Updating dependencies
-   Making theme system changes
-   Adding or modifying widgets

### Pre-Commit Validation Checklist

Before committing changes, run these checks:

```bash
# 1. Format code
npm run prettify

# 2. Build CSS
npm run build:css

# 3. Check for syntax errors (via build)
# This will fail fast if there are import errors or syntax issues
npm run build 2>&1 | head -50
```

**Expected:** No errors, build completes successfully

### Build Validation

**Quick build check:**

```bash
# Start dev server (doesn't open Electron, just checks React build)
BROWSER=none npm start
```

**What to check:**

-   ✅ Webpack compiles without errors
-   ✅ No module resolution errors
-   ✅ Server starts at http://localhost:3000
-   ✅ No red error messages in terminal

**Stop with:** `Ctrl+C`

### Runtime Validation

**Full application check:**

```bash
npm run dev
```

**What happens:**

1. React dev server starts (http://localhost:3000)
2. Electron window opens automatically
3. Application loads in Electron

**Health Check Indicators:**

**In Terminal:**

-   ✅ `Compiled successfully!` message appears
-   ✅ No red error messages
-   ✅ Electron process starts without errors

**In Electron Window:**

-   ✅ Application window opens (not blank screen)
-   ✅ Dashboard renders with visible components
-   ✅ No visible error messages or blank panels

**In Browser DevTools (Electron → View → Toggle Developer Tools):**

```javascript
// Console should show theme loading
[ThemeWrapper] Loading X saved themes...
[ThemeWrapper] Loaded theme: theme-1
[ThemeWrapper] Setting loaded theme as active: theme-1

// Should NOT show:
❌ NULL theme errors
❌ Module not found errors
❌ React errors (red error overlay)
❌ Uncaught exceptions
```

**Theme System Validation:**
Open DevTools Console and run:

```javascript
// Should return theme object with ~150 keys
Object.keys(window.__REACT_DEVTOOLS_GLOBAL_HOOK__).length;
```

**Stop validation:** `Ctrl+C` in terminal, close Electron window

### Quick Validation Script

**Automated validation script available:**

```bash
# Run validation script
./scripts/validate.sh
```

**What it does:**

1. ✅ Runs Prettier to format code
2. ✅ Builds Tailwind CSS
3. ✅ Checks React build (30 second test)
4. ✅ Reports success/failure with colored output

**Sample output:**

```
🔍 Validating Dash Application...

📝 Step 1/4: Running Prettier...
✅ Code formatted successfully

🎨 Step 2/4: Building Tailwind CSS...
✅ Tailwind CSS built successfully

🏗️  Step 3/4: Checking React build...
   (This will take ~30 seconds)
✅ Build successful - no errors detected

📋 Step 4/4: Validation Summary
✅ Code formatting: PASSED
✅ CSS build: PASSED
✅ React build: PASSED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All validations passed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Quick validation (without script):**

```bash
npm run prettify && npm run build:css && timeout 30 bash -c 'BROWSER=none npm start'
```

### Component-Specific Validation

**After modifying theme system:**

1. Run `npm run dev`
2. Open DevTools Console
3. Check for theme loading messages
4. Verify components have colored backgrounds (not transparent)
5. Toggle theme variant (if UI available) - should update colors

**After adding/modifying widgets:**

1. Run `npm run dev`
2. Navigate to dashboard with the widget
3. Check widget renders correctly
4. Check widget data loads
5. Test widget interactions

**After modifying Electron integration:**

1. Run `npm run dev`
2. Test IPC communication (if modified)
3. Check file system operations work
4. Verify credentials/providers load

### Integration Testing with dash-react

**After updating @trops/dash-react dependency:**

```bash
# 1. Install new version
npm install

# 2. Rebuild native modules
npm run rebuild

# 3. Clear cache (if needed)
rm -rf node_modules/.cache

# 4. Validate build
npm run dev
```

**Check in DevTools Console:**

```javascript
// Verify dash-react version
// Look for package version in console logs or check:
require("@trops/dash-react/package.json").version;
```

### Common Validation Errors

**Error:** `Module not found: Error: Can't resolve '@trops/dash-react'`

```bash
# Fix: Reinstall dash-react
npm install
npm run rebuild
```

**Error:** `Compiled with warnings` - CSS order warnings

```bash
# Usually safe to ignore, but can fix by:
npm run build:css
```

**Error:** Blank Electron window

```bash
# Fix: Check console for errors, usually:
# 1. Clear cache: rm -rf node_modules/.cache
# 2. Rebuild: npm run dev
```

**Error:** Theme not loading / NULL theme

```bash
# Fix: Verify ThemeWrapper imports from @trops/dash-react
# Check src/Context/ThemeWrapper.js line 3
```

### Automated Validation (Claude Code)

**When Claude makes changes, validate with:**

```bash
# Quick validation (30 seconds)
npm run prettify && npm run build:css

# Full validation (60 seconds - includes dev server check)
npm run prettify && npm run build:css && timeout 30 bash -c 'BROWSER=none npm start'
```

**Success criteria:**

-   No errors in terminal output
-   "Compiled successfully!" message appears
-   Process completes without crashing

**If validation fails:**

-   Read error messages carefully
-   Check file paths and imports
-   Verify syntax is correct
-   Ensure all dependencies are installed

## Resources

**Documentation:**

-   [Quick Start Guide](./docs/QUICK_START.md)
-   [Widget Development](./docs/WIDGET_DEVELOPMENT.md)
-   [Widget Registry](./docs/WIDGET_REGISTRY.md)
-   [Provider API Setup](./docs/PROVIDER_API_SETUP.md)
-   [Full Index](./docs/INDEX.md)

**Contact:**
[GitHub Issues](https://github.com/trops/dash/issues)
