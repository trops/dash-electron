# PRD: CommandPalette Navigation System

**Status:** In Progress
**Last Updated:** 2026-02-16
**Owner:** John Giatropoulos
**Related PRDs:** None

---

## Executive Summary

Replace the existing PanelWelcome landing screen with a modern navigation system comprising a persistent top Navbar, a CommandPalette (Cmd+K) for quick access to all app features, Excel-style bottom tab bar for multi-dashboard switching, and a clean EmptyState canvas when no dashboards are open.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

PanelWelcome is functional but limiting. It serves as the only entry point for dashboard browsing (via a folder tree), and all quick actions (new workspace, theme toggle, settings) are buried in unlabeled icon buttons in a sidebar. There is no way to have multiple dashboards open simultaneously — opening a new dashboard replaces the current one entirely.

Users cannot search for dashboards by name, quickly switch between open dashboards, or access application-level features (themes, settings, providers) without returning to the welcome screen first.

**Who experiences this problem?**

-   Primary: Dashboard creators who build and iterate on multiple dashboards
-   Secondary: Dashboard consumers who switch between dashboards frequently

**What happens if we don't solve it?**

Users continue with a single-dashboard workflow that requires navigating back to the welcome screen to switch contexts. Dashboard discovery remains limited to tree browsing. Power users cannot leverage keyboard shortcuts for navigation.

### Current State

**What exists today?**

PanelWelcome renders as a centered panel with a left sidebar toolbar and a MainMenu tree for browsing dashboards. Actions (create, load, theme, settings) are icon-only buttons without labels.

**Limitations:**

-   No multi-dashboard support (single workspace at a time)
-   No search/filter for dashboards
-   Actions undiscoverable (icon-only, no labels or keyboard shortcuts)
-   Must return to welcome screen to switch dashboards

---

## Goals & Success Metrics

### Primary Goals

1. **Multi-dashboard navigation** — Users can open, switch between, and close multiple dashboards via tabs
2. **Quick access via CommandPalette** — All app features (dashboards, themes, providers, settings) accessible via Cmd+K search
3. **Persistent navigation** — Navbar always visible with theme/settings/search triggers

### Success Metrics

| Metric                  | Target     | How Measured                           |
| ----------------------- | ---------- | -------------------------------------- |
| Dashboard switch time   | < 1 second | Time from Cmd+K to dashboard rendered  |
| Feature discoverability | 100%       | All PanelWelcome actions in new system |
| Multi-dashboard support | Yes        | Tab bar supports N open dashboards     |

### Non-Goals

-   Drag-and-drop tab reordering (future enhancement)
-   Tab persistence across app restarts (future enhancement)
-   Split-view / side-by-side dashboards (out of scope)

---

## User Stories

### Must-Have (P0)

**US-001: Open dashboard via search**

> As a dashboard user,
> I want to press Cmd+K and type a dashboard name to open it,
> so that I can quickly navigate without browsing a tree.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] Cmd+K opens CommandPalette overlay
-   [x] Typing filters dashboards by name
-   [x] Clicking a dashboard opens it in a new tab
-   [x] If dashboard is already open, switches to existing tab

---

**US-002: Switch between open dashboards**

> As a dashboard user,
> I want to click tabs at the bottom to switch between open dashboards,
> so that I can work on multiple dashboards without losing state.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] Bottom tab bar shows all open dashboards
-   [x] Active tab is visually distinct
-   [x] Clicking a tab switches to that dashboard
-   [x] Close button on hover removes the tab

---

**US-003: Access themes and settings from anywhere**

> As a dashboard user,
> I want to access theme toggle, theme editor, and settings from the navbar,
> so that I don't have to return to a welcome screen.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] Navbar always visible with theme/palette/settings buttons
-   [x] CommandPalette includes theme and settings groups
-   [x] All PanelWelcome actions available in new system

---

**US-004: Disambiguate dashboards with same name**

> As a dashboard user,
> I want to see additional details (widget count, last-saved date) next to each dashboard name in the CommandPalette,
> so that I can distinguish between dashboards with the same name.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] Dashboard items show widget count (e.g. "3 widgets")
-   [x] Dashboard items show last-saved date when available (e.g. "3 widgets · 2/14/2026")
-   [x] "open" badge still appears for dashboards that are already in a tab
-   [x] Detail text is visually secondary (smaller, lower opacity) so it doesn't compete with the name

