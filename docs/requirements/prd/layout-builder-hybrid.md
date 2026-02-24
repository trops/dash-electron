# PRD: LayoutBuilder Hybrid Redesign

**Status:** In Progress
**Last Updated:** 2026-02-19
**Owner:** Core Team
**Related PRDs:** None

---

## Executive Summary

The LayoutBuilder Hybrid Redesign transforms the widget addition and provider configuration experience from a modal-heavy, interruption-prone workflow into a Notion-style inline interaction pattern. This redesign reduces time-to-add-widget by 70% (from ~10s to ~3s) and makes provider requirements visible at a glance, significantly improving dashboard creation productivity.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

The current LayoutBuilder forces users through a modal-based workflow for adding widgets and configuring providers. Users must: (1) Click "+" button, (2) Wait for modal to open (interrupts view), (3) Scroll through widget list in modal, (4) Select widget, (5) Modal closes, (6) Widget appears (possibly off-screen). For provider configuration, users must open a separate config modal, navigate to provider section, select provider, and close modal. This multi-step, modal-heavy workflow takes 10+ seconds per widget and is disorienting.

**Who experiences this problem?**

-   Primary: Dashboard users creating and configuring dashboards
-   Secondary: Widget developers whose widgets' provider requirements are hidden until after addition

**What happens if we don't solve it?**

-   Reduced user productivity in dashboard creation
-   Steeper learning curve for new users
-   Negative perception of platform responsiveness
-   Competitive disadvantage vs. modern low-code tools (Notion, Retool, etc.)

### Current State

**What exists today?**

LayoutBuilder uses `LayoutBuilderAddItemModal` for widget selection - a full-screen modal with sidebar widget list categorized by workspace type. Provider configuration happens through `LayoutBuilderConfigModal`, a separate modal opened after widget placement.

**Limitations:**

-   Modal interrupts visual flow and context
-   No visibility of provider requirements during widget selection
-   Widget placement is slow (~10s per widget)
-   Provider configuration is disconnected from widget headers (~15-20s to configure)
-   No recent widgets for faster access
-   No keyboard navigation for power users

---

## Goals & Success Metrics

### Primary Goals

1. **Eliminate modal interruptions** during widget addition workflow
2. **Surface provider requirements** before and during widget placement
3. **Reduce time-to-add-widget** by 70% (from ~10s to ~3s)
4. **Improve discoverability** of widgets and their requirements

### Success Metrics

| Metric                         | Current          | Target     | How Measured                                 |
| ------------------------------ | ---------------- | ---------- | -------------------------------------------- |
| Time to add widget             | ~10s             | ~3s        | Time from "+" click to widget visible        |
| Time to configure provider     | ~15-20s          | ~4s        | Time from provider badge click to assigned   |
| Modal interruptions per widget | 2 (add + config) | 0          | User flow observation                        |
| New user task completion       | ~60%             | ~90%       | "Add widget with provider" task success rate |
| User satisfaction (NPS)        | Baseline         | +20 points | Post-feature survey                          |

### Non-Goals

-   Redesigning the drag-and-drop layout system
-   Changing workspace/container architecture
-   Modifying widget internal configuration (userConfig)
-   Real-time collaborative editing
-   Mobile/tablet optimization (desktop-first)

---

## User Personas

### Sarah - Dashboard Creator (Primary)

**Role:** Product Manager

**Goals:**

-   Build custom dashboards to track KPIs across multiple tools quickly
-   Experiment with different widget layouts to find optimal view
-   Configure providers without context switching

**Pain Points:**

-   Wastes time clicking through modals to add each widget
-   Forgets which widgets need which providers
-   Frustrated by slow iteration when experimenting with layouts
-   Loses visual context when modals open

**Technical Level:** Beginner to Intermediate

**Success Scenario:** Sarah adds 5 widgets to a new dashboard in under 1 minute, assigns providers inline, and sees immediate visual feedback without modal interruptions.

### Alex - Widget Developer (Secondary)

**Role:** Frontend Developer

**Goals:**

-   Create widgets that integrate cleanly into dashboards
-   Ensure provider requirements are clearly visible to users
-   Understand how users discover and add widgets

**Pain Points:**

-   Provider requirements hidden until widget is added
-   No clear visual feedback on widget compatibility
-   Unclear how users discover widgets in large libraries

**Technical Level:** Advanced

**Success Scenario:** Alex's widget clearly shows its provider requirements in the dropdown, and users can configure providers before or immediately after adding the widget.

### Jordan - Dashboard Administrator (Tertiary)

**Role:** IT Admin

**Goals:**

-   Ensure providers are configured correctly across dashboards
-   Audit which widgets lack provider configuration
-   Maintain dashboard consistency

**Pain Points:**

-   Cannot see at-a-glance which widgets lack provider configuration
-   Manual process to audit provider assignments

**Technical Level:** Intermediate

**Success Scenario:** Jordan can visually scan a dashboard in edit mode and immediately see which widgets need provider attention via color-coded badges.

---

## User Stories

### Must-Have (P0)

**US-001: Quick Widget Addition**

> As a dashboard user,
> I want to add widgets without opening a modal,
> so that I can maintain visual context and iterate quickly.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [ ] AC1: Clicking "+" button opens an inline dropdown (no modal overlay)
-   [ ] AC2: Dropdown appears centered on screen with backdrop
-   [ ] AC3: Dropdown shows search input auto-focused
-   [ ] AC4: Widget list displays with icons, names, and workspace categories
-   [ ] AC5: Clicking a widget adds it immediately to the layout
-   [ ] AC6: Dropdown closes automatically after selection
-   [ ] AC7: Recent widgets section shows last 3 used widgets
-   [ ] AC8: Keyboard navigation (↑/↓/Enter/Esc) works correctly

