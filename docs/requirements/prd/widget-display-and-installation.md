# PRD: Widget Display & Installation UX

**Status:** Draft
**Last Updated:** 2026-03-22
**Owner:** Core Team
**Related PRDs:** [Widget Installation Model](widget-installation-model.md), [Widget Dropdown](widget-dropdown.md), [Dashboard Marketplace](dashboard-marketplace.md)
**Repos:** dash-core, dash-electron

---

## Executive Summary

The widget display and installation experience has four critical UX gaps that undermine the registry-first model: widget lists show package-level entries instead of individual components, installation progress is invisible in most entry points, the auth prompt renders inline (making it easy to miss), and missing widgets in dashboards must be resolved one at a time. This PRD locks down requirements for consistent, polished widget identification, universal installation progress feedback, modal-based authentication, and batch missing-widget resolution.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

The registry-first model (see [Widget Installation Model PRD](widget-installation-model.md)) established three installation tracks and scoped identity for widgets. However, the UX around displaying, installing, and authenticating has not kept pace with the backend model. Users encounter four distinct pain points:

1. **Widget identity is ambiguous.** Settings > Widgets shows `displayName || name` as the label and only shows `packageId` for installed widgets. Built-in widgets have no sub heading at all. When a package contains multiple widgets (e.g., a Clock package with Digital, Analog, and Flip variants), users cannot distinguish between them or find the scoped ID they need to reference a specific widget.

2. **Installation is a black box.** The `InstallProgressModal` — with its dark overlay, per-item progress list, and status icons — only appears when installing from the WidgetSidebar discover tab. Installing from Settings > Widgets > Discover, the layout builder widget dropdown, or via ZIP/folder produces no visible progress feedback. Users don't know if an install is working, stuck, or failed.

3. **Authentication is buried.** The `RegistryAuthPrompt` renders as an inline div mixed with surrounding content. In scrollable panels, users must hunt for the sign-in button. The prompt doesn't explain why authentication is needed — it just says "Sign in to install." Since all registry downloads require auth, this is a blocker for the entire Discover experience.

4. **Missing widgets are tedious to resolve.** When a user installs a dashboard that references 5 widgets they don't have, each missing widget renders an independent `WidgetNotFound` component. The user must click "Find in Registry" five separate times, potentially authenticate five times, and install one widget at a time. There is no batch resolution.

**Who experiences this problem?**

-   Primary: End users installing widgets and dashboards from the registry
-   Secondary: Users opening shared dashboards with missing widget dependencies
-   Tertiary: New users encountering authentication for the first time

**What happens if we don't solve it?**

Users cannot confidently identify widgets, have no feedback during installation, struggle to authenticate, and face tedious manual work when importing dashboards with dependencies. The registry-first model fails to deliver on its promise of frictionless widget acquisition.

### Current State

**What exists today?**

-   `WidgetsSection.js` renders widget list items with `displayName || name` as primary text and `packageId` as 10px/40%-opacity sub text — but only for installed widgets. Built-in widgets show no sub heading.
-   `InstallProgressModal.js` exists as a complete, well-designed component (dark overlay, per-item status icons, non-dismissible during install, Done button on completion). It is only used by `WidgetSidebar.js`.
-   `RegistryAuthPrompt.js` renders as inline flex divs with sign-in button and device code polling — never as a modal.
-   `WidgetNotFound.js` operates independently per missing widget with its own modal, registry lookup, and install flow.
-   `useInstalledWidgets.js` exposes `packageId` (scoped `@scope/name`) for installed widgets but the field is absent for built-in widgets.

**Limitations:**

-   Widget list does not show individual components within a package — only one entry per package
-   No sub heading for built-in widgets, making them harder to identify and reference
-   `InstallProgressModal` is not used by `DiscoverWidgetsDetail`, `EnhancedWidgetDropdown`, or the ZIP/folder install flows in `WidgetsSection`
-   `RegistryAuthPrompt` is always inline — in `RegistryDashboardDetail`, `RegistryPackageDetail`, `RegistryThemeDetail`, `WidgetNotFound`, and `WidgetSidebar`
-   `RegistryThemeDetail` duplicates the auth flow inline rather than reusing `RegistryAuthPrompt`
-   No batch resolution for multiple missing widgets in a dashboard

---

## Goals & Success Metrics

### Primary Goals

1. **Unambiguous widget identity** — Every widget in every list shows its `displayName` and full scoped ID
2. **Universal installation feedback** — The `InstallProgressModal` appears for every installation from every entry point
3. **Frictionless authentication** — Auth prompt is a modal that clearly explains why sign-in is needed
4. **Batch missing-widget resolution** — Users resolve all missing widgets for a dashboard in a single action

