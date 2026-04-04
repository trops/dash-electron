# PRD: In-App AI Assistant & Widget Builder

**Status:** Draft
**Last Updated:** 2026-04-03
**Owner:** John Giatropoulos
**Related PRDs:** None

---

## Executive Summary

Bring AI inside dash-electron as a first-class assistant that helps users build widgets, configure dashboards, troubleshoot issues, and remix existing widgets — all conversationally. The feature has two flagship capabilities: a right-side panel AI assistant with full access to Dash MCP tools, and an inline widget builder modal that generates custom widgets from natural language with live preview.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

Dash-electron has strong AI foundations — Chat widgets (Anthropic + Claude Code CLI), an MCP server with 22+ tools for dashboard management, and a dynamic widget loading system. However, these capabilities are fragmented: the MCP server requires an external LLM client, the chat widgets are standalone, and widget creation requires CLI access and coding skills.

Users who want to create custom widgets must leave the app, run scaffolding scripts, write React code, and manually register the widget. Non-developers can't create widgets at all. The AI capabilities exist but aren't unified into a single, accessible in-app experience.

**Who experiences this problem?**

-   Primary: Solutions Engineers who need custom widgets for customer demos
-   Secondary: Non-developer users who want to customize their dashboards beyond available widgets

**What happens if we don't solve it?**

Widget creation remains developer-only. The MCP server's power is underutilized because it requires external tooling. Users who would benefit most from custom widgets (SEs doing customer-facing work) can't create them without engineering support.

### Current State

**What exists today?**

-   **ChatAnthropicWidget** — Direct Anthropic API chat with streaming + MCP tool use
-   **ChatClaudeCodeWidget** — Chat via Claude Code CLI, no API key needed
-   **MCP Server** — 22+ tools for dashboard/widget/theme/provider management
-   **Widgetize script** — CLI scaffolding for new widget projects (`node scripts/widgetize.js`)
-   **Widget Registry** — Install, compile, and load widgets at runtime via `widgetRegistry.js`
-   **DynamicWidgetLoader** — Sandboxed widget loading via `vm.runInContext()`

**Limitations:**