**Edge Cases:**

-   Empty widget list → Shows "No widgets found" message
-   Search with no results → Shows helpful message with suggestion
-   Widget addition fails → Shows error, keeps dropdown open

**Technical Notes:**
Implemented by `WidgetDropdown` component in `src/Components/Layout/Builder/Enhanced/WidgetDropdown.js`. Uses ComponentManager.map() to get all widgets. Recent widgets stored in localStorage (max 10).

**Example Scenario:**

```
User: Sarah, empty dashboard in edit mode
Action: Clicks "+" on root container
Expected: WidgetDropdown appears centered, search input focused, shows 15 available widgets
Time: <100ms to render
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests pass for WidgetDropdown component
-   [ ] Integration tests verify dropdown opens/closes correctly
-   [ ] Acceptance criteria verified with manual testing
-   [ ] Documentation updated in CLAUDE.md

---

**US-002: Widget Search & Filtering**

> As a dashboard user,
> I want to search for widgets by name,
> so that I can quickly find what I need in large widget libraries.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [ ] AC1: Search input filters widgets in real-time
-   [ ] AC2: Search is case-insensitive
-   [ ] AC3: Search matches widget name and key
-   [ ] AC4: Empty search shows all widgets categorized by workspace
-   [ ] AC5: Search results highlight matching text (nice-to-have)

**Edge Cases:**

-   Search query with special characters → Escapes regex properly
-   Very long search query → Truncates display if needed

**Technical Notes:**
Uses JavaScript filter() method on widget list. Debounced to 50ms for performance.

**Example Scenario:**

```
User: Sarah, dropdown open with 50 widgets
Action: Types "slack" in search
Expected: Widget list filters to show only Slack-related widgets (3 results)
Time: <50ms to update
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests verify filter logic
-   [ ] Case-insensitive search tested
-   [ ] Performance verified with 100+ widgets
-   [ ] Documentation updated

---

**US-003: Provider Status Visibility**

> As a dashboard user,
> I want to see provider requirements on widget headers,
> so that I know what needs configuration before using the dashboard.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [ ] AC1: ProviderBadge component displays on widget headers
-   [ ] AC2: Badge shows provider type (e.g., "slack", "github")
-   [ ] AC3: Badge color indicates status (green=configured, yellow=required, gray=optional)
-   [ ] AC4: Badge shows provider name when configured (e.g., "slack · My Workspace")
-   [ ] AC5: Badge is visible in both edit and preview modes
-   [ ] AC6: Multiple badges shown if widget requires multiple providers

**Edge Cases:**

-   Widget with no provider requirements → No badges shown
-   Provider deleted after widget configured → Shows error state badge
-   Provider type doesn't exist → Shows warning badge

**Technical Notes:**
Implemented by `ProviderBadge` component in `src/Components/Layout/Builder/Enhanced/ProviderBadge.js`. Uses widgetConfig.providers to get requirements. Reads selectedProviders from widget item data.

**Example Scenario:**

```
Widget: SlackNotifications
Providers required: [{type: "slack", required: true}]
State: Provider not configured
Expected: Yellow badge with "⚠️ slack" displayed on widget header
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests verify badge color logic
-   [ ] Visual design matches mockups
-   [ ] Accessibility verified (color contrast, ARIA labels)
-   [ ] Documentation updated

---

**US-004: Inline Provider Assignment**

> As a dashboard user,
> I want to assign providers directly from the widget header,
> so that I don't have to open separate configuration modals.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [ ] AC1: Clicking provider badge opens dropdown menu
-   [ ] AC2: Dropdown lists available providers of that type
-   [ ] AC3: Selected provider is highlighted in dropdown
-   [ ] AC4: Clicking provider in dropdown assigns it to widget
-   [ ] AC5: Dropdown shows "Create New Provider" option
-   [ ] AC6: Clicking "Create New" opens provider creation modal (fallback)
-   [ ] AC7: Badge updates immediately after assignment
-   [ ] AC8: Dropdown closes after selection
-   [ ] AC9: Click outside dropdown closes it

**Edge Cases:**

-   No providers of required type configured → Shows "No providers configured" with "Create New" button
-   Provider assignment fails → Shows error message, dropdown stays open
-   Multiple widgets share same provider → All update when provider edited

**Technical Notes:**
Provider dropdown implemented in WidgetCardHeader. Uses providers from DashboardContext. Calls onProviderChange handler to update widget.selectedProviders.

**Example Scenario:**

```
User: Sarah, widget with yellow slack badge
Action: Clicks badge
Expected: Dropdown opens showing 2 slack providers + "Create New" option
Action: Selects "My Slack Workspace"
Expected: Badge turns green, shows "✓ slack · My Slack Workspace", dropdown closes
Time: ~4s total
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests for provider selection logic
-   [ ] Integration tests for provider assignment
-   [ ] Error handling tested
-   [ ] Documentation updated

---

**US-005: Enhanced Widget Card Header**

> As a dashboard user,
> I want to access common widget actions from the header,
> so that I can configure, duplicate, and delete widgets efficiently.

**Priority:** P0
**Status:** In Progress

**Acceptance Criteria:**

-   [ ] AC1: Widget header shows drag handle (⋮⋮)
-   [ ] AC2: Widget icon and name displayed clearly
-   [ ] AC3: Action buttons shown: Configure (⚙️), Duplicate (📋), Delete (🗑️)
-   [ ] AC4: Buttons show on hover or always visible (configurable)
-   [ ] AC5: Configure button opens widget config modal
-   [ ] AC6: Duplicate creates a copy below the original
-   [ ] AC7: Delete confirms before removal
-   [ ] AC8: All actions have tooltips

**Edge Cases:**

