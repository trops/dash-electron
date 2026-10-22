# PRD: In-App AI Assistant & Widget Builder

**Status:** In Progress — US-001 (Settings › AI) and US-006 (as Fix <widget>) Implemented; US-005 partly built (see it). **Retired:** the right-side AI Assistant panel (US-002, Phase 2; create-entry 5e-2c, 2026-10-14) and the Widget Builder's own AI chat, Remix and Discover (US-003, US-004, US-007; consolidation Phase 3b, 2026-10-21). Their stories are in the Appendix. The Widget Builder is the by-hand tool (create-entry CRE-010 AC6); every AI build or change goes through the Dash team in Create.
**Last Updated:** 2026-10-22
**Owner:** John Giatropoulos
**Related PRDs:** None

> **Panel retired (create-entry 5e-2c, 2026-10-14).** The wand button and the AI Assistant panel are gone from the right-hand rail; asking and making things both happen in **Create** (create-entry PRD CRE-007 AC4). What the panel did, and where it lives now:
>
> | The panel could…                                               | Now                                                        |
> | -------------------------------------------------------------- | ---------------------------------------------------------- |
> | Add a widget or bot to a dashboard, switch a dashboard's theme | A Create plan for that dashboard (5e-2b)                   |
> | Make a new dashboard                                           | A Create plan                                              |
> | Ask a team lead                                                | The lead's Conversation: Bots panel › Pinned (Phase 4a)    |
> | Answer questions about bots and dashboards                     | The Dash team page: Bots panel › Pinned › Dash team        |
> | Remove, move or resize widgets; set layouts                    | Edit mode on the dashboard                                 |
> | Add or remove providers                                        | The Providers page                                         |
> | Make a theme from a description                                | Create › Theme                                             |
> | Make a theme from a website; delete dashboards                 | The Themes and Dashboards pages                            |
> | Chat with your connected tools                                 | A dashboard's team lead (no general-purpose chat any more) |
>
> (The "Ask box" and To: picker that first replaced the panel in Create were removed in consolidation Phase 4a, 2026-10-21: you ask the Dash team or a lead from the Bots panel.)
>
> **The Widget Builder's chat retired too (consolidation Phase 3b, 2026-10-21).** Every AI widget build or change goes through the Dash team in Create (create-entry CRE-005 AC3, CRE-014): the Scout, the Planner, the Builder's draft, the Checker and a preview before anything is installed. The Widget Builder keeps Compose, Code, Preview, Configure, Logs, Style checks (named Console and Scorecard until Phase 4d), drafts and the checked Install, with no AI of its own; Compose's "describe it" hands off to Create. Discover's job (find a widget you have or one in the registry) is the Scout's, and browsing the registry is Widgets › Search for Widgets.
>
> Kept: ChatCore (the sample Chat widgets use it), Settings › AI (renamed from "AI Assistant"; Create and the Widget Builder use it), and Dash's MCP server for outside apps — its `ask_team_lead` runs now say "Asked through Dash's MCP server". Assistant chats were never saved past the window, so there's no history to move.

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
**Status:** Implemented (Settings › AI — the section was "AI Assistant" until the panel retired; dash-core `src/Components/Settings/sections/AiAssistantSection.js`). Create, the Dash team and the Widget Builder use it.

**Acceptance Criteria:**

-   [x] AC1: If Claude Code CLI is installed, AI features work immediately with no configuration (Connection Status shows "Available at …")
-   [x] AC2: If CLI is not available, user can enter an Anthropic API key via Settings › AI
-   [x] AC3: API keys are stored encrypted using the existing provider system (`safeStorage`) — saved as an Anthropic credential provider
-   [x] AC4: If user already has an Anthropic provider (from Chat widget), it is reused automatically
-   [x] AC5: Settings › AI shows: connection status, preferred backend, API key (if Anthropic), model selector. Settings are saved in app settings under `aiAssistant`.
-   [x] AC6: The model selector is populated dynamically (live Anthropic Models API fetch with a curated fallback), has a Refresh action, and auto-migrates a retired saved model to a current replacement with a one-time notice. Default model: `claude-opus-4-8`. Implemented 2026-06-24 (dash-core `electron/llm/modelProviders.js` provider registry + `LLM_LIST_MODELS` IPC; renderer `src/utils/modelMigration.js`).

**Technical Notes:**
Reuse `llmController` + `cliController` from `dash-core/electron/controller/`. Store preference in `settings.json`. Reuse `providerController` for API key encryption.

