# Dash — Manual QA Test Plan

A friend-friendly checklist for testing a Dash release end-to-end on your own machine. Pick a topic, run through it, and file findings using the [report template](./REPORT-TEMPLATE.md).

Each section has a rough time budget. The whole sweep is ~3 hours; you do not have to do it all in one sitting, and you do not have to do every section. **Claim a section in the tracking issue/Slack thread before you start so we don't double up.**

If something on this list doesn't match what you see in the app, that's still a finding — file it. The product moves fast and this doc may be a little behind.

> **Maintainers:** see [AUTOMATION-COVERAGE.md](./AUTOMATION-COVERAGE.md) for which of these items are already covered by Playwright specs and which still need a human run. How making things works today is described in [create-entry.md](../requirements/prd/create-entry.md).

---

## Conventions

-   **PASS** = behaves exactly as described.
-   **FAIL** = doesn't. File a finding using [REPORT-TEMPLATE.md](./REPORT-TEMPLATE.md).
-   **N/A** = the surface isn't reachable on your build (e.g., a Mac-only path on Windows). Note it and move on.
-   **Severity** when filing:
    -   **Blocker** — app crashes, data loss, can't sign in, can't install/uninstall.
    -   **Major** — feature visibly broken but app stays alive.
    -   **Minor** — feature works but UX is wrong (label, ordering, copy).
    -   **Cosmetic** — visual / polish only.

