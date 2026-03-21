# PRD: Widget Installation Model

**Status:** Implemented
**Last Updated:** 2026-03-20
**Owner:** Core Team
**Related PRDs:** [Dashboard Marketplace](dashboard-marketplace.md), [Widget Dropdown](widget-dropdown.md)
**Repos:** dash-core (v0.1.239+), dash-electron (v0.0.239+)

---

## Executive Summary

Dash supports three independent tracks for getting widgets into a running application: **Registry (Discover)**, **ZIP install**, and **built-in (`src/Widgets/`)**. The registry-first model makes Discover the primary path for end users while preserving ZIP install for offline/private use and built-in widgets for developers who ship custom widgets compiled into their app. Only registry-installed widgets participate in the update system.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

Prior to this model, all 12 stock widgets (Slack, Gmail, GitHub, etc.) were compiled directly into the dash-electron app as built-in widgets. They had no registry identity -- no scope, no version, no `downloadUrl`. The update system (`checkUpdates()`) could never match them to registry packages, meaning users would never see updates. Additionally, the first-launch experience forced a "Kitchen Sink" sample workspace on users rather than letting them choose what they actually need.

The registry-first model solves this by publishing all stock widgets to the registry, making Discover the primary acquisition path, and shipping dash-electron with an empty `src/Widgets/` directory. Users choose which widgets they want. Updates flow through the registry's scoped identity system.

**Who experiences this problem?**

-   Primary: End users who want to install, discover, and update widgets
-   Secondary: Developers who build custom widgets for private distribution
-   Tertiary: Widget publishers who distribute via the registry

**What happens if we don't solve it?**

Built-in widgets never receive updates. Users get a bloated default install with widgets they don't need. There's no clear path for community widget distribution.

### Current State

**What exists today (post-implementation):**

Three independent installation tracks, each with distinct use cases:

| Track                     | Source                      | Use Case                             | Updates                        | Storage                |
| ------------------------- | --------------------------- | ------------------------------------ | ------------------------------ | ---------------------- |
| Registry (Discover)       | Remote registry API         | Primary path for end users           | Yes (scoped identity matching) | `widgets/@scope/name/` |
| ZIP install               | Local `.zip` file or folder | Offline, private, or development use | No                             | `widgets/name/`        |
| Built-in (`src/Widgets/`) | Compiled source code        | Developers shipping custom apps      | No (separate track)            | N/A (in bundle)        |

---

## Architecture

### Installation Track 1: Registry (Discover)

The primary path for end users. Widgets are browsed in the Discover tab or Dashboard Wizard, then downloaded and installed from the registry.

**Flow:**

1. User browses widgets via Discover tab or Wizard
2. `useRegistrySearch()` calls `window.mainApi.registry.search(query, filters)`
3. Results filtered by app capabilities (only shows widgets the app can support)
4. User clicks Install -- `installPackage(widget)` triggers:
    - Builds scoped ID: `@scope/name` (e.g., `@trops/slack`)
    - Resolves download URL placeholders: `{version}` and `{name}`
    - Calls `window.mainApi.widgets.install(scopedId, resolvedUrl)`
5. Main process downloads ZIP (HTTPS only), validates entries, extracts to `widgets/@scope/name/`
6. Widget registered, `widget:installed` event broadcast to all windows
7. App hot-reloads the new widget without restart

**Key files:**

| File                                                                 | Repo      | Role                                      |
| -------------------------------------------------------------------- | --------- | ----------------------------------------- |
| `src/hooks/useRegistrySearch.js`                                     | dash-core | Search + install trigger (renderer)       |
| `electron/controller/registryController.js`                          | dash-core | API fetch, search, update checking (main) |
| `electron/widgetRegistry.js`                                         | dash-core | Download, extract, register (main)        |
| `src/Components/Settings/details/DiscoverWidgetsDetail.js`           | dash-core | Discover tab UI                           |
| `src/Components/Layout/DashboardWizard/steps/WizardCustomizeStep.js` | dash-core | Wizard install step                       |

**Wizard integration:** The Wizard's custom path auto-installs selected registry widgets before creating the dashboard layout. This ensures layout items referencing widget component names resolve correctly.

**Capability filtering:** The search hook discovers the app's API namespaces from `window.mainApi` and only shows packages whose required APIs are available. A toggle ("Show all packages") overrides this filter.

### Installation Track 2: ZIP Install

For offline use, private widgets, or development testing. Users provide a `.zip` file or a local folder path.

**Flow:**

1. User goes to Settings > Widgets > "Install from ZIP"
2. File picker opens via `window.mainApi.dialog.chooseFile(true, ["zip"])`
3. Calls `window.mainApi.widgets.installLocal(widgetName, filepath)`
4. Main process extracts ZIP or copies folder to `widgets/name/`
5. Validates ZIP entries against path traversal attacks
6. Looks for `dash.json` metadata, falls back to `package.json`
7. Auto-compiles CJS bundle if not present
8. Widget registered, `widget:installed` event broadcast

