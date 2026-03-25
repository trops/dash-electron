# PRD: Developer Experience & Asset Distribution

**Status:** In Progress
**Last Updated:** 2026-03-25
**Owner:** Core Team
**Related PRDs:** [Widget Installation Model](https://github.com/trops/dash-core/blob/master/docs/requirements/prd/widget-installation-model.md), [Dashboard Marketplace](https://github.com/trops/dash-core/blob/master/docs/requirements/prd/dashboard-marketplace.md), [Widget Display & Installation](https://github.com/trops/dash-core/blob/master/docs/requirements/prd/widget-display-and-installation.md)
**Repos:** dash-electron, dash-core

---

## Executive Summary

Dash supports three asset types (widgets, dashboards, themes) distributed through three channels (registry, ZIP, built-in). The widget lifecycle has mature CLI tooling -- from scaffold to publish -- but dashboards and themes lack equivalent developer workflows. Documentation is scattered across three repositories, seven PRDs, three Claude Code skills, and multiple docs directories. This PRD defines the requirements for a unified developer experience: complete lifecycle tooling for all asset types, comprehensive documentation, and clear distribution workflows.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

A developer cloning the dash-electron template today can build and publish widgets effectively thanks to the `widgetize` scaffold, Rollup bundling, and `publishToRegistry.js`. However, the experience breaks down for dashboards and themes:

-   **Dashboard creation** relies entirely on the in-app Wizard or MCP tools -- there is no way to export a dashboard configuration for sharing without the running Electron app. The `publishKitchenSink.js` script demonstrates the complexity: 500+ lines of hardcoded layout configuration.
-   **Theme creation** for developers is limited to the in-app Theme editor or the `publishThemes.js` script, which only publishes 10 hardcoded curated themes from `registryThemes.js`. A developer who creates a custom theme in the app has no CLI path to export or distribute it.
-   **Documentation** is spread across `dash-electron/README.md`, `dash-electron/docs/`, `dash-core/docs/` (7 files), `dash-react/README.md`, and three Claude Code skills. There is no single document that walks a developer through the full lifecycle for all three asset types. A new developer must discover and cross-reference 15+ documents to understand the system.
-   **ZIP distribution** is fully implemented at the code level (widgets, dashboards, and themes all support ZIP import) but the workflow for creating and sharing ZIPs is undocumented for dashboards and themes.
-   **Script duplication** -- the OAuth device flow, registry publishing, and manifest building logic is duplicated across `publishToRegistry.js`, `publishThemes.js`, `publishKitchenSink.js`, and `reinstallWidgets.js` (~480 lines of identical code across 4 files).

**Who experiences this problem?**

-   Primary: Developers building widgets, dashboards, and themes for the Dash ecosystem
-   Secondary: Widget publishers distributing assets via registry and ZIP
-   Tertiary: New developers evaluating the platform for the first time

**What happens if we don't solve it?**

-   Developers waste time hunting through 15+ documents across 3 repos to understand basic workflows
-   Theme and dashboard distribution remains limited to in-app UI -- developers cannot automate or script these workflows
-   The 480-line auth/publish code duplication makes registry integration changes risky and error-prone
-   New developers bounce during onboarding because the learning curve is unnecessarily steep

### Current State

**What exists today?**

| Asset     | Create                | Develop        | Test                         | Package                                 | Publish                                                | Distribute ZIP     | Install from Registry | Install from ZIP      |
| --------- | --------------------- | -------------- | ---------------------------- | --------------------------------------- | ------------------------------------------------------ | ------------------ | --------------------- | --------------------- |
| Widget    | `widgetize` CLI       | `npm run dev`  | `test:widgets`, `screenshot` | `package-widgets`, `package-zip`        | `publish-to-registry`                                  | Share ZIP manually | Discover tab / Wizard | Settings > Widgets    |
| Dashboard | Wizard (in-app)       | In-app editing | Manual verification          | In-app export                           | In-app publish modal                                   | Share ZIP manually | Discover tab          | Settings > Dashboards |
| Theme     | Theme editor (in-app) | In-app editing | Visual preview               | `publish-themes --local` (curated only) | In-app publish modal / `publish-themes` (curated only) | Share ZIP manually | Discover tab          | Settings > Themes     |

**Limitations:**

-   No CLI scaffold for themes (no `themeize` equivalent of `widgetize`)
-   `publishThemes.js` only publishes hardcoded themes from `registryThemes.js` -- cannot publish user-created themes
-   No headless dashboard export script (requires running Electron app)
-   No unified developer guide document
-   No comprehensive script reference
-   OAuth device flow and publish logic duplicated across 4 scripts
-   ZIP distribution workflow undocumented for dashboards and themes

---

## Goals & Success Metrics

### Primary Goals

1. **Complete documentation** -- A single developer guide covers the full lifecycle for all three asset types
2. **Script reference** -- Every npm script is documented with flags, examples, and expected output
3. **Theme CLI tooling** -- Developers can create and distribute themes from the command line
4. **Dashboard CLI export** -- Developers can export dashboard configurations without the running app
5. **DRY publishing code** -- Shared auth module eliminates cross-script duplication

### Success Metrics

| Metric                                      | Target                                                   | How Measured                                              |
| ------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Developer guide covers all asset lifecycles | 3/3 asset types documented end-to-end                    | Document review                                           |
| Script documentation coverage               | 100% of npm scripts in package.json                      | Count scripts in package.json vs documented in SCRIPTS.md |
| Time to first widget (new developer)        | <30 min from clone to running widget                     | Walkthrough timing using DEVELOPER_GUIDE.md               |
| Theme CLI creation                          | Developer can create a theme ZIP without the app running | End-to-end test: `themeize` -> ZIP -> install             |
| Auth code deduplication                     | 1 shared module, 0 duplicate implementations             | Code review of publish scripts                            |

### Non-Goals

-   **`dashboardize` CLI scaffold** -- Dashboards are visual artifacts (grid layout + event wiring), not code. The Wizard, blank template, import, and MCP tools cover all creation paths. A CLI scaffold producing empty JSON adds no value.
-   **Unified `dash` CLI tool** -- npm scripts are the right abstraction for this project. A custom CLI adds build/install/version complexity with no benefit over `npm run <script>`.
-   **npm publish wrapper** -- `npm publish` is a standard npm command that developers already know. Documentation suffices.
-   **Real-time documentation sync** -- Cross-repo link freshness is managed by linking to authoritative sources (GitHub URLs), not by duplicating content.

---

## User Personas

### Widget Developer

**Role:** Developer who builds widgets for the Dash ecosystem (integrations with Slack, GitHub, Algolia, etc.)

**Goals:**

-   Scaffold, develop, test, and publish a widget quickly
-   Understand the Widget API, provider system, and MCP integration
-   Distribute widgets via registry and/or ZIP

**Pain Points:**

-   Widget development docs are split between dash-core and dash-electron
-   Must cross-reference 5+ documents to understand the full widget lifecycle
-   No single "cookbook" for common widget patterns

**Technical Level:** Intermediate to Advanced

**Success Scenario:** Creates a new MCP-connected widget and publishes it to the registry in under 30 minutes, following a single guide document.

### Dashboard Creator

**Role:** Developer or power user who assembles dashboards and shares them with their team

**Goals:**

-   Create multi-widget dashboards with event wiring
-   Export and share dashboard configurations
-   Publish dashboards to the registry for community use

**Pain Points:**

-   Dashboard export is in-app only -- cannot script or automate
-   Dashboard config format is not documented for manual creation
-   No CLI path for CI/CD integration

**Technical Level:** Beginner to Intermediate

**Success Scenario:** Creates a dashboard in-app, exports it via CLI, and shares the ZIP with a colleague who installs it in one click.

### Theme Designer

**Role:** Developer or designer who creates custom color themes for Dash

**Goals:**

-   Create themes from the command line or from design specs
-   Preview themes across all components
-   Distribute themes via registry and ZIP

**Pain Points:**

-   Theme creation requires the running Electron app
-   `publishThemes.js` only works with hardcoded themes
-   No CLI path to create a theme from a color palette

**Technical Level:** Beginner to Intermediate

**Success Scenario:** Creates a branded theme from CLI using company colors, generates a ZIP, and distributes it to team members.

### App Developer

**Role:** Developer who clones the dash-electron template to build a custom dashboard application for their organization

**Goals:**

-   Understand the full architecture quickly
-   Know which repo owns which functionality
-   Set up cross-repo development when needed

**Pain Points:**

-   Three repos with different conventions and doc structures
-   Must understand the relationship between dash-core, dash-react, and dash-electron
-   Link/unlink workflow is not discoverable

**Technical Level:** Intermediate to Advanced

**Success Scenario:** Clones the template, reads the developer guide, and has a working development environment with custom widgets within an hour.

---

## User Stories

### Must-Have (P0)

**US-001: Unified Developer Guide**

> As a new developer,
> I want a single document that walks me through the full development lifecycle for widgets, dashboards, and themes,
> so that I don't have to hunt through 15+ documents across 3 repos to understand how to build and distribute assets.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [x] AC1: `DEVELOPER_GUIDE.md` exists in `dash-electron/docs/`
-   [x] AC2: Guide covers widget lifecycle (create, develop, test, package, publish, distribute)
-   [x] AC3: Guide covers dashboard lifecycle (create, configure, export, publish, distribute)
-   [x] AC4: Guide covers theme lifecycle (create, customize, export, publish, distribute)
-   [x] AC5: Guide covers all three distribution channels (registry, ZIP, built-in)
-   [x] AC6: Guide links to authoritative dash-core and dash-react docs for deep-dives
-   [ ] AC7: Guide includes troubleshooting section with common issues

**Definition of Done:**

-   [x] Document created and reviewed
-   [x] All internal links verified
-   [x] Linked from INDEX.md and README.md

---

**US-002: Script Reference**

> As a developer,
> I want a comprehensive reference of all npm scripts with usage examples,
> so that I can quickly find and use the right command for any task.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [x] AC1: `SCRIPTS.md` exists in `dash-electron/docs/`
-   [x] AC2: Every npm script in `package.json` is documented
-   [x] AC3: Each entry includes: command, description, flags/arguments, usage example
-   [x] AC4: Scripts are organized by category (development, widgets, themes, CI/CD, testing, etc.)

**Definition of Done:**

-   [x] Document created and reviewed
-   [x] All scripts verified against `package.json`
-   [x] Linked from INDEX.md and DEVELOPER_GUIDE.md

---

### Should-Have (P1)

**US-003: Theme Scaffold CLI (`themeize`)**

> As a theme designer,
> I want a CLI command to create a theme from color names,
> so that I can create and distribute themes without using the in-app editor.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: `npm run themeize "My Theme" --primary blue --secondary rose --tertiary amber` creates a `.theme.json` file
-   [ ] AC2: Color names are validated against the Tailwind color palette
-   [ ] AC3: `--harmony triadic` auto-generates secondary/tertiary from primary using color harmony
-   [ ] AC4: `--random` generates a random theme
-   [ ] AC5: Output file is installable via Settings > Themes > Install from ZIP (after wrapping in ZIP)
-   [ ] AC6: `--register` flag adds the theme to `registryThemes.js` for batch publishing

**Technical Notes:**

Script: `scripts/themeize.js`. Reuse color validation from `dash-core/src/utils/themeGenerator.js`. Output format matches `publishThemes.js --local` ZIP structure.

---

**US-004: Shared Registry Auth Module**

> As a developer maintaining the publish scripts,
> I want the OAuth device flow and registry API calls in a single shared module,
> so that changes to the auth flow only need to happen in one place.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: `scripts/lib/registryAuth.js` exports `authenticate()`, `getScope()`, `publishToApi()`, `deleteFromApi()`, `getFormDataImpl()`
-   [ ] AC2: `publishToRegistry.js` imports from shared module instead of duplicating
-   [ ] AC3: `publishThemes.js` imports from shared module instead of duplicating
-   [ ] AC4: `publishKitchenSink.js` imports from shared module instead of duplicating
-   [ ] AC5: `reinstallWidgets.js` imports from shared module instead of duplicating
-   [ ] AC6: All publish scripts pass existing tests after refactor

**Technical Notes:**

~480 lines of duplication eliminated. Pattern: `const { authenticate, getScope, publishToApi } = require('./lib/registryAuth')`.

---

**US-005: Extend Theme Publishing for User-Created Themes**

> As a theme designer,
> I want to publish themes I created in the app via the CLI,
> so that I can distribute custom themes without using the in-app publish modal.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: `npm run publish-themes -- --from-app` reads themes from the app data directory and publishes them
-   [ ] AC2: `npm run publish-themes -- --from-file themes/my-theme.theme.json` publishes a theme from a local file
-   [ ] AC3: `npm run publish-themes -- --list-app-themes` lists available themes in the app without publishing
-   [ ] AC4: `--dry-run` flag works with all new flags

**Technical Notes:**

App data path: `~/Library/Application Support/Dash/{appId}/themes.json`. Follow `reinstallWidgets.js` pattern for discovering the appId.

---

### Nice-to-Have (P2)

**US-006: Headless Dashboard Export**

> As a dashboard creator,
> I want a CLI command to export a dashboard configuration as a ZIP,
> so that I can script dashboard distribution and CI/CD pipelines without the running app.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: `npm run export-dashboards` lists available dashboards and creates ZIPs
-   [ ] AC2: `npm run export-dashboards -- --id 12345` exports a specific dashboard
-   [ ] AC3: Exported ZIP matches the format produced by in-app export (`.dashboard.json` inside ZIP)
-   [ ] AC4: `--output ./backups/` flag controls output directory

**Technical Notes:**

Script: `scripts/exportDashboards.js`. Requires extracting headless-callable logic from `dash-core/electron/controller/dashboardConfigController.js` (cross-repo change). Reads `workspaces.json` from `~/Library/Application Support/Dash/{appId}/`.

---

## Implementation Phases

### Phase 1: Documentation (P0 Stories)

**Deliverables:**

-   [x] US-001: Unified Developer Guide (`DEVELOPER_GUIDE.md`)
-   [x] US-002: Script Reference (`SCRIPTS.md`)
-   [x] Updated `INDEX.md` and `README.md`
-   [x] This PRD

**Success Criteria:** A new developer can follow the developer guide to understand the full lifecycle for all three asset types without needing to cross-reference external documents.

### Phase 2: Theme Tooling & DRY (P1 Stories)

**Deliverables:**

-   [ ] US-003: `themeize` CLI script
-   [ ] US-004: Shared registry auth module
-   [ ] US-005: Extended `publishThemes.js`

**Success Criteria:** Developers can create, validate, and publish themes entirely from the command line. Publish scripts share a single auth module.

**Dependencies:** Phase 1 (documentation describes these tools)

### Phase 3: Dashboard Export (P2 Stories)

**Deliverables:**

-   [ ] US-006: Headless dashboard export script

**Success Criteria:** Developers can export dashboard configurations from the command line for backup and distribution.

**Dependencies:** Phase 2 (shared auth module), cross-repo changes in dash-core

---

## Decisions Made

| Date       | Decision                                      | Rationale                                                                                               |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2026-03-25 | No `dashboardize` CLI scaffold                | Dashboards are visual artifacts (layout + event wiring), not code. Wizard and MCP tools cover creation. |
| 2026-03-25 | No unified `dash` CLI tool                    | npm scripts are sufficient. A custom CLI adds versioning and install complexity.                        |
| 2026-03-25 | Developer guide is a hub, not a duplicate     | Links to authoritative dash-core/dash-react docs rather than copying their content.                     |
| 2026-03-25 | PRD lives in dash-electron, not dash-core     | This is template-specific DX (scripts, docs, developer workflows), not framework architecture.          |
| 2026-03-25 | Documentation ships first, scripts in Phase 2 | Docs provide immediate value; scripts can reference the documented workflows.                           |

---

## Out of Scope

-   **Visual widget designer** -- Widgets require React code; a drag-drop builder is a separate initiative
-   **Auto-generated API clients from MCP schemas** -- Would require MCP introspection tooling
-   **Web-based (non-Electron) dashboard support** -- Separate initiative tracked in README
-   **Cross-repo documentation sync tooling** -- Mitigated by hub-and-spoke doc architecture

---

## Revision History

| Version | Date       | Author    | Changes                                                                |
| ------- | ---------- | --------- | ---------------------------------------------------------------------- |
| 1.0     | 2026-03-25 | Core Team | Initial draft -- Phase 1 documentation, Phase 2-3 tooling user stories |
