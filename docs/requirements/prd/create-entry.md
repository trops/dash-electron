# PRD: Create — One Entry for Making Dashboards, Widgets, Bots and Themes

**Status:** In Progress
**Last Updated:** 2026-10-11
**Owner:** John Giatropoulos
**Location:** dash-electron (Create and Edit modals, AI Assistant, Widget Builder); dash-core (Dash team bots, planner tools, bot/dashboard APIs, usage)
**Related PRDs:** [ai-assistant.md](./ai-assistant.md), dash-core `team-dashboards.md` (bots report results, widgets start bots, one plan from a goal), dash-core `bot-teams.md` (teams, leads), dash-core `bot-factory.md` (budgets, usage), dash-core `app-navigation.md`
**Mockup:** Design canvas "Dash Create — unified entry": 1 Start, 2 Conversation + plan, 3 Building, 4 Edit (by hand or with AI), 5 Sidebar

---

## Executive Summary

Making things in Dash has grown seven separate entry points with different first screens: the New Dashboard modal (four options), the Dashboard Wizard, the AI Assistant panel, the Widget Builder (from the Widgets page, an empty cell, or Edit with AI), the New Bot form and the team lead's drafts. Users, and the people building Dash, lose track of which to use.

**Create** replaces them with one full-screen modal. It opens on a single prompt ("What do you want to make?") with **Type** and **Where** under it, a row to start **without AI** (blank, import, registry), and starters to remix. Once the conversation starts, the prompt moves up and a **plan** appears beside it: bots, widgets, layout, what you must approve (installs, sign-ins), and the estimated cost. Nothing is created until **Build**.

The work is done by **your Dash team**: built-in bots with one role each (Planner, Scout, Builder, Checker), their own instructions, tools, permissions and model. The user sees who did what, with which model, and what it cost.

**Editing** uses the same modal: the whole dashboard on the left, editable by hand; click a widget or bot to select it; the right panel has **Add** (your widgets and the registry) and **Ask AI**, plus the selection's own settings. The pencil opens on Add; Edit with AI opens on Ask AI.

---

## Problem Statement

-   **Too many doors.** Seven entry points, each built at a different time. The Widget Builder opens on drafts, then a provider-type list, before the user can type.
-   **No whole-goal path.** Nothing makes bots, widgets and a dashboard together from one goal (team-dashboards TD-007/TD-008).
-   **One AI does everything.** A single assistant plans, searches, builds and judges its own work, with every permission at once, on one model.
-   **Cost is invisible.** Users can't tell what building a dashboard, or running its bots, will cost.
-   **Editing is scattered.** Edit with AI, Configure, the bot form and Dashboard Config are separate places.

## Goals

-   One place to start making anything, with a path that never needs AI.
-   A plan before building; installs and sign-ins approved before Build, never mid-build.
-   Work split across role bots with least privilege and a model suited to each job.
-   Cost and model visible before, during and after.
-   One edit mode for by-hand and AI changes, with one Save and Cancel.

## Non-Goals

-   Replacing the Bots, Widgets and Dashboards pages as places to browse and manage.
-   Doing setup for the user: provider sign-in and permission grants stay the user's.

---

## User Stories

### CRE-001: One start screen (P0)

