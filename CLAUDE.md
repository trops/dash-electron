# Dash-Electron — Electron App Template

> ⚠️ **THIS FILE IS A PROTOCOL, NOT DOCUMENTATION.**
> Every section marked MANDATORY must be followed in order, without exception.
> If anything is unclear — requirements, file locations, which repo to change —
> **ASK before proceeding. Do not infer. Do not improvise.**

---

## ⚠️ MANDATORY: Before Any Code Changes

These steps are NON-NEGOTIABLE and must happen in this exact order before writing any code:

1. Sync dash-electron:

    ```bash
    cd ~/Development/dash-electron/dash-electron
    git checkout master && git pull origin master
    ```

2. Sync dependency repos:

    ```bash
    cd ~/Development/dash-core/dash-core && git pull origin master
    cd ~/Development/dash-react/dash-react && git pull origin master
    ```

3. Create a feature branch in dash-electron:
    ```bash
    cd ~/Development/dash-electron/dash-electron
    git checkout -b feat/<TICKET-KEY>-<slug>
    ```

**If any pull fails: STOP. Report the exact error. Do not proceed.**

---

## ⚠️ MANDATORY: PRD Gate

Before writing any code for a feature:

1. Run:
    ```bash
    ls docs/requirements/prd/
    ```
2. If a relevant PRD exists, read it fully before proceeding.
3. Confirm to the user: "Read PRD: `<filename>`" or "No relevant PRD found."
4. Do not start implementation until this confirmation is given.

---

## ⚠️ MANDATORY: Development Phases

These four phases are sequential and cannot be skipped, combined, or reordered.

### Phase 1 — PLAN

1. State the task in one sentence.
2. List every file that will be created or modified.
3. List any dependencies that will be added.
4. Identify risks, ambiguities, or cross-repo implications.
5. **Wait for explicit user approval before writing a single line of code.**
   Acceptable approvals: "proceed", "looks good", "go ahead", 👍.
   Silence is NOT approval.

### Phase 2 — IMPLEMENT

1. Make only the changes listed in the approved plan.
2. Do not refactor, rename, or "improve" anything outside the plan.
3. Do not add dependencies not listed in the plan.
4. Run Prettier when done:
    ```bash
    npm run prettify
    ```
5. Fix any Prettier errors before proceeding.

### Phase 3 — VALIDATE

1. Run the full CI validation:
    ```bash
    npm run ci
    ```
2. If it fails, fix the errors and re-run. Do not proceed with a failing build.
3. Do not mark this phase complete until `npm run ci` exits cleanly.
4. **If you cannot make CI pass: STOP. Report the exact output. Do not proceed.**

### Phase 4 — RELEASE

1. Use the CI script — **this is the only approved release path**:
    ```bash
    npm run ci:release -- -m "type(scope): description"
    ```
2. Do not manually construct `git commit`, `git push`, `git tag`, or `gh pr` commands.
   Manual git commands outside of `ci.sh` are not permitted.
3. Confirm to the user: "Released. Commit: `<hash>` pushed to `<branch>`."

---

## ⚠️ MANDATORY: Cross-Repo Changes

When a task touches dash-core or dash-react AND dash-electron:

1. Sync ALL repos first (see Mandatory Pre-Work above).
2. Make and validate changes in the dependency repo **first** (dash-core or dash-react).
3. Run that repo's `npm run ci` to confirm it passes before touching dash-electron.
4. Only then update dash-electron.
5. Never modify dash-electron to work around a missing dash-core change — fix it at the source.
6. Read `.claude/skills/cross-repo-dev/SKILL.md` before starting any cross-repo task.

---

## ⚠️ NON-NEGOTIABLE RULES

-   **Never skip a phase.** Even if the task "seems simple."
-   **Never combine phases.** Do not implement and validate in the same step.
-   **Never push directly to master.** Always use feature branches and PRs via `ci:release`.
-   **Never use `git push --force` or `git reset --hard`.**
-   **Never use `git add .` or `git add -A`.** Stage only the files changed in Phase 2.
-   **When in doubt, ask.** Do not infer requirements. Do not improvise solutions.
-   **If a command fails, stop.** Report the exact error output. Do not attempt workarounds.
-   **Never run `npm run build:css` manually.** Tailwind CSS is only rebuilt by `ci.sh`
    when `src/index.css` or `tailwind.config.js` has changed. Do not add `build:css`
    to any validate, dev, or pre-commit sequence.

---