-   Duplicate fails (no space) → Shows error message
-   Delete last widget in container → Confirms with stronger warning
-   Widget too narrow to show all buttons → Truncates with "more" menu

**Technical Notes:**
Implemented by `WidgetCardHeader` component. Integrates with existing LayoutBuilderConfigModal for configuration. Uses ComponentManager.config() to get widget metadata.

**Example Scenario:**

```
Widget: StatusWidget in edit mode
Header shows: [⋮⋮] StatusIcon "Status Widget" [⚙️] [📋] [🗑️] [🔌 provider badges]
Hover state: Buttons highlight
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests for all actions
-   [ ] Accessibility tested (keyboard navigation, tooltips)
-   [ ] Visual design matches specification
-   [ ] Documentation updated

---

### Should-Have (P1)

**US-006: Widget Dropdown Shows Provider Requirements**

> As a dashboard user,
> I want to see provider requirements in the widget dropdown,
> so that I can make informed decisions before adding widgets.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Widget items in dropdown show 🔌 icon if they require providers
-   [ ] AC2: Hovering/focusing widget item shows provider details (tooltip or expanded view)
-   [ ] AC3: Widget description mentions provider requirements
-   [ ] AC4: Required vs. optional providers are distinguished visually

**Edge Cases:**

-   Widget with many providers → Truncates with "+N more" indicator
-   Provider type unknown → Shows warning icon

**Technical Notes:**
Enhancement to WidgetDropdown component. Reads providers from widgetConfig.

**Example Scenario:**

```
Dropdown showing widgets:
- StatusWidget (no icon)
- SlackNotifications 🔌 (hover shows "Requires: slack")
- AnalyticsDashboard 🔌 (hover shows "Requires: algolia, Optional: github")
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests verify provider display
-   [ ] Visual design approved
-   [ ] Documentation updated

---

**US-007: Recent Widgets Section**

> As a power user,
> I want to see recently used widgets at the top of the dropdown,
> so that I can add frequently used widgets faster.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Dropdown shows "Recent" section with last 3-5 used widgets
-   [ ] AC2: Recent widgets stored in localStorage
-   [ ] AC3: Recent list updates when widget is added
-   [ ] AC4: Recent section can be cleared (optional)

**Edge Cases:**

-   localStorage quota exceeded → Fails gracefully, doesn't block widget addition
-   Widget removed from system → Filters out of recent list

**Technical Notes:**
Uses localStorage with key "dash-recent-widgets". Stores widget keys, not full configs.

**Example Scenario:**

```
User: Alex, frequently adds StatusWidget and AnalyticsDashboard
Opens dropdown: Shows "Recent" section with these 2 widgets
Selecting from recent: Instantly adds without searching
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests for localStorage operations
-   [ ] Edge cases tested (quota, deleted widgets)
-   [ ] Documentation updated

---

**US-009: Grid Cell Integrity After Merge/Split Operations**

> As a dashboard user,
> I want grid layouts to remain intact after repeated merge and split operations,
> so that cells don't disappear and leave empty gaps in my dashboard.

**Priority:** P0
**Status:** Complete

**Acceptance Criteria:**

-   [x] AC1: Splitting a previously merged cell restores all hidden cells with no gaps
-   [x] AC2: Multiple merge→split cycles produce no orphaned `hide: true` cells
-   [x] AC3: Merging cells that are already part of a merge cleans up old span/hide state first
-   [x] AC4: Deleting a row/column through a merged region clamps the span to new bounds
-   [x] AC5: Adding a row/column adjacent to a merged region rebuilds hide flags correctly
-   [x] AC6: Every cell in `1..rows × 1..cols` is always present (no missing keys)
-   [x] AC7: No cell key exists outside the current `rows × cols` bounds
-   [x] AC8: Corrupted grids loaded from storage are auto-repaired on initialization
-   [x] AC9: Fully-hidden columns/rows (orphaned or redundant from merges) are compacted away
-   [x] AC10: Stale component references on hidden cells don't prevent compaction

**Root Cause (Bug):**
Merge sets `hide: true` on consumed cells and `span` on the kept cell, but split, add-row, add-col, delete-row, and delete-col operations never cleaned up these properties. Over time, orphaned `hide: true` cells accumulated (the renderer skips them) and stale `span` values caused CSS grid misalignment.

Additionally, `_normalizeGrid()` was only called after grid mutations — never when workspaces were loaded from the API. If a mutation left the grid in a bad state and the user saved, the corruption persisted forever on reload.

**Solution: `_normalizeGrid()` + Targeted Pre-Steps + Load-Time Repair**

The fix has three layers:

1. **Targeted pre-steps** in `splitGridCell` and `mergeGridCells` that eagerly clean up the specific cells being operated on
2. **`_normalizeGrid(grid)`** — a safety-net repair pass called after every grid mutation, now with column/row compaction
3. **`_normalizeAllGrids()`** — called from `_initialize()` and used in `LayoutBuilder` to repair corrupted grids on workspace load

**Technical Notes:**
Implemented in `DashboardModel.js` and `LayoutBuilder.js`. See technical documentation section below for the full algorithm.

**Example Scenarios:**

```
Scenario 1: Merge → Split
3×1 grid: merge rows 1+2 → cell 1.1 gets span:{row:2}, cell 2.1 gets hide:true
Split cell 1.1 vertically → unmerge pre-step unhides 2.1, removes span
→ shift operates on clean cells → normalize confirms consistency → 3 visible cells

Scenario 2: Multiple Cycles
Merge 2 cells → split → merge different pair → split again
Each operation ends with _normalizeGrid rebuilding all hide flags from spans
→ no stale hide flags accumulate → all cells visible