### Success Metrics

| Metric                                    | Target                             | How Measured                                                     |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Widget list shows full ID for all widgets | 100% of list items                 | Visual inspection: Settings > Widgets                            |
| Install progress modal coverage           | 100% of install entry points       | Test each entry point (sidebar, discover, dropdown, ZIP, folder) |
| Auth prompt renders as modal              | 100% of auth-required entry points | Test from each install surface                                   |
| Missing widget resolution clicks          | 1 click for batch install          | Open dashboard with 5 missing widgets, count clicks to resolve   |

### Non-Goals

**What are we explicitly NOT doing?**

-   **Redesigning the widget list layout** — We are adding sub headings to the existing list, not changing the list's visual design
-   **Changing the install progress modal's design** — The existing `InstallProgressModal` is well-designed; we are extending its usage, not redesigning it
-   **Adding new authentication methods** — The OAuth device flow stays the same; we are only changing how the prompt is presented
-   **Auto-installing missing widgets without user consent** — The batch modal requires explicit user action

---

## User Personas

### Dashboard Consumer

**Role:** End user who installs widgets and dashboards from the registry

**Goals:**

-   Quickly find and install widgets
-   See clear progress during installation
-   Understand what each widget is and how to reference it

**Pain Points:**

-   Cannot tell widgets apart when they share similar names
-   No feedback during install from Settings > Discover
-   Auth prompt is easy to miss when scrolled out of view
-   Must install missing dashboard widgets one at a time

**Technical Level:** Beginner to Intermediate

**Success Scenario:** User installs a dashboard from the marketplace, sees a batch modal for 4 missing widgets, clicks "Install All", watches the progress modal, and the dashboard loads fully within 30 seconds.

### Dashboard Creator

**Role:** Developer who builds and shares dashboards

**Goals:**

-   Reference specific widgets by their scoped ID when building layouts
-   Verify which widgets are installed and their exact identifiers

**Pain Points:**

-   Built-in widgets don't show their ComponentManager key
-   Hard to communicate exact widget identifiers to other users

**Technical Level:** Intermediate to Advanced

**Success Scenario:** User opens Settings > Widgets, sees every widget with its full scoped ID (e.g., `trops.clock.DigitalClockWidget`), and copies the ID to use in a layout configuration.

---

## User Stories

### Must-Have (P0)

**US-001: Widget List Shows Individual Components with Full Scoped ID**

> As a Dashboard Consumer,
> I want to see every individual widget component with its full scoped ID in the widget list,
> so that I can identify exactly which widgets I have and reference them by their unique identifier.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given any widget in Settings > Widgets, when viewing the list, then the primary label shows `displayName` (e.g., "Digital Clock") and a sub heading shows the full scoped ID (e.g., `trops.clock.DigitalClockWidget`)
-   [ ] AC2: Given a registry-installed package containing multiple widgets (e.g., Clock with Digital, Analog, Flip), when viewing Settings > Widgets, then each individual widget component has its own row in the list
-   [ ] AC3: Given a built-in widget without a scoped registry ID, when viewing Settings > Widgets, then the sub heading shows the ComponentManager registration key (e.g., `DigitalClockWidget`)
-   [ ] AC4: Given an installed widget with `packageId`, when viewing Settings > Widgets, then the sub heading shows the full scoped ID including package context (e.g., `trops.clock.DigitalClockWidget`), not just the package ID (`@trops/clock`)

**Edge Cases:**

-   Widget with no `displayName` → Use `name` as primary label, still show scoped ID as sub heading
-   Widget with very long scoped ID → Truncate with ellipsis, show full ID on hover/tooltip
-   Legacy widget without scoped ID or ComponentManager key → Show `name` as sub heading

**Technical Notes:**

Files to modify:

-   `dash-core/src/Components/Settings/sections/WidgetsSection.js` — Update list item rendering (currently lines 341-356) to always show full scoped ID sub heading for every widget
-   `dash-core/src/hooks/useInstalledWidgets.js` — Ensure the hook exposes the full scoped ID (ComponentManager key) for ALL widgets, not just `packageId` for installed ones. Built-in widgets should expose their CM registration key.

Current rendering logic (WidgetsSection.js ~line 343):

```
Primary text: displayName || name
Sub text: packageId (installed only, 10px, 40% opacity)
```

Required rendering logic:

```
Primary text: displayName || name
Sub text: full scoped ID (ALL widgets, both built-in and installed)
```

**Example Scenario:**