---

**US-002: AI Assistant Panel** — Retired. Superseded by Create and the Dash team (create-entry CRE-007; the table at the top) (2026-10-22). Original story: Appendix A.

---

**US-003: Build Widget with AI** — Retired (was Implemented, v0.0.338–v0.0.345). Superseded by the Dash team building widgets in Create, and empty cell → Build with AI (create-entry CRE-005 AC3, CRE-008) (2026-10-22). Original story: Appendix A.

---

### Should-Have (P1)

**US-004: Remix Existing Widget** — Retired (was Implemented). Superseded by Change <widget> in Create (create-entry CRE-014): your own widget changes in place, everywhere it's used; anyone else's becomes a new widget in that cell. AC4 ("original untouched") no longer holds for your own widgets (2026-10-22). By hand, Edit the code yourself. Original story: Appendix A.

---

**US-007: Discover Registry Widgets Before Building** — Retired (was Implemented). Superseded by the Scout looking first (create-entry CRE-005 AC3) and the Widgets page's registry search (2026-10-22). Original story: Appendix A.

---

**US-005: Publish AI-Built Widget**

> As a Solutions Engineer,
> I want to publish my AI-built widget to the registry,
> so that my team can install and use it.

**Priority:** P1
**Status:** Partly built — publishing lives on the Widgets page (dash-core app-navigation NAV-012), not Settings › Widgets.

**Acceptance Criteria:**

-   [x] AC1: The Widgets page shows **Publish…** (or **Publish new version…**) on your own and AI-built packages (dash-core `AppPages/WidgetsPage.js` → `PublishWidgetModal`)
-   [ ] AC2: Publish validates widget structure via `validateWidget.cjs` — not wired into the in-app publish
-   [ ] AC3: User provides metadata (display name, description, icon) — the dialog shows what the widget's config already says
-   [x] AC4: Widget published under `@username/` (the dialog shows "publishing as @username/…")
-   [x] AC5: Publishes through the registry (`mainApi.registry.publishWidget`; requires registry sign-in)
-   [ ] AC6: Remix attribution preserved in registry listing

**Technical Notes:**
Original plan reused `scripts/publishToRegistry.js` and `scripts/validateWidget.cjs`; the in-app publish uses dash-core's `widgetRegistryController` instead.

---

**US-006: AI Troubleshooting**

> As a Dashboard Creator,
> I want the assistant to diagnose widget errors and suggest fixes,
> so that I can resolve issues without developer help.

**Priority:** P1
**Status:** Implemented as **Fix <widget>** (consolidation Phase 3). A failing installed widget shows **Fix <name>**; it opens Create › Change <widget> with the error and "Fix the error so it works again." (dash-core `Widget/canFixWithAi.js`, `Create/CreateEdit.js`). A missing connection shows on the card as a pill instead (create-entry CRE-015 AC9).

**Acceptance Criteria:**

-   [x] AC1: The error is sent with the fix request (`fixRequestDetail`)
-   [x] AC2: A missing connection or unconnected listener shows as the card's pill and opens the widget panel at the fix (no AI needed)
-   [x] AC3: The Dash team's Scout says what the widget does now, and the Planner plans the fix
-   [x] AC4: Nothing is installed until the user previews the fix (code and all) and accepts it

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

| Backend         | Auth                 | Setup                              |
| --------------- | -------------------- | ---------------------------------- |
| Claude Code CLI | Pro/Max subscription | Auto-detected, zero config         |
| Anthropic API   | API key (encrypted)  | Settings › AI or existing provider |

### UI Layout

Superseded by the panel's retirement (US-002) (2026-10-22): asking and making happen in Create and the Bots panel. Original sketch:

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