## ci.sh — The Only Approved Release Path

The `scripts/ci.sh` script handles the full pipeline: Node 20 via nvm, Prettier, Tailwind CSS,
CI build with ESLint errors, widget tests, commit, version bump, push, PR, merge, tag, and cleanup.

```bash
# Validate only
npm run ci

# Validate + commit + version bump
npm run ci:commit -- -m "Your commit message"

# Above + push branch
npm run ci:push -- -m "Your commit message"

# Above + create PR
npm run ci:pr -- -m "Your commit message"

# Above + merge PR + tag + cleanup
npm run ci:release -- -m "Your commit message"
```

Each flag is cumulative. `--release` runs all prior steps automatically.

---

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

---

## Product Requirements Documentation

**Location:** `docs/requirements/`

Before implementing features, check for relevant Product Requirements Documents (PRDs).
**See the PRD Gate above — this check is mandatory, not optional.**

### PRD Commands

```bash
# Test PRD acceptance criteria
npm run test:prd layout-builder-hybrid
npm run test:prd layout-builder-hybrid --checklist
npm run prd:coverage layout-builder-hybrid

# Create new PRD
npm run prdize "Feature Name"
npm run prdize "Feature Name" --dry-run
```

**When implementing user stories:**

-   Read related PRD for full context (problem statement, personas)
-   Review acceptance criteria — each criterion should be testable
-   Check technical notes for implementation hints and constraints
-   Review user workflows for expected behavior
-   Consider edge cases documented in stories
-   Consult technical docs linked from PRD for architecture details

**See:** [docs/requirements/README.md](docs/requirements/README.md)

---

## Architecture

**Technology Stack:**

-   **Runtime**: Electron 39 + Node.js v18/v20/v22
-   **Core Framework**: @trops/dash-core (contexts, hooks, models, controllers)
-   **UI Library**: @trops/dash-react (components, ThemeContext)
-   **Styling**: TailwindCSS 3
-   **Build**: Create React App (craco) + Rollup (widgets)
-   **Packaging**: Electron Forge

