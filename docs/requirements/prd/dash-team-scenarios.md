# Dash team — use cases walked through on paper

**Status:** Slice 0 of phase 3 (create-entry PRD CRE-011 / CRE-012)
**Last Updated:** 2026-10-11
**Related:** [create-entry.md](./create-entry.md) · dash-core `bot-teams.md` (TEAM-010 team_run_bot) · `bot-factory.md` (US-016 model advisor, US-019 budgets) · `bot-capabilities.md` (CAP-006 built-in tools)

Before building the Dash team (Planner, Scout, Builder, Checker), six realistic requests are walked through the planned team: who does what, with which tool, what the user must approve, roughly what it costs, and where it breaks. Every step is checked against what the code has today. The gaps feed the phase 3 slices; the scenarios later become the Planner's test set (plan-only runs, nothing built).

**Roles, as planned (phase 3):**

| Role    | Model tier (Anthropic) | Tools                                                                                                      |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Planner | deep (Opus)            | read-only: library, providers, results · `ask_role` to hand work to the others                             |
| Scout   | fast (Haiku)           | `search_library` (installed + `@ai-built` + registry) · read-only                                          |
| Builder | balanced (Sonnet)      | `build_widget` (wraps the headless `widget:ai-build`) · `create_bot` (staged, user accepts) · layout tools |
| Checker | balanced (Sonnet)      | `check_widget` (compile + code checks + Scorecard) · read-only · can fail a step                           |

**What exists today (verified):** running a bot with a prompt and getting its output (`bots.run`); team leads as built-in-ish bots (`role: "lead"`); the Dash MCP tools (`search_widgets`, `install_widget`, `add_widget`, `create_dashboard`, `set_layout`, `list_providers`, …) — but bots don't get them; headless widget compile (`widget:ai-compile-preview`) and install (`widget:ai-build`); the builder's code checks and Scorecard (renderer-side code); `propose_bot` (drafts only); usage per run (tokens, partly counted) and monthly spend.

**Cost figures** are rough per-run estimates at Anthropic API prices (Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per 1M tokens in/out). On Claude Code they're tokens "included in your plan".

---

## 1. "A widget with my unread Gmail count"

**Flow**

1. **Scout** — `search_library("gmail unread count")`: your widgets (none), `@ai-built` (none), registry (maybe a Gmail widget). Nothing fits → "build new".
2. **Planner** — needs Gmail; `list_providers` shows it isn't set up → **Before building: Connect Gmail**.
3. **User** connects Gmail (OAuth; the team never does this).
4. **Builder** — writes the widget for the Gmail MCP provider (tool names from the MCP catalog / `mcpKnownTools`), `build_widget` → installs to `@ai-built/`.
5. **Checker** — `check_widget`: compiles, no made-up components, provider calls exist, Scorecard passes. Fails → back to Builder (≤ 2).

**Approvals:** connect Gmail · the widget's tool grant at first use (JIT consent).
**Cost:** Scout ~5k in / 0.5k out ($0.01) · Builder ~25k / 4k ($0.14) · Checker ~10k / 1k ($0.05) → **~$0.20**.

**Gaps**

-   **G1** The team must **wait for a provider the user hasn't connected** instead of failing (CRE-004 AC5) — needs a "waiting for Gmail" step state. _(phase 4)_
-   **G2** The Checker **can't see the widget render** — the render check (empty preview, runtime errors) needs the preview iframe. A headless render check needs an offscreen window. _(later; slice 3 ships compile + code checks + Scorecard)_

## 2. "A morning PR digest bot, and a widget showing its results"

**Flow**

1. **Planner** — asks one question (which repos?), plans: a bot (weekdays 9:00, GitHub read tools, publishes `digest`) + a widget showing it.
2. **Scout** — `search_library("bot results")`: the built-in **Bot results** widget (`dash.bots.BotResults`) already shows a bot's latest result (team-dashboards TD-001/002, shipped) → reuse, no new widget.
3. **Builder** — `create_bot` (name, instructions, schedule, GitHub tools, `publishes: [digest]`); places Bot results on the dashboard, pointed at the bot.
4. **Checker** — the bot's tools are read-only (no write tools selected); the schedule is valid; the widget's result source is the new bot's `digest`.

**Approvals:** GitHub connected · accept the new bot (it runs on a schedule) · the bot's tool grants (read-only tools skip the prompt under "ask").
**Cost:** build ~$0.10 (Planner + Scout + Builder + Checker, small) · **running cost**: one Sonnet run per weekday ~15k / 2k ≈ $0.08 → **~$1.70/month**.

**Gaps**

-   **G3** The Builder has **no tool to create a bot** — only `propose_bot` (drafts in memory, lead-only). Needs `create_bot` that stages a bot for the user to accept. _(slice 3)_
-   **G4** **`add_widget` on paged dashboards** is likely broken (an earlier finding, not re-verified here: paged dashboards render `pages[active].layout`, and the top-level layout is only a mirror). Verify, and make the Builder's placement target the page. _(slice 3 — check before relying on it)_
-   **G5** The plan's **running-cost estimate** needs per-model prices and the bot's schedule — prices exist for Anthropic/Claude Code only; OpenAI/xAI have no curated list. _(slice 1 for recording; estimates in phase 4)_

## 3. "Add a date filter to my existing Inbox widget"

**Flow**

1. **Builder** — reads the widget's source (`widgetBuilder.readSources` exists), edits it, `build_widget` as an update of the same package.
2. **Checker** — compile + code checks + Scorecard, plus **no lost settings**: every `userConfig` field and its `defaultValue` from the old config is still there (the prompt already asks for this; nothing checks it).
3. The edited widget is swapped into its cell (the shared finish step does this).