**Folder install:** Settings > Widgets also supports "Load from Folder" which bulk-imports widgets from a directory. Uses smart detection to determine if the folder itself is a widget or contains widget subdirectories.

**Key files:**

| File                                                 | Repo      | Role                                                    |
| ---------------------------------------------------- | --------- | ------------------------------------------------------- |
| `src/Components/Settings/sections/WidgetsSection.js` | dash-core | Install UI (renderer)                                   |
| `electron/widgetRegistry.js`                         | dash-core | `installFromLocalPath()`, `registerWidgetsFromFolder()` |

### Installation Track 3: Built-in Widgets (`src/Widgets/`)

For developers who clone dash-electron and ship their own custom application with widgets compiled into the bundle. These widgets are imported at build time and registered directly with ComponentManager -- no download, no extraction, no registry identity.

**Flow:**

1. Developer creates widgets in `src/Widgets/MyWidget/`
2. Exports from `src/Widgets/index.js` barrel file
3. `Dash.js` imports all widgets: `import * as myWidgets from "./Widgets"`
4. Registration loop iterates exports and calls `ComponentManager.registerWidget()` for each
5. Handles both direct exports (`{ component, type, ... }`) and namespace re-exports (nested objects)

**Default state:** The dash-electron template ships with an empty `src/Widgets/index.js`:

```js
// Add your built-in widgets here.
// See src/SampleWidgets/ for examples.
```

The registration loop still runs but registers nothing. Developers can add their own widgets to this directory for private distribution.

**Key files:**

| File                   | Repo          | Role                                     |
| ---------------------- | ------------- | ---------------------------------------- |
| `src/Widgets/index.js` | dash-electron | Barrel export (empty by default)         |
| `src/Dash.js`          | dash-electron | Registration loop (lines 46-74)          |
| `src/SampleWidgets/`   | dash-electron | Reference implementations (not compiled) |

### External Widget Loading (Runtime)

Registry and ZIP-installed widgets are loaded at app startup via a two-phase process in `Dash.js`:

**Phase 1 -- CJS Bundles:** `loadInstalledWidgets()` calls `window.mainApi.widgets.readAllBundles()`, evaluates each bundle, and registers components with ComponentManager.

**Phase 2 -- Config Fallback:** For widgets without bundles, reads `.dash.js` config metadata and creates `React.lazy` wrappers via `createLazyWidget()`. Each lazy wrapper calls `readBundle()` on first render, providing on-demand loading with a Suspense fallback.

**Hot reload:** When a widget is installed at runtime, `widget:installed` fires and `handleWidgetInstalled()` loads the new widget without requiring an app restart.

---

## Scoped Identity System

All registry-installed widgets use scoped identifiers following the npm convention: `@scope/name`.

### Package ID Utilities

```
electron/utils/packageId.js
```

| Function                   | Input                | Output                              |
| -------------------------- | -------------------- | ----------------------------------- |
| `toPackageId(scope, name)` | `"trops"`, `"slack"` | `"@trops/slack"`                    |
| `parsePackageId(id)`       | `"@trops/slack"`     | `{ scope: "trops", name: "slack" }` |

### Directory Structure

```
widgets/
  @trops/
    slack/          # Registry: @trops/slack
    gmail/          # Registry: @trops/gmail
  weather/          # ZIP install (no scope)
```

### Update Matching

`registryController.checkUpdates()` matches installed widgets to registry packages:

1. Constructs `@scope/name` from registry package metadata
2. Compares against installed widget's `packageId`
3. Falls back to bare-name matching for pre-migration entries
4. Returns update info if registry version is newer

**Only registry-installed widgets participate in updates.** Built-in and ZIP-installed widgets have no registry identity and are never checked.

### Migration

On first load, `widgetRegistry.loadRegistry()` migrates legacy bare-name entries to scoped IDs:

-   Re-keys map entry: `slack` -> `@trops/slack`
-   Moves folder: `widgets/slack/` -> `widgets/@trops/slack/`
-   Sets `_scopeMigrated` flag to prevent re-runs

---

## Developer Guide

### For End Users

| I want to...                 | How                                                                |
| ---------------------------- | ------------------------------------------------------------------ |
| Browse and install widgets   | Settings > Widgets > Discover tab, or use the Dashboard Wizard     |
| Install a widget from a file | Settings > Widgets > "Install from ZIP"                            |
| See available updates        | Settings > Widgets -- update indicators appear on registry widgets |
| Uninstall a widget           | Settings > Widgets > click widget > Uninstall                      |

### For Widget Developers