**For complete architecture docs, see:** [@trops/dash-core documentation](https://github.com/trops/dash-core)

---

## Directory Structure

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
│   ├── ci.sh                   # Full CI pipeline — the only approved release path
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

---

## Environment Setup

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

---

## Development Commands

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

---

## Key Files

### Dash.js — Main App Component

-   Imports all local widgets from `src/Widgets/` and registers them with `ComponentManager`
-   Creates `ElectronDashboardApi` instance from `@trops/dash-core`
-   Loads installed external widgets via two-phase loading
-   Renders `DashboardStage` with the API and credentials

### electron.js — Main Process

Creates the Electron `BrowserWindow` and registers all IPC handlers. Imports controllers and events from `@trops/dash-core/electron`, then wires them to `ipcMain.handle()` calls. Includes both core handlers and template-specific handlers (algolia, openai, menuItems, plugins).

### preload.js — Context Bridge

```javascript
const { defaultMainApi } = require("@trops/dash-core/electron");
contextBridge.exposeInMainWorld("mainApi", defaultMainApi);
```

---

## Important Patterns

### Import Rules

**ThemeContext** must come from `@trops/dash-react`:

```javascript
// CORRECT
import { ThemeContext } from "@trops/dash-react";

// WRONG - creates dual context instance
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

### Provider System

**Critical:** Providers are read from `AppContext.providers`, NOT `DashboardContext.providers`.
DashboardContext.providers is structurally empty due to component tree ordering.

**For complete provider docs, see:** [dash-core Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)

---

## Widget System

```bash
# Create a new widget
node ./scripts/widgetize MyAwesomeWidget
# Creates: src/Widgets/MyAwesomeWidget/{widgets/, workspaces/, index.js}
```

**For complete widget docs, see:** [dash-core Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md)

---

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

---

## Runtime Validation Checklist

After `npm run dev`:

-   **Terminal:** "Compiled successfully!" appears, no red errors, Electron process starts
-   **Electron Window:** Application window opens, dashboard renders, no blank panels
-   **DevTools Console:** Theme loading messages appear, no NULL theme or module resolution errors

---

### Visual Inspection

After `npm run ci` passes, capture a screenshot of the feature for UI review. Requires the React dev server to be running (`npm start` or `npm run dev`).

**Usage:**

```bash
npm run screenshot                                    # full window → /tmp/dash-review.png
npm run screenshot -- --click "Home"                  # click sidebar item, then capture
npm run screenshot -- --click-selector "css" --click "Text"  # CSS click, then text click
npm run screenshot -- --steps scripts/steps/nav.js    # run JS navigation file
npm run screenshot -- --selector ".sidebar" /tmp/s.png       # element screenshot
```

**Navigation map** — use this to determine the `--click` / `--click-selector` flags for each feature area:

| Feature Area | Screenshot Command |
|---|---|
| Home / default view | `npm run screenshot` |
| Settings > General | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings"` |
| Settings > Themes | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Themes"` |
| Settings > Providers | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Providers"` |
| Settings > Widgets | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Widgets"` |
| Settings > Folders | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Folders"` |
| Settings > Notifications | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Notifications"` |
| Settings > Account | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Account"` |
| Settings > MCP Server | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "MCP Server"` |
| Specific workspace | `npm run screenshot -- --click "<workspace name>"` |
| Sidebar only | `npm run screenshot -- --selector "aside"` |

**Planning requirement:** When planning a task that affects the UI, the plan's verification section MUST include the `npm run screenshot` command with the appropriate flags from the navigation map above. Claude determines the correct navigation by mapping the changed files to the feature area they affect.

---

## Code Style

-   **React components:** PascalCase (`MyWidget.js`)
-   **Widget configs:** `{ComponentName}.dash.js`
-   **Utilities:** camelCase (`layout.js`)
-   **Formatting:** Prettier (`.prettierrc`), 4-space indentation
-   Run `npm run prettify` before every commit — enforced by `ci.sh`

---

## Environment Variables

-   `.env` — Your local environment (not committed)
-   `.env.default` — Template with all variables

**Optional vars:**

-   `REACT_APP_IDENTIFIER` — App identifier (defaults to package name)
-   `REACT_APP_APPLE_*` — Apple signing credentials for packaging
-   `REACT_APP_GOOGLE_*` — Google API credentials

---

## Version Management

```bash
npm run bump       # Patch bump (0.0.X)
npm run bump-tag   # Patch bump with git tag
```

**Current versions:**

-   dash-electron: 0.0.58
-   @trops/dash-core: ^0.1.3
-   @trops/dash-react: latest
-   Node.js: v18/v20/v22
-   Electron: ^39.0.0
-   React: ^18.2.0

---

## Related Projects

| Repo              | Location                               | Purpose                       |
| ----------------- | -------------------------------------- | ----------------------------- |
| @trops/dash-core  | `~/Development/dash-core/dash-core/`   | Core framework                |
| @trops/dash-react | `~/Development/dash-react/dash-react/` | UI component library          |
| dash (monolith)   | `~/Development/dash/dash/`             | Original app, safety net only |

### Development Sync (Cross-Repo)

```bash
# Terminal 1 - rebuild dash-core
cd ~/Development/dash-core/dash-core && npm run build

# Terminal 2 - rebuild dash-react
cd ~/Development/dash-react/dash-react && npm run build

# Terminal 3 - reinstall and run dash-electron
cd ~/Development/dash-electron/dash-electron && npm install && npm run dev
```

---

## Troubleshooting

**Theme not loading / NULL theme:** Verify ThemeContext is imported from `@trops/dash-react`, not a local file.

**`electron-rebuild` fails:** Ensure Python 3, XCode Command Line Tools, and Node.js v18/v20/v22 are installed.

**Can't install @trops packages:** Ensure `.npmrc` has `@trops:registry=https://npm.pkg.github.com`. Run `npm run setup` to regenerate.

**Hot reload not working:** Check React dev server is running at http://localhost:3000. Restart `npm run dev`. Clear cache: `rm -rf ~/Library/Application Support/{appId}`.

**Blank Electron window:** Clear cache `rm -rf node_modules/.cache` and restart `npm run dev`.

---

## Resources

**Local Documentation:**

-   [Documentation Index](./docs/INDEX.md)
-   [Quick Start Guide](./docs/QUICK_START.md)
-   [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md)
-   [Main App Integration](./docs/MAIN_APP_INTEGRATION.md)

**Core Framework Documentation:**

-   [Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md)
-   [Widget API](https://github.com/trops/dash-core/blob/master/docs/WIDGET_API.md)
-   [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md)
-   [Widget Registry](https://github.com/trops/dash-core/blob/master/docs/WIDGET_REGISTRY.md)
-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md)
-   [Testing Guide](https://github.com/trops/dash-core/blob/master/docs/TESTING.md)