```
User has the Clock package installed (contains Digital Clock, Analog Clock, Flip Clock).
User opens Settings > Widgets.
Expected: Three separate rows appear:
  - "Digital Clock" with sub heading "trops.clock.DigitalClockWidget"
  - "Analog Clock" with sub heading "trops.clock.AnalogClockWidget"
  - "Flip Clock" with sub heading "trops.clock.FlipClockWidget"
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Every widget in Settings > Widgets shows displayName + full scoped ID
-   [ ] Multi-widget packages show individual component rows
-   [ ] Built-in widgets show CM registration key as sub heading
-   [ ] Acceptance criteria verified via screenshot
-   [ ] `npm run ci` passes

---

**US-002: Universal Install Progress Modal**

> As a Dashboard Consumer,
> I want to see a progress modal with per-widget status whenever I install something,
> so that I know the installation is working and can see exactly what's happening.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given I install a widget from Settings > Widgets > Discover (`DiscoverWidgetsDetail`), when the install starts, then the `InstallProgressModal` appears with dark overlay, per-item progress list, and status icons
-   [ ] AC2: Given I install a widget from the layout builder widget dropdown (`EnhancedWidgetDropdown`), when the install starts, then the `InstallProgressModal` appears
-   [ ] AC3: Given I install from ZIP via Settings > Widgets (`WidgetsSection` `handleInstallFromZip`), when the install starts, then the `InstallProgressModal` appears (replacing inline loading text)
-   [ ] AC4: Given I load from a folder via Settings > Widgets (`WidgetsSection` `handleLoadFolder`), when the install starts, then the `InstallProgressModal` appears (replacing inline loading text)
-   [ ] AC5: Given the WidgetSidebar discover tab install, when the install starts, then the existing `InstallProgressModal` continues to work (reference implementation, no regression)
-   [ ] AC6: Given the modal is open and installation is in progress, when I click the overlay or press Escape, then the modal does NOT close (non-dismissible during install)
-   [ ] AC7: Given all items have reached terminal status (installed, already-installed, or failed), when I look at the modal, then the "Done" button is enabled and clicking it closes the modal

**Edge Cases:**

-   Install fails midway through a multi-widget package → Failed items show red X with error text; "Done" button still becomes enabled when all items are terminal
-   User triggers install while another install's progress modal is still showing → Queue the second install or block with a message
-   ZIP contains a single widget vs. a directory of widgets → Modal shows one item or multiple items accordingly

**Technical Notes:**

Reference implementation: `WidgetSidebar.js` lines 167-216 (progress state management) and lines 354-360 (modal rendering).

`InstallProgressModal` props:

```javascript
{
  isOpen,          // boolean — visibility
  setIsOpen,       // function — close handler (no-op while installing)
  widgets,         // array of { packageName, displayName, status, error? }
  isComplete,      // boolean — true when all widgets at terminal status
  onDone,          // function — callback when Done clicked
  onCancel,        // function — optional cancel callback
}
```

Status values: `"pending"` (clock icon, gray), `"downloading"` (spinning blue), `"installed"` / `"already-installed"` (green check), `"failed"` (red X).

Files to modify:

-   `dash-core/src/Components/Settings/details/DiscoverWidgetsDetail.js` — Add progress state and render `InstallProgressModal`
-   `dash-core/src/Components/Layout/Builder/Enhanced/EnhancedWidgetDropdown.js` — Add progress state and render `InstallProgressModal`
-   `dash-core/src/Components/Settings/sections/WidgetsSection.js` — Replace inline loading/success text with `InstallProgressModal` for ZIP and folder installs

**Example Scenario:**

```
User is in Settings > Widgets > Discover.
User clicks "Install" on the Slack package (contains 4 widgets).
Expected: InstallProgressModal appears with dark overlay:
  - "SlackWidget" — spinning blue (downloading)
  - "SlackListChannels" — clock icon (pending)
  - "SlackChannelMessages" — clock icon (pending)
  - "SlackPostMessage" — clock icon (pending)
As each widget installs:
  - Status updates to green checkmark
  - Header shows "Installing 2 of 4..."
When all done:
  - Header shows "Installation Complete"
  - "Done" button becomes enabled
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Progress modal appears for all 5 install entry points
-   [ ] Modal is non-dismissible during active installation
-   [ ] Done button only enabled when all items are terminal
-   [ ] Works for widgets, dashboards, and themes
-   [ ] `npm run ci` passes

---

**US-003: Post-Installation Refresh Across All Views**

> As a Dashboard Consumer,
> I want all widget lists to automatically refresh after I install something,
> so that I can immediately see and use my newly installed widgets.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given I install a widget from ANY entry point (sidebar, discover, dropdown, ZIP, folder), when installation completes, then the Settings > Widgets list includes the newly installed widget(s) as individual items with full scoped IDs
-   [ ] AC2: Given I install a widget, when installation completes, then Discover views show an "Installed" badge on the package
-   [ ] AC3: Given I install a widget, when installation completes, then the sidebar widget list includes the new widget(s)
-   [ ] AC4: Given I install a widget, when installation completes, then the `EnhancedWidgetDropdown` "Installed" tab includes the new widget(s)
-   [ ] AC5: Given the `dash:widgets-updated` event, when it fires, then all listener components re-fetch their widget data

