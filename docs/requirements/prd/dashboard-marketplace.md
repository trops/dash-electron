# PRD: Dashboard Configuration Marketplace

**Status:** Draft
**Last Updated:** 2026-03-07
**Owner:** Core Team
**Related PRDs:** None
**Epic:** DASH-10

---

## Executive Summary

The Dashboard Marketplace enables users to browse, download, and share prebuilt dashboard configurations -- complete with widget dependencies, event wiring, and provider requirements. This eliminates the tedious manual process of building dashboards from scratch by letting users install curated, ready-to-use dashboard layouts from the existing dash-registry or from local ZIP files, with all required widgets auto-installed and event handlers auto-wired.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

Building a functional dashboard today requires multiple manual steps: adding widgets one-by-one, configuring their layout in a grid, wiring event handlers between widgets, and setting up required providers. A user who wants a "GitHub + Slack DevOps dashboard" must independently discover compatible widgets, figure out which events connect them, and manually configure everything. There is no way to share a working dashboard configuration with another user.

This friction discourages experimentation and limits the value of the widget ecosystem. Widget developers publish individual widgets, but users lack curated, opinionated combinations that demonstrate how widgets work together.

**Who experiences this problem?**

-   Primary: Dashboard consumers who want pre-made, functional dashboards without manual setup
-   Secondary: Dashboard creators who build useful layouts and want to share them with the community
-   Tertiary: Widget developers who want their widgets featured in curated dashboard configurations

**What happens if we don't solve it?**

-   Users only use simple single-widget dashboards because multi-widget setups are too tedious
-   The widget ecosystem grows but adoption remains low -- widgets exist in isolation
-   No community sharing layer means every user starts from zero
-   Widget developers lack a showcase for demonstrating widget interoperability

### Current State

**What exists today?**

The dash-registry (`registry-index.json`) supports browsing and installing individual widget packages. The `registryController.js` handles fetching/caching the registry index and searching packages. The `widgetRegistry.js` manages widget download, extraction, and dynamic loading. Workspaces are stored as JSON in `workspaces.json` via `workspaceController.js`, and `DashboardModel` / `LayoutModel` define the workspace structure including grid layout, widget placement, and event listeners.

**Limitations:**

-   Registry only supports widget packages (`type: "widget"`) -- no dashboard configuration type
-   No way to export a working dashboard as a portable configuration file
-   No way to import a dashboard and auto-install its widget dependencies
-   Event wiring between widgets must be manually configured per-widget
-   No attribution or sharing controls for dashboard configurations

---

## Goals & Success Metrics

### Primary Goals

1. **Enable dashboard sharing** - Users can export their dashboards as portable configuration files (ZIP) and publish them to the registry
2. **One-click dashboard setup** - Users can install a pre-made dashboard and have all widgets auto-installed and events auto-wired
3. **Extend the registry** - Add dashboard configurations as a first-class package type alongside widgets in the existing dash-registry

### Success Metrics

| Metric                         | Target                                       | How Measured                                   |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| Dashboard install success rate | >95% of installs complete without error      | Error tracking in install flow                 |
| Time to functional dashboard   | <30 seconds from browse to working dashboard | Workflow timing (excluding provider setup)     |
| Registry dashboard count       | 5+ community dashboards within first month   | Registry index count where `type: "dashboard"` |

### Non-Goals

-   **Provider auto-configuration** - Provider mapping UX is deferred to a later phase (P2). Users will manually configure providers after import.
-   **Dashboard editing/forking** - Imported dashboards are used as-is. Editing tools for imported dashboards are out of scope.
-   **Cross-app dashboard sharing** - Dashboards are scoped to dash-electron apps with compatible widget registries.
-   **Real-time collaboration** - No live co-editing of dashboards.

---

## User Personas

### Dashboard Consumer

**Role:** End user who wants functional dashboards without manual setup

**Goals:**

-   Browse and discover pre-made dashboards that solve specific use cases
-   Install a dashboard with one click and have it "just work"
-   Understand what widgets and providers a dashboard needs before installing

**Pain Points:**

-   Building multi-widget dashboards from scratch is tedious and error-prone
-   Doesn't know which widgets work well together or how to wire events
-   No way to get a "starter" dashboard for common workflows

**Technical Level:** Beginner to Intermediate

**Success Scenario:** Finds a "DevOps Monitor" dashboard in the registry, installs it, sees all widgets appear in a pre-configured layout with events already wired. Only needs to add API credentials to start using it.

### Dashboard Creator

**Role:** Power user who builds and shares dashboard configurations

**Goals:**

-   Export working dashboards to share with colleagues or the community
-   Publish curated dashboards to the registry with proper attribution
-   Get credit as the dashboard author while preserving widget author attribution

**Pain Points:**

-   No way to share a working dashboard setup with others
-   Cannot package a dashboard with its widget dependencies
-   No mechanism to publish dashboards to the community

**Technical Level:** Intermediate to Advanced

**Success Scenario:** Builds a polished analytics dashboard, exports it as a ZIP to share with teammates, then publishes it to the registry for the wider community.

### Widget Developer

**Role:** Developer who publishes widgets and wants them used in curated dashboards

**Goals:**

-   Have widgets featured in community dashboards to drive adoption
-   Maintain proper attribution when widgets are included in dashboard configs
-   Understand which dashboards use their widgets

**Pain Points:**

-   Widgets exist in isolation -- no way to showcase them in curated combinations
-   No attribution trail when widgets are bundled into shared configurations

