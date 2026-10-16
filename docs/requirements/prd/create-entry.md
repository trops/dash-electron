# PRD: Create — One Entry for Making Dashboards, Widgets, Bots and Themes

**Status:** In Progress
**Last Updated:** 2026-10-14 (reconciled with the code — each story has a Status, and boxes say what is built; `[~]` marks partly built, with what's missing)
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

**Status:** In Progress

-   [~] AC1: A single Create modal, full screen with a margin, opens from the left rail's **+** and from Cmd/Ctrl+K "Create…". (2a: the rail's + is labelled Create; "Create…" is in the command palette. The palette still opens by click — nothing binds ⌘K yet.) _(Partial, 2026-10-14: the rail's + and the palette's Create… work; nothing binds ⌘K / Ctrl+K)_
-   [x] AC2: It opens with the cursor in one prompt box, a heading and a one-line explanation.
-   [~] AC3 (2a: Type is a `ChoiceMenu` (dash-react); 4d-3: Dashboard on; 5c: **Auto** (the default — one short AI question picks Widget, Bot, Dashboard or Theme with a reason, then Create carries on as that type, "picked by Auto · Change" in the header; a keyword guess without an AI) and **Theme** (the AI picks a name and four colors from a description; the theme editor opens on it unsaved, adjustable with hue/saturation/lightness, saved with Create Theme) — dash-core utils/aiOnce.js, Create/autoType.js, Create/themeFromPrompt.js, ThemeManagerModal `initialTheme`; still open: **+** attach and **Where** — a new bot picks its dashboard in the form's Team field): Under the box: **+** (attach a provider or file), **Type** (Auto, Dashboard, Widget, Bot, Theme) and **Where** (New dashboard, or an existing one). Both are menus (`aria-haspopup`, `aria-expanded`). Type Dashboard + Where existing means "add to that dashboard".
-   [x] AC4 (2a: shown for Widget; writes `settings.aiAssistant.preferredBackend`, the same setting as Settings › AI Assistant, via `useAiBackend`): An **AI** picker beside Send shows the provider in use ("AI: Claude Code") and lets the user change it. With no AI configured it says so and links to set one up; the no-AI row still works.
-   [x] AC5: **Or start without AI:** Blank dashboard (opens Edit on Add), Import from file, Browse registry. (2a: also New theme; Widget adds Browse widgets / Install from file / Load from folder, Bot adds Fill in the bot form.)
-   [x] AC6 (2a: Enter sends — Widget opens the Widget Builder with the prompt as its first, visible message; Bot opens the bot form. The conversation inside Create comes with 2c): Enter starts the conversation; the prompt moves to the top. _(Built, 2026-10-14: the conversation runs inside Create (Create's plan step, the builder step))_

### CRE-002: Starters (P2 — after result-aware packaging)

**Status:** Implemented

-   [x] AC1 (5b, dash-core Components/Create/StarterCards.js + starters.js): Starters below the prompt, filtered by category tabs. Shown for Type Auto and Dashboard: public registry dashboards tagged `starter` that have bots; tabs All + each category present; each card has a thumbnail drawn from the package's layout (its grid, a label per cell).
-   [x] AC2 (5b): Each shows a name, one line, what it makes and what it needs (named providers, never "your CRM") — e.g. "Makes 2 widgets · 1 bot · needs Gmail, Google Calendar".
-   [x] AC3 (5b: the package is read without installing; its widgets become registry pieces and its bots new bots — instructions, read-only tools, schedule, results, shown in Bot results; the plan shows at once and the Planner is asked to adapt it; Build goes through Before building and the normal build): Picking one opens its plan (Remix); it never builds directly.
-   Layout pass (screen audit, October 2026 — screen 2): Create's start screen follows the design guide's Screen layout rules. The modal sits on a raised surface (dash-react `.dr-modal-surface`) with a quiet header; sections have real titles ("Start from a starter", "Or start without AI"); the category filter is a `SegmentedControl`; each starter is a dash-react `Card2` button (Tab, Enter/Space) with a recessed layout preview (widget names on hover), 15/14/12px text and equal heights; the no-AI options are secondary buttons.
-   [x] AC4 (5b: three starters published by trops — Morning Brief, Inbox Triage, PR Review; dependency done in 5a-1: dashboard packages carry their team — results, triggers, listeners — and import re-points them; 5a-2: they publish to the registry with a bot summary, which the registry keeps and shows; install from the registry shows and adds them — first live-tested with the starters in 5b): Starters come from registry dashboard packages with bots (bot-factory US-027). **Depends on** team export and bot packages carrying `publishes` and result wiring (team-dashboards follow-up).

### CRE-003: A plan before building (P1)

**Status:** Implemented

-   Layout pass (screen audit, October 2026 — screen 2b): the plan is titled section cards (What it makes, Preview with sample data, Before building, What to expect) instead of one bordered card with caps labels. Each piece shows where it comes from as a coloured pill above its name (Yours, From the registry, New bot / New widget / New layout), a kind icon, a real Swap… button and a quiet ×; a new bot's Runs / Uses / Sends is a labelled list. Question cards take a typed answer (Enter sends a lone question); an "I'll type it"-style option focuses the field, and the Planner is told not to offer one. Before building uses To do / Done pills. **Discard:** "…" on an open plan (Create and the dock) → Discard plan, or Remove from Recent once built, after a confirm; removing a Recent row (start screen or dock) also confirms. In the dock the preview stacks in one column.
-   [x] AC1: For a Dashboard, the Planner asks at most a few clarifying questions as tappable answers, then shows the **Plan**: Bots, Widgets, Layout, **Before building**, **Estimated cost**. _(Built, 2026-10-14: CreatePlanStep — tappable questions; bots / widgets / layout groups; Before building; Estimated cost)_
-   [x] AC2: Each plan item is editable from the panel or by asking. _(Built, 2026-10-14: Swap…, remove a piece, follow-ups to the Planner)_
-   [x] AC3: **Before building** lists every install (with what it can access) and every sign-in, each with its own button (Review & approve, Connect). The Build button names what's still open ("Connect Gmail & build"); pressing it walks through them first. Nothing pops up during the build. _(Built, 2026-10-14: Review & approve / Connect; buildButtonLabel ("Connect Gmail & build"))_
-   [x] AC4 (4e-1: kept automatically as it goes — no Save draft button needed; the plan says "Kept in Recent · nothing has been built or installed yet"): Nothing is created or installed until Build. Back, Close and Save draft keep the plan under Recent, and the header says so.
-   [x] AC5: The plan says what the bots can and can't do ("can read email; none can send email"). _(Built, 2026-10-14: "What it can and can't do")_
-   [x] AC6 (5d, dash-core Components/Create/PlanSketch.js + planPreview.js: a sketch on the plan card laid out the way the build lays it out — widgets in a one- or two-column grid, then a Bot results box per bot that shows its results; the Planner adds made-up `sample` lines per piece (generic names, never the user's data); every box says Sample; Hide/Show; without samples a box shows the piece's notes and the card says the Planner hasn't added sample data yet. A starter's plan fills in once the Planner adapts it): Preview shows the dashboard with sample data (P2).

### CRE-004: Building with progress (P1)

**Status:** In Progress

-   [x] AC1 (partly, 4d-1: install, create dashboard, Builder builds, Checker checks, place — each with who did it, model and tokens; Dash's own steps say "no AI"; 4d-2: save bots, Bot results widget, triggers and listeners as Dash steps; first run is offered as Run <bot> now, never automatic; 4d-3: failed-step options and waiting for a provider; Type: Dashboard on for everyone; 4e-1: Recent; still open: a live preview (AC2)): Steps — install & connect, create bots, build widgets, place, wire, **check the work**, first run — each showing which team member did it, the model, tokens and cost. _(Built, 2026-10-14: planBuild step kinds; CreateBuildingStep shows role, model and tokens, and "Run <bot> now")_
-   [ ] AC2: A live preview fills in as steps finish.
-   [x] AC3 (4d-1: Stop aborts the running role, stops the rest, keeps what's built; 4e-1: the build stays in Recent as "Stopped", and a build the app closed during shows "Interrupted" with Continue building, which reuses every finished step): **Stop** halts after the current step; what's built is kept as a draft in Recent.
-   [x] AC4 (4d-3, dash-core electron/bots/planBuild.js fix/retry/reuseEarlier/builtSummary + CreateBuildingStep): A failed step shows what failed and offers **Let Builder fix it**, **Edit plan** and **Remove what was built**. Finished steps are kept. Let Builder fix it is offered on a failed build, check or wiring step of a widget the Builder made — the Builder gets the error (and the Checker's notes) and updates the widget, then it's checked again and what depended on it runs again; at most twice per widget, then "edit the plan or remove what was built". Dash's own steps (install, dashboard, place, save bot, results) offer **Try again**. Edit plan goes back to the plan; building again reuses the same dashboard and every unchanged widget, bot and wiring (matched by name), updates a changed AI-built widget in place, saves a changed bot over the old one, and names what the edited plan dropped (left on the dashboard). Remove confirms first, then deletes the dashboard, its bots and lead and the widgets the Builder made new; registry installs stay installed and updated widgets keep their changes. The Builder is told every event the plan needs the widget to send (its own and the ones its bots start on); the Checker is told a widget made in this build has no earlier users (a changed config isn't a breaking change) and, after a fix, what the fix was for. Builds are kept in Recent (4e-1): after a restart Fix/Try again wait for Continue building; Edit plan and Remove work straight away.
    -   _Build fixes, 2026-10-15 (a user's 7-widget Algolia dashboard was left half-built):_ a build step now trusts **build_widget's own result** (the controller notes each result for the run as `record.builds` — `_noteBuild` / `_takeBuilds`), falling back to the package the Builder's answer names, case-insensitively (a PascalCase `@ai-built/IndexCompare` was missed before, so a widget that built was reported failed). A failed build says why — "the Builder didn't build it — build_widget said: …" or "it never called build_widget" — and keeps the Builder's answer under the step; steps waiting on it say "<step> didn't finish: <why>". Widgets you already have are placed by their **component**: plans may name `component` (the Planner gives it when a package has several widgets), and otherwise the piece's name picks it, ignoring spaces and case ("Algolia Rules List" → AlgoliaRulesList). A place that fails because the widget can't be told apart no longer offers Try again. The Builder is told to rebuild with update: true when build_widget says the widget already exists. Still to do: placeholders for failed widgets, and a Checker that renders the widget.
    -   _Build fixes 2, 2026-10-15 (the same dashboard came out on one page, with no connection or index set):_ a plan now carries what the user answered. The layout piece can list **pages** (`[{ name, widgets: [widget names] }]`); a new dashboard gets one page per planned page (each grid sized for its widgets, the first shown — dash-core `utils/placeWidget.js` `blankDashboard`), and each widget is placed on its page (`teamPlan.js` `planPages`; widgets no page names go on the first). A widget piece can give its **provider** (`{ <type>: <connection name> }`) and **settings** (its userConfig values); when it is placed, a connection the user has of that type is set on the widget (`selectedProviders`, any case, its saved name kept) and only settings the widget's .dash.js declares are saved — what was left out is named under the step (“left out: setting "colour"”). The Planner is told to put answers into the pieces and drop answered questions; it can now read_widget to see setting names. **Build waits** while the plan still has questions (“Answer the Planner's questions first.”). The new dashboard is named after the layout without a trailing “layout”, and a layout piece without a source counts as new. **Automatic fixes:** a failed build or check goes back to the Builder by itself (“Fixing what went wrong · try 1 of 2”), at most twice, before the step offers Edit plan / Remove; a role that didn't run (no AI, paused) isn't retried. A plan that changes a dashboard you have still places on the page it shows. Edit plan keeps earlier placements, so a dashboard built before this keeps its single page. **Plan screen:** full size, once there's a plan, the plan and the chat are two equal columns (plan left, chat right); the chat is one scroll area that ends with the Planner's questions and Send answers, opens at its end, and keeps only the reply box pinned. The dock stays one column, also one scroll area opening at its end. Built steps use the theme's main text colour (details muted), and in the dock a step's AI use goes on its own line. While the Planner (or any chat reply) is still arriving, a spinner shows beside its name (dash-react 1.0.78 ChatMessage streaming). Shipped in dash-core 0.1.780.
    -   _Build fixes 3, 2026-10-15 (a built Attribute Boost asked for an App ID and API keys and called Algolia with fetch, while the Algolia connection sat unused):_ the Checker fails what it used to pass with notes. A new Widget Builder code check (src/AiAssistant/widgetCodeValidator.js `validateProviderCredentials`, in the generated public/lib/widgetChecks.cjs) flags a widget whose config declares a connection but has a credential-like setting (apiKey, adminApiKey, secret, accessToken, password; an App ID only alongside a direct call) or fetches the connected service itself; the Builder's build_widget refuses it before installing, and check_widget reports it. A data widget's missing **loading** and **error** states are now must-fix (`mustFix` from teamWidgetTools.cjs scorecardSummary): the Checker fails on them, while style misses stay notes. The Checker's request now carries what the plan says the widget does, its connection, the settings the plan sets and the plan's checks (dash-core planBuild.js `checkRequest`), and its instructions say to judge each check and fail a widget that asks for keys. Still to do: a Checker that renders the widget (needs a hidden preview window).
    -   _Plan grids, 2026-10-16 (a storefront plan said "search on top, filters down the left, results in the middle, pagination below" only in notes, and the build made a plain 2-column grid):_ a layout page can carry a **grid** — `cols`, `rows`, `colWidths` (1/4, 1/3, 1/2, 2/3, shrink, grow), `rowHeights` (shrink, grow; rows grow unless planned) and `cells` [{ widget, row, col, rowSpan?, colSpan? }] (dash-core teamPlan.js). validatePlan rejects cells outside the grid, overlapping cells, two cells for one widget and unknown sizes, and warns on unknown widget names. planPages carries the grid with each widget's cell (a widget without one gets the first free cell no other widget is planned for), and a single named page keeps its name instead of "Page 1". blankDashboard (utils/placeWidget.js) builds the planned grid — sizes as colModes / rowModes, spans on the anchor cell, covered cells hidden — and each widget is placed in its cell. A cell holds one widget, so stacked filters are one per row with the results spanning those rows; the Planner is told this, with that pattern as its example, and to give positions in the grid, never only in notes. The plan card's preview sketch draws the first page's grid (one column in the dock). Plans that change an existing dashboard still place into free cells. **Dashboards can be apps:** the Planner reuses a widget when it fits the experience the user described, not because it exists; when a request describes one experience (a storefront: search, filters, results and paging) it asks whether to build one new widget that does it all or assemble existing widgets, with the trade-off, unless the user already said. **Bots-only plans:** a team of bots needs no widgets — the plan is the bots plus a layout piece naming their (empty) dashboard; whether each bot gets a Bot results card is the user's call, so the Planner asks (a results card per bot, or keep the dashboard empty with results in the Bots view) unless they said, and adds a button or other widget only when asked (dash-core 0.1.783).
-   [x] AC5 (4d-3): Steps that need a provider the user skipped wait ("waiting for Gmail") instead of failing. Before building, the Connect window has **Build without it for now** and the Build button then says "Build without Gmail". A bot whose provider isn't connected — and its results and triggers — wait; everything else builds; the end says "Built — waiting for Gmail" with **Connect Gmail**, and once it's connected the waiting steps run. (Widgets don't wait: the Builder can write one without the provider connected.)
-   [x] AC6 (4d-1: Go to dashboard closes Create and opens the built dashboard's tab, live; the end shows actual tokens against the estimate): When done, **Go to dashboard** opens the live dashboard (not the editor), and the header compares actual cost with the estimate.

### CRE-005: Single things stay quick (P0)

**Status:** Implemented

-   [x] AC1 (2a: Bot → the bot form inside Create; 2c-3: Widget → the Widget Builder inside Create under "Create › New widget", ← Back keeps the prompt; Theme still opens the theme editor from the no-AI row): Type Widget, Bot or Theme skips the multi-part plan: the conversation builds that one thing with its preview beside it (today's Widget Builder and bot form, inside the modal).
-   [x] AC2 (2c-1: after the prompt, "Which data should this widget use?" with types guessed from the prompt, No external provider and Choose another…; the pick still precedes the chat so the AI's instructions name the type): Provider choice happens in the conversation, not as a list before typing.

### CRE-006: Editing in the same modal (P0)

**Status:** In Progress

Decided 2026-10-10: editing uses the same full-screen modal; no scope toggle — you click what you want to change.

-   [x] AC1: Edit shows the whole dashboard on the left (with page tabs for paged dashboards), every widget plus a **Bots on this dashboard** row showing each bot's model and cost this month.
-   [x] AC2: Nothing selected = the dashboard. Clicking a widget or bot selects it. Selecting a widget highlights the bot that feeds it; selecting a bot highlights the widgets it feeds; unrelated items dim.
-   [x] AC3: The header breadcrumb ("Inbox triage › Important emails · widget") shows the selection; clicking the dashboard name goes back.
-   [x] AC4 (dash-core #718 v0.1.733): Selecting while on **Add** or a settings tab opens the selection's settings (widget: Settings; bot: Instructions). Only Ask AI stays on Ask AI. A by-hand user never lands in a chat by clicking.
-   [x] AC5 (widget: Settings / Listeners / Providers / Code inline — dash-core #718; bot: Instructions / Runs / Access, one form, staged for the dashboard's Save with keepLatest — dash-core #719; notifications/schedule behind "More settings…"): The selection's no-chat tabs: widget Settings, Listeners, Code; bot Instructions, Runs, Access; dashboard Theme. (Layout is the left side itself.)
-   [x] AC6: All changes — by hand or by AI, to widgets, bots or layout — are **staged** until Save. Bot hints say "applies after you save".
-   [x] AC7: **Cancel** confirms, listing what will be discarded and what is kept (registry installs stay installed).
-   [ ] AC8: Adding bots or widgets through Ask AI comes back as a plan (needs CRE-003; until then Ask AI changes one selected widget or bot).
-   [x] AC9: In the real app widgets render as themselves under a selection overlay — not wrapped in a button — so their own buttons keep working while editing. _(Built, 2026-10-14: GridCellFrame renders the widget in a role="group" frame, not a button, and keeps it mounted)_

### CRE-007: Sidebar and Recent (P1)

**Status:** In Progress

-   [x] AC1 (4e-2, dash-core Components/Create/CreateDockPanel.js + dash-electron AssistantDock): Any Create conversation can fold into the right sidebar and expand back. A plan conversation folds from the Create header (Fold, disabled while the Planner is answering — that answer would be lost) into the dock's Create panel (rail button: plus), which shows it compact — chat, plan card, Before building, live build steps, Go to dashboard — and resizes (remembered); Expand reopens it full size. With nothing folded the panel shows Recent. (Build fixes 2: a plan picked from the dock's Recent opens in Create full size, like Expand; questions still open in the dock.) Plans only: the Widget Builder and the bot form don't fold (the Widget Builder's session ends when it unmounts; its drafts are in Recent).
-   [~] AC2 (4e-1, dash-core electron/bots/createRecent.js + Components/Create/recentRows.js): Recent lists every conversation with live status (building 3/7 · $0.55, draft plan, edit saved, answered); each is a link. On Create's start screen: plan conversations (Draft plan · Building 3/7 · 21k tokens · Built · Built, with problems · Waiting for Gmail · Stopped · Interrupted · Removed) and Widget Builder drafts, newest first, with age; a plan reopens as it was left (its build too) and can be removed (×). Saved in the main process (`dash-create-recent`, newest 20, 50 messages each), so a restart loses nothing. Each plan also has a **build memory** (BotMemory scope `plan:<id>`): Dash writes the request, answers, plan and build facts (what failed, what the Builder fixed and why, what waits); the Dash team's roles get memory tools for that plan only while they work on it, so a reopened plan's Planner and a later fix know the history; a finished build hands an `about` to the new dashboard's team memory. Removing from Recent forgets the plan memory; Remove what was built deletes the dashboard's `about`. Not yet: "edit saved" / "answered" rows (Edit sessions and Assistant questions aren't in Recent — 4e-2 / CRE-007 AC4). _(Partial, 2026-10-14: plan and question rows (Asked / Answered); no "edit saved" rows)_
-   [~] AC3 (superseded 2026-10-12): Folding an Edit session with unsaved changes keeps a "Editing · unsaved" banner on that dashboard until saved or cancelled. Edit became a mode inside the dashboard (CRE-006), not a modal, so there's nothing to fold; leaving with unsaved changes already asks to discard. Revisit only if staged edits should survive switching dashboards.
-   Layout pass (screen audit, October 2026 — screen 1): the dock's Create panel follows the design guide's Screen layout rules. Header is dash-react `PanelHeader` (back arrow when a conversation is open; Expand and a quiet Close); Recent rows are `ListRow` (shared with Create's start screen); the Ask box is a `ChatComposer` pinned at the bottom like every chat, under Recent, not above it; an empty dock shows `EmptyState` with **Make something new…** as its one action; default width 384px like the other docks; the rail's open button is filled in both modes (`ButtonIcon2` `selected` + `ariaPressed`).
-   [x] AC4 (5e-1, dash-core Components/Create/AskStep.js + CreateDockPanel.js: the dock's Create panel has an Ask box; questions go to the Planner and are kept in Recent as questions — Asked / Answered — beside plans, in the dock and on Create's start screen; an answer that plans something has **Open as a plan**, which starts Create from it. 5e-2a, dash-core #747 v0.1.762: the Ask box has a **To:** picker — **Dash team** (the Planner, default) or a dashboard's team lead, shown only when there are leads; a lead question goes straight to that lead (`askLead`, via "create"), follow-ups stay with it, Recent says "Answered · <lead>", and the Bots view labels it "Asked from Create". 5e-2b, dash-core #748 v0.1.763: a plan can change a dashboard you already have — `plan.dashboard` names it; the plan adds widgets and bots there and can apply one of your saved themes, while removing, moving and resizing stay in Edit. The plan card says **Changes to <dashboard> · not made yet** and **Make these changes**; it waits while that dashboard has unsaved edits; Remove takes off only what it added and puts the old theme back, never deleting the dashboard, its lead or its notes. Create and the dock say up front that you review a plan before anything is made, and Type: Auto sends changes to a named dashboard to the Planner. 5e-2c, dash-core #749 + this repo: the separate AI Assistant rail panel is retired — the rail is Create and Bot Activity, Settings › AI Assistant is now Settings › AI, and Dash's MCP server's lead questions say "Asked through Dash's MCP server"; ai-assistant.md lists where each thing the panel did lives now): The AI Assistant panel becomes this sidebar (P2): questions and making things share one list.

### CRE-008: Old entry points become shortcuts (P0)

**Status:** In Progress

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
| AI Assistant panel                 | The sidebar (CRE-007 AC4) — panel retired in 5e-2c                                                                   |

### CRE-009: Reuse before building (P1)

**Status:** In Progress

Every planned piece — widgets **and bots** — is resolved in one order, and the plan says which:

-   [~] AC1 (widgets; dash-core #726 v0.1.741 — the Scout looks before Create builds, matches tagged Yours / AI-built; bots not yet): **Yours first:** installed widgets, your own (`@<you>/…`, `@ai-built/…`) and existing bots. Tagged **Yours**. _(Partial, 2026-10-14: widgets are reused; existing bots aren't (search_library covers widgets only))_
-   [~] AC2 (widget packages; dash-core #726 — Registry · install opens the registry search): **Then the registry:** widget packages, dashboard packages and bot templates. Tagged **Registry · install**. A registry widget is only matched to a bot result it declares it can show; otherwise it must read the provider directly. _(Partial, 2026-10-14: registry widget packages only; dashboard packages and bot templates aren't searched)_
-   [x] AC3: **Then build it.** Tagged **New**. _(Built, 2026-10-14: "New widget" / "New bot" pill on plan rows)_
-   [x] AC4: Every planned widget has **Swap…**, an inline picker of alternatives that can show the same thing (yours, registry, or build new). _(Built, 2026-10-14: SwapPicker — the Scout's alternatives plus Build new)_
-   [x] AC5: The summary counts both ("3 bots: 1 from the registry, 2 new · 3 widgets: 1 yours, 1 from the registry, 1 new"). _(Built, 2026-10-14: planChecklist countsLine ("3 widgets: 2 from the registry, 1 AI-built"))_
-   [x] AC6 (dash-core #722/#726 — search_library says the registry couldn't be searched and still lists yours): Registry unreachable → the plan says so and falls back to Yours and New.

### CRE-010: Building by hand stays first-class (P0)

**Status:** In Progress

ONE edit mode (CRE-006); by hand and AI are tabs of its right panel.

-   [~] AC1: The left side is always editable by hand: + Column, + Row, page tabs, resize and move by dragging, click to select. _(Partial, 2026-10-14: + Row / + Column, page tabs, drag-move and click-select; resizing is the merge-cells modal, not dragging)_
-   [~] AC2: **Add**: searchable, filters All / Mine / Installed / Built in / Registry. Drag a widget onto an empty cell or past the last column (drop zone highlighted while dragging), or click to fill the selected cell. Registry rows say **Install & add · can read Gmail** and confirm the grant inline. _(Partial, 2026-10-14: search, filters, Discover, drag and click-to-place; no inline "Install & add · can read X" grant)_
-   [ ] AC3: Empty library → Add opens on Registry with a line explaining why.
-   [ ] AC4: An empty column says "drag a widget here from Add, or ask AI to build one"; Add's footer has "Not here? Ask AI to build one".
-   [ ] AC5: A placed widget that needs wiring says "not connected yet · Connect it…" and opens its Listeners.

### CRE-011: Your Dash team (P1)

**Status:** Implemented

Built-in bots, always present, that do the making. Each has one role, its own instructions, only the tools its role needs, and a model chosen for the job within the user's AI provider.

| Role        | Does                                                                                                                   | Tools (least privilege)                                                     | Default model tier |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| **Planner** | Talks with you, asks questions, writes the plan, explains                                                              | read-only: library, registry results from Scout                             | strongest          |
| **Scout**   | Searches your widgets, bots, providers and the registry; reports what exists and what's missing                        | read-only search; no installs                                               | fastest / cheapest |
| **Builder** | Generates widgets and bots, places and wires them                                                                      | write: drafts, dashboards, bot definitions; installs only what you approved | strong             |
| **Checker** | Checks the work: each widget renders, each trigger fires, nothing exceeds what was approved (e.g. no send-email tools) | read-only + preview runs; can fail a step                                   | strong             |

-   [x] AC1 (dash-core #721 v0.1.736 — Planner/Scout/Builder/Checker created at startup, delete refused, pause saved across restarts): The team exists for every user; it isn't on any dashboard and can't be deleted (it can be paused).
-   [x] AC2 (partly, slice 4: SCOUT step in Create and CHECKER card in the Widget Builder, each with model and tokens; the full conversation and Building labels come with phase 4): The conversation labels who's speaking or acting (PLANNER, SCOUT…); Building shows who did each step. _(Built, 2026-10-14: "Planner asked the Scout…" notes in the plan; who did what in the build)_
-   [x] AC3 (dash-core #721 — per-role picks per provider on the Bots page Dash team section; editable there rather than Settings, which became the Bots page): Each role's model is set per provider with sensible defaults (e.g. Anthropic: Planner Opus, Scout Haiku, Builder Sonnet, Checker Sonnet) and is editable in Settings.
-   [x] AC4: Roles hand off through the existing bot machinery (runs, events, results — team-dashboards), not one long prompt, so each is testable alone. _(Built, 2026-10-14: \_askRole runs the role bot as a real bot run)_
-   [x] AC5 (dash-electron slice 4 — after each Widget Builder install the Checker checks it; Let Builder fix it, at most twice, then over to the user): The Checker can send a step back to the Builder ("Let Builder fix it"), at most twice, then asks the user.
-   [x] AC6 (5e-1, dash-core electron/bots/resultsDigest.js + roleTools.js: the Planner gets read-only `bot_results` — the latest result each bot sent, with when — and `bot_runs` — recent runs and answers, by bot and hours; the Dash team's own bots are left out; times are given in the user's local time with the current time, so "today" is their day; a question gets no plan): Answering questions ("what did my bots find today?") uses the Planner with read access to results — the same team, not a separate assistant.

### CRE-012: Cost and model visibility (P1)

**Status:** In Progress

-   [~] AC1: The plan shows an **Estimated cost**: to build (by role and model) and to run the bots (per day, at their schedules), with a note to change schedules to lower it. _(Partial, 2026-10-14: the build estimate by role and model is computed (planEstimate); "to run" is the Planner's own text, with no per-day figure from schedules)_
-   [ ] AC2: Each planned bot shows its model and tokens per run.
-   [x] AC3 (4d-1: per-step model and tokens, running total, end compares with the estimate; dollars only for API runs): Building shows actual tokens and cost per step and a running total; the end compares with the estimate.
-   [x] AC4 (dash-core #720 v0.1.735 — runs record model, provider, all tokens incl. cache and cost; run history, Bots page last run, edit bots row): Edit's bots row shows each bot's model and cost this month (from BudgetController usage).
-   [x] AC5 (dash-core #720): With Claude Code (subscription) as the AI, show tokens and "included in your plan" instead of dollars; dollars for API-key providers.

### CRE-013: States and accessibility (P0 across all boards)

**Status:** In Progress

-   [~] AC1: Designed states: AI thinking (progress per role), AI error (retry, switch AI), registry unreachable, offline, no providers, empty library, large dashboards (scrolling bots row), several builds at once (Recent statuses). _(Partial, 2026-10-14: no-AI, registry-unreachable and Recent states exist; offline, large-dashboard and per-role thinking states unconfirmed)_
-   [~] AC2: Visible keyboard focus on every control and on the prompt box (`:focus-within`). _(Partial, 2026-10-14: focus rings in the design system; the Create prompt box has no focus-within ring)_
-   [~] AC3: Text meets 4.5:1 contrast; placeholders included. _(Partial, 2026-10-14: text tokens are tuned for contrast; 4.5:1 not verified)_
-   [x] AC4: Menus use `aria-haspopup`/`aria-expanded`; tab rows use `role="tablist"`/`role="tab"`/`aria-selected`. _(Built, 2026-10-14: dash-react ChoiceMenu / FilterMenu (aria-haspopup), Tabs (tablist))_
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
5. ~~**Assistant merge:** fully into the sidebar (CRE-007 AC4), or keep "ask" separate?~~ Decided (2026-10-14): fully into Create's sidebar; the panel is retired (5e-2c). Ask runs on the bot runner with in-process tools, not the Dash MCP server.

## Revision History

| Version | Date       | Author            | Changes                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1     | 2026-10-10 | John Giatropoulos | Draft for discussion, with mockup                                                                                                                                                                                                                                                          |
| 0.3     | 2026-10-11 | John Giatropoulos | Phase 1 shipped; phase 2a (start screen, Widget/Bot types, no-AI row, entry points) implemented; follow-ups listed                                                                                                                                                                         |
| 0.2     | 2026-10-10 | John Giatropoulos | Select-to-edit; one edit mode (Add / Ask AI); reuse before building; fresh-eyes review applied (no-AI start, approvals before Build, failure/Stop, staged Cancel, states, a11y); Dash team (CRE-011); cost and model visibility (CRE-012); phases reordered around a smaller first version |