**Edge Cases:**

-   Install from ZIP that doesn't match any registry package → Widget appears in list without "Installed" badge in Discover (since there's no registry match)
-   Install while Settings > Widgets is not open → Data refreshes on next navigation to that view
-   Rapid successive installs → Each fires `dash:widgets-updated` and views remain consistent

**Technical Notes:**

The `dash:widgets-updated` custom event already exists and is dispatched from `Dash.js` in `handleWidgetInstalled` and `handleWidgetsLoaded`. Existing listeners in `useInstalledWidgets`, `DiscoverWidgetsDetail`, `EnhancedWidgetDropdown`, and `WidgetSidebar` should already respond to this event.

Files to verify:

-   `dash-electron/src/Dash.js` — Confirm `handleWidgetInstalled` and `handleWidgetsLoaded` both dispatch `dash:widgets-updated` after every install method (registry, ZIP, folder)
-   All listener components properly re-fetch on event receipt

Primary risk: The event may not fire for all install paths (e.g., ZIP and folder installs may bypass `handleWidgetInstalled`). Verify each path.

**Example Scenario:**

```
User installs the Gmail package from Settings > Widgets > Discover.
Installation completes and progress modal shows "Done".
User clicks Done.
Expected:
  - Settings > Widgets list now shows GmailWidget, GmailInbox, GmailCompose, GmailSearch
  - Sidebar widget list now includes Gmail widgets
  - Discover tab shows "Installed" badge on Gmail package
  - Layout builder dropdown "Installed" tab includes Gmail widgets
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] `dash:widgets-updated` fires after every install method
-   [ ] All four views refresh after install from any entry point
-   [ ] Acceptance criteria verified
-   [ ] `npm run ci` passes

---

**US-004: Registry Auth Prompt as Modal Window (BLOCKER)**

> As a Dashboard Consumer,
> I want the authentication prompt to appear as a clear, prominent modal,
> so that I understand why sign-in is needed and can authenticate without hunting through the UI.

**Priority:** P0 — BLOCKER (users cannot download any registry asset without authenticating)
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given I trigger an action that requires registry authentication, when the auth prompt appears, then it renders as a **modal with dark overlay background** — not inline within a panel
-   [ ] AC2: Given the auth modal is visible, when I read the content, then it clearly states WHY authentication is needed (e.g., "The Dash Registry requires authentication to download and install packages")
-   [ ] AC3: Given the auth modal is visible, when I look at the modal, then the sign-in button is immediately visible without scrolling
-   [ ] AC4: Given I click "Sign In" and the device code flow starts, when the polling state is active, then the device code and instructions display within the modal (not inline)
-   [ ] AC5: Given I click "Cancel" in the auth modal, when the modal closes, then the original operation is cancelled gracefully
-   [ ] AC6: Given I successfully authenticate, when the auth completes, then the modal closes automatically and the original operation (install) resumes
-   [ ] AC7: Given the auth modal, when it appears from ANY entry point (widget install, dashboard install, theme install, sidebar discover, widget-not-found), then the modal looks and behaves identically

**Edge Cases:**

-   User is already authenticated → Auth modal does not appear; install proceeds directly
-   Auth token expires mid-session → Auth modal reappears on next install attempt
-   User closes the app during device code polling → Polling stops cleanly, no orphaned state
-   Multiple components request auth simultaneously → Only one auth modal appears

**Technical Notes:**

Current implementation: `RegistryAuthPrompt.js` renders as inline flex divs. It has two states: (1) default — sign-in button, and (2) polling — device code display with waiting message.

Used inline in 5 locations:

1. `RegistryDashboardDetail.js` (line ~497-506) — inline in scrollable content
2. `RegistryPackageDetail.js` (line ~202-208) — inline, hides install button
3. `RegistryThemeDetail.js` (line ~413-466) — **duplicates** auth flow inline instead of reusing RegistryAuthPrompt
4. `WidgetNotFound.js` (line ~214-218) — already inside a `<Modal>` parent
5. `WidgetSidebar.js` (line ~321-332) — inline in sidebar discover panel

**Approach:** Create a new `RegistryAuthModal.js` component that wraps `RegistryAuthPrompt` content inside the `<Modal>` component from `@trops/dash-react`. Update all 5 usage locations to use the modal version. Remove the duplicated auth flow in `RegistryThemeDetail.js`.

Files to modify:

-   `dash-core/src/Components/Registry/RegistryAuthPrompt.js` — Convert to modal OR create new `RegistryAuthModal.js` wrapper
-   `dash-core/src/Components/Settings/details/RegistryDashboardDetail.js` — Use modal auth
-   `dash-core/src/Components/Settings/details/RegistryPackageDetail.js` — Use modal auth
-   `dash-core/src/Components/Settings/details/RegistryThemeDetail.js` — Use modal auth, remove duplicated auth flow
-   `dash-core/src/Widget/WidgetNotFound.js` — Already in a modal parent; verify compatibility
-   `dash-core/src/Components/Navigation/WidgetSidebar.js` — Use modal auth

**Example Scenario:**

```
User is not authenticated.
User clicks "Install" on a widget in Settings > Widgets > Discover.
Expected: A modal appears with dark overlay:
  - Heading: "Sign In Required"
  - Body: "The Dash Registry requires authentication to download and install packages."
  - Prominent "Sign In" button