Scenario 3: Delete Row Through Merged Cell
Cell 1.1 has span:{row:3}. Delete row 2 → cells shift up, rows decrements
→ normalize clamps span from 3 to 2 → rebuilds hide → correct 2-row merge

Scenario 4: Corrupted Grid on Load (NEW)
1×5 grid loaded from API: cell 1.1 has span:{col:4}, cells 1.2-1.4 hide:true, cell 1.5 visible
→ _normalizeAllGrids() runs in _initialize()
→ compaction detects cols 2-4 are fully hidden, shrinks 1.1's span, shifts 1.5 left
→ result: 1×2 grid with both widgets at equal width
→ console.warn logs "[DashboardModel] Grid repaired for layout item ..."

Scenario 5: Hidden Cell with Stale Component Ref (NEW)
2×3 grid: cell 1.2 has component:2 AND hide:true (stale ref from prior merge)
→ compaction allows hidden cells regardless of component refs (component is invisible anyway)
→ column 2 compacted, stale ref removed, grid becomes 2×2
```

**Definition of Done:**

-   [x] `_normalizeGrid()` method implemented
-   [x] Unmerge pre-step added to `splitGridCell`
-   [x] Clear-old-state pre-step added to `mergeGridCells`
-   [x] Normalize call added to all 6 grid mutation methods
-   [x] Manual verification of all acceptance criteria scenarios
-   [x] `_normalizeAllGrids()` runs on `_initialize()` for load-time repair
-   [x] `LayoutBuilder` creates DashboardModel on workspace load to propagate repaired layout to UI
-   [x] Grid compaction (fully-hidden column/row removal) added to `_normalizeGrid`
-   [x] Console warning logged when grid is repaired on load

---

**US-010: Edit Mode Snapshot & Cancel Discard**

> As a dashboard user,
> I want all my unsaved edits (layout, name, folder, theme) to be discarded when I click Cancel,
> so that I can safely experiment with changes without committing them.

**Priority:** P0
**Status:** Complete

**Acceptance Criteria:**

-   [x] AC1: Entering edit mode snapshots the current workspace state
-   [x] AC2: Layout changes (add/delete rows/columns, merge/split, widget moves) are preserved when changing name, folder, or theme during edit mode
-   [x] AC3: Clicking Cancel restores the workspace to its exact pre-edit state (layout, name, folder, theme all revert)
-   [x] AC4: Clicking Save persists all accumulated edits (layout + name + folder + theme) in a single save operation
-   [x] AC5: The snapshot is cleared after a successful save
-   [x] AC6: LayoutBuilder's `onTogglePreview` also triggers the snapshot/restore flow (not just the header Cancel button)

**Root Cause (Bug):**

Two separate issues combined to create a broken edit-mode experience:

1. **Layout edits lost on header changes:** The name, folder, and theme change handlers in `DashboardStage` copied from `workspaceSelected` (derived from `openTabs` state), which is stale during active LayoutBuilder edits. LayoutBuilder manages its own internal state and syncs it to `currentWorkspaceRef`, but the handlers ignored the ref. Changing folder or theme would overwrite the tab's workspace with the original layout, discarding all layout edits.

2. **Cancel didn't discard header changes:** The Cancel button simply toggled `previewMode` without reverting the workspace. Name, folder, and theme changes were applied immediately to `openTabs` via `updateTabWorkspace`, so clicking Cancel left those edits in place even though the user expected them to be discarded.

**Solution: Snapshot on Edit Entry + Restore on Cancel**

Three changes in `DashboardStage.js`:

1. **`originalWorkspaceRef`** — a new ref that stores a deep copy of the workspace when entering edit mode
2. **`handleToggleEditMode()`** — replaces the simple `setPreviewMode(!previewMode)` toggle:
    - Entering edit mode: snapshots `workspaceSelected` into `originalWorkspaceRef`
    - Canceling: restores the snapshot via `updateTabWorkspace`, clears both `currentWorkspaceRef` and `originalWorkspaceRef`
3. **Change handlers use `currentWorkspaceRef.current || workspaceSelected`** — ensures layout edits from LayoutBuilder are preserved when the user changes name, folder, or theme

The save path (`handleClickSaveWorkspace` / `handleSaveWorkspaceComplete`) already read from `currentWorkspaceRef.current || workspaceSelected` and now also clears both refs after a successful save.

**Technical Notes:**

Implemented in `DashboardStage.js`. The fix touches only the edit-mode orchestration layer — no changes to LayoutBuilder, DashboardModel, or the grid system.

Key refs:

-   `currentWorkspaceRef` — existing ref synced by LayoutBuilder with latest layout state
-   `originalWorkspaceRef` — new ref holding the pre-edit snapshot

**Example Scenarios:**

```
Scenario 1: Layout Edit + Folder Change + Cancel
User enters edit mode → deletes a row → changes folder from "Work" to "Personal"
Clicks Cancel → workspace reverts to original layout WITH original folder ("Work")
→ All edits discarded

Scenario 2: Layout Edit + Theme Change + Save
User enters edit mode → adds a column → changes theme to "Dark Blue"
Clicks Save → workspace saved with new column AND "Dark Blue" theme
→ All edits persisted in one save

Scenario 3: Name + Folder + Theme + Layout + Cancel
User enters edit mode → renames dashboard → changes folder → changes theme → deletes 2 rows
Clicks Cancel → all four changes discarded, workspace identical to pre-edit state