-   MCP tools require an external LLM client (can't use them from within the app)
-   Widget creation requires CLI + coding skills
-   Chat widgets are standalone — not integrated with dashboard management tools
-   No way to generate widgets from natural language
-   No way to remix/customize existing widgets without source code access

---

## Goals & Success Metrics

### Primary Goals

1. **Zero-config AI access** — Users with Claude Code CLI installed can use the assistant immediately with no setup
2. **Conversational widget creation** — Non-developers can describe a widget and get a working result
3. **Unified AI experience** — One assistant panel that can do everything the MCP tools can do, plus build widgets

### Non-Goals

-   **Multi-LLM support in v1** — Only Anthropic API + Claude Code CLI. OpenAI/others deferred.
-   **Interpreted/eval mode** — Full esbuild compilation for all widget builds. No hot-reload shortcuts.
-   **AI-generated widget marketplace curation** — No quality gates for publishing AI-built widgets beyond existing validation.
-   **Autonomous agent mode** — The assistant responds to user requests, it doesn't proactively modify dashboards.

---

## User Personas

### Solutions Engineer (SE)

**Role:** Customer-facing technical consultant

**Goals:**

-   Build custom demo dashboards quickly for customer meetings
-   Create widgets tailored to specific customer data/APIs
-   Share polished widgets with the team via the registry

**Pain Points:**

-   Creating widgets requires leaving the app and writing code
-   Scaffolding + coding + testing loop is too slow for demo prep
-   Can't easily customize existing widgets for specific customer needs

**Technical Level:** Intermediate (comfortable with APIs, not a React developer)

**Success Scenario:** SE describes "a widget showing top search queries from our Algolia index with a date range picker" → gets a working widget in under 5 minutes → drops it into a customer demo dashboard.

### Dashboard Creator

**Role:** Non-developer user building internal dashboards

**Goals:**

-   Customize dashboards without engineering support
-   Get help configuring providers and widgets
-   Troubleshoot issues when widgets show errors

**Pain Points:**

-   Provider setup is confusing (which type? what credentials?)
-   Widget errors are opaque ("provider not configured" — how to fix?)
-   Can't create custom widgets at all

**Technical Level:** Beginner

**Success Scenario:** User asks the assistant "why isn't my Gong widget showing data?" → assistant diagnoses missing provider → walks them through setup → widget starts working.

---

## User Stories

### Must-Have (P0)

**US-001: Connect to LLM**

> As a user,
> I want to connect the AI assistant to my preferred LLM backend,
> so that I can use AI features within the app.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: If Claude Code CLI is installed, assistant is available immediately with no configuration
-   [ ] AC2: If CLI is not available, user can enter an Anthropic API key via Settings > AI Assistant
-   [ ] AC3: API keys are stored encrypted using the existing provider system (`safeStorage`)
-   [ ] AC4: If user already has an Anthropic provider (from Chat widget), assistant reuses it automatically
-   [ ] AC5: Settings > AI Assistant shows: preferred backend, API key (if Anthropic), model selector

**Technical Notes:**
Reuse `llmController` + `cliController` from `dash-core/electron/controller/`. Store preference in `settings.json`. Reuse `providerController` for API key encryption.

---

**US-002: AI Assistant Panel**

> As a user,
> I want a persistent AI assistant panel on the right side of the app,
> so that I can get help with dashboard tasks without leaving my workflow.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Assistant panel slides in from the right side (same side as WidgetSidebar in edit mode)
-   [ ] AC2: Panel has a toggle button in the toolbar/header area
-   [ ] AC3: Assistant has access to all Dash MCP tools (dashboard, widget, theme, provider, layout management)
-   [ ] AC4: Assistant knows the active dashboard context (which dashboard is open, what widgets are placed)
-   [ ] AC5: Chat history persists within the session
-   [ ] AC6: Panel can be popped out into a standalone window

**Technical Notes:**
Build on `ChatCore.js` engine. Pre-configure system prompt with Dash capabilities. Enable all MCP tools by default. Use `DashboardPublisher` IPC bridge for cross-window events if popped out.

---

**US-003: Build Widget with AI**

> As a Solutions Engineer,
> I want to describe a widget in natural language and get a working result with live preview,
> so that I can create custom widgets without writing code.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Grid cell "+" menu includes "Build with AI" option
-   [ ] AC2: Opens a modal with split pane: chat (left) + live preview (right)
-   [ ] AC3: AI generates `.js` component + `.dash.js` config from natural language description
-   [ ] AC4: Each iteration compiles via esbuild and renders in the preview pane
-   [ ] AC5: User can iterate conversationally ("make the chart blue", "add a date picker")
-   [ ] AC6: "Add to Grid" installs widget to `@ai-built/` scope and places it in the selected cell
-   [ ] AC7: Widget uses `@trops/dash-react` components and `@trops/dash-core` hooks (externalized in esbuild)

**Technical Notes:**
Widget files go to `{userData}/widgets/@ai-built/{widget-name}/`. Use existing `widgetRegistry.installFromLocalPath()` for installation. esbuild compilation uses same pipeline as registry widgets. Preview uses `renderComponent()` from `dash-core/utils/layout.js`.

---

### Should-Have (P1)

**US-004: Remix Existing Widget**

> As a user,
> I want to customize an existing widget using AI,
> so that I can adapt it to my specific needs without starting from scratch.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Right-click widget → "Remix with AI" opens the widget builder modal
-   [ ] AC2: Original widget source is pre-loaded as AI context
-   [ ] AC3: AI generates a forked version under `@ai-built/` scope
-   [ ] AC4: Original widget is untouched — remix is a separate installation
-   [ ] AC5: Remix metadata tracks attribution (`remixedFrom` in `dash.json`)

**Technical Notes:**
Installed widgets already include source files (`widgets/*.js` + `widgets/*.dash.js`). The AI reads these as context. Fork naming: `@ai-built/{original-name}-custom`.

---

**US-005: Publish AI-Built Widget**

> As a Solutions Engineer,
> I want to publish my AI-built widget to the registry,
> so that my team can install and use it.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Settings > Widgets shows AI-built widgets with a "Publish" action
-   [ ] AC2: Publish validates widget structure via `validateWidget.cjs`
-   [ ] AC3: User provides metadata (display name, description, icon)
-   [ ] AC4: Widget re-scoped from `@ai-built/` to `@username/`
-   [ ] AC5: Publishes via `publishToRegistry.js` (requires registry auth)
-   [ ] AC6: Remix attribution preserved in registry listing

**Technical Notes:**
Reuse existing `scripts/publishToRegistry.js` and `scripts/validateWidget.cjs`.

---

**US-006: AI Troubleshooting**

> As a Dashboard Creator,
> I want the assistant to diagnose widget errors and suggest fixes,
> so that I can resolve issues without developer help.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Assistant can read the active widget's error state
-   [ ] AC2: Assistant can inspect provider configuration for a widget
-   [ ] AC3: Assistant suggests specific fixes ("Your Gong widget needs a provider — want me to set it up?")
-   [ ] AC4: Assistant can execute fixes with user confirmation (e.g., connect a provider to a widget)

---

## Architecture

### AI-Generated Widget Storage

```
{app.getPath("userData")}/widgets/
├── registry.json                     # Tracks all widgets (existing)
├── @trops/gong/                      # Registry widget (existing)
├── @ai-built/                        # AI-generated widgets (new scope)
│   ├── customer-health/
│   │   ├── dash.json
│   │   ├── widgets/
│   │   │   ├── CustomerHealth.js
│   │   │   └── CustomerHealth.dash.js
│   │   └── dist/
│   │       └── index.cjs.js
│   └── sales-chart-custom/           # Remix of existing widget
│       ├── dash.json                  # includes remixedFrom
│       └── ...
```

### LLM Connection

| Backend         | Auth                 | Setup                                        |
| --------------- | -------------------- | -------------------------------------------- |
| Claude Code CLI | Pro/Max subscription | Auto-detected, zero config                   |
| Anthropic API   | API key (encrypted)  | Settings > AI Assistant or existing provider |

### UI Layout

```
┌──────────┬──────────────────────────────────┬──────────────┐
│ Pinned   │                                  │  AI          │
│ Sidebar  │     Dashboard Content             │  Assistant   │
│ (left)   │     (center)                      │  Panel       │
│          │                                  │  (right)     │
│ Nav +    │                                  │              │
│ Pages    │                                  │  Chat +      │
│          │                                  │  Tools       │
└──────────┴──────────────────────────────────┴──────────────┘
Left = Navigation          Center = Content          Right = Helpers
```

### Widget Builder Modal

```
┌───────────────────────────────────────────────────────┐
│  Build Widget with AI                            [X]  │
├──────────────────────┬────────────────────────────────┤
│  Chat                │  Live Preview                  │
│                      │  ┌────────────────────────┐    │
│  [conversation]      │  │  [rendered widget]     │    │
│                      │  └────────────────────────┘    │
│                      │                                │
│  [input...]          │  [Regenerate]  [Add to Grid]   │
├──────────────────────┴────────────────────────────────┤
│  Backend: Claude Code CLI (connected)                 │
└───────────────────────────────────────────────────────┘
```

### Widget Lifecycle

```
Build (modal) → Install locally → Test & iterate → Publish (optional)
  AI generates     @ai-built/       User uses it,     Promote to
  + compiles       scope, local     asks AI to fix    @username/ scope,
  + previews       only             issues            push to registry
```

### Key Infrastructure Reuse

| Need                | Existing Solution                           | File                                                  |
| ------------------- | ------------------------------------------- | ----------------------------------------------------- |
| LLM streaming       | `llmController` + `cliController`           | `dash-core/electron/controller/llmController.js`      |
| Chat UI             | `ChatCore.js` + components                  | `dash-electron/src/SampleWidgets/Chat/`               |
| MCP tool execution  | `mcpController.callTool()`                  | `dash-core/electron/controller/mcpController.js`      |
| Dashboard MCP tools | 22+ tools                                   | `dash-core/electron/mcp/`                             |
| Widget installation | `widgetRegistry.installFromLocalPath()`     | `dash-core/electron/widgetRegistry.js`                |
| Widget compilation  | esbuild pipeline                            | `dash-core/electron/widgetRegistry.js`                |
| Dynamic loading     | `DynamicWidgetLoader` + `vm.runInContext()` | `dash-core/electron/dynamicWidgetLoader.js`           |
| Scoped packages     | `@scope/name` support                       | `dash-core/electron/widgetRegistry.js`                |
| Popout windows      | `createWidgetPopoutWindow()`                | `dash-electron/public/electron.js`                    |
| Provider encryption | `safeStorage.encryptString()`               | `dash-core/electron/controller/providerController.js` |
| Settings storage    | `settingsController`                        | `dash-core/electron/controller/settingsController.js` |

---

## Decisions Made

| Date       | Decision                                   | Rationale                                                                                                          |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 2026-04-03 | Anthropic + Claude Code CLI only for v1    | Both already work end-to-end. Add OpenAI/others later.                                                             |
| 2026-04-03 | Full esbuild pipeline for widget builds    | Same as registry widgets. ~1-2s per iteration. Production-ready output. No new eval system.                        |
| 2026-04-03 | `@ai-built/` scope in existing widgets dir | Leverages all existing registry infrastructure. No new storage system.                                             |
| 2026-04-03 | Right-side panel (not left sidebar)        | Left sidebar = navigation. Right side = helpers (widget picker, assistant). Clear separation.                      |
| 2026-04-03 | Publishing is a separate promotion step    | Users should test AI-built widgets before sharing. Publish from Settings > Widgets when ready.                     |
| 2026-04-03 | Remix attribution in dash.json             | `remixedFrom` field tracks original author/widget. Registry displays credit. Similar to 3D printing remix culture. |

---

## Out of Scope

-   **Multi-LLM support** — OpenAI, Google, local models. Deferred to v2.
-   **Interpreted hot-reload** — All builds go through esbuild. No eval-based rendering.
-   **Autonomous agent** — Assistant responds to requests, doesn't proactively modify dashboards.
-   **Widget marketplace curation** — No quality review for published AI-built widgets beyond `validateWidget.cjs`.
-   **Code editor view** — Users don't see/edit generated source code directly. AI handles code changes conversationally.

**Future Considerations:**

-   Multi-LLM backends via extended `llmController`
-   AI-powered event wiring between widgets
-   Template generation from AI conversations ("save this dashboard setup as a template")
-   Widget dependency management (AI widget that needs a new npm package)

---

## Implementation Phases

### Phase 1: AI Assistant Settings + LLM Connection (P0)

**Deliverables:**

-   [ ] US-001: Settings > AI Assistant tab
-   [ ] Auto-detect Claude Code CLI
-   [ ] API key entry (reuses provider system)
-   [ ] Backend preference stored in `settings.json`
-   [ ] New IPC: `ai-assistant:get-config`, `ai-assistant:set-config`

**Success Criteria:** User can configure and verify LLM connection from within the app.

### Phase 2: AI Sidebar Assistant (P0)

**Deliverables:**

-   [ ] US-002: Right-side `AiAssistantPanel` component
-   [ ] Pre-loaded with Dash MCP tools as system context
-   [ ] Context-aware (active dashboard, placed widgets)
-   [ ] Popout to standalone window support
-   [ ] Toggle button in toolbar

**Success Criteria:** User can have a conversation with the assistant that creates/modifies dashboards using MCP tools.

**Dependencies:** Phase 1

### Phase 3: Inline Widget Builder (P0)

**Deliverables:**

-   [ ] US-003: `WidgetBuilderModal` component
-   [ ] Split-pane: chat + live preview
-   [ ] Code generation → esbuild → preview render loop
-   [ ] "Add to Grid" installs to `@ai-built/` scope
-   [ ] "Build with AI" option in grid cell "+" menu

**Success Criteria:** User describes a widget in natural language → working widget added to dashboard.

**Dependencies:** Phase 1, Phase 2 (shared ChatCore infrastructure)

### Phase 4: Remix + Publish + Troubleshooting (P1)

**Deliverables:**

-   [ ] US-004: Remix existing widgets
-   [ ] US-005: Publish AI-built widgets to registry
-   [ ] US-006: AI troubleshooting for widget errors

**Success Criteria:** Full widget lifecycle from build → test → remix → publish.

**Dependencies:** Phase 3

---

## Revision History

| Version | Date       | Author            | Changes                                |
| ------- | ---------- | ----------------- | -------------------------------------- |
| 1.0     | 2026-04-03 | John Giatropoulos | Initial draft from design conversation |