**Technical Notes:**
Widget count is derived from `workspace.layout.length`. Last-saved date is derived from `workspace.version` (a `Date.now()` timestamp set on save). Both shown as a compact secondary span after the dashboard name.

---

**US-005: Create and manage providers from CommandPalette**

> As a dashboard user,
> I want to create new providers and manage existing ones from the CommandPalette,
> so that I can configure data sources without hunting through menus.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] Providers group shows "Create New Provider" action item
-   [x] Providers group shows "Manage Providers..." action item
-   [x] "Create New Provider" opens the Application Settings modal (placeholder until dedicated flow exists)
-   [x] "Manage Providers..." opens the Application Settings modal
-   [x] Both actions are searchable/filterable via the query
-   [x] Palette closes after selecting a provider action

---

**US-006: Empty state for providers group**

> As a new user with no providers configured,
> I want to see a clear indication that no providers exist and an easy path to create one,
> so that the Providers group is useful even when empty.

**Priority:** P0
**Status:** Done

**Acceptance Criteria:**

-   [x] When 0 providers exist and no search query, "No providers configured" text is shown (dimmed)
-   [x] "Create New Provider" and "Manage Providers..." actions still appear below the empty state text
-   [x] When a search query is active, the empty state text is hidden (only matching actions shown)
-   [x] Providers group is always visible (not hidden when empty) because action items ensure `showProviders` is true

---

### Should-Have (P1)

**US-007: Empty state with guidance**

> As a new user,
> I want to see clear guidance when no dashboards are open,
> so that I know how to get started.

**Priority:** P1
**Status:** Done

**Acceptance Criteria:**

-   [x] EmptyState displays centered with icon and Cmd+K hint
-   [x] Action buttons for "Search" and "New Dashboard"

---

**US-008: Keyboard shortcut for new dashboard**

> As a power user,
> I want to press Cmd+N to create a new dashboard directly,
> so that I can start building without opening the CommandPalette first.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] Cmd+N creates a new blank dashboard and opens it in a tab
-   [ ] Works from any state (empty state, viewing a dashboard, etc.)

---

**US-009: Recent items in CommandPalette**

> As a returning user,
> I want to see my recently opened dashboards at the top of the CommandPalette,
> so that I can quickly resume where I left off.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] A "Recent" group appears at the top of CommandPalette when no query is entered
-   [ ] Shows last 5 dashboards opened (ordered by recency)
-   [ ] Recent list persists across app restarts (stored in app config)
-   [ ] Searching still filters across all groups, not just recents

---

### Nice-to-Have (P2)

**US-010: Tab drag reordering**

> As a user with many open dashboards,
> I want to drag tabs to reorder them,
> so that I can organize my workspace.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] Tabs can be dragged left/right to reorder
-   [ ] Active tab maintains its active state during and after drag

---

**US-011: Tab persistence across restarts**

> As a user,
> I want my open tabs to be restored when I relaunch the app,
> so that I don't lose my working context.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] Open tabs (IDs + active tab) saved to app config on change
-   [ ] On app launch, previously open tabs are restored
-   [ ] Active tab is restored to the same tab that was active on quit

---

**US-012: Dedicated provider creation flow**

> As a user creating a new provider,
> I want a focused creation flow (not just the settings modal),
> so that the process is guided and clear.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] "Create New Provider" in CommandPalette opens a dedicated modal/wizard
-   [ ] Flow guides user through provider type selection, credential entry, and validation
-   [ ] On completion, new provider appears in the Providers group immediately

---

## Architecture

### Component Hierarchy

```
DashboardStage (state owner)
├── DashNavbar (top)
│   └── Navbar (dash-react)
│       ├── Navbar.Brand ("Dash.")
│       ├── Navbar.Content (Search button → opens CommandPalette)
│       └── Navbar.Actions (theme toggle, theme editor, settings)
│
├── Main Content Area
│   ├── DashboardHeader + LayoutBuilder (when workspace selected)
│   └── EmptyState (when no tabs open)
│
├── DashTabBar (bottom)
│   └── Navbar (dash-react)
│       ├── Tab buttons (one per open workspace)
│       └── New Tab button (+)
│
├── DashCommandPalette (modal overlay)
│   └── CommandPalette (dash-react)
│       ├── Group: Dashboards (workspace list + New/Load/Folder actions)
│       ├── Group: Providers (provider list + Create/Manage actions)
│       ├── Group: Themes (theme list + Toggle/Editor actions)
│       └── Group: Settings (App settings, Debug toggle)
│
└── Modals
    ├── ApplicationSettingsModal
    ├── ThemeManagerModal
    ├── DashboardLoaderModal
    └── AddMenuItemModal
```