Scenario 4: Multiple Header Changes Preserve Layout
User enters edit mode → merges two cells → changes folder → changes theme → changes name
Each header change reads from currentWorkspaceRef (which has the merged layout)
→ Layout edits preserved through all header changes
```

**Definition of Done:**

-   [x] `originalWorkspaceRef` added to DashboardStage
-   [x] `handleToggleEditMode` replaces raw `setPreviewMode` toggle
-   [x] Name, folder, and theme handlers read from `currentWorkspaceRef.current || workspaceSelected`
-   [x] Cancel restores snapshot and clears both refs
-   [x] Save clears both refs after successful persistence
-   [x] Both `onClickEdit` (header) and `onTogglePreview` (LayoutBuilder) use `handleToggleEditMode`
-   [x] Manual verification of all acceptance criteria scenarios

---

### Nice-to-Have (P2)

**US-008: Context Menu for Power Users**

> As a power user,
> I want to right-click widgets for advanced options,
> so that I can access power features without cluttering the UI.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Right-click widget opens context menu
-   [ ] AC2: Menu options: Configure, Duplicate, Delete, Move Up, Move Down, Export Config
-   [ ] AC3: Menu appears at cursor position
-   [ ] AC4: Menu closes on click outside or selection
-   [ ] AC5: Keyboard shortcut hints shown in menu

**Edge Cases:**

-   Right-click on widget boundary → Menu positions to stay in viewport
-   Menu too large for screen → Scrollable

**Technical Notes:**
Future enhancement. Would use react-contextmenu or custom implementation.

**Example Scenario:**

```
User: Power user, right-clicks StatusWidget
Menu appears: [⚙️ Configure] [📋 Duplicate] [🗑️ Delete] [↑ Move Up] [↓ Move Down] [💾 Export Config]
```

**Definition of Done:**

-   [ ] Code implemented and reviewed
-   [ ] Unit tests for menu interactions
-   [ ] Keyboard navigation tested
-   [ ] Documentation updated

---

## Feature Requirements

### Functional Requirements

**FR-001: Inline Widget Selection**

-   **Description:** System provides inline dropdown for widget selection without modal overlay
-   **User Story:** US-001, US-002
-   **Priority:** P0
-   **Validation:** Dropdown renders without modal, search filters correctly, selection adds widget

**FR-002: Provider Status Indicators**

-   **Description:** System displays provider requirements and status on widget headers using color-coded badges
-   **User Story:** US-003
-   **Priority:** P0
-   **Validation:** Badges show correct colors (green/yellow/gray), provider names display when configured

**FR-003: Inline Provider Configuration**

-   **Description:** System allows provider assignment from widget header without separate modal
-   **User Story:** US-004
-   **Priority:** P0
-   **Validation:** Clicking badge opens dropdown, selecting provider assigns it, badge updates immediately

**FR-004: Enhanced Widget Actions**

-   **Description:** System provides configure, duplicate, and delete actions from widget header
-   **User Story:** US-005
-   **Priority:** P0
-   **Validation:** All actions work correctly, tooltips display, confirmation for destructive actions

**FR-005: Grid Cell Integrity (Normalize After Mutation)**

-   **Description:** System ensures grid cell consistency after every merge, split, add-row, add-col, delete-row, and delete-col operation by running an idempotent normalization pass
-   **User Story:** US-009
-   **Priority:** P0
-   **Validation:** Repeated merge/split cycles produce no orphaned cells; row/column operations correctly clamp spans; all cells in bounds are present

**FR-006: Edit Mode Snapshot & Cancel Discard**

-   **Description:** System snapshots workspace state on edit mode entry; Cancel restores the snapshot (discarding all edits), Save persists all edits and clears the snapshot
-   **User Story:** US-010
-   **Priority:** P0
-   **Validation:** Layout + name + folder + theme changes all revert on Cancel; all persist on Save; layout edits survive header changes during editing

### Non-Functional Requirements

**NFR-001: Performance**

-   Widget dropdown renders in <100ms with 100+ widgets
-   Search filtering updates in <50ms (debounced)
-   Provider dropdown renders in <50ms
-   No layout shift when badges appear/disappear

**NFR-002: Backward Compatibility**

-   All existing dashboards load and function correctly
-   Widget configs (\*.dash.js) remain unchanged
-   Provider system architecture unchanged
-   Layout engine drag-and-drop logic unchanged

**NFR-003: Usability**

-   Widget addition completes in 3 clicks or less
-   Provider configuration completes in 2 clicks or less (if provider exists)
-   All interactions have visual feedback within 100ms
-   Error messages are clear and actionable

**NFR-004: Accessibility**

-   WCAG 2.1 AA compliance
-   Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
-   Screen reader announces dropdown state
-   Color contrast meets accessibility standards

---

## User Workflows

### Workflow 1: Add Widget (Happy Path)

**Trigger:** User wants to add a widget to their dashboard

**Steps:**

1. User clicks "+" button on container
2. WidgetDropdown appears centered with backdrop, search input auto-focused
3. User types "slack" in search
4. Widget list filters to show Slack widgets
5. User clicks "Slack Notifications" widget
6. Widget appears in layout immediately
7. Dropdown closes automatically
8. Widget header shows yellow ⚠️ badge for required Slack provider
9. User clicks badge → provider dropdown opens
10. User selects "My Slack Workspace"
11. Badge turns green ✓ with provider name

**Success State:** Widget is added, provider configured, badge shows green status

**Error Scenarios:**

-   Widget addition fails (e.g., validation error) → Shows error message, dropdown stays open
-   No providers configured → Badge shows yellow, dropdown shows "Create New" option

**Time Estimate:** ~3 seconds (vs. ~10s with modal)

**Example:**

```
User: Sarah, Dashboard Creator
Initial state: Empty dashboard in edit mode
Action: Adds SlackNotifications widget with provider configuration
Result: Widget visible, provider assigned, ready to use
Total time: 3 seconds
```

---

### Workflow 2: Add Widget with Keyboard

**Trigger:** Power user wants to add widget using keyboard only

**Steps:**

1. User presses "+" keyboard shortcut (or navigates to button and presses Enter)
2. Dropdown opens, search input auto-focused
3. User types widget name
4. User presses ↓ to select first result
5. User presses Enter
6. Widget added, dropdown closes

**Success State:** Widget added without using mouse

**Error Scenarios:**

-   No results for search → User sees "No widgets found" message

**Time Estimate:** ~2 seconds

**Example:**

```
Power user: Adds StatusWidget
Keyboard only: [+] → type "status" → [↓] → [Enter]
Time: 2 seconds
```

---

### Workflow 3: Configure Provider (Existing Widget)

**Trigger:** User sees widget with yellow ⚠️ provider badge

**Steps:**

1. User clicks badge
2. Provider dropdown opens below badge
3. User selects provider from list
4. Badge updates to green ✓
5. Dropdown closes

**Success State:** Provider configured, widget functional

**Error Scenarios:**

-   No providers available → Shows "No providers configured" with "Create New" button
-   Provider assignment fails → Error message, dropdown stays open

**Time Estimate:** ~4 seconds (vs. ~15s with modal)

**Example:**

```
Widget: AnalyticsDashboard with unconfigured algolia provider
User: Jordan, clicks yellow badge
Selects: "Production Algolia"
Result: Badge green, widget queries Algolia index
Time: 4 seconds
```

---

### Workflow 4: Create New Provider

**Trigger:** User needs to configure provider that doesn't exist yet

**Steps:**

1. User clicks provider badge
2. Provider dropdown shows "No providers configured"
3. User clicks "+ Create New slack"
4. Provider creation modal opens (existing flow)
5. User fills in credentials (Slack webhook URL, token)
6. User saves
7. Returns to dashboard, badge updates to green

**Success State:** New provider created and assigned

**Error Scenarios:**

-   Invalid credentials → Validation error in provider modal
-   Network error during save → Error message with retry option

**Time Estimate:** ~30 seconds (credential entry time unavoidable)

**Example:**

```
User: Sarah, needs to add Slack provider
Clicks: Yellow badge → "+ Create New slack"
Fills: Webhook URL, bot token
Saves: Provider created
Result: Badge green, widget functional
Time: 30 seconds (depends on typing speed)
```

---

## Design Considerations

### UI/UX Requirements

**WidgetDropdown Design:**

-   Size: 384px wide (w-96), max-height 384px (scrollable)
-   Position: Fixed center (top-50%, left-50%, transform)
-   Backdrop: Black 50% opacity, blur effect
-   Header: Blue gradient (bg-blue-600), white text
-   Search: Gray background, white input, blue focus ring
-   Widget Items: Hover state (bg-blue-50), selected state (bg-blue-100)
-   Icons: 2xl text size for widget icons

**ProviderBadge Design:**

-   States:
    -   Configured: Green background (bg-green-100), green border (border-green-500), ✓ icon
    -   Required: Yellow background (bg-yellow-100), yellow border (border-yellow-500), ⚠️ icon
    -   Optional: Gray background (bg-gray-100), gray border (border-gray-400), ○ icon
-   Text: xs font size, medium weight
-   Hover: 80% opacity
-   Max width: Provider name truncates at 100px

**WidgetCardHeader Design:**

-   Background: Gray-50 (light mode) / Gray-900 (dark mode)
-   Border: Bottom border only
-   Spacing: px-3 py-2.5
-   Drag Handle: Gray-400, hover Gray-600
-   Action Buttons: Icon-only, hover changes color
-   Layout: Flexbox, gap-3, items-center

**Mockups/Wireframes:** See Figma designs (link TBD)

### Architecture Requirements

**Component Structure:**

-   WidgetDropdown is portal-rendered to body (avoids z-index issues)
-   ProviderBadge is reusable across widget types
-   WidgetCardHeader integrates with existing LayoutBuilderConfigModal
-   Feature flags control gradual rollout (USE_ENHANCED_WIDGET_SELECTOR, USE_ENHANCED_WIDGET_HEADER)

**State Management:**

-   Dropdown state managed in LayoutBuilder (showWidgetDropdown, dropdownTarget)
-   Provider selection updates widget.selectedProviders object
-   Recent widgets stored in localStorage (key: "dash-recent-widgets", max 10 items)

**See Technical Docs:**

-   [ComponentManager.js](../../src/ComponentManager.js) - Widget registration and retrieval
-   [DashboardContext.js](../../src/Context/DashboardContext.js) - Provider data source

### Dependencies

**Internal:**

-   ComponentManager (existing) - Widget discovery
-   DashboardContext (existing) - Provider data
-   LayoutBuilderConfigModal (existing) - Widget configuration fallback
-   ThemeContext (from @trops/dash-react) - Theming

**External:**

-   React 18 - Component library
-   TailwindCSS 3 - Styling
-   @trops/dash-react - UI components (ButtonIcon, Panel, etc.)

---

## Open Questions & Decisions

### Decisions Made

| Date       | Decision                                                  | Rationale                                                                           | Owner     |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------- |
| 2026-02-14 | Use inline dropdown instead of modal for widget selection | Reduces context loss, faster iteration, matches modern UX patterns (Notion, Retool) | Core Team |
| 2026-02-14 | Embed provider badges in widget headers                   | Makes requirements visible at all times, reduces clicks to configure                | Core Team |
| 2026-02-14 | Feature flags for gradual rollout                         | Allows testing and rollback without code changes                                    | Core Team |
| 2026-02-14 | Recent widgets in localStorage (max 10)                   | Improves power user productivity without backend changes                            | Core Team |

---

## Out of Scope

**Explicitly excluded from this PRD:**

-   **Slash command support** (type "/" to search widgets) - Future enhancement (Phase 2)
-   **Widget favorites** - User-specific widget bookmarks - Future enhancement
-   **Collapsible sidebar widget library** - Alternative to dropdown - Different approach
-   **Provider health monitoring** - Live status checks for provider connections - Separate feature
-   **Undo/redo for layout changes** - Broader feature, not specific to this redesign

**Future Considerations:**

-   Context menu for right-click power user actions (US-008)
-   Keyboard shortcuts for common actions (Ctrl+D to duplicate, etc.)
-   Provider auto-configuration from environment variables
-   Widget templates (save configured widgets for reuse)

---

## Implementation Phases

### Phase 1: MVP (P0 Stories) - CURRENT

**Timeline:** Sprint 1-2 (2 weeks)

**Deliverables:**

-   [x] US-001: Quick widget addition (WidgetDropdown component)
-   [x] US-002: Widget search & filtering
-   [x] US-003: Provider status badges (ProviderBadge component)
-   [ ] US-004: Inline provider assignment
-   [ ] US-005: Enhanced widget card header (WidgetCardHeader component)
-   [x] US-010: Edit mode snapshot & cancel discard

**Success Criteria:**

-   Widget addition workflow completes in <5 seconds
-   Provider configuration workflow completes in <10 seconds
-   No modal interruptions
-   All P0 acceptance criteria verified
-   Backward compatible with existing dashboards

**Risks:**

-   Provider dropdown positioning edge cases - Mitigation: Extensive testing across layouts
-   Performance with 100+ widgets - Mitigation: Virtualized list if needed

**Current Status:** WidgetDropdown, ProviderBadge, WidgetCardHeader components created. Integration in progress.

---

### Phase 2: Enhancement (P1 Stories)

**Timeline:** Sprint 3 (1 week)

**Deliverables:**

-   [ ] US-006: Provider requirements in widget dropdown
-   [ ] US-007: Recent widgets section

**Success Criteria:**

-   Provider requirements visible before widget addition
-   Recent widgets reduce time for frequently used widgets by 50%

**Dependencies:**

-   Requires Phase 1 completion
-   Requires user testing feedback from Phase 1

---

### Phase 3: Polish (P2 Stories)

**Timeline:** Backlog (TBD)

**Deliverables:**

-   [ ] US-008: Context menu for power users

**Success Criteria:**

-   Power users can access all actions via keyboard + right-click

**Dependencies:**

-   Requires Phase 1 and 2 completion
-   Requires user feedback on need for context menu

---

## Technical Documentation

**See related technical docs:**

-   [LayoutBuilder.js](../../src/Components/Layout/Builder/LayoutBuilder.js) - Main orchestrator, feature flags
-   [ComponentManager.js](../../src/ComponentManager.js) - Widget registration and config
-   [WIDGET_PROVIDER_CONFIGURATION.md](../WIDGET_PROVIDER_CONFIGURATION.md) - Provider system guide
-   [PROVIDER_ARCHITECTURE.md](../PROVIDER_ARCHITECTURE.md) - Three-tier provider storage

**Implementation Status:**

-   WidgetDropdown: Created (src/Components/Layout/Builder/Enhanced/WidgetDropdown.js)
-   ProviderBadge: Created (src/Components/Layout/Builder/Enhanced/ProviderBadge.js)
-   WidgetCardHeader: Created (src/Components/Layout/Builder/Enhanced/WidgetCardHeader.js)
-   Integration: In progress (LayoutBuilder.js, LayoutBuilderGridItem.js)

### Grid Cell Normalization System

**Files:**

-   [DashboardModel.js](../../src/Models/DashboardModel.js) — normalization engine
-   [LayoutBuilder.js](../../src/Components/Layout/Builder/LayoutBuilder.js) — load-time repair integration
-   [LayoutGridContainer.js](../../src/Components/Layout/Builder/LayoutGridContainer.js) — gutter rendering

**Problem:** Grid merge/split operations use two cell properties to represent merged regions: `span` (on the kept cell, defining how many rows/cols it covers) and `hide: true` (on consumed cells, so the renderer skips them). Without cleanup, these properties become orphaned after subsequent operations, causing invisible cells and layout gaps. Additionally, corrupted grids persisted to storage were never repaired on load, because normalization only ran after mutations.

**Solution Architecture:**

The fix has three layers:

1. **Targeted pre-steps** in `splitGridCell` and `mergeGridCells` that eagerly clean up the specific cells being operated on
2. **`_normalizeGrid(grid)`** — a safety-net repair pass called after every grid mutation, with column/row compaction
3. **`_normalizeAllGrids()`** — called from `_initialize()` to repair all grids on model creation; used in `LayoutBuilder`'s workspace `useEffect` to ensure repaired layout flows to the UI

**`_normalizeGrid` Algorithm (3 phases, idempotent):**

```
=== Phase 1: Fill, clean, and clamp (steps 1-3) ===