User clicks "Sign In".
Expected: Modal updates to show:
  - Device code in large monospace text (e.g., "ABCD-1234")
  - "Enter this code at [URL]"
  - "Waiting for authentication..."
  - Cancel button
User completes auth in browser.
Expected: Modal closes, widget installation begins with InstallProgressModal.
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Auth prompt renders as modal with dark overlay in all entry points
-   [ ] Modal clearly explains why authentication is needed
-   [ ] Sign-in button visible without scrolling
-   [ ] Device code displays in modal during polling
-   [ ] Cancel closes modal, successful auth closes modal and resumes operation
-   [ ] Duplicated auth flow in RegistryThemeDetail removed
-   [ ] `npm run ci` passes

---

**US-005: Batch "Install All Missing Widgets" for Dashboards**

> As a Dashboard Consumer,
> I want a single modal that lists all missing widgets when I open a dashboard,
> so that I can install everything at once instead of resolving each missing widget individually.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given a dashboard loads with multiple missing widgets, when the dashboard renders, then a single modal appears listing ALL missing widgets for that dashboard
-   [ ] AC2: Given the missing widgets modal, when I view the list, then each missing widget shows: component name (from layout), whether it was found in the registry (with package name), and "Not found" if no registry match
-   [ ] AC3: Given the missing widgets modal with found widgets, when I click "Install All", then all found packages install in a single batch operation
-   [ ] AC4: Given I click "Install All" and authentication is required, when the auth modal appears, then it appears ONCE (not per widget) and after authenticating, the batch install proceeds
-   [ ] AC5: Given the batch install is in progress, when I look at the screen, then the `InstallProgressModal` shows per-widget progress for all items being installed
-   [ ] AC6: Given the batch install completes, when all widgets are installed, then the dashboard refreshes and missing widgets are replaced with their installed components
-   [ ] AC7: Given a dashboard with only ONE missing widget, when it renders, then the existing `WidgetNotFound` component with "Find in Registry" still works as a fallback (no batch modal for single missing widget)

**Edge Cases:**

-   Some missing widgets found, some not → Modal shows found widgets with "Install" option and not-found widgets with "Not Available" label; "Install All" only installs found ones
-   Same package satisfies multiple missing widgets → Package appears once in install list, both widget names shown under it
-   Dashboard has 0 missing widgets → No modal appears
-   Dashboard has 1 missing widget → Individual `WidgetNotFound` renders (existing behavior)
-   User dismisses the batch modal → Missing widgets render individually as `WidgetNotFound` components (fallback behavior)
-   All missing widgets are not found in registry → Modal shows all as "Not Available" with "Close" button only

**Technical Notes:**

Current implementation to build on:

-   `WidgetNotFound.js` has `getWidgetSearchQuery()` for parsing scoped IDs and `packageToFlatWidget()` for converting registry results
-   `window.mainApi.registry.getPackage(packageName)` for exact package lookups
-   `window.mainApi.registry.search(widgetName)` for fallback searches
-   The dashboard layout is available in the rendering layer — can collect all missing component keys by walking the layout and checking `ComponentManager.getComponent()`

Approach:

-   At the dashboard rendering layer (where layout is walked and `WidgetNotFound` is rendered), detect when multiple widgets are missing
-   If count > 1, render a `MissingWidgetsModal` instead of individual `WidgetNotFound` components
-   The modal performs batch registry lookups, presents results, and offers "Install All"
-   Reuse `InstallProgressModal` for the batch install progress phase
-   Auth modal (US-004) fires once if needed

Files to modify/create:

-   Create `dash-core/src/Widget/MissingWidgetsModal.js` (or equivalent)
-   Dashboard rendering layer — detect multiple missing widgets and trigger batch modal
-   Reuse `WidgetNotFound.js` lookup logic (`getWidgetSearchQuery`, `packageToFlatWidget`)
-   Reuse `InstallProgressModal` for batch install progress

**Example Scenario:**

```
User imports a "DevOps Dashboard" that references 5 widgets: SlackWidget, GitHubPRList,
GitHubIssueList, GmailInbox, CustomInternalWidget.

Dashboard loads. 4 of 5 are not installed (CustomInternalWidget has no registry entry).

Expected: A modal appears:
  "This dashboard requires 5 widgets that are not installed."

  ✅ SlackWidget — Found in @trops/slack
  ✅ GitHubPRList — Found in @trops/github
  ✅ GitHubIssueList — Found in @trops/github (same package as above)
  ✅ GmailInbox — Found in @trops/gmail
  ❌ CustomInternalWidget — Not found in registry

  [Install All (3 packages)] [Close]

User clicks "Install All".
Auth modal appears (US-004) if not authenticated. User authenticates once.
InstallProgressModal shows:
  - @trops/slack — downloading...
  - @trops/github — pending
  - @trops/gmail — pending

All complete. Dashboard refreshes. 4 widgets now render. CustomInternalWidget shows
individual WidgetNotFound with "Find in Registry" as fallback.
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Batch modal appears for dashboards with 2+ missing widgets
-   [ ] Modal shows registry lookup results per widget
-   [ ] "Install All" triggers batch install with single auth
-   [ ] InstallProgressModal shows during batch install
-   [ ] Dashboard refreshes after batch install
-   [ ] Individual WidgetNotFound still works for single missing widget
-   [ ] `npm run ci` passes

---

## Feature Requirements

### Functional Requirements

**FR-001: Full Scoped ID Display**

-   **Description:** Every widget in every list view must display its full scoped ID as a sub heading below the displayName
-   **User Story:** US-001
-   **Priority:** P0
-   **Validation:** Open Settings > Widgets, verify every row shows displayName + scoped ID sub heading

**FR-002: Universal InstallProgressModal**

-   **Description:** The existing `InstallProgressModal` component must be rendered during installation from all 5 entry points: sidebar discover, settings discover, layout builder dropdown, ZIP install, and folder install
-   **User Story:** US-002
-   **Priority:** P0
-   **Validation:** Trigger install from each entry point, verify dark-overlay modal with per-item progress appears

**FR-003: Post-Install Event Propagation**

-   **Description:** The `dash:widgets-updated` event must fire after every successful installation regardless of install method, and all view components must respond by refreshing their data
-   **User Story:** US-003
-   **Priority:** P0
-   **Validation:** Install a widget, verify Settings > Widgets, sidebar, discover, and dropdown all show the new widget

**FR-004: Modal Auth Prompt**

-   **Description:** `RegistryAuthPrompt` must render inside a `<Modal>` component with dark overlay, clear explanation of why auth is needed, and immediately visible sign-in button
-   **User Story:** US-004
-   **Priority:** P0 — BLOCKER
-   **Validation:** Trigger install while unauthenticated from each entry point, verify modal auth appears

**FR-005: Batch Missing Widget Resolution**

-   **Description:** When a dashboard has 2+ missing widgets, a single modal lists all missing widgets with registry lookup results and an "Install All" button for batch installation
-   **User Story:** US-005
-   **Priority:** P0
-   **Validation:** Open a dashboard with 5 missing widgets, verify single batch modal appears

### Non-Functional Requirements

**NFR-001: Performance**

-   Widget list rendering must not regress — adding sub headings must not measurably increase render time
-   Batch registry lookups for missing widgets should execute in parallel, not sequentially

**NFR-002: Consistency**

-   The `InstallProgressModal` must look and behave identically regardless of which entry point triggered it
-   The auth modal must look and behave identically regardless of which entry point triggered it

**NFR-003: Backward Compatibility**

-   Existing widgets with no scoped ID must still display correctly (fallback to CM key or name)
-   The individual `WidgetNotFound` component must continue to work for single missing widgets

---

## User Workflows

### Workflow 1: Install Widget from Settings > Discover

**Trigger:** User navigates to Settings > Widgets > Discover and clicks "Install" on a package

**Steps:**

1. User clicks "Install" on a package in the Discover list
2. System checks authentication status
3. If not authenticated: Auth modal appears with explanation and sign-in button
4. User authenticates (device code flow in modal)
5. Auth modal closes, `InstallProgressModal` appears with per-widget progress
6. Each widget transitions: pending → downloading → installed
7. Installation completes, "Done" button becomes enabled
8. User clicks "Done", modal closes
9. All views refresh: widget list, sidebar, discover badges, dropdown

**Success State:** New widgets appear in all views, Discover shows "Installed" badge

**Error Scenarios:**

-   Network failure during download → Failed items show red X with error text; user can close modal and retry
-   Auth cancelled → Auth modal closes, install is cancelled, no state change
-   Package already installed → Shows "already-installed" status with green check

---

### Workflow 2: Open Dashboard with Missing Widgets

**Trigger:** User opens a dashboard whose layout references widgets that are not installed

**Steps:**

1. Dashboard rendering detects multiple missing widget component keys
2. Batch modal appears listing all missing widgets
3. System performs parallel registry lookups for each missing widget
4. Modal shows results: found widgets with package names, not-found widgets marked
5. User clicks "Install All"
6. Auth modal appears if needed (once)
7. `InstallProgressModal` appears with batch progress
8. Installation completes
9. Dashboard refreshes, installed widgets render in their layout positions
10. Any still-missing widgets show individual `WidgetNotFound` as fallback

**Success State:** Dashboard renders with all available widgets installed; remaining gaps show clear "not found" state

**Error Scenarios:**

-   No missing widgets found in registry → Modal shows all as "Not Available" with "Close" button only
-   User dismisses batch modal → Individual `WidgetNotFound` components render per missing widget
-   Partial install failure → Successfully installed widgets render; failed ones show `WidgetNotFound`

---

## Design Considerations

### UI/UX Requirements

-   Auth modal must use the existing `<Modal>` component from `@trops/dash-react` for visual consistency
-   Scoped ID sub heading text should use reduced size and opacity (consistent with current installed-widget sub text styling: 10px, 40% opacity)
-   Batch missing widgets modal should follow the same visual pattern as `InstallProgressModal` (dark overlay, centered content)

### Architecture Requirements

-   `InstallProgressModal` is the single source of truth for install progress UI — no new progress components
-   Auth modal wraps existing `RegistryAuthPrompt` logic — no duplication of OAuth device code flow
-   `dash:widgets-updated` event is the single mechanism for cross-view refresh — no new event types

### Dependencies

**Internal:**

-   `@trops/dash-react` `<Modal>` component — used for auth modal
-   `InstallProgressModal` — reused across all entry points
-   `useRegistryAuth` hook — provides auth state and device code flow
-   `useRegistrySearch` hook — provides install and search logic

**External:**

-   Dash Registry API — for package lookups and downloads
-   OAuth device code flow — for authentication

---

## Open Questions & Decisions

### Open Questions

1. **Q: Should the batch missing widgets modal appear automatically or require user action?**

    - Context: Auto-showing a modal on dashboard load could be disruptive if the user doesn't want to install anything right now
    - Options: (A) Auto-show on load, (B) Show a banner with "Install Missing Widgets" button that opens the modal
    - Status: Open

2. **Q: Should the auth modal be a singleton at the app level or rendered per-component?**

    - Context: If multiple components try to show auth simultaneously, we need one modal, not many
    - Options: (A) Global auth modal managed by context/hook, (B) First-render-wins with a shared lock
    - Status: Open

3. **Q: How should we handle the scoped ID format for display — dots or slashes?**

    - Context: CM keys use dots (`trops.clock.DigitalClockWidget`), package IDs use npm-style (`@trops/clock`). Which is the sub heading?
    - Options: (A) CM key with dots, (B) npm-style `@scope/name`, (C) Both
    - Status: Open — Recommended: CM key (dots) as it uniquely identifies the widget, not just the package

### Decisions Made

| Date       | Decision                                                                | Rationale                                                             | Owner     |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | --------- |
| 2026-03-22 | Reuse existing `InstallProgressModal` everywhere                        | Avoid UI fragmentation; component is already well-designed            | Core Team |
| 2026-03-22 | Auth prompt becomes modal, not inline                                   | Inline rendering is buried in scrollable content; modal is unmissable | Core Team |
| 2026-03-22 | Batch modal for 2+ missing widgets; single uses existing WidgetNotFound | Avoids over-engineering for the common case of 1 missing widget       | Core Team |
| 2026-03-22 | Remove duplicated auth flow in RegistryThemeDetail                      | Single auth implementation reduces bugs and maintenance               | Core Team |

---

## Out of Scope

**Explicitly excluded from this PRD:**

-   **Widget update UX** — Showing available updates and the update flow is a separate concern
-   **Widget search/filter in Settings > Widgets** — The list improvements here are about display, not search
-   **Install cancellation mid-download** — The current `InstallProgressModal` has a Cancel button but cancelling individual downloads is not in scope
-   **Widget dependency resolution** — If Widget A depends on Widget B, we don't auto-detect or install B (beyond the batch dashboard case)

**Future Considerations:**

-   **Automatic missing widget detection at dashboard import time** — Could pre-resolve before the dashboard even renders
-   **Widget update progress modal** — Could reuse `InstallProgressModal` for updates
-   **Smart deduplication in batch install** — If 3 missing widgets are in the same package, show 1 package entry in progress modal

---

## Implementation Phases

### Phase 1: MVP (P0 Stories — Auth Modal + Progress Modal)

**Deliverables:**

-   [ ] US-004: Registry auth prompt as modal (BLOCKER — unblocks all install flows)
-   [ ] US-002: Universal install progress modal (5 entry points)
-   [ ] US-003: Post-installation refresh across all views

**Success Criteria:** Every install flow shows the auth modal (if needed) and the progress modal, and all views refresh after install.

**Risks:**

-   Auth modal as singleton may require new context/provider — Mitigation: Start with per-component rendering, deduplicate later if needed
-   `RegistryThemeDetail` duplicated auth flow may have diverged from `RegistryAuthPrompt` — Mitigation: Audit both before consolidating

---

### Phase 2: Widget Identity (P0)

**Deliverables:**

-   [ ] US-001: Widget list shows individual components with full scoped ID

**Success Criteria:** Every widget in Settings > Widgets shows displayName + full scoped ID sub heading; multi-widget packages show individual rows.

**Dependencies:**

-   Requires Phase 1 completion (auth and progress modals must work before changing widget list)
-   `useInstalledWidgets` hook changes may affect other consumers

---

### Phase 3: Batch Missing Widgets (P0)

**Deliverables:**

-   [ ] US-005: Batch "Install All Missing Widgets" for dashboards

**Success Criteria:** Dashboard with 5 missing widgets shows single batch modal; user installs all found widgets in one action.

**Dependencies:**

-   Requires Phase 1 (auth modal, progress modal) and Phase 2 (widget identity for display)
-   New `MissingWidgetsModal` component creation

---

## Key Files Reference

All files in dash-core unless noted otherwise.

| File                                                               | Role                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/Components/Settings/sections/WidgetsSection.js`               | Widget list — needs scoped ID sub heading + modal for ZIP/folder |
| `src/Components/Settings/details/DiscoverWidgetsDetail.js`         | Settings discover — needs progress modal                         |
| `src/Components/Settings/details/InstallProgressModal.js`          | Progress modal component (exists, reuse everywhere)              |
| `src/Components/Settings/details/RegistryPackageDetail.js`         | Package detail panel                                             |
| `src/Components/Settings/details/RegistryThemeDetail.js`           | Theme detail — has duplicated auth flow to remove                |
| `src/Components/Settings/details/RegistryDashboardDetail.js`       | Dashboard detail — needs modal auth                              |
| `src/Components/Navigation/WidgetSidebar.js`                       | Reference implementation for progress modal                      |
| `src/Components/Layout/Builder/Enhanced/EnhancedWidgetDropdown.js` | Widget dropdown — needs progress modal                           |
| `src/Components/Registry/RegistryAuthPrompt.js`                    | Auth prompt — convert to modal                                   |
| `src/hooks/useRegistrySearch.js`                                   | Install logic                                                    |
| `src/hooks/useRegistryAuth.js`                                     | Auth hook (device code OAuth)                                    |
| `src/hooks/useInstalledWidgets.js`                                 | Widget list hook — needs full ID exposure                        |
| `src/Widget/WidgetNotFound.js`                                     | Missing widget fallback — needs batch awareness                  |
| `dash-electron/src/Dash.js`                                        | Post-install event dispatch                                      |

---

## Verification

### Automated

```bash
# Verify widget list shows displayName + full scoped ID
npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Widgets"
```

### Manual Testing

-   [ ] Install from Settings > Discover → dark progress modal appears with per-widget progress
-   [ ] Install from widget dropdown (layout builder) → same modal appears
-   [ ] Install from ZIP → same modal appears
-   [ ] Install from folder → same modal appears
-   [ ] Install from sidebar discover → existing modal still works (no regression)
-   [ ] After any install, widget list refreshes in all views
-   [ ] Unauthenticated user triggers install → auth MODAL (not inline) appears with clear explanation
-   [ ] Open dashboard with multiple missing widgets → single batch modal lists all missing widgets
-   [ ] Click "Install All" in batch modal → auth once if needed → progress modal → dashboard refreshes

---

## Revision History

| Version | Date       | Author    | Changes                                                                                      |
| ------- | ---------- | --------- | -------------------------------------------------------------------------------------------- |
| 1.0     | 2026-03-22 | Core Team | Initial draft — widget identity, universal progress modal, modal auth, batch missing widgets |