**Approvals:** none new (same package, same provider).
**Cost:** Builder ~30k / 5k ($0.17) · Checker ~12k / 1k ($0.05) → **~$0.22**.

**Gaps**

-   **G6** The Checker needs an **"old vs new config" check** (lost `userConfig` fields / defaults, removed events other widgets listen to). _(slice 3, small)_

## 4. "An Algolia search widget"

**Flow**

1. **Scout** — `search_library("algolia search")`: the registry has `@trops/algolia` widgets; you may already have it installed → **"Yours" / "Registry · install"**, no build.
2. **Planner** — offers it: "Use the Algolia Search widget from the registry · can read your Algolia index".
3. **User** approves the install and its permissions (the install-time permission review exists).
4. **Builder** — `install_widget` + place it.

**Approvals:** install + its declared permissions · Algolia provider connected.
**Cost:** Scout + Planner ~**$0.03**. No build.

**Gaps**

-   **G7** Today's widget search (`search_widgets`) covers the **registry only** — your installed and `@ai-built` widgets aren't searched, so "Yours first" (CRE-009 AC1) can't work. `search_library` must merge both. _(slice 3)_
-   **G8** Installing from the registry **needs registry sign-in** for private packages and shows the permission review — the plan must list it under "Before building" (CRE-003 AC3), not pop it up mid-build. _(phase 4)_

## 5. "A bot that posts my daily summary to Slack"

**Flow**

1. **Planner** — plans a bot with Slack tools to **send** a message; states it plainly: "can post to #general".
2. **Checker** — the bot's tool selection includes a write tool (`chat_postMessage`); write tools always ask unless "Always allow" is granted (the permission gate classifies read-only vs write today). Confirms only the needed Slack tools are selected (least privilege).
3. **Builder** — `create_bot` with exactly those tools; the approval policy stays "ask".

**Approvals:** Slack connected · accept the bot · its first post (or "Always allow").
**Cost:** build ~$0.08 · running ~$0.05/run.

**Gaps**

-   **G9** "**can / can't**" disclosure (CRE-003 AC5) needs the read-only vs write classification exposed to the Planner/Checker as data (the gate has it internally). _(slice 3)_
-   **G10** Claude Code bots get **every built-in tool** (Bash, Write, WebFetch…) unless set otherwise; the Dash team roles and the bots they create should get none / read-only (CAP-006). _(slice 2)_

## 6. "A morning brief dashboard: calendar, email and Slack"

**Flow**

1. **Planner** — a few tappable questions (which calendar, which channels, a summary bot?), then a **plan**: 3 widgets (Scout: calendar from the registry, Gmail from scenario 1 if built, Slack channels yours), an optional summary bot, a layout, **Before building** (connect Google Calendar, Gmail, Slack), an estimate.
2. **Builder** — builds what's new one at a time, `create_dashboard` + layout, places and wires.
3. **Checker** — after each piece; a failure stops that piece ("Let Builder fix it" ≤ 2, then asks).

**Approvals:** three connections · installs · the bot.
**Cost:** build ~$0.60–1.00 (Planner Opus is the biggest share) · running: the summary bot ~$1.70/month.

**Gaps**

-   **G11** A **structured plan** the UI can show and the Planner tests can check (questions, pieces each tagged Yours / Registry / New, layout, before-building list, estimate). _(phase 4 — but define the schema in slice 3 so tests can start)_
-   **G12** **Multi-step orchestration** — progress, Stop, failed-step recovery, waiting on connections (CRE-004). _(phase 4)_
-   **G13** **Hand-offs** between roles with a loop guard, budget and fan-out cap (TEAM-010 `team_run_bot`). _(slice 3: `ask_role`)_

---

## Gaps by slice

| Slice                         | Closes                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Cost & usage**          | Every run records model, provider, all tokens (every turn, cache included) and cost; Claude Code = tokens "included in your plan"; G5 recording                           |
| **2 · The team exists**       | Built-in, undeletable, pausable (pause persists) roles; per-role model by tier per provider; G10 per-role built-in tools                                                  |
| **3 · Role tools**            | G3 `create_bot` (staged) · G4 placement on paged dashboards · G6 old-vs-new config check · G7 `search_library` · G9 can/can't data · G13 `ask_role` · plan schema for G11 |
| **4 · Builder uses the team** | Scout before building, Checker after each build                                                                                                                           |
| **Phase 4**                   | G1 waiting on connections · G8 before-building approvals · G11 plan UI · G12 orchestration                                                                                |
| **Later**                     | G2 headless render check                                                                                                                                                  |

**Also found while mapping (bugs, not team gaps):**

-   On the **Anthropic API** backend the Widget Builder may still be offered the Dash tools — `disableTools` isn't checked in that path (it is on Claude Code).
-   Team leads run on **Opus** by default (`model: null` → provider default), though the bot-teams PRD says a lead's default is the fast tier.
-   The tool-loop engine records only the **last turn's** tokens; neither engine counts cache tokens; Claude Code runs are priced in dollars. _(slice 1)_

## Planner test set (once the Planner exists)

Each scenario becomes a plan-only run — the Planner produces a plan, nothing is built — with expectations:

| #   | Expect in the plan                                                                        |
| --- | ----------------------------------------------------------------------------------------- |
| 1   | a new widget for Gmail · Before building: connect Gmail                                   |
| 2   | a scheduled bot publishing `digest` · the built-in Bot results widget (reused, not built) |
| 3   | an update to the existing widget · no new package                                         |
| 4   | the registry Algolia widget (Registry · install) · no build                               |
| 5   | a bot with only the Slack send tool it needs · "can post to Slack" stated                 |
| 6   | three pieces tagged Yours/Registry/New · three connections · an estimate                  |