Step 1: Fill missing cells
  For every (r,c) in 1..rows × 1..cols, create { component: null, hide: false } if absent

Step 2: Remove out-of-bounds keys
  Delete any cell key where row > grid.rows or col > grid.cols

Step 3: Clamp spans to grid bounds
  For each cell with a span:
    span.row = min(span.row, rows - r + 1)
    span.col = min(span.col, cols - c + 1)
  Remove span entirely if clamped to 1×1

=== Phase 2: Compact fully-hidden columns/rows (steps 6-7) ===

Runs BEFORE step 4 clears hide flags, using the raw hide state to detect
orphaned or redundant columns/rows.

Step 6: Compact fully-hidden columns (right-to-left)
  A column is compactable if EVERY cell has hide:true and is not a span origin.
  Hidden cells with stale component refs are still compactable (the component
  is already invisible, covered by a span from another cell).

  For each compactable column c:
    1. Shrink any spans from earlier columns that reach into column c (span.col--)
    2. Shift all columns after c left by one
    3. Decrement grid.cols

Step 7: Compact fully-hidden rows (bottom-to-top)
  Same logic as step 6 but for rows. Shrink row spans, shift rows up, decrement.

=== Phase 3: Full normalization (steps 1-5 via _normalizeGridSteps) ===

Step 4: Clear ALL hide flags
  Set hide: false on every cell