**Technical Level:** Advanced

**Success Scenario:** Publishes a GitHub widget that gets included in 3 popular community dashboards, driving downloads and providing real-world usage examples.

---

## User Stories

### Must-Have (P0)

**US-001: Dashboard Config Schema**

> As a dashboard creator,
> I want a standardized schema for dashboard configuration files,
> so that dashboards can be reliably exported, shared, and imported across installations.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: A `.dashboard.json` schema is defined that includes: workspace layout (full `DashboardModel` JSON), widget dependencies (package name, version, required flag), event wiring (source/target widget + event/handler names), provider requirements (type, class, which widgets use them), metadata (name, description, author, tags, icon, screenshots), and a `shareable` boolean flag
-   [ ] AC2: The `shareable` flag defaults to `true` when a user creates a dashboard config from their own workspace, and is set to `false` when importing from registry or ZIP
-   [ ] AC3: Dashboard author attribution is separate from widget author attribution -- each widget entry in the config retains its original `author` field
-   [ ] AC4: Schema includes a `schemaVersion` field for future compatibility
-   [ ] AC5: Schema validation rejects configs missing required fields (name, workspace, widgets array)

**Edge Cases:**

-   Widget in config no longer exists in registry -> Config is still valid; install flow handles missing widgets gracefully (see US-005)
-   Dashboard has no event wiring -> `eventWiring` array is empty; config is still valid
-   Dashboard has no provider requirements -> `providers` array is empty; config is still valid

**Technical Notes:**

The schema builds on existing models:

-   `workspace` field contains the same JSON structure as entries in `workspaces.json` (managed by `workspaceController.js`)
-   `widgets` array references packages from `registry-index.json`
-   `eventWiring` maps to the `listeners` property in `LayoutModel.js`
-   `providers` mirrors the provider declarations in `.dash.js` widget configs

**Example Schema:**

```json
{
    "schemaVersion": "1.0.0",
    "name": "My Analytics Dashboard",
    "description": "Pre-wired analytics with Algolia + GitHub",
    "author": { "name": "trops", "id": "trops" },
    "shareable": true,
    "tags": ["analytics", "algolia", "github"],
    "icon": "chart-line",
    "screenshots": [],
    "workspace": {
        "id": 1709856000000,
        "name": "Analytics",
        "type": "workspace",
        "label": "Analytics",
        "version": 1,
        "layout": [
            {
                "id": 1,
                "order": 1,
                "type": "grid",
                "component": "LayoutGridContainer",
                "hasChildren": 1,
                "parent": 0,
                "menuId": 1,
                "width": "w-full",
                "height": "h-full",
                "grid": {
                    "rows": 2,
                    "cols": 2,
                    "gap": "gap-2",
                    "1.1": { "component": "AlgoliaSearchPage", "hide": false },
                    "1.2": {
                        "component": "AlgoliaResultsWidget",
                        "hide": false
                    },
                    "2.1": { "component": "GitHubRepoWidget", "hide": false },
                    "2.2": { "component": "SlackChannelWidget", "hide": false }
                }
            }
        ]
    },
    "widgets": [
        {
            "id": "trops.algolia.AlgoliaSearchPage",
            "package": "@trops/algolia-search",
            "version": "^1.0.0",
            "required": true,
            "author": "Dash Team"
        },
        {
            "id": "trops.algolia.AlgoliaResultsWidget",
            "package": "@trops/algolia-search",
            "version": "^1.0.0",
            "required": true,
            "author": "Dash Team"
        },
        {
            "id": "trops.github.GitHubRepoWidget",
            "package": "@trops/github-widgets",
            "version": "^1.0.0",
            "required": true,
            "author": "Dash Team"
        },
        {
            "id": "trops.slack.SlackChannelWidget",
            "package": "@trops/slack-widgets",
            "version": "^1.0.0",
            "required": false,
            "author": "Community Author"
        }
    ],
    "providers": [
        {
            "type": "algolia",
            "providerClass": "credential",
            "required": true,
            "usedBy": ["AlgoliaSearchPage", "AlgoliaResultsWidget"]
        },
        {
            "type": "github",
            "providerClass": "credential",
            "required": true,
            "usedBy": ["GitHubRepoWidget"]
        }
    ],
    "eventWiring": [
        {
            "source": {
                "widget": "AlgoliaSearchPage",
                "event": "queryChanged"
            },
            "target": {
                "widget": "AlgoliaResultsWidget",
                "handler": "onSearchQuerySelected"
            }
        }
    ]
}
```

**Definition of Done:**

-   [ ] Schema documented with all fields, types, and validation rules
-   [ ] JSON Schema file created for programmatic validation
-   [ ] Example configs created for testing
-   [ ] Schema handles all existing workspace/layout model properties

---

**US-002: Export Dashboard as ZIP**

> As a dashboard creator,
> I want to export one of my dashboards as a `.zip` file,
> so that I can share it with colleagues via file transfer.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: User can right-click or use a menu action on any workspace to select "Export as ZIP"
-   [ ] AC2: The exported ZIP contains a valid `.dashboard.json` file following the schema from US-001
-   [ ] AC3: The export process reads the current workspace from `workspaceController`, resolves widget dependencies from installed widgets, extracts event wiring from `LayoutModel` listeners, and aggregates provider requirements from `.dash.js` configs
-   [ ] AC4: User is prompted with a native file save dialog to choose the export location
-   [ ] AC5: The `shareable` flag is set to `true` in the exported config (user created this dashboard)
-   [ ] AC6: Dashboard author is set to the current user; each widget's `author` field comes from the widget's package metadata