| I want to...                            | How                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Build a widget for my private app       | Add to `src/Widgets/`, export from `index.js`, restart app                               |
| Build a widget for the registry         | Develop in `src/SampleWidgets/` (or any dir), publish with `npm run publish-to-registry` |
| Test a widget locally before publishing | Use ZIP install or folder install to load the built widget                               |
| See example widget code                 | Browse `src/SampleWidgets/` -- 12 full working examples                                  |

### Publishing to the Registry

```bash
# Publish all widgets from a directory
npm run publish-to-registry -- --all --dir src/SampleWidgets

# Publish a single widget
npm run publish-to-registry -- --widget Slack --dir src/SampleWidgets

# Preview manifest without publishing
npm run publish-to-registry -- --all --dir src/SampleWidgets --dry-run
```

The publish pipeline: Rollup bundles the widget -> `packageZip.js` creates a distributable ZIP -> `publishToRegistry.js` authenticates via OAuth device flow and uploads to the registry API.

**Flags:**

| Flag              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `--widget <Name>` | Publish a single widget directory                       |
| `--all`           | Publish all widget directories                          |
| `--dir <path>`    | Custom widget source directory (default: `src/Widgets`) |
| `--dry-run`       | Preview manifest without publishing                     |
| `--name <name>`   | Override registry package name                          |
| `--republish`     | Overwrite existing version in registry                  |

### Sample Widgets

The `src/SampleWidgets/` directory contains all 12 stock widgets as developer reference:

| Package        | Key Widgets                                                              | Category     |
| -------------- | ------------------------------------------------------------------------ | ------------ |
| DashSamples    | NotepadWidget, ThemeViewerWidget, EventSenderWidget, EventReceiverWidget | general      |
| Chat           | ChatClaudeCodeWidget                                                     | productivity |
| Slack          | SlackWidget, SlackListChannels, SlackChannelMessages, SlackPostMessage   | social       |
| Gmail          | GmailWidget, GmailInbox, GmailCompose, GmailSearch                       | productivity |
| GoogleCalendar | GoogleCalendarWidget, GCalUpcoming, GCalQuickCreate                      | productivity |
| GoogleDrive    | GoogleDriveWidget, GDriveFileList, GDriveFileSearch                      | productivity |
| GitHub         | GitHubWidget, GitHubRepoList, GitHubIssueList, GitHubPRList              | development  |
| Notion         | NotionWidget                                                             | productivity |
| Gong           | GongWidget                                                               | productivity |
| Filesystem     | FilesystemWidget                                                         | utilities    |
| Algolia        | AlgoliaSearchWidget, AlgoliaAnalyticsWidget, + 10 more                   | development  |
| AlgoliaSearch  | AlgoliaSearchPage                                                        | development  |

These are **not compiled** into the app. They exist purely as examples for developers who want to build their own widgets.

---

## Security

### ZIP Validation

All ZIP extractions (registry download, local install, dashboard import) pass through `validateZipEntries()`:

-   Rejects entries with `..` path segments (path traversal)
-   Rejects absolute paths (filesystem escape)
-   Rejects entries that resolve outside the target directory

### Download Security

-   Registry downloads enforce HTTPS-only URLs
-   OAuth device flow for registry publishing (no stored credentials)

---

## First-Run Experience

The app launches with an empty state showing three actions:

1. **Search** -- opens the command palette widget search
2. **New Dashboard** -- creates a blank dashboard
3. **Wizard** -- guided flow: browse registry, select widgets, create dashboard

The previous "Welcome Prompt" (Kitchen Sink sample workspace) has been removed. The `WelcomePrompt` component still exists in dash-core for API compatibility but is no longer rendered by `DashboardStage`.

---

## Decisions Made

| Date       | Decision                                            | Rationale                                                           |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| 2026-03-20 | Ship dash-electron with empty `src/Widgets/`        | Eliminates built-in widget bloat; users install only what they need |
| 2026-03-20 | Keep built-in widget mechanism intact               | Developers who clone the template can still compile custom widgets  |
| 2026-03-20 | Only registry widgets get updates                   | Clean separation -- built-in and ZIP widgets are developer-managed  |
| 2026-03-20 | Use npm-style `@scope/name` for widget identity     | Prevents name collisions, familiar convention                       |
| 2026-03-20 | Remove Kitchen Sink welcome prompt                  | Wizard provides a better onboarding experience                      |
| 2026-03-20 | Wizard auto-installs widgets before layout creation | Prevents broken layout references to uninstalled widgets            |

---

## Revision History

| Version | Date       | Author    | Changes                                                                                       |
| ------- | ---------- | --------- | --------------------------------------------------------------------------------------------- |
| 1.0     | 2026-03-20 | Core Team | Initial version -- documents registry-first model, scoped identity, three installation tracks |