Step 5: Rebuild hide from spans (row-major)
  Iterate cells top-left to bottom-right:
    If cell has span → mark all covered cells hide: true
    If cell is already covered by an earlier span → remove its span (conflict resolution)
    Covered cells that had their own span also lose it
```

**Load-time repair flow:**

```
1. Workspace data arrives from API
2. LayoutBuilder useEffect fires → creates DashboardModel(workspace)
3. DashboardModel._initialize() → deep copies workspace, sets this.layout
4. _initialize() calls _normalizeAllGrids()
5. _normalizeAllGrids() iterates layout items, calls _normalizeGrid() on each grid
6. If grid was modified, logs console.warn("[DashboardModel] Grid repaired ...")
7. LayoutBuilder stores model.layout in state → repaired data flows to UI
```

**Pre-step in `splitGridCell` (unmerge):**

Before the shift logic runs, if the target cell has a `span`:

-   Unhide all cells the span covers
-   Delete the span
-   This prevents the shift from carrying stale `hide: true` cells to new positions

**Pre-step in `mergeGridCells` (clear old state):**

Before setting new hide/span values, for each cell in the selection:

-   If it has a `span`, unhide its previously-covered cells and delete the span
-   Set `hide: false`
-   This handles re-merging (merging a cell that is already part of a merge group)

**Methods that call `_normalizeGrid`:**

| Method               | Why normalize is needed                                  |
| -------------------- | -------------------------------------------------------- |
| `splitGridCell`      | Other merged groups may be affected by the row/col shift |
| `mergeGridCells`     | Safety net after setting new span/hide values            |
| `addGridRow`         | Shifted cells may land outside existing span coverage    |
| `deleteGridRow`      | Spans that crossed the deleted row need clamping         |
| `addGridColumn`      | Shifted cells may land outside existing span coverage    |
| `deleteGridColumn`   | Spans that crossed the deleted column need clamping      |
| `_normalizeAllGrids` | Repairs corrupted grids on workspace load from API       |

**Key invariants maintained by `_normalizeGrid`:**

1. Every `(r,c)` in `1..rows × 1..cols` has a cell object
2. No cell keys exist outside `rows × cols` bounds
3. No span extends past grid edges
4. `hide: true` appears **only** on cells covered by another cell's `span`
5. No two spans overlap (earlier span wins in row-major order)
6. No fully-hidden columns or rows exist (compacted away)

**Gutter label rendering:**

Column/row gutter labels in `LayoutGridContainer.js` use `getColGutterSpan()` / `getRowGutterSpan()` to determine how many grid tracks a label spans. These functions only span into consecutive fully-hidden columns/rows (where no row/column has a visible cell). They do NOT use cell span values — cell spans are visualized by the cells themselves via CSS grid `gridColumn`/`gridRow` properties. This prevents gutter labels from incorrectly spanning across columns that have visible cells in other rows.

---

## Testing Requirements

### Unit Tests

**Coverage Target:** 85% minimum

**Test Cases:**

-   [ ] WidgetDropdown renders correctly
-   [ ] Search filtering works with various queries
-   [ ] Keyboard navigation cycles through widgets
-   [ ] Recent widgets stored/retrieved from localStorage
-   [ ] ProviderBadge shows correct status colors
-   [ ] ProviderBadge displays provider name when configured
-   [ ] WidgetCardHeader renders all action buttons
-   [ ] Provider dropdown opens/closes correctly

**Test File:** `tests/prd/layout-builder-hybrid.test.js`

### Integration Tests

**Test Scenarios:**

-   [ ] Widget addition updates layout correctly
-   [ ] Provider selection saves to widget config
-   [ ] Feature flags toggle between old/new UI correctly
-   [ ] Dashboard saves/loads with enhanced widgets
-   [ ] Multiple widgets can share same provider

**Test File:** `tests/integration/layout-builder-enhanced.test.js`

### E2E Tests

**Test Workflows:**

-   [ ] Complete Workflow 1 (Add widget with provider) end-to-end
-   [ ] Time measurement: Widget addition <5 seconds
-   [ ] Time measurement: Provider configuration <10 seconds
-   [ ] Keyboard-only widget addition works
-   [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

**Test File:** `tests/e2e/layout-builder-workflows.spec.js`

### Manual Testing

**Test Checklist:**

-   [ ] Visual design matches specifications
-   [ ] Accessibility (keyboard navigation tested)
-   [ ] Screen reader announces dropdown state
-   [ ] Color contrast meets WCAG AA
-   [ ] Performance benchmarks met (100ms dropdown render)
-   [ ] Edge cases behave as expected (empty list, no providers, etc.)

**Test Evidence:** Screenshots in `/docs/testing/layout-builder-hybrid/`

---

## Revision History

| Version | Date       | Author    | Changes                                                                      |
| ------- | ---------- | --------- | ---------------------------------------------------------------------------- |
| 1.0     | 2026-02-14 | Core Team | Initial PRD created from planning session                                    |
| 1.1     | 2026-02-16 | Core Team | Added US-009, FR-005: Grid cell integrity fix (\_normalizeGrid + pre-steps)  |
| 1.2     | 2026-02-19 | Core Team | US-009: Added load-time grid repair, column/row compaction, gutter span fix  |
| 1.3     | 2026-02-19 | Core Team | Added US-010, FR-006: Edit mode snapshot/restore — Cancel discards all edits |