**Edge Cases:**

-   Dashboard contains widgets that are no longer installed -> Export warns user but still generates config with widget references
-   Dashboard has no event wiring -> Valid export with empty `eventWiring` array
-   Dashboard name contains special characters -> Sanitized for filename, preserved in config JSON

**Technical Notes:**

Key files to extend:

-   `workspaceController.js` -- add `exportWorkspaceAsConfig()` method to serialize workspace + resolve dependencies
-   `widgetRegistry.js` -- query installed widget metadata for dependency resolution
-   New IPC handler in `electron.js` for the export action
-   Use `electron.dialog.showSaveDialog()` for native file picker

**Example Scenario:**

```
User has a working "DevOps Monitor" dashboard with GitHub, Slack, and PagerDuty widgets.
User right-clicks the workspace tab and selects "Export as ZIP".
System serializes the workspace layout, resolves 3 widget dependencies, extracts 2 event wiring rules.
Native save dialog appears. User saves to ~/Desktop/devops-monitor.zip.
ZIP contains devops-monitor.dashboard.json with shareable: true.
```

**Definition of Done:**

-   [ ] Export action accessible from workspace context menu
-   [ ] Generated ZIP contains valid `.dashboard.json`
-   [ ] All widget dependencies resolved and included in config
-   [ ] Event wiring extracted from layout listeners
-   [ ] Provider requirements aggregated from widget configs
-   [ ] Native file save dialog used for export location

---

**US-003: Import Dashboard from ZIP**

> As a dashboard consumer,
> I want to import a dashboard from a `.zip` file,
> so that I can use a dashboard shared by a colleague without manual setup.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: User can trigger "Import Dashboard from ZIP" from the app menu or workspace list
-   [ ] AC2: A native file picker allows selecting a `.zip` file from disk
-   [ ] AC3: The system validates the `.dashboard.json` inside the ZIP against the schema
-   [ ] AC4: Required widgets that are not already installed are automatically downloaded and installed from the registry
-   [ ] AC5: The workspace is added to `workspaces.json` and appears in the workspace list
-   [ ] AC6: Event wiring from the config's `eventWiring` array is applied to the workspace's layout model `listeners` properties
-   [ ] AC7: The imported dashboard is marked `shareable: false` -- the user cannot re-publish someone else's dashboard
-   [ ] AC8: A summary is shown after import: widgets installed, events wired, providers needed
-   [ ] AC9: ZIP entries are validated against path traversal attacks (reuse existing `validateZipEntries` from `widgetRegistry.js`)

**Edge Cases:**