### Key Files

| File                                              | Purpose                                                 |
| ------------------------------------------------- | ------------------------------------------------------- |
| `src/Components/Navigation/DashNavbar.js`         | Top navbar with brand, search trigger, action buttons   |
| `src/Components/Navigation/DashCommandPalette.js` | Builds command groups from app data, handles filtering  |
| `src/Components/Navigation/DashTabBar.js`         | Bottom tab bar for multi-dashboard switching            |
| `src/Components/Dashboard/DashboardStage.js`      | State owner — manages tabs, modals, workspace lifecycle |

### State Flow

-   **Tab state** (`openTabs`, `activeTabId`) lives in DashboardStage
-   **CommandPalette query** is local to DashCommandPalette
-   **Workspace data** (`workspaceConfig`) loaded from API, passed to CommandPalette
-   **Provider data** comes from `AppContext.providers`
-   **Theme data** comes from `ThemeContext`

---

## Implementation Phases

### Phase 1: MVP — Done

-   [x] DashNavbar component (top navbar with CommandPalette trigger)
-   [x] DashCommandPalette component (4 command groups: Dashboards, Providers, Themes, Settings)
-   [x] DashTabBar component (bottom Excel-style tabs)
-   [x] DashboardStage refactor (tab state, EmptyState, replace PanelWelcome)
-   [x] EmptyState with guidance (Cmd+K hint, Search/New Dashboard buttons)

### Phase 1.1: Refinements — Done

-   [x] Dashboard disambiguation (widget count + last-saved date in CommandPalette)
-   [x] Provider actions ("Create New Provider", "Manage Providers...")
-   [x] Provider empty state ("No providers configured" when no providers exist)
-   [x] Wire `onCreateNewProvider` → opens Settings modal as placeholder

### Phase 2: Enhancement — Backlog

-   [ ] Keyboard shortcut Cmd+N for new dashboard (US-008)
-   [ ] Recent items in CommandPalette (US-009)
-   [ ] Tab rename syncs with workspace name changes

### Phase 3: Polish — Backlog

-   [ ] Tab drag reordering (US-010)
-   [ ] Tab persistence across restarts (US-011)
-   [ ] Dedicated provider creation flow (US-012)
-   [ ] Animated transitions

---

## Open Questions & Decisions

### Decisions Made

| Date       | Decision                                           | Rationale                                                                                                         | Owner |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| 2026-02-15 | Replace PanelWelcome entirely                      | Cleaner UX; all PanelWelcome actions accessible via CommandPalette                                                | John  |
| 2026-02-15 | Bottom tab bar (Excel-style)                       | Familiar pattern, keeps main content area maximized                                                               | John  |
| 2026-02-15 | Cmd+K for CommandPalette                           | Standard convention (VS Code, Slack, Figma, etc.)                                                                 | John  |
| 2026-02-16 | Use widget count + version date for disambiguation | Workspace IDs are timestamps (not user-friendly); widget count and save date provide meaningful differentiation   | John  |
| 2026-02-16 | "Create New Provider" opens Settings modal         | No dedicated provider creation flow exists yet; Settings modal is the current entry point for provider management | John  |
| 2026-02-16 | Show provider empty state only when no query       | When searching, irrelevant empty-state text would be noise; action items are sufficient                           | John  |

### Open Questions

1. **Q: Should Cmd+N create a blank dashboard or open a template picker?**

    - Context: US-008 needs to decide what "new dashboard" means
    - Options: (A) Blank with 1x1 grid, (B) Template picker modal
    - Status: Open

2. **Q: Where should recent items be stored?**

    - Context: US-009 needs persistence across restarts
    - Options: (A) Electron store, (B) workspace API, (C) localStorage
    - Status: Open

3. **Q: Should provider items in CommandPalette be clickable (navigate to config)?**
    - Context: Currently provider list items have no `onSelect` handler
    - Options: (A) Click opens provider detail/edit, (B) Click copies provider name, (C) Remain display-only
    - Status: Open

---

## Revision History

| Version | Date       | Author            | Changes                                                                                                                                                                                       |
| ------- | ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-15 | John Giatropoulos | Initial draft — core navigation system                                                                                                                                                        |
| 1.1     | 2026-02-16 | John Giatropoulos | Added US-004 through US-012; added architecture section; marked Phase 1 done; added refinements (provider actions, empty state, dashboard disambiguation); added decisions and open questions |