**Now (2026-10-21, consolidation Phase 3b; wording Phase 4d):** **Widget Builder · Build by hand** — Preview / Code / Configure / **Logs** / **Style checks** (were Console / Scorecard) on the left; the name commits on Enter or when you leave the field (no Save button; "Saved when you press Enter or click away." while it differs; a name that can't be used shows why and the widget keeps its old one), and Category says what it's for ("where the widget is listed when you publish it"); on the right, Compose for a new widget (hidden when editing an installed widget's code, which opens on Code). No chat, provider question or Discover. See create-entry CRE-010 AC6. (The 2026-10-13 layout with the Build chat and Discover: Appendix A.)

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

| Date       | Decision                                         | Rationale                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-03 | Anthropic + Claude Code CLI only for v1          | Both already work end-to-end. Add OpenAI/others later.                                                                                                                                                                                                                                                   |
| 2026-04-03 | Full esbuild pipeline for widget builds          | Same as registry widgets. ~1-2s per iteration. Production-ready output. No new eval system.                                                                                                                                                                                                              |
| 2026-04-03 | `@ai-built/` scope in existing widgets dir       | Leverages all existing registry infrastructure. No new storage system.                                                                                                                                                                                                                                   |
| 2026-04-03 | Right-side panel (not left sidebar)              | Left sidebar = navigation. Right side = helpers (widget picker, assistant). Clear separation.                                                                                                                                                                                                            |
| 2026-04-03 | Publishing is a separate promotion step          | Users should test AI-built widgets before sharing. Publish from Settings > Widgets when ready.                                                                                                                                                                                                           |
| 2026-04-03 | Remix attribution in dash.json                   | `remixedFrom` field tracks original author/widget. Registry displays credit. Similar to 3D printing remix culture.                                                                                                                                                                                       |
| 2026-04-04 | CLI tool-free mode for widget builder            | System prompt prohibits all tools (Skill, Read, Write, Bash). CLI outputs code blocks only; modal handles compilation. Prevents permission dialogs and blank responses in embedded UI.                                                                                                                   |
| 2026-04-04 | No cwd sandbox for CLI                           | Attempted sandboxing CLI to `@ai-built/` directory but it broke project context (blank responses). CLI runs in project directory with tool-free prompt instead.                                                                                                                                          |
| 2026-04-05 | LayoutBuilder event for cell placement           | Widget placed via `dash:place-widget-in-cell` CustomEvent. LayoutBuilder modifies its own React state directly using `addItemToItemLayout`. No stageKey++, no workspace file save, no app refresh.                                                                                                       |
| 2026-04-05 | Tailwind dev exclusion                           | Widget cache path excluded from tailwind content in dev mode (`NODE_ENV !== 'production'`) to prevent webpack rebuilds when AI widgets are installed at runtime.                                                                                                                                         |
| 2026-04-05 | Skip widget:installed broadcast for cell context | When installing with cell context, the `widget:installed` IPC broadcast is skipped entirely. The broadcast triggers `handleWidgetInstalled` → `stageKey++` → full app refresh, which is unacceptable UX. Widget component registered manually via `readBundle` + `registerBundleConfigs` on modal close. |

---

## Implementation Notes (Phase 3: Widget Builder)

### Shipped Versions

| Version  | Date       | Description                                                                        |
| -------- | ---------- | ---------------------------------------------------------------------------------- |
| v0.0.338 | 2026-04-04 | `widgetize --output-dir` flag, skill updated to target `@ai-built/`                |
| v0.0.339 | 2026-04-04 | `@ai-built/` directory created on startup (fixed ENOENT)                           |
| v0.0.340 | 2026-04-04 | System prompt prevents CLI file writes                                             |
| v0.0.341 | 2026-04-04 | Removed cwd sandbox, restored project context                                      |
| v0.0.342 | 2026-04-04 | Prevented CLI from using tools/skills (fixed blank responses)                      |
| v0.0.343 | 2026-04-04 | Removed broken sanity check, single-block recompilation, "Send error to AI" button |
| v0.0.344 | 2026-04-05 | Pre-install cleanup of stale builds, `onInstalled` callback                        |
| v0.0.345 | 2026-04-05 | Auto-place widget in cell without app refresh (cross-repo: dash-core v0.1.321)     |

### Architecture Decisions

**1. Tool-Free CLI Mode**
The Claude Code CLI, when invoked from the widget builder modal, runs with `--append-system-prompt` that explicitly prohibits all tool use. The CLI generates code blocks as text; the modal's `extractCodeBlocks` function parses them and the `compilePreview` IPC handler compiles them. This avoids permission dialogs (Write/Bash tools) and skill invocations (dash-widget-builder) that cause blank responses in the embedded UI.

**2. Widget Placement via LayoutBuilder Event**
The `dash:place-widget-in-cell` CustomEvent is dispatched from `Dash.js` when the modal closes. LayoutBuilder in dash-core listens for this event and uses `addItemToItemLayout` (the same function used by the normal "Add widget" button) to modify its own `currentWorkspace` React state. This triggers a re-render that shows the widget in the cell. No workspace file save, no stageKey remount, no IPC broadcasts.

**3. Widget Registration on Modal Close**
When the modal closes after a successful install:

1. `readBundle(scopedName)` reads the compiled CJS bundle from `@ai-built/`
2. `registerBundleConfigs(scopedName, source)` registers the widget component in the renderer's `ComponentManager`
3. `dash:place-widget-in-cell` event places it in the grid cell
4. LayoutBuilder auto-saves the workspace on its own schedule

**4. Tailwind Dev Exclusion**
The `tailwind.config.js` content array conditionally excludes the widget cache path in dev mode (`process.env.NODE_ENV !== 'production'`). Installing AI widgets writes new `.js` files to the cache directory; without this exclusion, webpack's file watcher detects them and triggers a full page rebuild.

### Lessons Learned

1. **Don't fight the framework's state management.** Multiple attempts to modify workspace files directly and then reload failed because LayoutBuilder manages its own React state. The working solution uses LayoutBuilder's existing `addItemToItemLayout` function via an event — working WITH the framework, not around it.

2. **IPC broadcasts are nuclear.** `widget:installed` and `workspace:saved` broadcasts trigger cascading re-renders (themes, settings, providers, workspaces all reload). Any operation that happens while the widget builder modal is open must avoid these broadcasts entirely.

3. **The tailwind content watcher causes webpack rebuilds.** Writing files to any directory in the tailwind `content` array triggers a full webpack rebuild in dev mode, which reloads the Electron window. This is invisible in the terminal (`[0] Rebuilding...` is easy to miss).

---

## Out of Scope

-   **Multi-LLM support** — OpenAI, Google, local models. Deferred to v2. _Groundwork laid 2026-06-24:_ model discovery is now provider-pluggable via a registry (`dash-core/electron/llm/modelProviders.js`) keyed by vendor — each provider supplies its own `listModels`, curated fallback, retired-id map, and default. Only `anthropic` is implemented; adding OpenAI/Google later is a new registry entry (the `openai` SDK already ships in dash-electron) with no change to the `LLM_LIST_MODELS` IPC or the Settings UI.
-   **Interpreted hot-reload** — All builds go through esbuild. No eval-based rendering.
-   **Autonomous agent** — Assistant responds to requests, doesn't proactively modify dashboards.
-   **Widget marketplace curation** — No quality review for published AI-built widgets beyond `validateWidget.cjs`.
-   ~~**Code editor view**~~ — Superseded by the Widget Builder's Code tab and Create's code preview (CRE-010 AC6, CRE-014) (2026-10-22).

**Future Considerations:**

-   Multi-LLM backends via extended `llmController`
-   AI-powered event wiring between widgets
-   Template generation from AI conversations ("save this dashboard setup as a template")
-   Widget dependency management (AI widget that needs a new npm package)

---

## Implementation Phases

### Phase 1: AI Assistant Settings + LLM Connection (P0) — ✅ Implemented

**Deliverables:**

-   [x] US-001: Settings › AI section
-   [x] Auto-detect Claude Code CLI (`mainApi.llm.checkCliAvailable`)
-   [x] API key entry (reuses provider system)
-   [x] Backend preference stored in app settings (`aiAssistant`)
-   [x] ~~New IPC: `ai-assistant:get-config`, `ai-assistant:set-config`~~ — not needed; the section reads and writes app settings

**Success Criteria:** User can configure and verify LLM connection from within the app.

### Phase 2: AI Sidebar Assistant (P0) — Retired

Superseded by Create and the Dash team (create-entry CRE-007) (2026-10-22). The panel shipped and was retired in create-entry 5e-2c (2026-10-14). Original deliverables: Appendix A.

### Phase 3: Inline Widget Builder (P0) — ✅ Implemented, then retired (consolidation Phase 3b, 2026-10-21; the builder's AI chat is gone)

**Deliverables:**

-   [x] US-003: `WidgetBuilderModal` component (v0.0.338)
-   [x] Split-pane: live preview (2/3) + chat (1/3)
-   [x] Code generation → esbuild → preview render loop (v0.0.343)
-   [x] "Install Widget" installs to `@ai-built/` scope (v0.0.344)
-   [x] "Build with AI" button in empty grid cells (dash-core 0.1.318)
-   [x] Auto-place widget in cell on modal close (v0.0.345, dash-core 0.1.321)
-   [x] "Send error to AI" button for compilation errors (v0.0.343)
-   [x] Single-block fix detection for iterative development (v0.0.343)

**Success Criteria:** ✅ User describes a widget in natural language → working widget added to dashboard cell without app refresh.

**Dependencies:** Phase 1 (partial — Claude Code CLI auto-detect works, settings UI not yet built)

### Phase 4: Remix + Publish + Troubleshooting (P1)

**Deliverables:**

-   [x] US-004: Remix existing widgets (retired; now Change <widget>, CRE-014)
-   [ ] US-005: Publish AI-built widgets to registry (partly built: AC1, AC4, AC5)
-   [x] US-006: AI troubleshooting for widget errors (as Fix <widget>)

**Success Criteria:** Full widget lifecycle from build → test → change → publish.

**Dependencies:** Phase 3

---

## Revision History

| Version | Date       | Author            | Changes                                                                                                                                                                                                                                                                                                                  |
| ------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-04-03 | John Giatropoulos | Initial draft from design conversation                                                                                                                                                                                                                                                                                   |
| 1.1     | 2026-04-05 | John Giatropoulos | Phase 3 implemented (v0.0.338–v0.0.345, dash-core v0.1.321). Added implementation notes, architecture decisions, and lessons learned.                                                                                                                                                                                    |
| 1.2     | 2026-04-19 | John Giatropoulos | Added US-007: Discover tab in Widget Builder. Ships read-only preview + install; remix wiring deferred. Depends on dash-core v0.1.388 (`fetchPackageSource`).                                                                                                                                                            |
| 1.3     | 2026-10-21 | John Giatropoulos | Consolidation Phase 3b: the Widget Builder's AI chat (US-003, US-004) and Discover (US-007) retired — AI builds and changes go through the Dash team in Create; the builder is for building by hand.                                                                                                                     |
| 1.4     | 2026-10-22 | John Giatropoulos | Consolidation Phase 5 reconciliation: US-001 and Phase 1 ticked (Settings › AI); US-002, US-003, US-004, US-007 and Phase 2 marked Retired, stories moved to Appendix A; US-005 partly built (Widgets page Publish); US-006 built as Fix <widget>; Logs / Style checks names; asking moved to the Bots panel (Phase 4a). |

---

## Appendix A: history

Retired stories and sketches, kept as written before they were superseded.

### US-002: AI Assistant Panel (retired 2026-10-14)

> As a user,
> I want a persistent AI assistant panel on the right side of the app,
> so that I can get help with dashboard tasks without leaving my workflow.

**Priority:** P0
**Status:** Backlog (the panel shipped without these boxes being ticked, then retired in create-entry 5e-2c)

**Acceptance Criteria:**

-   [ ] AC1: Assistant panel slides in from the right side (same side as WidgetSidebar in edit mode)
-   [ ] AC2: Panel has a toggle button in the toolbar/header area
-   [ ] AC3: Assistant has access to all Dash MCP tools (dashboard, widget, theme, provider, layout management)
-   [ ] AC4: Assistant knows the active dashboard context (which dashboard is open, what widgets are placed)
-   [ ] AC5: Chat history persists within the session
-   [ ] AC6: Panel can be popped out into a standalone window

**Technical Notes:**
Build on `ChatCore.js` engine. Pre-configure system prompt with Dash capabilities. Enable all MCP tools by default. Use `DashboardPublisher` IPC bridge for cross-window events if popped out.

**Phase 2 deliverables (as planned):**

-   [ ] US-002: Right-side `AiAssistantPanel` component
-   [ ] Pre-loaded with Dash MCP tools as system context
-   [ ] Context-aware (active dashboard, placed widgets)
-   [ ] Popout to standalone window support
-   [ ] Toggle button in toolbar

**Success Criteria:** User can have a conversation with the assistant that creates/modifies dashboards using MCP tools.

**UI layout sketch:** see Architecture › UI Layout above.

### US-003: Build Widget with AI (retired 2026-10-21)

> As a Solutions Engineer,
> I want to describe a widget in natural language and get a working result with live preview,
> so that I can create custom widgets without writing code.

**Priority:** P0
**Status:** Implemented, then retired

**Acceptance Criteria:**

-   [x] AC1: Grid cell "+" menu includes "Build with AI" option (v0.0.338, dash-core 0.1.318)
-   [x] AC2: Opens a modal with split pane: live preview (left 2/3) + chat (right 1/3) (v0.0.338)
-   [x] AC3: AI generates `.js` component + `.dash.js` config from natural language description (v0.0.342)
-   [x] AC4: Each iteration compiles via esbuild and renders in the preview pane (v0.0.343)
-   [x] AC5: User can iterate conversationally — single-block fixes supported (v0.0.343)
-   [x] AC6: "Install Widget" installs to `@ai-built/` scope, "Done" places it in the selected cell (v0.0.345)
-   [x] AC7: Widget uses `@trops/dash-react` components and `@trops/dash-core` hooks (externalized in esbuild)

**Technical Notes:**
Widget files go to `{userData}/widgets/@ai-built/{widget-name}/`. Use existing `widgetRegistry.installFromLocalPath()` for installation. esbuild compilation uses same pipeline as registry widgets. Preview uses `evaluateBundle()` + `extractWidgetConfigs()` from `dash-core`.

### US-004: Remix Existing Widget (retired 2026-10-21)

> As a user,
> I want to customize an existing widget using AI,
> so that I can adapt it to my specific needs without starting from scratch.

**Priority:** P1
**Status:** Implemented, then retired

**Acceptance Criteria:**

-   [x] AC1: "Edit with AI" button on widget cell header in layout edit mode opens the widget builder modal
-   [x] AC2: Original widget source is pre-loaded as AI context (Code tab + chat seed)
-   [x] AC3: AI generates a forked version under `@ai-built/` scope
-   [x] AC4: Original widget is untouched — remix is a separate installation under `@ai-built/`
-   [x] AC5: Remix metadata tracks attribution (`remixedFrom` in `dash.json`) for non-AI-built widgets

**Technical Notes:**
Uses `widget:read-sources` IPC (dash-core 0.1.322+) to read `.js` + `.dash.js` source files. "Edit with AI" wand button added to `WidgetCardHeader` in layout edit mode. On remix, widget is installed to `@ai-built/` and the cell's widget is swapped in-place via `dash:swap-widget-in-cell` event (no page refresh). Attribution is only added when remixing a non-`@ai-built/` widget.

### US-007: Discover Registry Widgets Before Building (retired 2026-10-21)

> As a user opening the Widget Builder,
> I want to search the Dash registry for existing widgets and preview them inline,
> so that I can install a battle-tested widget instead of re-generating one from scratch.

**Priority:** P1
**Status:** Implemented (read-only preview + install), then retired

**Acceptance Criteria:**

-   [x] AC1: Widget Builder modal opens on a new **Discover** tab by default (existing Edit-with-AI flow still opens on Preview)
-   [x] AC2: Discover tab has a search input that queries the registry via `mainApi.registry.search(query, { type: "widget" })`
-   [x] AC3: Search results render as cards (displayName, scoped ID, description, "Installed" badge when applicable)
-   [x] AC4: Clicking a card fetches the package source via a new `mainApi.registry.previewFetch` IPC and renders the live widget in the Preview tab (no installation)
-   [x] AC5: Preview footer shows an Install button that calls existing `mainApi.widgets.install` and surfaces the standard success screen
-   [x] AC6: A disabled **Remix** button is rendered next to Install with tooltip "Remix is coming in a follow-up release" (wiring deferred)
-   [x] AC7: A "Back to Discover" link is visible while previewing a registry widget
-   [ ] AC8: Remix button wired — hand off registry source to the existing Edit-with-AI flow, fork to `@ai-built/` with attribution (never built)

**Technical Notes:**
Added `fetchPackageSource(packageName)` in dash-core `electron/controller/registryController.js` (shipped v0.1.388). Downloads package ZIP to a temp dir with `validateZipEntries()`, reads `widgets/*.js`, `widgets/*.dash.js`, and optionally `dist/index.cjs.js`, then cleans up. Exposed via `mainApi.registry.previewFetch`. The dash-electron `WidgetBuilderModal` compiles the returned source through the existing `compilePreview` pipeline so the registry widget renders exactly the same way an AI-built one does.

### Widget Builder layout (2026-10-13, design audit screen 3a — before Phase 3b)

The builder was one raised modal surface: a panel header (title, quiet ✕), Preview / Code / Configure / Console / Scorecard as underline tabs on the left (2/3), and Build | Compose plus "Discover existing" on the right (1/3), with both header rows the same height so their hairlines line up. The Build pane opened on its message box ("Describe the widget you want"). Sending asked "Which data should this widget use?" with likely choices; the chat started with the description as its first message once the data was picked. "Pick the data first…" opened the full list: rows with an icon, a readable name and "Not set up yet" / "Set up · N accounts", plus a filter. A type with no account asked before going on (set up, skip, or pick something else). The install bar used a Category menu and a primary Install button.