-   ZIP contains invalid or missing `.dashboard.json` -> Show error, abort import
-   Required widget not found in registry -> Show warning listing missing widgets; import proceeds with available widgets placed, missing slots show placeholder
-   Widget version conflict (installed version doesn't match required range) -> Use installed version if compatible, warn if not
-   Duplicate workspace name -> Append " (imported)" suffix
-   User already has an identical workspace -> Import creates a new copy with unique ID

**Technical Notes:**

Key files to extend:

-   `widgetRegistry.js` -- reuse `validateZipEntries()` for security; add batch install method
-   `workspaceController.js` -- add `importWorkspaceFromConfig()` to create workspace from dashboard config
-   `registryController.js` -- resolve widget packages from registry for auto-install
-   New IPC handler in `electron.js` for import action
-   Use `electron.dialog.showOpenDialog()` with filter for `.zip` files

**Example Scenario:**

```
User receives devops-monitor.zip from a colleague.
User opens app menu -> "Import Dashboard from ZIP".
File picker opens, user selects the ZIP.
System validates the .dashboard.json schema.
System finds 3 required widgets: 2 already installed, 1 needs download.
System downloads and installs the missing widget from registry.
Workspace "DevOps Monitor" is added to workspace list.
Event wiring (2 rules) applied to layout listeners.
Summary shown: "Imported 'DevOps Monitor' -- 1 widget installed, 2 events wired, 2 providers needed (GitHub, Slack)."
Dashboard shareable flag set to false.
```

**Definition of Done:**

-   [ ] Import action accessible from app menu and workspace list
-   [ ] ZIP validation includes path traversal protection
-   [ ] Schema validation catches malformed configs
-   [ ] Missing widgets auto-installed from registry
-   [ ] Workspace created and visible in workspace list
-   [ ] Event wiring applied to layout model
-   [ ] Imported dashboard marked `shareable: false`
-   [ ] Post-import summary displayed to user

---

**US-004: Browse/Search Dashboards on Registry**

> As a dashboard consumer,
> I want to browse and search for dashboard configurations on the registry,
> so that I can discover pre-made dashboards for my use case.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: The registry index (`registry-index.json`) supports a new package type `"dashboard"` alongside existing `"widget"` type
-   [ ] AC2: The registry UI (widget browser) shows a toggle or tab to switch between widgets and dashboards
-   [ ] AC3: Dashboard entries display: name, description, author, tags, widget count, and icon
-   [ ] AC4: Search works across dashboard name, description, tags, and included widget names
-   [ ] AC5: Filter option: "Compatible with my installed widgets" shows dashboards whose required widgets are all already installed
-   [ ] AC6: Clicking a dashboard entry shows a detail view with full description, widget list, provider requirements, and event wiring summary

**Edge Cases:**

-   Registry has no dashboards yet -> Show empty state with message encouraging users to publish
-   Registry fetch fails -> Show cached results if available; show error if no cache
-   Dashboard references widgets from a different registry -> Show as incompatible

**Technical Notes:**

Key files to extend:

-   `registry-index.json` (dash-registry) -- add `type: "dashboard"` entries to packages array
-   `registryController.js` -- extend `searchRegistry()` to filter by type; add installed-widget compatibility filter
-   `registryApi.js` -- add IPC channels for dashboard-specific registry queries
-   `build-index.js` (dash-registry) -- extend index builder to include dashboard packages

**Example Scenario:**

```
User opens the widget browser and switches to "Dashboards" tab.
Registry shows 8 available dashboards.
User searches "analytics".
Results filter to 2 dashboards: "Algolia Analytics" and "GitHub Insights".
User clicks "Algolia Analytics".
Detail view shows: 4 widgets required (2 installed, 2 need install), 3 event wiring rules, 1 provider needed (Algolia).
```

**Definition of Done:**

-   [ ] Registry index supports `type: "dashboard"` packages
-   [ ] Registry UI shows dashboards separately from widgets
-   [ ] Search and filter works for dashboard entries
-   [ ] Compatibility filter based on installed widgets
-   [ ] Dashboard detail view shows complete information

---

**US-005: Install Dashboard from Registry**

> As a dashboard consumer,
> I want to install a dashboard directly from the registry,
> so that I can set up a pre-made dashboard without needing a ZIP file.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Dashboard detail view (from US-004) includes an "Install" button
-   [ ] AC2: Clicking "Install" triggers the same import flow as ZIP import (US-003) but sourced from the registry instead of a local file
-   [ ] AC3: The dashboard config is fetched from the registry, validated, and processed identically to ZIP import
-   [ ] AC4: All required widgets are auto-installed from the registry
-   [ ] AC5: The installed dashboard is marked `shareable: false`
-   [ ] AC6: Post-install summary shows widgets installed, events wired, and providers needed
-   [ ] AC7: If the user already has a workspace with the same name, the import appends " (imported)" to avoid collision

**Edge Cases:**

-   Network failure during widget install -> Rollback: remove partially imported workspace, show error with retry option
-   Dashboard references a widget that was removed from registry -> Warn user, proceed with available widgets
-   User clicks install on a dashboard they previously installed -> Create new copy (different workspace ID)

**Technical Notes:**

Key files to extend:

-   `registryController.js` -- add `fetchDashboardConfig()` to download dashboard config from registry
-   Reuse the import pipeline from US-003 (`importWorkspaceFromConfig`)
-   New IPC handler for registry-based dashboard install

**Example Scenario:**

```
User browses registry dashboards and finds "DevOps Monitor".
User clicks "Install" on the dashboard detail view.
System fetches dashboard config from registry.
System identifies 4 required widgets: 1 already installed, 3 need download.
Progress indicator shows widget installation (3/3 complete).
Workspace "DevOps Monitor" added to workspace list.
Summary: "3 widgets installed, 2 events wired. Providers needed: GitHub, Slack, PagerDuty."
Dashboard marked shareable: false.
```

**Definition of Done:**

-   [ ] Install button on dashboard detail view
-   [ ] Dashboard config fetched from registry
-   [ ] Import pipeline shared with ZIP import flow
-   [ ] Widgets auto-installed from registry
-   [ ] Dashboard marked `shareable: false`
-   [ ] Post-install summary displayed
-   [ ] Error handling with rollback on failure

---

### Should-Have (P1)

**US-006: Publish Dashboard to Registry**

> As a dashboard creator,
> I want to publish my own dashboard to the registry,
> so that other users can discover and install it.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: "Publish to Registry" option is only available for dashboards with `shareable: true` (user-created dashboards, not imported ones)
-   [ ] AC2: User can add/edit description, tags, icon, and screenshots before publishing
-   [ ] AC3: The published dashboard appears in the registry as a `type: "dashboard"` package
-   [ ] AC4: Dashboard author attribution is preserved; widget authors are credited individually
-   [ ] AC5: Publishing validates that all referenced widgets exist in the registry
-   [ ] AC6: User receives confirmation with a link/identifier for the published dashboard

**Edge Cases:**

-   Dashboard references a locally-installed widget not in the registry -> Block publish, show which widgets need to be published first
-   User tries to publish an imported dashboard (`shareable: false`) -> Option is hidden; if forced via API, reject with error
-   Dashboard with same name already exists in registry by same author -> Prompt to update or rename

**Technical Notes:**

Extends the registry publish workflow. Dashboard configs are published similarly to widget packages but with `type: "dashboard"` in the registry manifest. The `shareable` flag is the gate -- only `true` allows publishing.

**Example Scenario:**

```
User right-clicks their "Analytics Hub" workspace (shareable: true).
Context menu shows "Export as ZIP" and "Publish to Registry".
User clicks "Publish to Registry".
Form appears: description pre-filled, user adds tags ["analytics", "algolia"].
User confirms. Dashboard is validated (all 3 widgets exist in registry).
Dashboard published. Confirmation: "Analytics Hub published to registry."
```

**Definition of Done:**

-   [ ] Publish option gated by `shareable: true`
-   [ ] Pre-publish form for metadata editing
-   [ ] Validation that referenced widgets exist in registry
-   [ ] Dashboard appears in registry after publish
-   [ ] Attribution preserved for dashboard and widget authors

---

**US-007: Compatibility Check**

> As a dashboard consumer,
> I want to see which widgets I already have vs. which need to be installed,
> so that I can understand the impact before importing a dashboard.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Before import/install, a compatibility summary shows: widgets already installed (green), widgets to be installed (yellow), widgets unavailable/missing (red)
-   [ ] AC2: The summary includes version compatibility -- whether installed versions satisfy the required version ranges
-   [ ] AC3: User can proceed with import or cancel based on the compatibility information
-   [ ] AC4: Optional widgets (where `required: false` in config) are clearly marked as optional

**Edge Cases:**

-   All widgets already installed -> Show "All widgets ready" and skip install step
-   No widgets installed -> Show full list of widgets to be installed with total download size estimate
-   Installed widget version is outside required range -> Warn but allow proceeding (use installed version)

**Technical Notes:**

Cross-reference dashboard config `widgets` array with installed widgets from `widgetRegistry.js`. Use semver comparison for version compatibility checks.

**Example Scenario:**

```
User clicks "Install" on "DevOps Monitor" dashboard.
Compatibility check runs:
  - GitHubRepoWidget v1.2.0 (installed, compatible)
  - SlackChannelWidget v1.0.0 (installed, compatible)
  - PagerDutyWidget (not installed, will be downloaded)
  - JiraWidget (not installed, not in registry -- unavailable)
User sees summary. Proceeds with install knowing JiraWidget won't be available.
```

**Definition of Done:**

-   [ ] Compatibility summary UI with color-coded status
-   [ ] Version range comparison using semver
-   [ ] Optional vs. required widgets distinguished
-   [ ] User can proceed or cancel from summary

---

**US-008: Dashboard Preview**

> As a dashboard consumer,
> I want to preview a dashboard's details before installing it,
> so that I can evaluate whether it meets my needs.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Dashboard detail view shows: full description, author info, tags, and creation date
-   [ ] AC2: Screenshot gallery displays dashboard screenshots (if provided in config)
-   [ ] AC3: Widget list shows all included widgets with their names, descriptions, and authors
-   [ ] AC4: Event wiring is displayed as a readable summary (e.g., "AlgoliaSearch -> AlgoliaResults: query changes")
-   [ ] AC5: Provider requirements are listed with clear labels

**Edge Cases:**

-   Dashboard has no screenshots -> Show placeholder with dashboard icon
-   Dashboard has 10+ widgets -> Scrollable widget list with count badge

**Technical Notes:**

This extends the dashboard detail view from US-004 with richer content display. Screenshots can be stored as URLs in the registry or embedded as base64 in the config.

**Example Scenario:**

```
User clicks "Algolia Analytics" dashboard in the registry browser.
Preview shows:
  - Description: "Complete Algolia analytics setup with search, results, and metrics"
  - Author: trops
  - Screenshots: 2 images showing the dashboard in light and dark theme
  - Widgets: AlgoliaSearchPage, AlgoliaResultsWidget, AlgoliaMetricsWidget (3 widgets)
  - Events: "Search query flows from SearchPage to ResultsWidget and MetricsWidget"
  - Providers needed: Algolia (credential)
User decides this fits their needs and clicks "Install".
```

**Definition of Done:**

-   [ ] Rich detail view with all metadata displayed
-   [ ] Screenshot gallery functional
-   [ ] Widget list with per-widget attribution
-   [ ] Event wiring summary in human-readable format
-   [ ] Provider requirements listed

---

### Nice-to-Have (P2)

**US-009: One-Shot Provider Setup**

> As a dashboard consumer,
> I want a single modal to configure all required providers after importing a dashboard,
> so that I can get the dashboard fully functional in one step.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: After dashboard import, if providers are required, a "Configure Providers" modal appears
-   [ ] AC2: The modal lists all required providers with input fields for credentials
-   [ ] AC3: Each provider shows which widgets depend on it
-   [ ] AC4: Providers already configured in the app are pre-filled and marked as ready
-   [ ] AC5: User can skip the modal and configure providers later

**Edge Cases:**

-   All providers already configured -> Modal shows "All providers ready" with a close button
-   User dismisses modal -> Widgets show provider-required state until configured

**Technical Notes:**

This builds on the existing provider system. Provider requirements are aggregated from the dashboard config's `providers` array. The modal reuses existing credential provider UI components.

**Definition of Done:**

-   [ ] Post-import provider configuration modal
-   [ ] All required providers listed with dependency info
-   [ ] Pre-fill for already-configured providers
-   [ ] Skip option available

---

**US-010: Dashboard Versioning**

> As a dashboard consumer,
> I want to be notified when a dashboard I installed has been updated,
> so that I can get the latest layout improvements and new widget integrations.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Dashboard configs include a `version` field following semver
-   [ ] AC2: The app periodically checks installed dashboard configs against registry versions
-   [ ] AC3: A notification badge appears on outdated dashboards in the workspace list
-   [ ] AC4: User can view changelog and choose to update or dismiss
-   [ ] AC5: Updating preserves user's provider configurations

**Edge Cases:**

-   User has customized the imported dashboard -> Warn that update will overwrite changes
-   Updated dashboard requires new widgets -> Trigger widget install flow before applying update

**Technical Notes:**

Requires tracking installed dashboard source (registry ID + version) in workspace metadata. Reuses registry fetch from `registryController.js` for version comparison.

**Definition of Done:**

-   [ ] Version field in dashboard config schema
-   [ ] Background version check against registry
-   [ ] Update notification in workspace list
-   [ ] Update flow preserves provider configs

---

**US-011: Ratings & Community Feedback**

> As a dashboard consumer,
> I want to see ratings and reviews for dashboards,
> so that I can choose high-quality, well-maintained configurations.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Users can rate dashboards on a 1-5 star scale after installing
-   [ ] AC2: Average rating and total review count displayed on dashboard cards in the registry
-   [ ] AC3: Users can write optional text reviews
-   [ ] AC4: Registry browse can be sorted by rating

**Edge Cases:**

-   Dashboard has no ratings -> Show "No ratings yet" instead of empty stars
-   User tries to rate without installing -> Prompt to install first

**Technical Notes:**

Requires a backend service or registry extension for storing ratings. This is a significant infrastructure addition and is deferred to P2.

**Definition of Done:**

-   [ ] Rating submission UI
-   [ ] Rating display on dashboard cards
-   [ ] Sort by rating in registry browse
-   [ ] Backend storage for ratings data

---

## Feature Requirements

### Functional Requirements

**FR-001: Dashboard Config Schema**

-   **Description:** Define and validate a `.dashboard.json` schema that captures workspace layout, widget dependencies, event wiring, provider requirements, attribution, and sharing controls
-   **User Story:** US-001
-   **Priority:** P0
-   **Validation:** JSON Schema validation passes for sample configs; all required fields enforced

**FR-002: Dashboard Export**

-   **Description:** Serialize a workspace into a `.dashboard.json` config and package as ZIP with resolved widget dependencies, event wiring, and provider requirements
-   **User Story:** US-002
-   **Priority:** P0
-   **Validation:** Exported ZIP can be successfully imported on a clean installation

**FR-003: Dashboard Import**

-   **Description:** Parse a `.dashboard.json` from ZIP or registry, validate schema, auto-install missing widgets, create workspace, apply event wiring, and set `shareable: false`
-   **User Story:** US-003, US-005
-   **Priority:** P0
-   **Validation:** Import from ZIP and registry both produce working dashboards with events wired

**FR-004: Registry Dashboard Support**

-   **Description:** Extend `registry-index.json` and `registryController.js` to support `type: "dashboard"` packages with browse, search, and compatibility filtering
-   **User Story:** US-004, US-005
-   **Priority:** P0
-   **Validation:** Dashboard packages appear in registry; search and filter work correctly

**FR-005: Registry Dashboard Publishing**

-   **Description:** Allow users to publish `shareable: true` dashboards to the registry as `type: "dashboard"` packages
-   **User Story:** US-006
-   **Priority:** P1
-   **Validation:** Published dashboards appear in registry and can be installed by other users

**FR-006: Pre-Install Compatibility Check**

-   **Description:** Compare dashboard widget requirements against installed widgets, showing status and version compatibility
-   **User Story:** US-007
-   **Priority:** P1
-   **Validation:** Compatibility summary correctly identifies installed, missing, and incompatible widgets

### Non-Functional Requirements

**NFR-001: Performance**

-   Dashboard import (excluding widget download) completes in <5 seconds
-   Registry dashboard search returns results in <2 seconds
-   Dashboard export completes in <3 seconds

**NFR-002: Security**

-   ZIP imports validated against path traversal attacks (reuse `validateZipEntries` from `widgetRegistry.js`)
-   Dashboard configs validated against schema before processing
-   `shareable: false` enforcement cannot be bypassed from renderer process

**NFR-003: Usability**

-   Dashboard install completes in 3 clicks or fewer (browse -> select -> install)
-   Post-install summary clearly communicates what was set up and what still needs configuration
-   Export/import actions discoverable from workspace context menu and app menu

**NFR-004: Compatibility**

-   Backward compatible with existing `workspaces.json` format
-   Dashboard configs work across dash-electron versions (schema versioning)
-   Existing widget packages unaffected by registry changes

---

## User Workflows

### Workflow 1: Import Dashboard from ZIP

**Trigger:** User receives a `.zip` dashboard file from a colleague

**Steps:**

1. User selects "Import Dashboard" from the app menu or workspace list "+" button
2. System opens native file picker filtered to `.zip` files
3. User selects the ZIP file
4. System extracts and validates `.dashboard.json` against schema
5. System shows compatibility summary: installed widgets, widgets to install, providers needed
6. User clicks "Import"
7. System installs missing widgets from registry
8. System creates workspace from config, applies event wiring
9. System shows post-import summary
10. New workspace appears in workspace list and is auto-selected

**Success State:** Dashboard is fully set up with widgets placed, events wired, and workspace visible. User only needs to configure providers.

**Error Scenarios:**

-   Invalid ZIP (no `.dashboard.json`) -> "Invalid dashboard file. The ZIP must contain a .dashboard.json configuration."
-   Widget install fails (network error) -> "Could not install 2 widgets. Check your connection and try again." with retry button
-   Schema validation fails -> "Dashboard configuration is invalid: [specific error]. Contact the dashboard author."

**Example:**

```
- User: Jane, Dashboard Consumer
- Initial state: App open with 2 existing workspaces
- Action: Menu -> Import Dashboard -> selects devops-monitor.zip
- Compatibility: 2/4 widgets installed, 2 to download
- Result: "DevOps Monitor" workspace created, 2 widgets installed, 3 events wired
- Post-state: 3 workspaces visible, "DevOps Monitor" active
```

---

### Workflow 2: Browse and Install from Registry

**Trigger:** User wants to find a pre-made dashboard for a specific use case

**Steps:**

1. User opens the widget/dashboard browser
2. User switches to "Dashboards" tab
3. User searches or browses available dashboards
4. User clicks a dashboard to see details (description, widgets, events, providers)
5. User clicks "Install"
6. System runs compatibility check and shows summary
7. User confirms installation
8. System downloads dashboard config and installs missing widgets
9. Workspace created with event wiring applied
10. Post-install summary displayed

**Success State:** Dashboard installed and visible in workspace list, ready for provider configuration.

**Error Scenarios:**

-   Registry unreachable -> "Cannot connect to registry. Check your internet connection."
-   All required widgets unavailable -> "This dashboard requires widgets that are no longer available in the registry."

**Example:**

```
- User: Mike, new to the platform
- Initial state: App open, no custom workspaces
- Action: Opens browser -> Dashboards tab -> searches "analytics"
- Finds: "Algolia Analytics" by trops (4 widgets, 2 events)
- Clicks Install -> compatibility check -> all widgets need download
- Result: 4 widgets installed, workspace created, events wired
- Provider needed: Algolia credential
```

---

### Workflow 3: Export and Share a Dashboard

**Trigger:** User has built a useful dashboard and wants to share it

**Steps:**

1. User right-clicks workspace tab or opens workspace menu
2. User sees sharing options: "Export as ZIP" and (if `shareable: true`) "Publish to Registry"
3. User selects "Export as ZIP"
4. System serializes workspace, resolves widget dependencies, extracts event wiring
5. Native save dialog appears
6. User chooses save location and filename
7. ZIP file saved to disk

**Success State:** ZIP file on disk containing a valid `.dashboard.json` that another user can import.

**Error Scenarios:**

-   Workspace references unresolvable widgets -> Warning shown, export proceeds with available metadata

**Example:**

```
- User: Sarah, Dashboard Creator
- Initial state: Has "Team Monitor" dashboard with 5 widgets, 4 events wired
- Action: Right-click "Team Monitor" tab -> "Export as ZIP"
- System resolves: 5 widgets (3 packages), 4 event wiring rules, 2 provider requirements
- Save dialog: ~/Desktop/team-monitor.zip
- Result: ZIP created with team-monitor.dashboard.json (shareable: true)
```

---

## Design Considerations

### UI/UX Requirements

-   Dashboard browser reuses existing widget browser UI patterns (tabs, search, cards)
-   Import/export actions accessible from workspace context menu and app menu
-   Post-import summary uses existing notification/modal patterns from `@trops/dash-react`
-   Compatibility check uses color-coded indicators (green/yellow/red)

### Architecture Requirements

-   Dashboard configs are a new package type in the existing registry -- not a separate system
-   Import pipeline shares code between ZIP and registry sources (single `importWorkspaceFromConfig` function)
-   Export serialization reads from existing workspace/widget data stores -- no new data models needed
-   `shareable` flag is enforced at the controller level (main process), not just in UI

**Key Files to Extend:**

| File                                                   | Change                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `dash-registry/scripts/build-index.js`                 | Include `type: "dashboard"` packages in index              |
| `dash-registry/public/registry-index.json`             | Add dashboard entries to packages array                    |
| `dash-core/electron/controller/registryController.js`  | Filter by type, compatibility check, dashboard fetch       |
| `dash-core/electron/controller/workspaceController.js` | `exportWorkspaceAsConfig()`, `importWorkspaceFromConfig()` |
| `dash-core/electron/widgetRegistry.js`                 | Batch install from dashboard manifest                      |
| `dash-core/electron/api/registryApi.js`                | New IPC channels for dashboard operations                  |
| `dash-core/src/Models/DashboardModel.js`               | Support import from dashboard config schema                |
| `dash-core/src/Models/LayoutModel.js`                  | Apply event wiring from config `eventWiring`               |
| `dash-core/src/ComponentManager.js`                    | Verify widget registration after batch install             |
| `dash-electron/public/electron.js`                     | Register new IPC handlers for dashboard import/export      |

### Dependencies

**Internal:**

-   Existing widget registry infrastructure (registry-index.json, registryController, widgetRegistry)
-   Existing workspace system (workspaceController, DashboardModel, LayoutModel)
-   Existing event system (DashboardPublisher, LayoutModel listeners)
-   Existing provider system (provider declarations in .dash.js configs)

**External:**

-   `adm-zip` -- already a dependency, used for ZIP creation and extraction
-   `semver` -- for version range comparison in compatibility checks

---

## Open Questions & Decisions

### Open Questions

1. **Q: Should dashboard screenshots be stored as URLs or embedded in the config?**

    - Context: Screenshots are valuable for preview but add file size to ZIP exports
    - Options: (A) URL references to hosted images, (B) base64 embedded in config, (C) separate image files in ZIP
    - Status: Open

2. **Q: Should imported dashboards be editable or read-only?**

    - Context: Users may want to customize imported dashboards but this complicates the `shareable` flag semantics
    - Options: (A) Fully editable but `shareable` stays false, (B) Read-only until user explicitly "forks", (C) Editable and `shareable` flips to true after modification
    - Status: Open

3. **Q: What is the publish mechanism for dashboards to the registry?**

    - Context: Widget publishing currently goes through npm + GitHub. Dashboards are config-only (no code), so the flow may differ.
    - Options: (A) Same npm publish flow as widgets, (B) Direct upload to registry API, (C) PR-based submission to dash-registry repo
    - Status: Open

### Decisions Made

| Date       | Decision                                                     | Rationale                                                                                  | Owner   |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------- |
| 2026-03-07 | Imported dashboards marked `shareable: false`                | Prevents republishing someone else's dashboard without permission                          | Product |
| 2026-03-07 | Dual sharing: ZIP export + registry publish                  | Supports both offline sharing (colleagues) and public sharing (community)                  | Product |
| 2026-03-07 | Provider setup deferred to P2                                | One-shot provider modal is a UX enhancement; users can manually configure providers in MVP | Product |
| 2026-03-07 | Separate attribution for dashboard author and widget authors | Dashboard curator gets credit; widget authors retain their attribution within the config   | Product |

---

## Out of Scope

**Explicitly excluded from this PRD:**

-   **Dashboard forking/remixing** - No mechanism to "fork" an imported dashboard and make it publishable. Users would need to recreate from scratch.
-   **Widget bundling in ZIP** - Dashboard ZIPs contain config only, not widget code. Widgets are always fetched from the registry.
-   **Real-time sync** - No cloud sync or real-time collaboration on shared dashboards.
-   **Analytics/telemetry** - No tracking of dashboard install counts or usage metrics (could be added to dash-registry later).
-   **Paid dashboards** - No monetization or paid marketplace features.

**Future Considerations:**

-   Dashboard templates (parameterized configs that prompt for customization during import)
-   Dashboard categories/collections in the registry
-   Automated screenshot generation from dashboard configs
-   Dashboard diff/merge tools for updating imported dashboards

---

## Implementation Phases

### Phase 1: MVP (P0 Stories)

**Deliverables:**

-   [ ] US-001: Dashboard Config Schema
-   [ ] US-002: Export Dashboard as ZIP
-   [ ] US-003: Import Dashboard from ZIP
-   [ ] US-004: Browse/Search Dashboards on Registry
-   [ ] US-005: Install Dashboard from Registry

**Success Criteria:** Users can export dashboards as ZIP files, import them on another installation with widgets auto-installed and events auto-wired, and browse/install dashboards from the registry.

**Risks:**

-   Registry schema changes may require coordination across dash-registry and dash-core repos -> Mitigate by designing backward-compatible registry changes
-   Widget batch install may surface edge cases in existing install flow -> Mitigate by thorough testing of widgetRegistry install pipeline

---

### Phase 2: Enhancement (P1 Stories)

**Deliverables:**

-   [ ] US-006: Publish Dashboard to Registry
-   [ ] US-007: Compatibility Check
-   [ ] US-008: Dashboard Preview

**Success Criteria:** Users can publish their own dashboards to the registry, see detailed compatibility information before installing, and preview dashboard details including screenshots.

**Dependencies:**

-   Requires Phase 1 completion
-   Registry publish mechanism needs to be decided (Open Question #3)

---

### Phase 3: Polish (P2 Stories)

**Deliverables:**

-   [ ] US-009: One-Shot Provider Setup
-   [ ] US-010: Dashboard Versioning
-   [ ] US-011: Ratings & Community Feedback

**Success Criteria:** Post-import provider configuration is streamlined, users are notified of dashboard updates, and community feedback helps surface quality dashboards.

**Dependencies:**

-   Requires Phase 1 and Phase 2 completion
-   Ratings system requires backend infrastructure decision

---

## Technical Documentation

**See related technical docs:**

-   [Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md) - Widget registration and loading
-   [Widget Registry](https://github.com/trops/dash-core/blob/master/docs/WIDGET_REGISTRY.md) - Registry infrastructure
-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md) - Provider system used by dashboards
-   [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md) - Widget config (.dash.js) format

---

## Testing Requirements

### Unit Tests

**Coverage Target:** 80% minimum

**Test Cases:**

-   [ ] Dashboard config schema validation (valid and invalid configs)
-   [ ] Export serialization: workspace -> .dashboard.json
-   [ ] Import deserialization: .dashboard.json -> workspace
-   [ ] Event wiring extraction and application
-   [ ] Provider requirement aggregation
-   [ ] `shareable` flag enforcement (true for user-created, false for imported)
-   [ ] Widget dependency resolution
-   [ ] Version compatibility comparison

**Test File:** `tests/prd/dashboard-marketplace.test.js`

### Integration Tests

**Test Scenarios:**

-   [ ] Full export -> import round trip (export dashboard, import ZIP, verify identical workspace)
-   [ ] Registry browse with mixed widget and dashboard packages
-   [ ] Batch widget install during dashboard import
-   [ ] Import with missing widgets (graceful degradation)

**Test File:** `tests/integration/dashboard-marketplace.test.js`

### E2E Tests

**Test Workflows:**

-   [ ] Complete ZIP export and import workflow
-   [ ] Registry browse, search, and install workflow
-   [ ] Import with auto-install of missing widgets

**Test File:** `e2e/dashboard-marketplace.spec.js`

### Manual Testing

**Test Checklist:**

-   [ ] Export produces valid ZIP with correct .dashboard.json
-   [ ] Import from ZIP creates working dashboard with events wired
-   [ ] Registry shows dashboards separately from widgets
-   [ ] Install from registry works end-to-end
-   [ ] `shareable: false` hides "Publish to Registry" option
-   [ ] Post-import summary is clear and accurate

---

## Revision History

| Version | Date       | Author    | Changes       |
| ------- | ---------- | --------- | ------------- |
| 1.0     | 2026-03-07 | Core Team | Initial draft |
