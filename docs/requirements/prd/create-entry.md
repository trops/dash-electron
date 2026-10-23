# PRD: Create — One Entry for Making Dashboards, Widgets, Bots and Themes

**Status:** In Progress
**Last Updated:** 2026-10-22 (consolidation Phase 5: one current source — "How making things works today", current ACs only, one list of open gaps, history in the appendix)
**Owner:** John Giatropoulos
**Location:** dash-electron (Widget Builder, install gate, the Dash team's widget tools); dash-core (Create, edit mode and the widget panel, the Dash team bots and their page, planner tools, bot/dashboard APIs, usage, the Widgets page)
**Related PRDs:** [ai-assistant.md](./ai-assistant.md), [dash-team-scenarios.md](./dash-team-scenarios.md), dash-core `team-dashboards.md` (bots report results, widgets start bots, one plan from a goal), dash-core `bot-teams.md` (teams, leads), dash-core `bot-factory.md` (budgets, usage), dash-core `app-navigation.md` (Manage pages, the bot page NAV-016, the Widgets page NAV-008)
**Mockup:** Design canvas "Dash Create — unified entry": 1 Start, 2 Conversation + plan, 3 Building, 4 Edit (by hand or with AI), 5 Sidebar

---

## Executive Summary

Making things in Dash had grown seven separate entry points with different first screens: the New Dashboard modal, the Dashboard Wizard, the AI Assistant panel, the Widget Builder's own AI chat, the New Bot form and the team lead's drafts. Users, and the people building Dash, lost track of which to use.

**Create** replaced them with one full-screen modal. It opens on a single prompt ("What do you want to make?") with **Type** under it, a row to start **without AI**, and starters. Making something with AI always goes through **your Dash team** — built-in bots with one role each (Planner, Scout, Builder, Checker), each with its own instructions, tools and model — and always shows a plan, then the thing running, before anything is saved or installed. The user sees who did what, with which model, and what it cost.

**Editing** is a mode on the dashboard itself: the dashboard stays on the left, editable by hand, and the edit panel on the right holds Add, the selected widget's one panel, the selected bot, the dashboard and its theme. Every AI change to a widget is one door, **Change <widget>** (or **Fix <widget>** for a crashed one), which opens Create on it. Questions go to the **Dash team page**, pinned in the Bots panel.

---

## Problem Statement

-   **Too many doors.** Seven entry points, each built at a different time. The Widget Builder opened on drafts, then a provider-type list, before the user could type.
-   **No whole-goal path.** Nothing made bots, widgets and a dashboard together from one goal (team-dashboards TD-007/TD-008).
-   **One AI did everything.** A single assistant planned, searched, built and judged its own work, with every permission at once, on one model.
-   **Cost was invisible.** Users couldn't tell what building a dashboard, or running its bots, would cost.
-   **Editing was scattered.** Edit with AI, Configure, the bot form and Dashboard Config were separate places.

## Goals

-   One place to start making anything, with a path that never needs AI.
-   A plan before building; installs and sign-ins approved before Build, never mid-build.
-   Work split across role bots with least privilege and a model suited to each job.
-   Cost and model visible before, during and after.
-   One edit mode for by-hand and AI changes, with one Save and Cancel.
-   Nothing installed that hasn't passed its checks.

## Non-Goals

-   Replacing the Bots, Widgets and Dashboards pages as places to browse and manage.
-   Doing setup for the user: provider sign-in and permission grants stay the user's.

---

## How making things works today

This section is the current behaviour, door by door. The user stories below hold the acceptance criteria; the appendix holds how it got here.

### Where Create opens

-   The left nav's **Create** (the one way in — the right rail has no **+**).
-   **⌘N / Ctrl+N**, except in a popout, while a dashboard is being edited, or while a dialog is open (DashboardStage).
-   The command palette's **Create…** (it shows ⌘N). The palette itself opens from the left nav's **Search**, the empty state's **Search** button and **⌘K / Ctrl+K** (dash-react CommandPalette toggles it), as the empty state's "Press ⌘K to search dashboards…" says.
-   **New Dashboard**, **New Widget** and **New Bot** on the Manage pages open Create on that type.

### Create's types

The start screen has one prompt, a **Type** menu (Auto, Widget, Bot, Dashboard, Theme), an **AI** picker beside Send (the same setting as Settings › AI), a one-line hint saying what happens before anything is made, and **Or start without AI**: Blank dashboard, Import dashboard from file, Browse dashboards in the registry, New theme — plus, for Widget, Build it by hand, Browse widgets in the registry, Install a widget from file and Load a widget from a folder. For Bot the row is only **Fill in the bot form**; for an empty cell it's only the widget install rows (Browse widgets in the registry, Install a widget from file, Load a widget from a folder). Starters (registry dashboard packages with bots) show for Auto and Dashboard.

-   **Auto** (the default): one short AI question picks Widget, Bot, Dashboard or Theme, with a reason; Create carries on as that type ("picked by Auto · Change").
-   **Dashboard:** the Planner talks it through inside Create and shows a **plan** — the pieces (each tagged Yours, From the registry or New, with Swap… and ×), the layout and its pages and grid, **Before building** (every install and sign-in, each with its own button), what the bots can and can't do, a preview with sample data, and an estimated cost. A plan can change a dashboard you already have ("Changes to <dashboard> · not made yet" / **Make these changes**). Nothing is made until **Build**. Building runs each widget as **Build → Check → Install → Place** (the Builder writes a draft, the Checker checks it, and only a pass installs it), then saves bots, results cards, triggers and listeners; each step shows who did it, the model and tokens; failed steps fix themselves up to twice, then offer Let Builder fix it / Edit plan / Remove what was built; **Go to dashboard** opens it live. A plan can **Fold** into the sidebar and expand back.
-   **Widget:** the Scout looks for a widget you already have; otherwise the Planner plans exactly one widget for your widgets, the Builder writes a draft, the Checker checks it, and you see it running. **Looks good — add it to my widgets** installs it; the Done screen has **See it on the Widgets page**. Nothing is installed before Looks good.
-   **Bot:** **Where** (No dashboard, or one of yours) → the Scout (your bots and registry dashboard packages' bots — **Use on <dashboard>**) → the Planner plans one bot → checked → saved **paused** → **Try it now**, **Turn on**, **Open its page**.
-   **Theme:** the AI picks a name and four colours from the description; the theme editor opens on it unsaved, and **Create Theme** saves it.

### Empty cell → Build with AI

In edit mode an empty cell shows **Add widget** and **Build with AI**; selecting the cell opens the edit panel's Add tab with **Build with AI** on top. Build with AI opens Create for that cell (Type: Widget, no menu): the Scout first (**Use in this cell** for one you have), else the Planner plans one widget, the Builder writes a draft, the Checker checks it, and **Preview** runs the real widget with the cell's connection and settings (**Looks good — put it in the cell** / Change something / Discard). It's installed, then placed in the open edit as an unsaved change.

### Change / Fix <widget>

One door for an AI change to a widget you have: **Change <widget>** in the widget panel, the card's ⋮ menu and the Widgets page; a crashed installed widget shows **Fix <widget>**, which carries the error and its cell. It opens **Create › Change <widget>**: the Scout says what it does now; Dash shows its settings, connection, events and package from its config; you pick **Update <widget> everywhere** (in place — only for your own widgets, signed in) or **Save as a new widget**; the Planner plans that one widget (Adds / Keeps / Files); the Builder writes a draft inside a copy of its package; the Checker compares it with the widget as it was; the preview shows it running, with **Code** and **What changed**. Nothing is installed before **Looks good — update <widget>**. Change waits while the dashboard has unsaved edits and isn't offered for built-in widgets. For your own widgets, **Or change it without AI: Edit the code yourself** opens the Widget Builder by hand.

### By hand: the Widget Builder

The Widget Builder (**Widget Builder · Build by hand**) has no AI of its own. Its tabs are **Preview**, **Code**, **Configure**, **Logs** and **Style checks**; a new widget opens on Compose, where **Rather describe it? Ask the Dash team** closes it and opens Create on a new widget with the text. The name saves on Enter or when you leave the field, and Install waits for it ("Goes into your widgets as <Name>"). Each version is checked (code checks, then the Checker) and Install waits for a pass; problems are listed to fix by hand. **Save as draft** keeps unfinished work; leaving with unsaved work asks Save as draft / Keep editing / Discard. Doors: Create › Build it by hand, the Widgets page's Install another › Build it by hand, Edit the code yourself, and an unfinished widget's Resume.

### The lead's hand-off

A dashboard's team lead doesn't make things itself. When asked for a bot, widget or layout, its answer ends with **Plan this with the Dash team**, which opens Create on that dashboard (Type: Bot with Where set, or a plan that changes the dashboard) with the request filled in; the lead's note and the dashboard's team (widgets, bots) go to the Scout and Planner. The same button shows on answers in the lead's own page and in the Dash team's conversations.

### Asking the Dash team

The Bots panel (right rail) pins the open dashboard's **lead** and **Dash team**. The Dash team page has **Conversation** — every question kept in Recent as a thread (including ones asked of a lead before), **New conversation**, and **Open as a plan** on an answer that plans something — and **Settings** — the roles, each opening its own form. When the team is paused the page says so, with **Turn on**. The Planner answers questions with read-only access to bots' results and runs ("what did my bots find today?"); a question gets no plan. A new question to a lead goes through that lead's own page.

### The Dash team's roles

| Role        | Does                                                                                                                                                                | Tools (least privilege)                                                                    | Default model tier |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| **Planner** | Talks with you, asks questions, writes the plan, answers questions about your bots' results                                                                         | read-only: library, registry results from the Scout, bot results and runs                  | strongest          |
| **Scout**   | Searches your widgets, bots, providers and the registry; reports what exists and what's missing                                                                     | read-only search; no installs                                                              | fastest / cheapest |
| **Builder** | Writes widget drafts and bots, places and wires them                                                                                                                | write: drafts, dashboards, bot definitions; installs only what you approved and was passed | strong             |
| **Checker** | Checks each draft before it's installed: compiles it, runs the code checks and the must-fix checklist, reads its config, compares a change with the original widget | read-only: `check_widget`, `read_widget`, `list_providers`; can fail a step                | strong             |

The Checker's checks are static — it does not render the widget (open gap). The team exists for every user, isn't on any dashboard, can't be deleted and can be paused; each role's model is set per AI provider on the Dash team page's Settings.

### The install gate

Every package install runs the widget code checks on the staged package before the installed one is touched — registry, file and folder installs, updates, drafts and the Widget Builder's installs alike (dash-electron `public/lib/installGate.cjs`, set on dash-core's widget registry). It checks the whole package's source, shared files included. A package that fails is refused. At startup the installed packages are checked too: one that fails is flagged on the Widgets page and keeps working; a package found on disk that isn't registered is registered only if it passes.

### Edit mode and the one widget panel

**Edit dashboard** puts the dashboard in edit mode in place. The edit panel on the right has **Add** (Installed and Registry, search and filters; click to fill the selected cell or drag onto the dashboard), **Widget** or **Bot** for the selection, **Dashboard** and **Theme**. Every change — by hand or by AI, notifications and schedule included — is staged until **Save**; **Cancel** confirms and lists what's discarded.

Selecting a widget opens **one stacked panel**: its name and whose it is, a ⋯ menu (Move to another cell, Split side by side, Split top and bottom, Remove), one **Change <widget>** button, then Settings, Connections, Listens for, Notifications and Schedule (when it has them) and Advanced: raw settings. While editing, a card whose widget is missing something shows one amber pill in its header — "Needs a Slack connection", "N listeners not connected" or "2 things to fix" — which opens the panel at the fix. The card's ⋮ menu is Edit in panel, Change <widget>, Move, Split ×2, Remove. Dashboard Config is the whole-dashboard view and hands a widget to the panel.

### The Widgets page

The Widgets page lists packages; clicking one drills in (**All packages** goes back), with **About this package** and each widget's page. A search lists matching widgets directly. A widget's page has a summary and a live preview, which runs by itself unless it would start an MCP server (then **Start preview**); it says which connection it's running with, and a failed run offers **Try again**. **Change <widget>** is on every widget; for your own, Create › Change also offers **Edit the code yourself** under "Or change it without AI". **Uninstall** is in the widget's ⋯ menu and says which other widgets in the package go with it. **New Widget** opens Create on a widget; **Install another** opens the picker: Describe it to the Dash team, Build it by hand, Search for Widgets, Install from File, Load from Folder.

### The sidebar and what you made recently

The right rail's Create panel holds a plan you **Fold** into it, shown compact (chat, plan, Before building, build steps, Go to dashboard), with **Expand** back to full size and **Close plan** to put it away (it stays saved; an unfinished one is under Unfinished). A Fold is the only way it opens — the rail has a Bots button and no Create button. It has no Recent list (QA 2026-10-22): with nothing folded it says how a plan gets there ("No plan folded here") and points to Dash team for questions. Plans are still saved as they go (kept across restarts) and each has a build memory its roles read while they work on it; **Forget plan** (or **Discard plan**) in the plan's "…" forgets that memory.

Plans you didn't finish are on Create's start screen, under the prompt: **Unfinished** lists plans saved but never built and builds not cleanly done — still building, waiting for a connection, stopped part-way (Stopped, Interrupted) or built with problems — newest first, up to 5, each with its status and age, **Continue** and **Discard** (or **Forget** once it built something — the plan menu's words). Continue reopens the plan as it was left (a stopped build offers **Continue building**); Discard / Forget asks first, as the plan menu does. Finished work isn't listed, and the section is absent when there's nothing unfinished.

What you made recently is where you use it: the dashboard edit panel's **Add** list starts with **Recently created** — your own widgets (made in Create or the Widget Builder, published under your username, or loaded from your own folder), newest first, the last 5 from the past two weeks — while no search or filter is set. Unfinished widgets are on the Widgets page, with **Resume**.

---

## User Stories

`[x]` built, `[~]` partly built (what's missing is said), `[ ]` not built. A retired AC is one line saying what replaced it; its old text is in the appendix.

### CRE-001: One start screen (P0)

**Status:** Implemented

-   [x] AC1: Create is a full-screen modal with a margin. It opens from the left nav's **Create**, the command palette's **Create…** and **⌘N / Ctrl+N** (not in a popout, while editing a dashboard, or while a dialog is open); the palette shows ⌘N on Create…. _(⌘K / Ctrl+K opens the command palette, as the empty state says.)_
-   [x] AC2: It opens with the cursor in one prompt box, a heading and a one-line explanation.
-   [~] AC3: Under the box: **Type** (Auto, Widget, Bot, Dashboard, Theme) as a menu (`aria-haspopup`, `aria-expanded`); for Bot, **Where** (No dashboard, or one of yours). Auto asks the AI once to pick a type, with a reason, and says "picked by Auto · Change"; without an AI it guesses from keywords. Theme makes a name and four colours and opens the theme editor unsaved. A plan that names a dashboard you have changes that dashboard. _Not built: **+** to attach a provider or file._
-   [x] AC4: An **AI** picker beside Send shows the AI in use and changes it (`settings.aiAssistant.preferredBackend`, the same setting as Settings › AI, via `useAiBackend`). With no AI configured it says so and links to set one up; the no-AI row still works.
-   [x] AC5: **Or start without AI:** Blank dashboard (opens edit mode on Add), Import dashboard from file, Browse dashboards in the registry, New theme; Widget adds Build it by hand, Browse widgets in the registry, Install a widget from file, Load a widget from a folder. Bot shows only Fill in the bot form; an empty cell shows only the widget install rows (no Build it by hand — the cell has its own Add widget).
-   [x] AC6: Enter sends the prompt and the conversation runs inside Create: Dashboard → the Planner and a plan (CRE-003); Widget and Bot → the Scout, then a one-piece plan (CRE-005); Theme → the theme editor; Auto → the type it picks.

### CRE-002: Starters (P2)

**Status:** Implemented

-   [x] AC1 (dash-core Components/Create/StarterCards.js + starters.js): Starters below the prompt, filtered by category tabs. Shown for Type Auto and Dashboard: public registry dashboards tagged `starter` that have bots; tabs All + each category present; each card has a thumbnail drawn from the package's layout (its grid, a label per cell).
-   [x] AC2: Each shows a name, one line, what it makes and what it needs (named providers, never "your CRM") — e.g. "Makes 2 widgets · 1 bot · needs Gmail, Google Calendar".
-   [x] AC3: Picking one opens its plan (read without installing; its widgets become registry pieces and its bots new bots; the Planner is asked to adapt it); it never builds directly.
-   [x] AC4: Starters come from registry dashboard packages with bots (bot-factory US-027): Morning Brief, Inbox Triage, PR Review, published by trops. Dashboard packages carry their team — results, triggers, listeners — and import re-points them.
-   Layout: the modal sits on a raised surface (dash-react `.dr-modal-surface`) with a quiet header; sections have real titles ("Start from a starter", "Or start without AI"); the category filter is a `SegmentedControl`; each starter is a dash-react `Card2` button (Tab, Enter/Space) with a recessed layout preview (widget names on hover), equal heights; the no-AI options are secondary buttons.

### CRE-003: A plan before building (P1)

**Status:** Implemented

-   [x] AC1: For a Dashboard, the Planner asks at most a few clarifying questions as tappable answers (a typed answer works too: Enter sends a lone question, and an "I'll type it"-style option focuses the field — the Planner is told not to offer one), then shows the **Plan**: Bots, Widgets, Layout, **Before building**, **Estimated cost**. Build waits while the plan still has questions.
-   [x] AC2: Each plan item is editable from the panel (Swap…, ×) or by asking the Planner.
-   [x] AC3: **Before building** lists every install (with what it can access) and every sign-in, each with its own button (Review & approve, Connect). The Build button names what's still open ("Connect Gmail & build"); pressing it walks through them first. Nothing pops up during the build.
-   [x] AC4: Nothing is created or installed until Build. The plan is saved as it goes, and says "Saved · nothing has been built or installed yet". "…" → **Discard plan** (or **Forget plan** once built), after a confirm.
-   [x] AC5: The plan says what the bots can and can't do ("can read email; none can send email").
-   [x] AC6 (dash-core PlanSketch.js + planPreview.js): Preview shows the dashboard laid out the way the build lays it out — the first page's grid, a Bot results box per bot that shows its results — with made-up sample lines from the Planner; every box says Sample; Hide/Show.
-   [x] AC7: The main process validates a plan against the user's dashboards and themes and refuses one with errors; Create disables Build and shows the errors in red, with **Ask the Planner to fix it**. Warnings (a provider that isn't connected, grid slips) don't block.
-   Layout: titled section cards (What it makes, Preview with sample data, Before building, What to expect); each piece shows where it comes from as a pill (Yours, From the registry, New bot / New widget / New layout), a kind icon, Swap… and a quiet ×; a new bot's Runs / Uses / Sends is a labelled list; Before building uses To do / Done pills. Full size, the plan and the chat are two equal columns; in the dock, one column.

### CRE-004: Building with progress (P1)

**Status:** In Progress (AC2 open)

-   [x] AC1: Steps — install & connect, create the dashboard, build each widget (Build → Check → Install → Place), save bots, results cards, triggers and listeners — each showing which team member did it, the model and tokens; Dash's own steps say "no AI". The first run is offered as **Run <bot> now**, never automatic.
-   [ ] AC2: A live preview fills in as steps finish.
-   [x] AC3: **Stop** aborts the running role and stops the rest; what's built is kept and the saved plan shows "Stopped". A build the app closed during shows "Interrupted" with **Continue building**, which reuses every finished step.
-   [x] AC4 (dash-core electron/bots/planBuild.js + CreateBuildingStep): A failed build or check goes back to the Builder by itself ("Fixing what went wrong · try 1 of 2"), at most twice; then the step offers **Let Builder fix it**, **Edit plan** and **Remove what was built**; Dash's own steps offer **Try again**. Edit plan goes back to the plan, and building again reuses the dashboard and every unchanged piece (matched by name), updates a changed AI-built widget in place, saves a changed bot over the old one, and names what the edited plan dropped (left on the dashboard). Remove confirms first, then deletes the dashboard, its bots and lead and the widgets the Builder made; registry installs stay installed and updated widgets keep their changes. A widget that never passes its check is never installed. The Builder is told every event the plan needs the widget to send (its own and the ones its bots start on); the Checker is told a widget made in this build has no earlier users and, after a fix, what the fix was for. After a restart, Let Builder fix it and Try again wait for **Continue building**; Edit plan and Remove work straight away.
-   [x] AC5: Steps that need a provider the user skipped wait ("waiting for Gmail") instead of failing. Before building, Connect has **Build without it for now** and the Build button then says "Build without Gmail". A bot whose provider isn't connected — and its results and triggers — wait; everything else builds. The end says "Built — waiting for Gmail" with **Connect Gmail**, and once it's connected the waiting steps run. (Widgets don't wait: the Builder can write one without the provider connected.)
-   [x] AC6: When done, **Go to dashboard** closes Create and opens the built dashboard's tab, live, and the end compares actual tokens with the estimate.
-   [x] AC7: A plan carries what the user answered: pages (`[{ name, widgets }]`) and grids (`cols`, `rows`, sizes, `cells` with spans) are built as planned; a widget piece's connection and settings are set on the placed widget, and settings its `.dash.js` doesn't declare are named as left out.

### CRE-005: Single things stay quick (P0)

**Status:** Implemented

-   [x] AC1: Type Widget, Bot or Theme skips the multi-part plan. Widget and Bot go through the Dash team as one-piece plans (AC3; Bot: Where → Scout → one bot, checked, saved paused, Try it now / Turn on / Open its page); Theme opens the theme editor.
-   [x] AC2: There is no provider list before typing: the Planner works out a widget's data from the prompt, and a plan names the connection.
-   [x] AC3: **Type: Widget goes through the Dash team.** Send runs the Scout (a widget you already have?), else the Planner plans exactly one widget "for your widgets" (`standalone`), the Builder writes a draft, the Checker checks it, and you see it running; **Looks good — add it to my widgets** installs it and a Done screen says "<Widget> is in your widgets" with **See it on the Widgets page**. Nothing is installed before Looks good. It reuses the empty-cell build (cell mode without a cell). **Build it by hand** is the first "Or start without AI" row (not offered for an empty cell — the cell has its own Add widget).
-   [x] AC4: **Update original** on a widget from one of the user's own packages rebuilds that package in place — a full copy with the edited widget written over it, version bumped to the next patch with a `-local` suffix, compiled, and reinstalled under its own name; the installed package is untouched until the build compiled and is put back if installing fails (public/lib/packageUpdate.cjs). A package registers only its own widgets (src/AiAssistant/widgetIdentity.js; widgetImportFixes.cjs `claimConfigIdentity`).

### CRE-006: Editing (P0)

**Status:** Implemented

Edit is a mode on the dashboard itself, not a modal: you click what you want to change.

-   [x] AC1: Edit shows the whole dashboard on the left (with page tabs for paged dashboards), every widget plus a **Bots on this dashboard** row showing each bot's model and cost this month.
-   [x] AC2: Nothing selected = the dashboard. Clicking a widget or bot selects it. Selecting a widget highlights the bot that feeds it; selecting a bot highlights the widgets it feeds; unrelated items dim.
-   [x] AC3: The header breadcrumb ("Inbox triage › Important emails · widget") shows the selection; clicking the dashboard name goes back.
-   [x] AC4: Selecting opens the selection's own panel (a widget's stacked panel — CRE-015; a bot's form). A by-hand user never lands in a chat by clicking.
-   [x] AC5: The edit panel's tabs: **Add**, **Widget** or **Bot** for the selection, **Dashboard**, **Theme**. A bot's tab is Instructions / Runs / Access, one form, staged for the dashboard's Save. (Layout is the left side itself.)
-   [x] AC6: All changes — by hand or by AI, to widgets, bots or layout — are **staged** until Save. Bot hints say "applies after you save".
-   [x] AC7: **Cancel** confirms, listing what will be discarded and what is kept (registry installs stay installed).
-   AC8 — superseded 2026-10-22 by CRE-014/CRE-015 (Change <widget>), the empty cell's Build with AI, Create › Bot with Where, and plans that change a dashboard you have. There is no Ask AI tab.
-   [x] AC9: Widgets render as themselves under a selection overlay — not wrapped in a button — so their own buttons keep working while editing (GridCellFrame, a role="group" frame).

### CRE-007: Sidebar (P1)

**Status:** Implemented

-   [x] AC1 (dash-core Components/Create/CreateDockPanel.js + dash-electron AssistantDock): A plan conversation folds from the Create header (**Fold**, disabled while the Planner is answering) into the right rail's Create panel, which shows it compact — chat, plan card, Before building, live build steps, Go to dashboard — and resizes (remembered); **Expand** reopens it full size. The panel opens only on a Fold (`dash:create-fold`): the rail has no Create button. The Widget Builder and the bot form don't fold.
-   [x] AC2 (dash-core electron/bots/createRecent.js): A plan is saved as it goes and reopens as it was left (its build too). Saved in the main process (`dash-create-recent`, newest 20 of each kind, 50 messages each). The Create panel no longer lists them (QA 2026-10-22: a list of what you already made didn't belong in Create). Plans you didn't finish — never built, still building or waiting, stopped part-way, or built with problems — are **Unfinished** on Create's start screen (dash-core Components/Create/UnfinishedPlans.js), with **Continue** and **Discard** / **Forget**; what you made recently is **Recently created** at the top of the dashboard's Add list (CRE-010 AC2); unfinished widgets are on the Widgets page. Each plan has a **build memory** (BotMemory scope `plan:<id>`): Dash writes the request, answers, plan and build facts (what failed, what the Builder fixed and why, what waits); the Dash team's roles get memory tools for that plan only while they work on it, so a reopened plan's Planner and a later fix know the history; a finished build hands an `about` to the new dashboard's team memory. **Forget plan** / **Discard plan** forgets the plan memory; Remove what was built deletes the dashboard's `about`.
-   AC3 — superseded 2026-10-12: Edit is a mode, not a modal, so there's nothing to fold; leaving with unsaved changes asks to discard.
-   AC4 — superseded 2026-10-21 by the Dash team page (app-navigation NAV-016 AC7, bot-teams TEAM-015 AC9): questions are the Dash team's conversations, not rows in the Create panel. The AI Assistant panel was retired in 5e-2c.
-   [x] AC5: There is one place to ask: the Dash team page (pinned in the Bots panel). Its Conversation lists every question as a thread with **New conversation**; an answer that plans something has **Open as a plan**. The Create panel has no Ask box, and its empty state points to Dash team.
-   Layout: the Create panel's header is dash-react `PanelHeader` (Expand and a quiet Close); with no plan folded it shows `EmptyState`; default width 384px like the other docks; the rail's open button is filled while open (`ButtonIcon2` `selected` + `ariaPressed`).

### CRE-008: Old entry points become shortcuts (P0)

**Status:** Implemented

| Was                                                                  | Is now                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **+** → New Dashboard modal ✓                                        | Create. Blank, Import and Registry are the "start without AI" row. The Wizard, the New Dashboard method picker and NewDashboardChooser are deleted; the Wizard's steps became the plan.                                                                                |
| Empty screen / palette / Manage › Dashboards **New Dashboard** ✓     | Create, Type: Dashboard                                                                                                                                                                                                                                                |
| Right rail **+** ✓                                                   | Removed — the left nav's Create                                                                                                                                                                                                                                        |
| Widgets page → New Widget ✓                                          | Create, Type: Widget                                                                                                                                                                                                                                                   |
| Empty cell → Build with AI ✓                                         | Create for that cell, through the Dash team: Scout (**Use in this cell**), else the Planner plans one widget → Builder draft → Checker → **Preview** (the real widget running; its connection and settings from the plan) → Install → placed in the open edit, unsaved |
| Empty cell → Add widget ✓                                            | Edit mode with the cell selected, on **Add** — no AI                                                                                                                                                                                                                   |
| Dashboard pencil ✓                                                   | **Edit dashboard**: edit mode on **Add**, nothing selected                                                                                                                                                                                                             |
| Widget menu / Edit panel / error box / Widgets page → Edit with AI ✓ | **Change <widget>** / **Fix <widget>** (with the error) → Create › Change <widget>, through the Dash team (CRE-014). Your own widgets also have **Edit the code yourself** (the Widget Builder, by hand)                                                               |
| Bots page → New Bot ✓                                                | Create, Type: Bot, through the Dash team: **Where** → Scout → one-bot plan → Check → saved **paused** → **Try it now** / **Turn on** / **Open its page**. "Fill in the bot form" stays as the no-AI start                                                              |
| Team lead "add a bot" ✓                                              | The lead hands off: **Plan this with the Dash team** — Create on that dashboard with the request filled in; the lead's note and the dashboard's team go to the Scout and Planner. The lead's own drafts are gone                                                       |
| AI Assistant panel ✓                                                 | Retired (5e-2c). Ask on the **Dash team page**, pinned in the Bots panel                                                                                                                                                                                               |

### CRE-009: Reuse before building (P1)

**Status:** In Progress

Every planned piece — widgets **and bots** — is resolved in one order, and the plan says which:

-   [~] AC1: **Yours first:** installed widgets, your own (`@<you>/…`, `@ai-built/…`) and existing bots. Tagged **Yours**. Widgets are reused in every plan; bots only in Create › Bot (`search_library` with what: "bots", **Use on <dashboard>**). _Not built: a dashboard plan's Planner doesn't reuse bots._
-   [~] AC2: **Then the registry:** widget packages, dashboard packages and bot templates. Tagged **Registry · install**. A registry widget is only matched to a bot result it declares it can show; otherwise it must read the provider directly. Built: registry widget packages; registry dashboard packages' bots in Create › Bot. _Not built: dashboard packages and bot templates in a dashboard plan's search._
-   [x] AC3: **Then build it.** Tagged **New** ("New widget" / "New bot").
-   [x] AC4: Every planned widget has **Swap…**, an inline picker of alternatives that can show the same thing (yours, registry, or build new).
-   [x] AC5: The summary counts both ("3 widgets: 2 from the registry, 1 AI-built").
-   [x] AC6: Registry unreachable → the plan says so and falls back to Yours and New.

### CRE-010: Building by hand stays first-class (P0)

**Status:** In Progress

-   [x] AC6: **The Widget Builder is the by-hand tool,** with no AI of its own (every AI widget build or change goes through the Dash team — CRE-005 AC3, CRE-014). Its title is **Widget Builder · Build by hand**; its tabs are Preview, Code, Configure, **Logs** and **Style checks**. A new widget opens on Compose; the name field starts empty, saves on Enter or when you leave it, and Install waits for it ("Goes into your widgets as <Name>"); Category says what it's for. **Edit the code yourself** opens on Code with the right side hidden ("Widget Builder · Counter · editing the code"); old drafts with chat history open as code. **Rather describe it? Ask the Dash team** closes the builder and opens Create on a new widget with the text. Each version is checked (code checks, then the Checker) and Install waits for a pass; problems are listed to fix by hand.
-   [~] AC1: The left side is always editable by hand: + Column, + Row, page tabs, move by dragging, click to select. _Not built: resizing by dragging — resizing is the merge-cells dialog._
-   [~] AC2: **Add**: **Installed** and **Registry**, search, and filters (source, package, provider, has events). **Recently created** comes first (dash-core Navigation/recentlyCreated.js): your own widgets, newest first by install time (the registry entry's `registeredAt`), the last 5 from the past two weeks; hidden while a search or filter is set, and when there are none. Drag a widget onto the dashboard or click to fill the selected cell. _Not built: registry rows saying **Install & add · can read Gmail** with the grant confirmed inline._
-   [ ] AC3: Empty library → Add opens on Registry with a line explaining why.
-   [ ] AC4: An empty column says "drag a widget here from Add, or build one with AI"; Add's footer has "Not here? Build one with AI".
-   AC5 — superseded 2026-10-21 by CRE-015 AC9: a widget that needs wiring shows "N listeners not connected" on its card, which opens Listens for.

### CRE-011: Your Dash team (P1)

**Status:** Implemented (the render check is an open gap)

Built-in bots, always present, that do the making — see "The Dash team's roles" above for what each does and the tools it gets.

-   [x] AC1 (dash-core #721): The team exists for every user; it isn't on any dashboard and can't be deleted (it can be paused).
-   [x] AC2: The conversation labels who's speaking or acting ("Planner asked the Scout…"); Building shows who did each step, with model and tokens.
-   [x] AC3: Each role's model is set per provider with sensible defaults (e.g. Anthropic: Planner Opus, Scout Haiku, Builder Sonnet, Checker Sonnet), editable on the Dash team page's Settings.
-   [x] AC4: Roles hand off through the existing bot machinery (runs, events, results — team-dashboards), not one long prompt, so each is testable alone.
-   AC5 — superseded 2026-10-16 by checking before install (CRE-004 AC4, CRE-010 AC6): the Checker checks each draft before it's installed; a failed check goes back to the Builder at most twice, then to the user. Nothing is checked after it's installed.
-   [x] AC6 (dash-core electron/bots/resultsDigest.js + roleTools.js): Answering questions ("what did my bots find today?") uses the Planner with read-only `bot_results` and `bot_runs` — the same team, not a separate assistant; the Dash team's own bots are left out; times are in the user's local time.

### CRE-012: Cost and model visibility (P1)

**Status:** In Progress

-   [~] AC1: The plan shows an **Estimated cost**: to build (by role and model) and to run the bots (per day, at their schedules), with a note to change schedules to lower it. _Not built: a per-day running figure from schedules — "to run" is the Planner's own text._
-   [ ] AC2: Each planned bot shows its model and tokens per run.
-   [x] AC3: Building shows actual tokens and cost per step and a running total; the end compares with the estimate (dollars only for API runs).
-   [x] AC4 (dash-core #720): Edit's bots row shows each bot's model and cost this month (from BudgetController usage).
-   [x] AC5 (dash-core #720): With Claude Code (subscription) as the AI, show tokens and "included in your plan" instead of dollars; dollars for API-key providers.

### CRE-013: States and accessibility (P0 across all boards)

**Status:** In Progress

-   [~] AC1: Designed states: AI thinking (progress per role), AI error (retry, switch AI), registry unreachable, offline, no providers, empty library, large dashboards (scrolling bots row), several builds at once (Recent statuses). _Built: no-AI, registry-unreachable and Recent states. Unconfirmed: offline, large-dashboard and per-role thinking states._
-   [~] AC2: Visible keyboard focus on every control and on the prompt box (`:focus-within`). _Not built: the Create prompt box has no focus-within ring._
-   [~] AC3: Text meets 4.5:1 contrast; placeholders included. _Not verified._
-   [x] AC4: Menus use `aria-haspopup`/`aria-expanded`; tab rows use `role="tablist"`/`role="tab"`/`aria-selected`.
-   [~] AC5: Every drag has a keyboard path: select a widget, then choose a target cell (Move to another cell; cells are focusable, Tab/Enter; click-to-place from Add). _Not built: arrow keys to move or resize the selection._

---

### CRE-014: Change a widget with AI, through the Dash team (P0)

**Status:** Implemented — consolidation Phase 3a built 2026-10-20; 3b (the Widget Builder's own chat retired) 2026-10-21

Mockup: https://claude.ai/artifact/TTKKYDWCdnfZZWCRnkQ5Ff

As a user, I change a widget I have by saying what I want, and see the change running before anything is installed.

-   [x] AC1: Every "change this widget with AI" door opens **Create › Change <widget>** on it: the widget panel and the card's ⋮ menu (**Change <widget>**), a crashed widget (**Fix <widget>**, any installed widget, with the error), and the Widgets page (**Change <widget>**). One event (`dash:edit-widget-with-ai`); dash-core's DashboardStage opens Create.
-   [x] AC2: Describe: the Scout says in plain words what it does now; Dash shows its settings (this cell's values), connection, what it sends and its package — from its config, never from the model.
-   [x] AC3: Where the change goes: **Update <widget> everywhere** (in place — everywhere it's used changes; the dashboards are listed) or **Save as a new widget** (it stays as it is; from a cell, the new one replaces it in that cell only). In place only for the user's own widgets (AI-built, or under their registry name — `widgetOwnership.js`); signed out, **Sign in to change <widget>**. Someone else's: Save as new only.
-   [x] AC4: The Planner plans exactly that widget (validatePlan `edit`: one widget piece — in place, source "update" with its package; as new, source "new"), saying what it **adds** and **keeps**. The plan card shows Adds / Keeps / Files; no Swap or Remove.
-   [x] AC5: The Builder writes a draft built inside a copy of the widget's package (its other files come along) — build_widget is held to that widget while the change's roles run (the main process works out the package from what's installed; the Builder can't point it elsewhere). It can read the package's other files (read_widget `file`), read-only.
-   [x] AC6: The Checker compares it with the widget as it was: a lost setting, provider or event fails unless the plan drops it.
-   [x] AC7: Preview: the real draft running with this cell's connection and settings, plus **Code** (the draft's files, read-only) and **What changed** (changed lines per file). Looks good — update <widget> / Change something / Discard — keep <widget> as it is. Nothing is installed before Looks good.
-   [x] AC8: Install: in place on the user's own package via Update original (version -local.N, backup, rollback if it fails) — the main process checks ownership again against who's signed in; an AI-built widget is replaced under its name; a new widget is installed as a remix of the original. A change's draft installs only from its own preview (the team's place_widget can't).
-   [x] AC9: Done: in place, the widget reloads where it runs (`dash:widget-changed` → new bundle, only its instances remount) — nothing to save; a new widget from a cell is swapped in as an unsaved change (scope and page guarded; Save keeps it, Cancel puts the old one back); from the Widgets page or the error box it's installed and the Done screen says where it is.
-   [x] AC10: The Widget Builder's own AI chat is retired (Phase 3b); it stays for building by hand (CRE-010 AC6).

**Implementation notes (Phase 3a, 2026-10-20):** dash-core `Create/CreateEdit.js`, `Create/editCreate.js` (steps, facts, usage, requests, lineDiff), `CreatePlanStep` / `CreateBuildingStep` / `CellPreview` `edit`; `electron/bots/editTarget.js` (resolve + ownership, parity-tested with `widgetOwnership.js`), planBuild `opts.edit`, botController `_editTarget` / `_editAskRole` / `_planInstallEdit`, `widgetRegistry.packageFiles` / `readWidgetFile`; role text (all four) upgraded with history. dash-electron `teamWidgetTools.buildChange` / `installDraft({ edit })` / `previewDraft` code; Dash.js hears `dash:edit-widget-code` (by hand) and `dash:widget-changed` (reload). Limits: the Builder changes only the component and its `.dash.js` in place, not helper files; one change builds at a time; an AI-built package with several widgets, or a package with no registry name, can only be changed as a new widget (`inPlaceProblem`, the same rule in Create and the main process). Fixed after the live test and review: settings written as a list (`userConfig: [{ key, label }]`) are read as the keyed object everywhere (`normalizeUserConfig` in ComponentConfigModel and the preview), and the team's builds must write the object; ownership comes from the installed package's scope only; a change in place installs as the component it was opened on; the error box clears when new code arrives; built-in widgets don't offer Fix with AI.

---

### CRE-015: One place to edit a widget (P0)

**Status:** Implemented — consolidation Phase 3P (dash-core #785 v0.1.800, #786 v0.1.801; dash-react #74 v1.0.80), 2026-10-21; AC9 Phase 4c (dash-core #789 v0.1.804)

Mockup: https://claude.ai/artifact/FhBmbzetEzqn4Xm1X73GPb

As a user editing a dashboard, everything about one widget is in one place, and there is one way to change it.

-   [x] AC1: Selecting a widget opens one stacked panel, read top to bottom: its name and whose it is ("Built by AI · yours", "From the registry · by acme"), a ⋯ menu (Move to another cell, Split side by side, Split top and bottom, Remove), one **Change <widget>** button, then **Settings**, **Connections**, **Listens for**, **Notifications** and **Schedule** (when the widget has them) and **Advanced: raw settings**. Each section says so when it's empty ("Counter doesn't use any.").
-   [x] AC2: **Listens for** lists each wiring ("Query changed — From Algolia Search Box", × to stop) and adds one with **+ Listen for another widget** (widgets' and bots' events). It shows for every widget — the rule no longer hides it for widgets the Dash team, bots or the MCP tool placed (they're saved typed as widgets; cells saved without a type are typed on load).
-   [x] AC3: One **Change <widget>** door everywhere — the panel, the card's ⋮ menu, a crashed widget's **Fix <widget>** (with the error and its cell), and the Widgets page (one per widget). It opens Create › Change: the Dash team, or **Or change it without AI: Edit the code yourself** for your own widgets (the Widget Builder, by hand, with the cell). Change waits while edits wait for Save ("Save or cancel your 1 change first.") and isn't offered for built-in widgets. The Ask AI tab is gone.
-   [x] AC4: The card's ⋮ menu: Edit in panel, Change <widget>, Move, Split ×2, Remove — no dialogs (dash-react ActionMenu, neutral, replacing the coloured MenuItem fills).
-   [x] AC5: Every change waits for the dashboard's Save, notifications and schedule included (they used to save at once, even on Cancel): they apply after the dashboard has saved; a failed save keeps them waiting; Cancel drops them and lists them.
-   [x] AC6: The Configure dialog is retired: headers, footer badges and old layouts select the widget in the panel at the asked-for section.
-   [x] AC7: Dashboard Config is the whole-dashboard view: Widgets shows one widget's summary and **Edit in panel** (its changes stay as unsaved dashboard changes, then the widget opens in the panel on its page); Listeners is a map of who listens to whom and Notifications a list, each row with Edit in panel; Providers keeps setting one connection for many widgets; "All widgets" keeps bulk settings.
-   [x] AC8: Raw settings edits are kept (they used to be dropped on Save).
-   [x] AC9 (consolidation Phase 4c, dash-core #789 v0.1.804): **What's missing says so, on the card.** While you edit, a widget card's header has one amber pill for what isn't set: "Needs a Slack connection" (a required connection with no pick — its own, the dashboard's for it, or a default of that type), "N listeners not connected", or "2 things to fix". Clicking it selects the widget and opens the panel at the fix — **Connections** first, else **Listens for**; ⋮ › **Edit in panel** also opens at Connections while one is missing. The footer's listener pill moved up into it (the card has no footer now).

**Implementation notes:** dash-core `Dashboard/WidgetPanel.js`, `ListensFor.js`, `widgetPanelText.js`, `pendingSettings.js` (store + context; applied in `handleSaveWorkspaceComplete`), `configHandOff.js`, `ConfigLists.js`; `utils/widgetSections.js` (`showsListeners`, `panelSections`); `EditPanel`, `WidgetCardHeader` → ActionMenu; `LayoutBuilder` edit actions guarded by scope and page (uuids repeat across pages and the sidebar), `LayoutPageContext`; `LayoutBuilderConfigModal` and `WidgetConfigPanel` deleted. No dashboards used the old flex layout (0 of 82 checked).

---

## Open gaps

One list; each is open unless it says otherwise.

1. **The Checker doesn't render the widget.** `check_widget` compiles the draft and runs the code checks, the must-fix checklist and a config read; nothing runs it in a hidden preview, so a widget that compiles but fails at runtime passes. Needs a hidden preview window.
2. ~~**⌘K is shown but not bound.**~~ Not a gap (QA 2026-10-22): dash-react's CommandPalette binds ⌘K / Ctrl+K to toggle the palette, so the empty state's "Press ⌘K to search dashboards…" is right.
3. **"AI Assistant" leftovers.** The Settings tab is already **AI**, but a few strings still say AI Assistant: the default `author` on widgets the builder makes ("AI Assistant" — WidgetBuilderModal, WidgetConfigureTab, aiBuild.cjs), the fallback provider name "Anthropic (AI Assistant)" in Settings › AI, and "Asked via the AI Assistant" on old conversations. (Code-nits PR.)
4. **Arrow keys** to move or resize a selected widget (CRE-013 AC5).
5. **A live preview while building** (CRE-004 AC2).
6. **Add tab:** Install & add with the grant inline (CRE-010 AC2); an empty library opening on Registry (AC3); empty-column and footer hints (AC4).
7. **Resizing by dragging** (CRE-010 AC1).
8. **Cost:** a per-day running cost from schedules (CRE-012 AC1); each planned bot's model and tokens per run (CRE-012 AC2).
9. **Reuse:** a dashboard plan doesn't reuse your bots, or search dashboard packages and bot templates (CRE-009 AC1–2).
10. **Create's + attach** (a provider or file) (CRE-001 AC3).
11. **States and accessibility:** offline, large-dashboard and per-role thinking states; a focus ring on the prompt box; a 4.5:1 contrast check (CRE-013 AC1–3).
12. **Remounts on mode switch:** widgets in the PinnedSidebar and on legacy (non-grid) dashboards still reload between view and edit. _(Not re-checked in Phase 5.)_
13. **Deleted drafts linger in the widget list:** `drafts.delete` removes the draft folder but leaves an `@ai-built/draft-<id>` entry in `widgets.list`. _(Not re-checked in Phase 5.)_
14. **Not verified in a packaged build:** the app.asar library cache the compiler uses for a package's npm libraries.
15. ~~**A saved plan can't be reopened once it's out of view.**~~ Closed (QA 2026-10-22): plans never built and builds not cleanly done are **Unfinished** on Create's start screen, with **Continue** and **Discard** / **Forget**.

## Open Questions

1. ~~Edit: same modal or lighter panel?~~ Decided: a mode on the dashboard with select-to-edit (CRE-006).
2. ~~**Dash team visibility:** its own page, or only inside Create?~~ Decided (Phase 4a, 2026-10-21): its own page, pinned in the Bots panel, with Conversation and Settings; it also does the work inside Create.
3. **Cost estimates:** how are estimates calibrated — fixed per-step figures first, then learned from the user's actual runs?
4. **Starter previews:** real screenshots or drawn thumbnails? (Today: drawn from the package's layout.)
5. ~~**Assistant merge:** fully into the sidebar, or keep "ask" separate?~~ Decided (2026-10-14): the panel is retired (5e-2c); since Phase 4a, asking is the Dash team page.

## Revision History

| Version | Date       | Author            | Changes                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1     | 2026-10-10 | John Giatropoulos | Draft for discussion, with mockup                                                                                                                                                                                                                                                          |
| 0.2     | 2026-10-10 | John Giatropoulos | Select-to-edit; one edit mode (Add / Ask AI); reuse before building; fresh-eyes review applied (no-AI start, approvals before Build, failure/Stop, staged Cancel, states, a11y); Dash team (CRE-011); cost and model visibility (CRE-012); phases reordered around a smaller first version |
| 0.3     | 2026-10-11 | John Giatropoulos | Phase 1 shipped; phase 2a (start screen, Widget/Bot types, no-AI row, entry points) implemented; follow-ups listed                                                                                                                                                                         |
| 0.4     | 2026-10-16 | John Giatropoulos | Phase 1b: plan builds write drafts, Check → Install → Place; plans with errors don't build                                                                                                                                                                                                 |
| 0.5     | 2026-10-19 | John Giatropoulos | Consolidation Phase 2a: one door — every New Dashboard opens Create, the Wizard and pickers are deleted, the rail's + is gone, Ask is in Create, ⌘N opens Create                                                                                                                           |
| 0.6     | 2026-10-20 | John Giatropoulos | Consolidation Phase 2b: an empty cell's Build with AI goes through the Dash team, with a preview before install, into the open edit                                                                                                                                                        |
| 0.7     | 2026-10-20 | John Giatropoulos | Consolidation Phase 2c-1: Create › Bot goes through the Dash team — Scout (your bots and registry ones), one-bot plan, checked, saved paused, Try it now / Turn on; Where picks its dashboard                                                                                              |
| 0.8     | 2026-10-20 | John Giatropoulos | Consolidation Phase 2c-2: team leads hand making things to the Dash team (Plan this with the Dash team), with the team's context; lead drafts removed                                                                                                                                      |
| 0.9     | 2026-10-20 | John Giatropoulos | Consolidation Phase 3a: Change with AI goes through the Dash team (CRE-014) — Scout, Planner, Builder draft, Checker, preview with code and what changed; in place for your own widgets, else a new widget                                                                                 |
| 1.0     | 2026-10-21 | John Giatropoulos | Consolidation Phase 3P: one place to edit a widget (CRE-015) — one stacked panel, one Change door (AI or by hand), Ask AI tab and Configure dialog removed, notifications and schedule wait for Save, Dashboard Config hands a widget to the panel                                         |
| 1.1     | 2026-10-21 | John Giatropoulos | Consolidation Phase 3b: new widgets go through the Dash team (CRE-005 AC3) and the Widget Builder becomes the by-hand tool with no AI of its own (CRE-010 AC6, CRE-014 AC10); Create's modal drops the Ask box and Recent (sidebar keeps them)                                             |
| 1.2     | 2026-10-21 | John Giatropoulos | Consolidation Phase 4: asking moves to the Dash team page (CRE-007), the card's missing-connection pill (CRE-015 AC9), the Widgets page drill-in and preview auto-run, the Widget Builder's Logs and Style checks tabs and name-on-Enter                                                   |
| 1.3     | 2026-10-22 | John Giatropoulos | Consolidation Phase 5: one current source — "How making things works today" (doors, roles, install gate, edit mode, Widgets page, Recent), current ACs only (CRE-008 Implemented; CRE-011 AC5 and CRE-006 AC8 superseded), one list of open gaps, history moved to the appendix            |
| 1.4     | 2026-10-22 | John Giatropoulos | Recent leaves Create (CRE-007); **Unfinished** plans on Create's start screen; **Recently created** heads the Add list (CRE-010 AC2); "Forget plan" replaces "Remove from Recent"                                                                                                          |

---

## Appendix: history

Kept so nothing is lost. None of this is current unless "How making things works today" or a user story says so.

### Phases (as planned and shipped)

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

Then the consolidation roadmap (2026-10-16 onward): Phase 0 and 1 (one install gate, check before install), Phase 2 (one door: Create; cell builds, bots and lead hand-offs through the Dash team), Phase 3 (Change through the Dash team; one widget panel; the Widget Builder by hand), Phase 4 (UI dead ends: the Dash team page, the Widgets drill-in, the card pill, builder wording), Phase 5 (this reconciliation).

### Follow-ups (deferred from phase 1) — status at Phase 5

1. ~~**Configure screens in the panel (CRE-006 AC4/AC5)**~~ — done: widget side dash-core #718 (v0.1.733), bot side #719 (v0.1.734); since replaced by the one widget panel (CRE-015).
2. **Arrow-key move and resize (CRE-013 AC5)** — open (Open gaps 4).
3. **Remounts on mode switch** — open (Open gaps 12).
4. ~~**⌘K label**~~ — done: the palette's Create… shows ⌘N (bound), and ⌘K opens the palette as the empty state says (Open gaps 2).
5. ~~**Build-mode registry panel:** the builder searched the registry with the latest visible message and showed "0 matches" in Build mode~~ — moot: the Widget Builder has no AI chat or registry search (Phase 3b).
6. **Deleted drafts linger in the widget list** — open (Open gaps 13).
7. ~~**Move the other builder entry points into Create** (empty-cell Build with AI, Edit with AI, Widgets page)~~ — done: Phases 2b, 3a and 3b.

### Retired acceptance criteria (old text)

-   **CRE-001 AC1 (before Phase 5):** "A single Create modal, full screen with a margin, opens from the left rail's **+** and from Cmd/Ctrl+K "Create…"." (2a: the rail's + was labelled Create; "Create…" was in the command palette; nothing bound ⌘K. Phase 2a, 2026-10-19: ⌘N / Ctrl+N opens Create; the rail's + was removed.)
-   **CRE-001 AC3 (wording before Phase 5):** "Under the box: **+** (attach a provider or file), **Type** (Auto, Dashboard, Widget, Bot, Theme) and **Where** (New dashboard, or an existing one). Both are menus. Type Dashboard + Where existing means "add to that dashboard"." Where became Bot-only; a plan names an existing dashboard instead (5e-2b).
-   **CRE-001 AC6 (2a):** "Enter sends — Widget opens the Widget Builder with the prompt as its first, visible message; Bot opens the bot form." Replaced by the conversation inside Create and, from Phase 2c-1/3b, by the Dash team for Bot and Widget.
-   **CRE-005 AC1 (2a–2c-3):** "Type Widget, Bot or Theme skips the multi-part plan: the conversation builds that one thing with its preview beside it (today's Widget Builder and bot form, inside the modal)." 2c-3 put the Widget Builder inside Create under "Create › New widget"; Phase 2c-1 moved Bot and Phase 3b moved Widget to the Dash team.
-   **CRE-005 AC2 (2c-1):** "Provider choice happens in the conversation, not as a list before typing" — after the prompt, "Which data should this widget use?" with guessed types, No external provider and Choose another…. Retired in Phase 3b with the Widget Builder's chat; the Planner works out a widget's data.
-   **CRE-006 AC4 (dash-core #718):** "Selecting while on **Add** or a settings tab opens the selection's settings (widget: Settings; bot: Instructions). Only Ask AI stays on Ask AI." The Ask AI tab is gone (Phase 3P).
-   **CRE-006 AC5 (dash-core #718/#719):** "The selection's no-chat tabs: widget Settings, Listeners, Code; bot Instructions, Runs, Access; dashboard Theme." Notifications/schedule were behind "More settings…". Phase 3P made a widget's settings one stacked panel.
-   **CRE-006 AC8:** "Adding bots or widgets through Ask AI comes back as a plan (needs CRE-003; until then Ask AI changes one selected widget or bot)." Partly built in Phase 3 (Change this widget with AI; a cell's plan for one widget); superseded when the Ask AI tab was removed.
-   **CRE-007 AC2 (4e-1 wording):** "Recent lists every conversation with live status (building 3/7 · $0.55, draft plan, edit saved, answered); each is a link." Rows for edit sessions were never built; questions moved to the Dash team page.
-   **CRE-007 AC3:** "Folding an Edit session with unsaved changes keeps a "Editing · unsaved" banner on that dashboard until saved or cancelled." Superseded 2026-10-12 (Edit became a mode).
-   **CRE-007 AC4 (5e-1, 5e-2a–c):** "The AI Assistant panel becomes this sidebar (P2): questions and making things share one list." 5e-1: the dock's Create panel had an Ask box; questions went to the Planner and were kept in Recent as Asked / Answered, with **Open as a plan**. 5e-2a (dash-core #747 v0.1.762): a **To:** picker — Dash team (default) or a dashboard's team lead; "Answered · <lead>"; the Bots view labelled it "Asked from Create". 5e-2b (dash-core #748 v0.1.763): a plan can change a dashboard you have (`plan.dashboard`), adding widgets and bots and applying a saved theme; "Changes to <dashboard> · not made yet" / **Make these changes**; it waits while that dashboard has unsaved edits; Remove takes off only what it added. 5e-2c (dash-core #749): the AI Assistant rail panel retired; the rail became Create and Bot Activity; Settings › AI Assistant became Settings › AI; Dash's MCP server's lead questions say "Asked through Dash's MCP server".
-   **CRE-007, Phase 2a (2026-10-19):** the right rail's **+** removed; Ask moved into Create's start screen (**Or ask a question**, with the To: picker); a question opened as a step inside Create. Phase 3b moved the Ask box and Recent to the sidebar's Create panel; Phase 4a (dash-core #788 v0.1.803) moved asking to the Dash team page and left the Create panel with Plans and Unfinished widgets.
-   **CRE-007 layout pass (screen audit, October 2026 — screen 1):** the dock's Ask box was a `ChatComposer` pinned at the bottom under Recent; an empty dock showed `EmptyState` with **Make something new…**. The Ask box was removed in Phase 4a.
-   **CRE-008 rows before Phase 5:** Empty cell → Add widget → "Edit modal on **Add**, no AI"; Dashboard pencil → "Edit modal on **Add**, nothing selected"; "Widget menu / Edit panel / Ask AI / error box / Widgets page → **Change with AI**"; AI Assistant panel → "The sidebar (CRE-007 AC4)".
-   **CRE-010 AC2 (before Phase 5):** "**Add**: searchable, filters All / Mine / Installed / Built in / Registry." The panel then had a Discover tab; in edit mode it's labelled Registry.
-   **CRE-010 AC5:** "A placed widget that needs wiring says "not connected yet · Connect it…" and opens its Listeners." Superseded by CRE-015 AC9's card pill.
-   **CRE-011 table (Checker, before Phase 5):** "Checks the work: each widget renders, each trigger fires, nothing exceeds what was approved (e.g. no send-email tools)" with "read-only + preview runs". The Checker never rendered widgets or ran previews; its tools are static (Open gaps 1).
-   **CRE-011 AC2 (slice 4):** a SCOUT step in Create and a CHECKER card in the Widget Builder, each with model and tokens. The CHECKER card was removed (2026-10-16).
-   **CRE-011 AC3:** "editable in Settings" — the picks moved to the Bots page's Dash team section, then to the Dash team page's Settings (Phase 4a).
-   **CRE-011 AC5 (dash-electron slice 4):** "The Checker can send a step back to the Builder ("Let Builder fix it"), at most twice, then asks the user" — after each Widget Builder install. _Changed 2026-10-16 (Widget Builder edit fixes): the Checker no longer runs after the install._ A user updated a widget, saw "Widget Updated!" with **Done** while the Checker was still running, and it then failed — the widget was already saved. Then the Widget Builder checked code **while it was written**: each version that compiled got the fast checks — built inside a copy of its package, the code checks, the must-fix checklist — via widget:check-draft (teamWidgetTools checkDraft), then the Checker on it as draft:<Name>. Problems went back to the AI hidden, at most 2 rounds. **Install / Update was enabled only when this exact code passed**; there is no install-anyway. A ChecksStatus line beside the button said Waiting for the AI / Checking / The Checker is reviewing it / Fixing N problems / Checked ✓ / problems left. A paused or missing Checker left the fast checks as the gate and said the review was skipped. CheckerCard and teamCheck.js removed. (Phase 3b removed the builder's AI; problems are now listed to fix by hand.)

### CRE-004 build fixes (2026-10-15 to 2026-10-16)

-   _Build fixes, 2026-10-15 (a user's 7-widget Algolia dashboard was left half-built):_ a build step now trusts **build_widget's own result** (the controller notes each result for the run as `record.builds` — `_noteBuild` / `_takeBuilds`), falling back to the package the Builder's answer names, case-insensitively (a PascalCase `@ai-built/IndexCompare` was missed before, so a widget that built was reported failed). A failed build says why — "the Builder didn't build it — build_widget said: …" or "it never called build_widget" — and keeps the Builder's answer under the step; steps waiting on it say "<step> didn't finish: <why>". Widgets you already have are placed by their **component**: plans may name `component` (the Planner gives it when a package has several widgets), and otherwise the piece's name picks it, ignoring spaces and case ("Algolia Rules List" → AlgoliaRulesList). A place that fails because the widget can't be told apart no longer offers Try again. The Builder is told to rebuild with update: true when build_widget says the widget already exists. Still to do: placeholders for failed widgets, and a Checker that renders the widget.
-   _Build fixes 2, 2026-10-15 (the same dashboard came out on one page, with no connection or index set):_ a plan now carries what the user answered. The layout piece can list **pages** (`[{ name, widgets: [widget names] }]`); a new dashboard gets one page per planned page (each grid sized for its widgets, the first shown — dash-core `utils/placeWidget.js` `blankDashboard`), and each widget is placed on its page (`teamPlan.js` `planPages`; widgets no page names go on the first). A widget piece can give its **provider** (`{ <type>: <connection name> }`) and **settings** (its userConfig values); when it is placed, a connection the user has of that type is set on the widget (`selectedProviders`, any case, its saved name kept) and only settings the widget's .dash.js declares are saved — what was left out is named under the step (“left out: setting "colour"”). The Planner is told to put answers into the pieces and drop answered questions; it can now read_widget to see setting names. **Build waits** while the plan still has questions (“Answer the Planner's questions first.”). The new dashboard is named after the layout without a trailing “layout”, and a layout piece without a source counts as new. **Automatic fixes:** a failed build or check goes back to the Builder by itself (“Fixing what went wrong · try 1 of 2”), at most twice, before the step offers Edit plan / Remove; a role that didn't run (no AI, paused) isn't retried. A plan that changes a dashboard you have still places on the page it shows. Edit plan keeps earlier placements, so a dashboard built before this keeps its single page. **Plan screen:** full size, once there's a plan, the plan and the chat are two equal columns (plan left, chat right); the chat is one scroll area that ends with the Planner's questions and Send answers, opens at its end, and keeps only the reply box pinned. The dock stays one column, also one scroll area opening at its end. Built steps use the theme's main text colour (details muted), and in the dock a step's AI use goes on its own line. While the Planner (or any chat reply) is still arriving, a spinner shows beside its name (dash-react 1.0.78 ChatMessage streaming). Shipped in dash-core 0.1.780.
-   _Build fixes 3, 2026-10-15 (a built Attribute Boost asked for an App ID and API keys and called Algolia with fetch, while the Algolia connection sat unused):_ the Checker fails what it used to pass with notes. A new Widget Builder code check (src/AiAssistant/widgetCodeValidator.js `validateProviderCredentials`, in the generated public/lib/widgetChecks.cjs) flags a widget whose config declares a connection but has a credential-like setting (apiKey, adminApiKey, secret, accessToken, password; an App ID only alongside a direct call) or fetches the connected service itself; the Builder's build_widget refuses it before installing, and check_widget reports it. A data widget's missing **loading** and **error** states are now must-fix (`mustFix` from teamWidgetTools.cjs scorecardSummary): the Checker fails on them, while style misses stay notes. The Checker's request now carries what the plan says the widget does, its connection, the settings the plan sets and the plan's checks (dash-core planBuild.js `checkRequest`), and its instructions say to judge each check and fail a widget that asks for keys. Still to do: a Checker that renders the widget (needs a hidden preview window).
-   _Plan grids, 2026-10-16 (a storefront plan said "search on top, filters down the left, results in the middle, pagination below" only in notes, and the build made a plain 2-column grid):_ a layout page can carry a **grid** — `cols`, `rows`, `colWidths` (1/4, 1/3, 1/2, 2/3, shrink, grow), `rowHeights` (shrink, grow; rows grow unless planned) and `cells` [{ widget, row, col, rowSpan?, colSpan? }] (dash-core teamPlan.js). validatePlan rejects cells outside the grid, overlapping cells, two cells for one widget and unknown sizes, and warns on unknown widget names. planPages carries the grid with each widget's cell (a widget without one gets the first free cell no other widget is planned for), and a single named page keeps its name instead of "Page 1". blankDashboard (utils/placeWidget.js) builds the planned grid — sizes as colModes / rowModes, spans on the anchor cell, covered cells hidden — and each widget is placed in its cell. A cell holds one widget, so stacked filters are one per row with the results spanning those rows; the Planner is told this, with that pattern as its example, and to give positions in the grid, never only in notes. The plan card's preview sketch draws the first page's grid (one column in the dock). Plans that change an existing dashboard still place into free cells. **Dashboards can be apps:** the Planner reuses a widget when it fits the experience the user described, not because it exists; when a request describes one experience (a storefront: search, filters, results and paging) it asks whether to build one new widget that does it all or assemble existing widgets, with the trade-off, unless the user already said. **Bots-only plans:** a team of bots needs no widgets — the plan is the bots plus a layout piece naming their (empty) dashboard; whether each bot gets a Bot results card is the user's call, so the Planner asks (a results card per bot, or keep the dashboard empty with results in the Bots view) unless they said, and adds a button or other widget only when asked (dash-core 0.1.783).
-   _Checked before installed (consolidation Phase 1b, 2026-10-16):_ the Builder's **build_widget writes a draft** (`draft:<Name>`) — compiled and code-checked like before, but nothing is installed. Each new or changed widget is now **Build → Check → Install → Place**: the Checker checks the draft, and only a PASSED verdict runs the **Install** step, which installs exactly the checked code through the install gate (dash-electron teamWidgetTools.cjs `installDraft`; the Checker's verdict is recorded on the draft for every Checker run — `reviewRun`, botController `_reviewedRun`). An update replaces the live widget only then. A widget that never passes is never installed, so Remove has nothing of it to clean up (builtSummary reads Install steps). Let Builder fix it rewrites the draft (a new widget isn't an update) and it's checked again; a refused install can be fixed by the Builder too. Outside plan builds, place_widget installs a draft only if the Checker passed it. **Plans are checked before building:** the main process validates the plan against the user's dashboards and themes and refuses one with errors (startPlanBuild); the Create screen disables Build and shows the errors in red. Only what the build needs is an error — a provider that isn't connected, and what a plan says about itself (summary, checks, access, estimate), are warnings — and the renderer's plan check is now an exact copy of the main process's (teamPlan.parity.test.js). Review fixes: Continue building / Edit plan keep a widget installed earlier (its Install step is reused; a build from before the Install step counts its built widgets as installed, and Remove still finds them), and rebuild one that was checked but never installed; a draft is installed once (installing it again is that widget); the Checker's verdict counts only for the draft it ran check_widget on (exactly one, unchanged since); fixing an installed widget is an update; an install that fails for an outside reason offers Try again, one refused for its draft offers Let Builder fix it; grid slips are warnings (cells that don't fit are skipped); the plan screen has **Ask the Planner to fix it**, and a refusal from the main process shows in red.

### Widget Builder edit fixes (2026-10-16)

Editing AlgoliaHits from the user's own @trops/algolia-search failed to build — "Could not resolve ./algoliaProviderConfig" — and "Update original" had only ever made an @ai-built copy. **Update original** on a widget from one of the user's own packages now rebuilds that package in place: a full copy (every widget, shared file and setting) with the edited widget written over it, its version bumped to the next patch with a -local suffix (0.0.911 → 0.0.912-local.1, so a real 0.0.912 from the registry still counts as newer), compiled, and reinstalled under its own name; the installed package is untouched until the build compiled and is put back if installing fails (public/lib/packageUpdate.cjs, aiBuild.cjs updateOriginalPackage). @ai-built widgets and Remix as new are unchanged. The compiler finds a package's npm libraries in the app's own (every node_modules at and above dash-core and the app folder; out of app.asar via a per-version cache when packaged — dash-core electron/widgetCompiler.js) and names a missing library or file plainly. The category comes from the widget's config, else its package manifest; when neither has one the user picks it — Update original too — and it's written into the widget's config (the registry organizes widgets by category). The AI is told to keep imports of the package's own files and never add API-key settings. **Drafts only when asked:** no automatic drafts; **Save as draft** for new widgets and edits (an edit's draft remembers what it edits and resumes as that edit); leaving with unsaved work — the builder's Close or its window's dismissal, or Create's ← Back / × through a leave guard Create awaits (dash-core CreateModal setLeaveGuard) — asks **Save as draft / Keep editing / Discard** (UnsavedWorkPrompt, a portal so the builder's window can't cover it). **A package registers only its own widgets:** a leftover @ai-built copy of AlgoliaHits whose .dash.js still said id "trops.algolia-search.AlgoliaHits" had taken the original's place on the user's dashboard (the bundle loader keys by the config's id, and ComponentManager fell back to its scope/packageName). Bundles now register under the id, scope and packageName of the package being loaded (src/AiAssistant/widgetIdentity.js in Dash.js registerBundleConfigs; a claimed id is logged), and installs rewrite a config's id/scope/packageName to the package it lands in (widgetImportFixes.cjs claimConfigIdentity) — so uninstalling a copy removes only its own widgets and the original keeps working with no reload. Not verified in a packaged build: the app.asar library cache.

### Story annotations before Phase 5

The stories carried per-slice notes ("(2a: …)", "_(Built, 2026-10-14: …)_", "_(Partial, 2026-10-14: …)_") from the 2026-10-14 reconciliation. Phase 5 folded them into each AC's current text; the slice details are in the phases above, the revision history and git history.