-   [x] AC1: A single Create modal, full screen with a margin, opens from the left rail's **+** and from Cmd/Ctrl+K "Create…". (2a: the rail's + is labelled Create; "Create…" is in the command palette. The palette still opens by click — nothing binds ⌘K yet.)
-   [x] AC2: It opens with the cursor in one prompt box, a heading and a one-line explanation.
-   [~] AC3 (2a: Type is a `ChoiceMenu` (dash-react) with Widget, Bot, and Dashboard/Theme disabled with a hint; **+** attach and **Where** not yet — a new bot picks its dashboard in the form's Team field): Under the box: **+** (attach a provider or file), **Type** (Auto, Dashboard, Widget, Bot, Theme) and **Where** (New dashboard, or an existing one). Both are menus (`aria-haspopup`, `aria-expanded`). Type Dashboard + Where existing means "add to that dashboard".
-   [x] AC4 (2a: shown for Widget; writes `settings.aiAssistant.preferredBackend`, the same setting as Settings › AI Assistant, via `useAiBackend`): An **AI** picker beside Send shows the provider in use ("AI: Claude Code") and lets the user change it. With no AI configured it says so and links to set one up; the no-AI row still works.
-   [x] AC5: **Or start without AI:** Blank dashboard (opens Edit on Add), Import from file, Browse registry. (2a: also New theme; Widget adds Browse widgets / Install from file / Load from folder, Bot adds Fill in the bot form.)
-   [~] AC6 (2a: Enter sends — Widget opens the Widget Builder with the prompt as its first, visible message; Bot opens the bot form. The conversation inside Create comes with 2c): Enter starts the conversation; the prompt moves to the top.

### CRE-002: Starters (P2 — after result-aware packaging)

-   [ ] AC1: Starters below the prompt, filtered by category tabs.
-   [ ] AC2: Each shows a name, one line, what it makes and what it needs (named providers, never "your CRM").
-   [ ] AC3: Picking one opens its plan (Remix); it never builds directly.
-   [ ] AC4: Starters come from registry dashboard packages with bots (bot-factory US-027). **Depends on** team export and bot packages carrying `publishes` and result wiring (team-dashboards follow-up).

### CRE-003: A plan before building (P1)

-   [ ] AC1: For a Dashboard, the Planner asks at most a few clarifying questions as tappable answers, then shows the **Plan**: Bots, Widgets, Layout, **Before building**, **Estimated cost**.
-   [ ] AC2: Each plan item is editable from the panel or by asking.
-   [ ] AC3: **Before building** lists every install (with what it can access) and every sign-in, each with its own button (Review & approve, Connect). The Build button names what's still open ("Connect Gmail & build"); pressing it walks through them first. Nothing pops up during the build.
-   [ ] AC4: Nothing is created or installed until Build. Back, Close and Save draft keep the plan under Recent, and the header says so.
-   [ ] AC5: The plan says what the bots can and can't do ("can read email; none can send email").
-   [ ] AC6: Preview shows the dashboard with sample data (P2).

### CRE-004: Building with progress (P1)

-   [ ] AC1: Steps — install & connect, create bots, build widgets, place, wire, **check the work**, first run — each showing which team member did it, the model, tokens and cost.
-   [ ] AC2: A live preview fills in as steps finish.
-   [ ] AC3: **Stop** halts after the current step; what's built is kept as a draft in Recent.
-   [ ] AC4: A failed step shows what failed and offers **Let Builder fix it**, **Edit plan** and **Remove what was built**. Finished steps are kept.
-   [ ] AC5: Steps that need a provider the user skipped wait ("waiting for Gmail") instead of failing.
-   [ ] AC6: When done, **Go to dashboard** opens the live dashboard (not the editor), and the header compares actual cost with the estimate.

### CRE-005: Single things stay quick (P0)

-   [x] AC1 (2a: Bot → the bot form inside Create; 2c-3: Widget → the Widget Builder inside Create under "Create › New widget", ← Back keeps the prompt; Theme still opens the theme editor from the no-AI row): Type Widget, Bot or Theme skips the multi-part plan: the conversation builds that one thing with its preview beside it (today's Widget Builder and bot form, inside the modal).
-   [x] AC2 (2c-1: after the prompt, "Which data should this widget use?" with types guessed from the prompt, No external provider and Choose another…; the pick still precedes the chat so the AI's instructions name the type): Provider choice happens in the conversation, not as a list before typing.

### CRE-006: Editing in the same modal (P0)

Decided 2026-10-10: editing uses the same full-screen modal; no scope toggle — you click what you want to change.

-   [x] AC1: Edit shows the whole dashboard on the left (with page tabs for paged dashboards), every widget plus a **Bots on this dashboard** row showing each bot's model and cost this month.
-   [x] AC2: Nothing selected = the dashboard. Clicking a widget or bot selects it. Selecting a widget highlights the bot that feeds it; selecting a bot highlights the widgets it feeds; unrelated items dim.
-   [x] AC3: The header breadcrumb ("Inbox triage › Important emails · widget") shows the selection; clicking the dashboard name goes back.
-   [x] AC4 (dash-core #718 v0.1.733): Selecting while on **Add** or a settings tab opens the selection's settings (widget: Settings; bot: Instructions). Only Ask AI stays on Ask AI. A by-hand user never lands in a chat by clicking.
-   [x] AC5 (widget: Settings / Listeners / Providers / Code inline — dash-core #718; bot: Instructions / Runs / Access, one form, staged for the dashboard's Save with keepLatest — dash-core #719; notifications/schedule behind "More settings…"): The selection's no-chat tabs: widget Settings, Listeners, Code; bot Instructions, Runs, Access; dashboard Theme. (Layout is the left side itself.)
-   [x] AC6: All changes — by hand or by AI, to widgets, bots or layout — are **staged** until Save. Bot hints say "applies after you save".
-   [x] AC7: **Cancel** confirms, listing what will be discarded and what is kept (registry installs stay installed).
-   [ ] AC8: Adding bots or widgets through Ask AI comes back as a plan (needs CRE-003; until then Ask AI changes one selected widget or bot).
-   [ ] AC9: In the real app widgets render as themselves under a selection overlay — not wrapped in a button — so their own buttons keep working while editing.

### CRE-007: Sidebar and Recent (P1)

-   [ ] AC1: Any Create conversation can fold into the right sidebar and expand back.
-   [ ] AC2: Recent lists every conversation with live status (building 3/7 · $0.55, draft plan, edit saved, answered); each is a link.
-   [ ] AC3: Folding an Edit session with unsaved changes keeps a "Editing · unsaved" banner on that dashboard until saved or cancelled.
-   [ ] AC4: The AI Assistant panel becomes this sidebar (P2): questions and making things share one list.

### CRE-008: Old entry points become shortcuts (P0)

| Today                              | Becomes                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **+** → New Dashboard modal (2a ✓) | Create. Blank, Import and Registry are the "start without AI" row. The Wizard is retired: its steps become the plan. |
| Widgets page → New Widget (2a ✓)   | Create, Type: Widget                                                                                                 |
| Empty cell → Build with AI         | Edit modal, that cell selected, Ask AI                                                                               |
| Empty cell → Add widget            | Edit modal on **Add**, no AI                                                                                         |
| Dashboard pencil                   | Edit modal on **Add**, nothing selected                                                                              |
| Widget menu → Edit with AI         | Edit modal on **Ask AI**, that widget selected                                                                       |
| Bots page → New Bot (2a ✓)         | Create, Type: Bot (the form remains as a tab)                                                                        |
| Team lead "add a bot"              | Create, Type: Bot, Where: that dashboard                                                                             |
| AI Assistant panel                 | The sidebar (CRE-007 AC4)                                                                                            |

### CRE-009: Reuse before building (P1)

Every planned piece — widgets **and bots** — is resolved in one order, and the plan says which:

-   [ ] AC1: **Yours first:** installed widgets, your own (`@<you>/…`, `@ai-built/…`) and existing bots. Tagged **Yours**.
-   [ ] AC2: **Then the registry:** widget packages, dashboard packages and bot templates. Tagged **Registry · install**. A registry widget is only matched to a bot result it declares it can show; otherwise it must read the provider directly.
-   [ ] AC3: **Then build it.** Tagged **New**.
-   [ ] AC4: Every planned widget has **Swap…**, an inline picker of alternatives that can show the same thing (yours, registry, or build new).
-   [ ] AC5: The summary counts both ("3 bots: 1 from the registry, 2 new · 3 widgets: 1 yours, 1 from the registry, 1 new").
-   [ ] AC6: Registry unreachable → the plan says so and falls back to Yours and New.

### CRE-010: Building by hand stays first-class (P0)

ONE edit mode (CRE-006); by hand and AI are tabs of its right panel.

-   [ ] AC1: The left side is always editable by hand: + Column, + Row, page tabs, resize and move by dragging, click to select.
-   [ ] AC2: **Add**: searchable, filters All / Mine / Installed / Built in / Registry. Drag a widget onto an empty cell or past the last column (drop zone highlighted while dragging), or click to fill the selected cell. Registry rows say **Install & add · can read Gmail** and confirm the grant inline.
-   [ ] AC3: Empty library → Add opens on Registry with a line explaining why.
-   [ ] AC4: An empty column says "drag a widget here from Add, or ask AI to build one"; Add's footer has "Not here? Ask AI to build one".
-   [ ] AC5: A placed widget that needs wiring says "not connected yet · Connect it…" and opens its Listeners.

### CRE-011: Your Dash team (P1)

Built-in bots, always present, that do the making. Each has one role, its own instructions, only the tools its role needs, and a model chosen for the job within the user's AI provider.

| Role        | Does                                                                                                                   | Tools (least privilege)                                                     | Default model tier |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| **Planner** | Talks with you, asks questions, writes the plan, explains                                                              | read-only: library, registry results from Scout                             | strongest          |
| **Scout**   | Searches your widgets, bots, providers and the registry; reports what exists and what's missing                        | read-only search; no installs                                               | fastest / cheapest |
| **Builder** | Generates widgets and bots, places and wires them                                                                      | write: drafts, dashboards, bot definitions; installs only what you approved | strong             |
| **Checker** | Checks the work: each widget renders, each trigger fires, nothing exceeds what was approved (e.g. no send-email tools) | read-only + preview runs; can fail a step                                   | strong             |

-   [x] AC1 (dash-core #721 v0.1.736 — Planner/Scout/Builder/Checker created at startup, delete refused, pause saved across restarts): The team exists for every user; it isn't on any dashboard and can't be deleted (it can be paused).
-   [ ] AC2: The conversation labels who's speaking or acting (PLANNER, SCOUT…); Building shows who did each step.
-   [x] AC3 (dash-core #721 — per-role picks per provider on the Bots page Dash team section; editable there rather than Settings, which became the Bots page): Each role's model is set per provider with sensible defaults (e.g. Anthropic: Planner Opus, Scout Haiku, Builder Sonnet, Checker Sonnet) and is editable in Settings.
-   [ ] AC4: Roles hand off through the existing bot machinery (runs, events, results — team-dashboards), not one long prompt, so each is testable alone.
-   [ ] AC5: The Checker can send a step back to the Builder ("Let Builder fix it"), at most twice, then asks the user.
-   [ ] AC6: Answering questions ("what did my bots find today?") uses the Planner with read access to results — the same team, not a separate assistant.

### CRE-012: Cost and model visibility (P1)

-   [ ] AC1: The plan shows an **Estimated cost**: to build (by role and model) and to run the bots (per day, at their schedules), with a note to change schedules to lower it.
-   [ ] AC2: Each planned bot shows its model and tokens per run.
-   [ ] AC3: Building shows actual tokens and cost per step and a running total; the end compares with the estimate.
-   [x] AC4 (dash-core #720 v0.1.735 — runs record model, provider, all tokens incl. cache and cost; run history, Bots page last run, edit bots row): Edit's bots row shows each bot's model and cost this month (from BudgetController usage).
-   [x] AC5 (dash-core #720): With Claude Code (subscription) as the AI, show tokens and "included in your plan" instead of dollars; dollars for API-key providers.

### CRE-013: States and accessibility (P0 across all boards)

-   [ ] AC1: Designed states: AI thinking (progress per role), AI error (retry, switch AI), registry unreachable, offline, no providers, empty library, large dashboards (scrolling bots row), several builds at once (Recent statuses).
-   [ ] AC2: Visible keyboard focus on every control and on the prompt box (`:focus-within`).
-   [ ] AC3: Text meets 4.5:1 contrast; placeholders included.
-   [ ] AC4: Menus use `aria-haspopup`/`aria-expanded`; tab rows use `role="tablist"`/`role="tab"`/`aria-selected`.
-   [~] AC5 (partly: Move to another cell + Tab/Enter on a cell, and click-to-place from Add, shipped in phase 1e; arrow-key move/resize not yet): Every drag has a keyboard path: select a widget, then choose a target cell (cells are focusable); arrow keys move or resize the selection.

---

## Phases

1. **Edit modal, by hand first (P0):** the full-screen Edit with select-to-edit, Add (drag/click, registry install & add), selection settings tabs, staged Save/Cancel with confirm, page tabs; the pencil, Add widget and Edit with AI route into it. Ask AI changes one selected widget or bot (today's builders). (CRE-006, CRE-008 edit rows, CRE-010, CRE-013)
2. **Create shell for single things (P0):** Start screen with Type Widget/Bot, the no-AI row and the AI picker; New Widget and New Bot route into it. (CRE-001, CRE-005, CRE-008)
    - **2a (shipped with 2b folded in):** dash-react `ChoiceMenu`; dash-core `Components/Create/` (CreateModal, createRouting, aiBackend) + `hooks/useAiBackend`; rail + / palette Create… / New Widget / New Bot open it via `dash:open-create` ({ type, workspaceId }); Widget sends `dash:open-widget-builder` { prompt } → dash-electron `initialPrompt` (skips drafts, ChatCore `initialMessageHidden={false}`); Bot opens BotDetail inside Create; no-AI row: blank dashboard ("Untitled dashboard", Edit on Add), LayoutManagerModal `initialMethod` import/registry, ThemeManagerModal `startInCreate`, Widgets page `installRequest`.
    - **2c-1 (shipped, electron #867):** provider choice as a question (`ChatProviderGate` question mode + `providerSuggestions.js`); drafts-list install passes (scoped component id, package).
    - **2c-2 (shipped, core #716):** "Continue a draft" — the three newest drafts on the start screen (Type: Widget).
    - **2c-3:** the Widget Builder inside Create. dash-core `setWidgetBuilderRenderer` slot + CreateModal builder step (Back keeps the prompt; closing ends the step). dash-electron `EmbeddedWidgetBuilder` (clears the chat before mount, finishes an install once on Done / Back / close / Create new provider) and `WidgetBuilderModal` `embedded` (no frame/header). The builder window's close steps moved to `finalizeWidgetBuilderSession.js` (register → refresh → swap / place), shared by both, with the remount guard. Empty-cell Build with AI, Edit with AI and the Widgets page still open the builder window.
    - **2d:** (`public/lib/widgetImportFixes.cjs` before compiling; `autoFixPolicy.js` + the builder sending build errors back by itself, "Fixing a build error… (try N of 2)"; also code whose component name couldn't be read used to stall silently — now a build error) the builder fixes its own compile errors — known slips (e.g. a config with no `export default`, a named import of a default export) fixed before compiling, like `ensureWidgetType`; other build errors sent back to the AI automatically once or twice ("Fixing a build error…"); the error is shown only if it still fails.
    - **2e:** (main `widget:builder-skill` → `builderSkill.js` keeps the building sections → `buildSystemPrompt({ skillText })` appends them as "Dash widget rules"; the chat waits for them; the prompt forbids the Skill tool and states the export/import format; the skill's own config example imported a default-exported component by name — fixed. Live: 3 of 3 builds clean on the first try, 34–46 s, no tool calls.) give the builder its instructions directly. The builder prompt says "use the dash-widget-builder skill", but the skill never reaches the AI: Claude Code is launched with `--disable-slash-commands` ("Disable all skills"), the installed app's working folder is inside `app.asar`, and the Anthropic API has no skills. The main process reads the skill and the builder puts its content (or its builder sections) in the system prompt, for both backends; the prompt stops pointing at the Skill tool; a test pins the key rules.
3. **Dash team + cost (P1)** — six use cases walked through first, with gaps mapped to slices: [dash-team-scenarios.md](./dash-team-scenarios.md). Slices: 1 cost & usage · 2 the team exists · 3 role tools · 4 the Widget Builder uses the team. Planner/Scout/Builder/Checker as built-in bots with per-role models; usage and cost shown on bots and runs. (CRE-011, CRE-012 AC4–5)
4. **Plan and build (P1):** team-dashboards Release 2 (widgets start bots) and Release 3 (planner) delivered as Type: Dashboard, with Before-building approvals, estimates, reuse order, Building with Checker and failure states, sidebar and Recent. (CRE-003, CRE-004, CRE-007, CRE-009, CRE-012 AC1–3)
5. **Later (P2):** starters (after result-aware packaging), Preview with sample data, Auto and Theme types, the Assistant merge. (CRE-002, CRE-003 AC6, CRE-007 AC4)

## Follow-ups (deferred from phase 1)

1. ~~**Configure screens in the panel (CRE-006 AC4/AC5)**~~ — done: widget side dash-core #718 (v0.1.733), bot side #719 (v0.1.734).
2. **Arrow-key move and resize (CRE-013 AC5):** a small slice; can go in anywhere.
3. **Remounts on mode switch:** widgets in the PinnedSidebar and on legacy (non-grid) dashboards still reload between view and edit.
4. **⌘K binding:** the palette shows "⌘K" but nothing binds it.
5. **Build-mode registry panel:** the builder searches the registry with the latest visible message and shows "0 matches" in the preview area even in Build mode — show it only when there are matches.
6. **Deleted drafts linger in the widget list:** `drafts.delete` removes the draft folder but leaves an `@ai-built/draft-<id>` entry in `widgets.list`.
7. **Move the other builder entry points into Create** (empty-cell Build with AI, Edit with AI, Widgets page) once the inside-Create builder has been in use.

## Open Questions

1. ~~Edit: same modal or lighter panel?~~ Decided: same modal, select-to-edit, by hand and AI as tabs (CRE-006, CRE-010).
2. **Dash team visibility:** show the team as its own page (like a dashboard team in the Bots view), or only inside Create?
3. **Cost estimates:** how are estimates calibrated — fixed per-step figures first, then learned from the user's actual runs?
4. **Starter previews:** real screenshots or drawn thumbnails?
5. **Assistant merge:** fully into the sidebar (CRE-007 AC4), or keep "ask" separate?

## Revision History

| Version | Date       | Author            | Changes                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1     | 2026-10-10 | John Giatropoulos | Draft for discussion, with mockup                                                                                                                                                                                                                                                          |
| 0.3     | 2026-10-11 | John Giatropoulos | Phase 1 shipped; phase 2a (start screen, Widget/Bot types, no-AI row, entry points) implemented; follow-ups listed                                                                                                                                                                         |
| 0.2     | 2026-10-10 | John Giatropoulos | Select-to-edit; one edit mode (Add / Ask AI); reuse before building; fresh-eyes review applied (no-AI start, approvals before Build, failure/Stop, staged Cancel, states, a11y); Dash team (CRE-011); cost and model visibility (CRE-012); phases reordered around a smaller first version |