**Test the installed app, not the dev server.** Run Dash.app (the release you're testing). Some bugs only show there, because it loads its pages from files on disk instead of `localhost:3000`. In v0.0.1004, every live preview was blank in the installed app but fine in dev.

You'll need a registry account to run the auth-gated parts. If you don't have one, ping John.

**Where things are:** the left nav has **Search**, **Create**, your recent dashboards, and under **Manage** the **Dashboards**, **Bots**, **Providers**, **Widgets** and **Themes** pages. **Settings** is in the account menu at the bottom of the left nav (click your name). The narrow rail on the far right has one button, **Bots** (the robot).

Several tests need AI. Set it up first: Settings → **AI** → pick Claude Code CLI or the Anthropic API.

---

## 0. Pre-flight (cold install) — ~15 min

### 0.1 Download

Pick the right artifact from https://github.com/trops/dash-electron/releases/latest:

| OS      | Arch                    | File                   |
| ------- | ----------------------- | ---------------------- |
| macOS   | Universal (Intel + ARM) | `Dash.dmg`             |
| Windows | x64                     | `Dash-x.y.z-Setup.exe` |

The macOS build is a universal binary — same `.dmg` works on both Intel and Apple Silicon. Note the version number from the GitHub release page — you'll need it on every finding.

### 0.2 First launch

-   [ ] App opens to a Welcome panel (no dashboards yet, sidebar is mostly empty).
-   [ ] No red errors in the dev tools console (View menu → Toggle Developer Tools).
-   [ ] Title bar shows "Dash".

### 0.3 Sign in to the registry

-   [ ] Click your name at the bottom of the left nav → **Settings** → **Account** → **Sign In**.
-   [ ] Browser opens to a Cognito hosted-UI page; complete sign-in.
-   [ ] Back in the app, your username appears under Account within ~10s.
-   [ ] Account section shows your owned packages (may be empty).

### 0.4 Registry index loads

-   [ ] Left nav → **Widgets** → **New Widget**. Create opens on Type: Widget. Under **Or start without AI**, click **Browse widgets in the registry**. Within ~5s the package list populates with at least a handful of public widgets.
-   [ ] Left nav → **Create** → set **Type** to **Dashboard** → **Browse dashboards in the registry**. Public dashboards are listed.
-   [ ] Left nav → **Themes** → **Browse marketplace**. Public themes are listed.

### 0.5 Create, ⌘N and the Bots rail

-   [ ] Left nav → **Create**. The Create screen asks "What do you want to make?" with a text box, a **Type** menu (Auto, Widget, Bot, Dashboard, Theme), **Send**, and **Or start without AI** buttons below. Close it.
-   [ ] With no dialog open and no dashboard in edit mode, press **⌘N** (Mac) or **Ctrl+N** (Windows). Create opens. Close it.
-   [ ] Click **Edit dashboard** on any dashboard, press ⌘N / Ctrl+N: nothing opens (it's off while editing). Click **Cancel**.
-   [ ] Click the robot (**Bots**) on the far-right rail. Your bots show as a contacts list with **Search bots**, **Recent / A–Z** and a **By team** switch. A **Pinned** section at the top holds the open dashboard's team lead (if it has one) and **Dash team**.
-   [ ] Click a bot: its page opens on its conversation. Send it a message; the reply streams in. Switch to **Activity**, then close the page.

If any of 0.1–0.5 fail, **stop here and file a Blocker.** The rest of the plan won't work until cold start does.

---

## 1. Dashboards — ~35 min

A "dashboard" (also called "workspace") is a saved layout of widgets. Test every way to get one in, edit it, share it, and remove it.

### 1.1 Create

-   [ ] **Blank** — left nav → **Create** → **Blank dashboard**. A new dashboard opens in edit mode; click **Save**.
-   [ ] **New Dashboard** — left nav → **Dashboards** → **New Dashboard**. Create opens with Type: Dashboard.
-   [ ] **With AI** — covered in §6.1.
-   [ ] **Import from file** — left nav → **Create** → set Type to **Dashboard** → **Import dashboard from file** → pick a `.dashboard.json` zip you have or that someone shared. Preview shows widgets/providers; importing creates the dashboard and auto-installs missing widgets.
-   [ ] **Install from registry** — Create → Type: Dashboard → **Browse dashboards in the registry** → pick one → install. The Install Progress modal shows a per-widget breakdown.
-   [ ] **Duplicate** — left nav → **Dashboards** → select a dashboard → its **⋯** menu → **Duplicate**. The copy has "(Copy)" in the name and is unpublished.

### 1.2 Edit layout

Open one of the dashboards you just created and click **Edit dashboard** in its header. An edit panel opens on the right with **Add**, **Dashboard** and **Theme** tabs (plus **Widget** when a widget is selected).

-   [ ] **Add widget** — an empty cell shows **Add widget** and **Build with AI**. Click **Add widget**: the Add tab says "Empty cell". Click a widget in the list; it lands in the cell. (Build with AI is §6.3.)
-   [ ] **Move** — select a widget → its **⋯** menu → **Move to another cell** → click another cell. An empty cell takes the widget; a full one swaps with it. **Save**; reload; the layout persists.
-   [ ] **Rows and columns** — **+ Row** and **+ Column** in the header add a row/column; click a row or column size to change it.
-   [ ] **Split** — widget **⋯** → **Split side by side** / **Split top and bottom**.
-   [ ] **Multi-page** — click **Add page** in the page tab bar; put a widget on each page; switch pages.
-   [ ] **Pinned sidebar** — Dashboard tab → turn on **Pinned sidebar**; put a widget in it.
-   [ ] **Nested grid** — drop a `LayoutGridContainer` inside another `LayoutGridContainer`. Children render in the inner grid.
-   [ ] **Cancel** — make a change, click **Cancel**. The change is gone.

### 1.3 Edit one widget (the widget panel)

In edit mode, click a widget. The edit panel's **Widget** tab shows its name, who it's from, a **Change <widget>** button, and sections **Settings**, **Connections**, **Listens for** (and Notifications, Schedule, Advanced when the widget has them).

-   [ ] **Settings** — change a setting; the widget reflects it after **Save**. The panel's footer says "Settings wait for Save."
-   [ ] **Connections** — pick a provider for a widget that needs one; **Save**; it connects.
-   [ ] **Missing-connection pill** — put a widget that needs a provider on a dashboard with no provider of that type. In edit mode its card shows a warning pill, e.g. "Needs a Slack connection" (two problems say "2 things to fix"). Click the pill: the panel opens at **Connections**. The card's **⋮** menu marks **Edit in panel** with "!".
-   [ ] **Listens for** — on a dashboard with two widgets that talk (e.g. a Kanban's `prospectSelected` into a detail widget), select the receiving widget → **Listens for** → **+ Listen for another widget** → pick **When** and what it should do → **Add** → **Save**. The wiring persists across reload.
-   [ ] **Delete a source** — delete the sending widget, **Save**. Dashboard tab → **Open Dashboard Config** → **Listeners**: the deleted widget is gone, and the receiver no longer lists it. (Listener reconciliation — a hot regression spot.)

### 1.4 Dashboard Config

In edit mode → **Dashboard** tab → **Open Dashboard Config**.

-   [ ] **Providers tab** — the amber dot shows when widgets still need a provider. Bulk-assign a provider; save; close and reopen — assignments stuck.
-   [ ] **Listeners**, **Notifications**, **Widgets** tabs — list what's set across the dashboard; **Edit in panel** on a row opens that widget in the edit panel.
-   [ ] **Dependencies tab** — lists every distinct widget package used in the dashboard. Each row shows the scoped name (`@scope/name`).

### 1.5 Publish

-   [ ] **Plain dashboard** — left nav → **Dashboards** → select your dashboard → **⋯** → **Publish**. Walk Account → Details → Tags → Icon → Dependencies → Defaults Review → Publish. After success, find it via Create → Type: Dashboard → **Browse dashboards in the registry**.
-   [ ] **Dashboard with @ai-built widget** — repeat with a dashboard that contains at least one widget under `@ai-built/<x>`. The Dependencies step should mark that widget **required to republish** with a default `patch` bump (you can't deselect it). The published manifest must reference your scope, not `@ai-built/`.
-   [ ] **Defaults review** — the Defaults Review step shows widget-config default values from each owned package's `.dash.js`. You can blank or edit them before the zip ships.
-   [ ] **Scope doubling sanity** — open the published dashboard's manifest (or look at its registry detail page). It must NOT contain `@trops/@ai-built/...` or any other doubled-scope string.

### 1.6 Install from registry

-   [ ] **Missing dependencies** — install a dashboard that depends on widgets you don't have. The Install Progress modal shows each widget downloading.
-   [ ] **Bundled theme** — install a dashboard that bundles a theme. Left nav → **Themes** shows the theme afterwards.
-   [ ] **Cancel + retry** — start an install, close the modal mid-flight, retry. Selections persist.
-   [ ] **Auth-gated install** — sign out → try to install a private dashboard → auth modal appears. Sign back in; install completes (covers the 401 retry contract).

### 1.7 Delete

-   [ ] Left nav → **Dashboards** → select → **⋯** → **Delete**. The confirmation says "Delete "<name>"? This can't be undone."; confirm; the dashboard is gone.

### 1.8 Export / Import round-trip

-   [ ] Left nav → **Dashboards** → select → **⋯** → **Export ZIP** (or **Export ZIP with bots** when it has a team).
-   [ ] Uninstall one of its widgets (§2.5).
-   [ ] Create → Type: Dashboard → **Import dashboard from file** → the zip. The missing widget is auto-fetched from the registry; the dashboard renders.

### 1.9 Navigation

-   [ ] Open a dashboard from the left nav.
-   [ ] Open a different one via the tab bar (clicking an existing tab).
-   [ ] Open a third via **Search** in the left nav.
-   [ ] Quit the app and reopen — the last-active dashboard restores.

---

## 2. Widgets — ~35 min

### 2.1 Install

All installs run the same code checks first (the install gate).

-   [ ] **From registry** — left nav → **Widgets** → **New Widget** → **Browse widgets in the registry** → pick one → Install.
-   [ ] **From a local zip** — Widgets → **New Widget** → **Install a widget from file** → pick a widget zip.
-   [ ] **From a folder** — Widgets → **New Widget** → **Load a widget from a folder** → pick a folder containing one or more widget packages. Non-widget folders are skipped, not failed.
-   [ ] **Install gate** — install (from file) a widget zip whose code breaks the widget rules — e.g. a widget that starts a bot directly from its code (widgets may only publish events). The install is refused with "<widget> wasn't installed — it didn't pass its checks:" and a list of what's wrong. Nothing new appears on the Widgets page.
-   [ ] **With AI** — covered in §6.2.

### 2.2 The Widgets page

-   [ ] Left nav → **Widgets**. The list shows packages, with **Search packages or widgets…**, an **Org** filter and **All / In use / Not used / Mine**.
-   [ ] **Drill in** — click a package. The list now shows that package's widgets under a header with the package's name and a back link **All packages**. The first row is **About this package** (its id and version).
-   [ ] Click **About this package**: the detail shows the package — version, where it's used, and **Update** / **Publish…** / **Change <widget>** when they apply, plus a **⋯** menu with **Open in Finder** and **Uninstall**.
-   [ ] Click a widget: its detail shows a live preview and **Change <widget>**.
-   [ ] **Search** — type a widget name. One flat list: **Packages**, then **Widgets**, each widget saying which package it's in. Clear the search; you're back where you were.
-   [ ] A package that didn't pass its checks at startup says **Didn't pass its checks** and lists the problems ("It still works, but these need fixing").

### 2.3 Preview

-   [ ] Open a widget that needs no server (e.g. a clock or a credential-only widget). The preview runs by itself; with a provider it says "Running with <provider>." **Reload** and **Stop** work.
-   [ ] Open a widget that uses an MCP provider. The preview waits with **Start preview** (it would start a server). Click it; the widget runs.
-   [ ] Open a widget whose provider type you have none of: the preview offers **Set up**.
-   [ ] Switch quickly between two widgets: the second widget's preview never shows the first one's state.
-   [ ] Make a preview fail (e.g. a widget whose server can't start): **Try again** appears and works once the cause is fixed.

### 2.4 Publish

-   [ ] Widgets → open an `@ai-built/<x>` package → **About this package** → **Publish…**.
-   [ ] **Sign-in gate** — if signed out, the modal first prompts auth.
-   [ ] **Personal-paths warning** — temporarily edit your widget source so it contains a literal `/Users/<your-username>/...` path. Try to publish. The modal must list that path and block publishing until you confirm or cancel. Remove the path; retry; succeeds.
-   [ ] **Bump preview** — patch / minor / major show the right next-version preview.
-   [ ] **Visibility toggle** — public ↔ private — verify the result in the registry detail page after publish.
-   [ ] **Scope remap** — `@ai-built/foo` published as `@<your-scope>/foo`. Search for it via **Browse widgets in the registry**; the scoped name is correct, no doubling. Afterwards the package's button reads **Publish new version…**.

### 2.5 Update

-   [ ] Have someone else publish a patch bump (or do it yourself with a second account / branch).
-   [ ] Within ~5 min the package shows an **Update** badge on the Widgets page, and the toolbar shows "**1 update · Update all**".
-   [ ] Open the package → **Update to v<x>**; the new version installs; existing instances on dashboards keep working.

### 2.6 Uninstall

-   [ ] Put a widget from a package with more than one widget on a dashboard, **Save**.
-   [ ] Widgets → open that package → click the widget → **⋯** → **Uninstall <package>…**.
-   [ ] The confirmation says the widget comes with the other widgets in the package and that uninstalling removes all of them, lists each with the dashboards it's on, and says those cells will show "Widget Not Found" until you reinstall from the registry. (For an `@ai-built` widget: "This can't be undone: it isn't in the registry.")
-   [ ] Confirm. The package is gone from the Widgets page; reopen the dashboard → the cell shows "Widget Not Found". No crash.
-   [ ] Same from the package: **About this package** → **⋯** → **Uninstall**.

### 2.7 Debug

-   [ ] **Runtime error** — pick (or write) an installed widget that throws on mount. The cell says "<widget> couldn't show" with the error, **Try again**, and **Fix <widget>** (not on built-in `dash.` widgets). **Fix <widget>** is tested in §6.4.
-   [ ] **Debug Console** — Cmd+Shift+D / Ctrl+Shift+D. Three tabs: Log Stream, API Catalog, Widget Events. Log Stream shows live `console.*` output; API Catalog renders the IPC method list.
-   [ ] **Builder preview error isolation** — in the Widget Builder (§6.6), type a syntax error in the widget code. The preview pane shows the error, but the rest of the app stays alive (no app-level crash).

---

## 3. Themes — ~15 min

-   [ ] **Install from registry** — left nav → **Themes** → **Browse marketplace** → pick → Install.
-   [ ] **Create with AI** — left nav → **Create** → Type: **Theme** → describe the look → **Send**. It opens in the theme editor; nothing changes until you save.
-   [ ] **Create without AI** — Create → **New theme** → pick a start (From Presets, From Colors, From Random, From Website) → save. The theme appears on the Themes page.
-   [ ] **Edit tokens** — Themes → select a theme → **Edit theme** → tweak a color, font size, or spacing token → save → previews update.
-   [ ] **Apply app-wide** — Themes → select → **Use as app theme**; the whole app re-skins.
-   [ ] **Apply to a single dashboard** — open a dashboard → **Edit dashboard** → **Theme** tab → pick the theme → **Save**. Only that dashboard re-skins.
-   [ ] **Publish** — Themes → select your theme → **⋯** → **Publish…**. Walk the multi-step modal (Account → Details → Tags → Publish).
-   [ ] **Delete** — Themes → select → **⋯** → **Delete**. Confirmation modal; confirm; theme is gone.

---

## 4. Providers / MCP / Credentials — ~25 min

The provider system is where most "but it doesn't work for me" findings come from. Spend some time here.

### 4.1 Credential providers

-   [ ] Left nav → **Providers** → **New Provider** → pick a credential-style provider (e.g., Algolia, OpenAI). Enter an API key. Save.
-   [ ] Toggle **default for type** on; create a second provider of the same type; toggle default on it instead. Verify only one provider of a given type can be default at a time.

### 4.2 MCP servers (catalog)

For each of these from the catalog, add the server, and confirm the tools list populates and a "Test" call works:

-   [ ] filesystem
-   [ ] github
-   [ ] gmail (OAuth)
-   [ ] google calendar (OAuth)
-   [ ] google drive (OAuth)
-   [ ] slack
-   [ ] gong
-   [ ] notion
-   [ ] algolia (if listed)

### 4.3 OAuth round-trip

Pick one OAuth-gated provider (Google Drive is the canonical one):

-   [ ] Add the provider → click Authenticate → browser opens → consent → close browser → the provider shows an "Authenticated" badge in the app.
-   [ ] Quit the app and reopen — auth state persists.

### 4.4 Custom MCP server

-   [ ] Providers → **New Provider** → Custom MCP server.
-   [ ] Configure transport + command + env vars. **On Windows specifically, leave one env var blank.** Save and start the server. It should not crash on parse (the Windows tokenization fix).

### 4.5 WebSocket provider

-   [ ] Providers → **New Provider** → WebSocket provider. URL + optional headers. Save. It connects (or shows a clean disconnected state if the URL is unreachable — no crash).

### 4.6 Provider resolution layering

-   [ ] Bind a provider at the **dashboard level**: Edit dashboard → Dashboard tab → **Open Dashboard Config** → **Providers**.
-   [ ] Override it for **one widget**: Edit dashboard → click the widget → **Connections** → pick another provider → **Save**.
-   [ ] Confirm the widget reads the most-specific binding (widget > dashboard > app default). Removing the widget's choice falls back to the dashboard's; removing that falls back to the app default.

### 4.7 Delete an in-use provider

-   [ ] Bind a provider to a widget on a dashboard.
-   [ ] Providers → select that provider → Delete.
-   [ ] Reopen the dashboard and click **Edit dashboard**. The widget's card shows the missing-connection pill (§1.3). App must NOT crash.

---

## 5. Settings & Account — ~10 min

Open Settings from your name at the bottom of the left nav.

-   [ ] **General** — toggle Debug Mode; click "Open Data Directory" — file manager opens to the user-data folder.
-   [ ] **Folders** — left nav → **Dashboards** → Folders → **New Folder** with a name and icon (icon picker has search). Rename it. Move a dashboard into it. Delete the folder; confirmation says how many dashboards live there.
-   [ ] **Notifications** — toggle global on/off. Pick a widget that emits notifications, toggle the per-widget setting, verify the change.
-   [ ] **MCP Server** — toggle the embedded server on. Copy the auth token. Change the port; restart; verify the new port.
-   [ ] **AI** — switch backend Claude Code CLI ↔ Anthropic API. The model picker updates accordingly.
-   [ ] **Account** — sign out (token cleared). Sign back in (different account is fine, or the same one). Owned-packages list reflects the signed-in user.

---

## 6. Making things: Create, the Dash team and the Widget Builder — ~45 min

Needs AI set up (Settings → **AI**). Nothing is made, installed or saved until you say so — if anything changes before you click the button that says it will, that's a **Major**.

### 6.1 A dashboard: plan → Build, and Fold

-   [ ] Left nav → **Create** → Type: **Dashboard** → describe one (e.g. "a dashboard to track my GitHub pull requests") → **Send**. The hint under the box said "You'll get a plan to review first. Nothing is made until you press Build."
-   [ ] A plan appears: what each widget is (Yours / From the registry / New) and **What to expect**. If it asks questions, answer them and click **Send answers**; the plan updates.
-   [ ] Anything to connect or approve is listed under **Before building**; the build button says what's left (e.g. "Connect Slack & build"; after **Build without it for now** in the Connect window, it says "Build without Slack").
-   [ ] **Fold** — while the plan is open, click the fold icon (**Fold into the sidebar**) in Create's header. Create closes and the plan carries on in a **Create** panel on the right. Click **Expand** there: it reopens in Create, where it was.
-   [ ] Click **Build**. Progress shows each piece; **Stop** works. When done, **Go to dashboard** opens the new dashboard, live.
-   [ ] **Auto** — Create → leave Type on **Auto** → describe something. Dash picks the type and says so; **Change** lets you pick another.

### 6.2 A widget on its own, through the team (with preview)

-   [ ] Create → Type: **Widget** → describe one (e.g. "a clock with the time in Tokyo") → **Send**.
-   [ ] The Scout looks for one you already have. If it finds some, each has **Use this** (or **Install** from the registry); **Build new instead** goes on. If none, click **Build it**.
-   [ ] A plan appears; click **Build**. The widget is built, checked, then shown running.
-   [ ] Pick a connection and settings if it asks. **Looks good — add it to my widgets** installs it: "<name> is in your widgets", with **See it on the Widgets page** and **Done**. **Change something** instead sends a note back to the Builder.
-   [ ] Nothing was installed before **Looks good** (check the Widgets page while the preview is up).

### 6.3 An empty cell → Build with AI

-   [ ] Open a dashboard → **Edit dashboard** → an empty cell → **Build with AI**. Create opens: "What should this cell show?", Type is fixed to **Widget**.
-   [ ] Describe it → **Send**. The Scout's matches offer **Use in this cell**; otherwise **Plan it**. Then **Build**.
-   [ ] The preview shows it running. **Looks good — put it in the cell** puts it in the cell as an unsaved change — click **Save** to keep it, or **Cancel** and the cell is empty again.

### 6.4 Change and Fix a widget

-   [ ] Edit dashboard → click a widget you made → **Change <widget>** (also in the card's **⋮** menu, and on the Widgets page). Create opens on the widget: what it is, and **What should change?**.
-   [ ] **Where the change goes**: **Update <widget> everywhere** (lists where it's used) or **Save as a new widget** (it replaces it in this cell only). A widget that isn't yours offers only **Save as a new widget**.
-   [ ] Describe a small change → **Send** → plan → **Build** → preview → **Looks good — update <widget>**. Every dashboard using it shows the change.
-   [ ] **Change something else** starts another change; **Done** closes.
-   [ ] **Edit the code yourself** opens the Widget Builder on that widget's code (§6.6).
-   [ ] With unsaved edits on the dashboard, **Change <widget>** is disabled and says "Save or cancel your N change(s) first."
-   [ ] **Fix** — a widget that throws (§2.7) → **Fix <widget>**. Create opens on it with "What went wrong" showing the error; carry on as a change.

### 6.5 A bot, the lead's hand-off and the Dash team

-   [ ] **Create › Bot** — Create → Type: **Bot** → pick **Where** (a dashboard) → describe what it should do and when → **Send**. The Scout checks for one you have (**Use on <dashboard>**); otherwise **Plan it** → plan → **Build**. The bot is saved **paused**: **Try it now**, **Turn on**, **Open its page**.
-   [ ] **Without AI** — Create → Type: Bot → **Fill in the bot form** → save. Toast: "Created <name>. It's paused until you turn it on."
-   [ ] **Lead hand-off** — open a dashboard that has a team lead. Bots rail → **Pinned** → the lead → ask it for something the team can't do yet (e.g. "add a widget that shows open Jira tickets"). Its answer has **Plan this with the Dash team**. Click it: Create opens with the request filled in, a line "From the <lead>: …" and the dashboard's team. Nothing is made until you **Send** and **Build**.
-   [ ] **Dash team page** — Bots rail → **Pinned** → **Dash team**. It opens with **Conversation** and **Settings** tabs.
-   [ ] **Conversation** — type in **Ask the Dash team…** → **Ask**. The answer streams in and the question appears in the thread list on the left. Click **New conversation**, ask another; both threads are listed; clicking the first shows its answer. An answer that plans something opens the plan — you review it before anything is made.
-   [ ] **Settings** — the roles Planner, Scout, Builder, Checker, each **On** or **Paused**. Click one → **Pause** / **Turn on** works → **Edit** opens its form. Change something, click the back link: "Discard unsaved changes?" asks first.
-   [ ] Pause the Planner: the Conversation tab says "The Dash team is paused" with **Turn on**.
-   [ ] Fold a plan (§6.1), then click **Back to Recent** in the Create panel on the right. It lists **Plans** and **Unfinished widgets**, and has no Ask box (questions go to the Dash team).

### 6.6 The Widget Builder by hand

-   [ ] Create → Type: **Widget** → **Build it by hand**. The Widget Builder opens ("Build by hand") with tabs **Preview**, **Code**, **Configure**, **Logs** and **Style checks**.
-   [ ] Type a name in **Name it, e.g. OrderLookup**. A hint says "Saved when you press Enter or click away." Press Enter (or click away): the hint goes. Clear the field and click away: the old name comes back.
-   [ ] Type a new name but don't press Enter: **Install widget** is disabled and says "Press Enter to save the name first".
-   [ ] **Category** says what it's for ("Where it's listed when you publish it."); Install waits for one.
-   [ ] Edit code → the preview updates. **Logs** says "No logs yet" until the widget logs something. **Style checks** says whether the style checks pass.
-   [ ] **Install widget** → the widget is checked, then installed; it's on the Widgets page under `@ai-built/<name>`.
-   [ ] Close with unsaved work: it asks to **Save as draft** / **Discard** / **Keep editing**. A draft shows on the Widgets page with **Resume**.

---

## 7. App lifecycle & platform — ~10 min

-   [ ] **Persistence** — quit the app, reopen — last dashboard restored.
-   [ ] **Auto-update** (production builds only) — leave the app open ~10 min on a version older than `latest`. The "Restart to Update" menu item should activate when an update is found.
-   [ ] **Account switch** — sign out → sign in as a different user. Owned packages and registry index visible to that user update. (Registry cache is keyed per user.)
-   [ ] **macOS only** — native menu bar items work, including "Open Data Directory" and theme toggle.
-   [ ] **Windows only** — Squirrel installer ran clean from the .exe. Uninstall via Add/Remove Programs leaves no orphan files.

---

## 8. Bug-watch list (regression magnets)

Each release, **also** rerun these specific scenarios — they broke recently and tend to break again:

| Fix                                                     | Re-run scenario                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Listener reconciliation on widget delete                | §1.3 — delete a source, then check Dashboard Config → Listeners                                 |
| `algoliaProvider` ReferenceError in dynamic widget load | App startup with `AlgoliaSearchPage` widget installed; check console for ReferenceError on load |
| AI-built widgets force-included on dashboard publish    | §1.5 — publish-with-@ai-built scenario                                                          |
| Defaults-review step in PublishDashboardModal           | §1.5 Defaults Review                                                                            |
| Scope doubling on publish                               | §1.5 — manifest never contains `@scope/@scope/...`                                              |
| Folder ID collision on dashboard install                | §1.6 — install a dashboard whose default folder already exists locally                          |
| Windows MCP config tokenization                         | §4.4 — empty env on Windows                                                                     |
| Widget preview error isolation in builder               | §2.7 — preview syntax error doesn't crash app                                                   |
| Install gate (every install is checked)                 | §2.1 — a zip that fails its checks is refused                                                   |
| Preview state across widgets                            | §2.3 — switching widgets never shows the previous one's preview                                 |
| Builder installs the old name                           | §6.6 — Install waits for the name                                                               |

---

## 9. Reporting

Use [REPORT-TEMPLATE.md](./REPORT-TEMPLATE.md). One finding per issue / message. Include:

-   App version (Settings → General).
-   OS + arch (e.g., macOS 14.4 arm64).
-   Whether you're signed in.
-   Steps from a clean state.
-   Screenshot or short screen recording.

Thank you for testing.
