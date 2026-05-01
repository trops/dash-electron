# Dash — Manual QA Test Plan

A friend-friendly checklist for testing a Dash release end-to-end on your own machine. Pick a topic, run through it, and file findings using the [report template](./REPORT-TEMPLATE.md).

Each section has a rough time budget. The whole sweep is ~2.5 hours; you do not have to do it all in one sitting, and you do not have to do every section. **Claim a section in the tracking issue/Slack thread before you start so we don't double up.**

If something on this list doesn't match what you see in the app, that's still a finding — file it. The product moves fast and this doc may be a little behind.

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

You'll need a registry account to run the auth-gated parts. If you don't have one, ping John.

---

## 0. Pre-flight (cold install) — ~15 min

### 0.1 Download

Pick the right artifact from https://github.com/trops/dash-electron/releases/latest:

| OS      | Arch          | File                          |
| ------- | ------------- | ----------------------------- |
| macOS   | Intel         | `Dash-x.y.z-darwin-x64.dmg`   |
| macOS   | Apple Silicon | `Dash-x.y.z-darwin-arm64.dmg` |
| Windows | x64           | `Dash-x.y.z-Setup.exe`        |

Note the version number — you'll need it on every finding.

### 0.2 First launch

-   [ ] App opens to a Welcome panel (no dashboards yet, sidebar is mostly empty).
-   [ ] No red errors in the dev tools console (View menu → Toggle Developer Tools).
-   [ ] Title bar shows "Dash".

### 0.3 Sign in to the registry

-   [ ] Settings (gear icon, top-right) → **Account** → **Sign In**.
-   [ ] Browser opens to a Cognito hosted-UI page; complete sign-in.
-   [ ] Back in the app, your username appears under Account within ~10s.
-   [ ] Account section shows your owned packages (may be empty).

### 0.4 Registry index loads

-   [ ] Settings → **Widgets** → **Discover**. Within ~5s the package list populates. You should see at least a handful of public widgets.
-   [ ] Same for Settings → **Dashboards** → **Discover**.
-   [ ] Same for Settings → **Themes** → **Discover**.

### 0.5 AI Assistant mounts

-   [ ] Right side of the window has an AI Assistant panel (or a button to open it). Click to open.
-   [ ] You can type a prompt; the input is enabled (whether or not the LLM responds — that's tested later).

If any of 0.1–0.5 fail, **stop here and file a Blocker.** The rest of the plan won't work until cold start does.

---

## 1. Dashboards — ~30 min

A "dashboard" (also called "workspace") is a saved layout of widgets. Test every way to get one in, edit it, share it, and remove it.

### 1.1 Create

-   [ ] **Blank** — sidebar "+" button → blank workspace appears.
-   [ ] **Template** — Layout Manager modal → pick a template → name it → it lands in the sidebar.
-   [ ] **Wizard** — Command Palette (⌘K / Ctrl+K) → "Dashboard Wizard" → walk Discover → Name → Folder → Theme → Review.
-   [ ] **Import from file** — Settings → Dashboards → Import → pick a `.dashboard.json` zip you have or that someone shared. Preview shows widgets/providers; importing creates the dashboard and auto-installs missing widgets.
-   [ ] **Install from registry** — Settings → Dashboards → Discover → pick one → Install Options → Install. The Install Progress modal shows a per-widget breakdown.
-   [ ] **Duplicate** — Settings → Dashboards → select a dashboard → Duplicate. The copy has "(Copy)" in the name and is unpublished.

### 1.2 Edit layout

Open one of the dashboards you just created and put it in edit mode (toggle in the header).

-   [ ] **Add widget** — click an empty grid cell → search picker → pick a widget → it lands in the cell.
-   [ ] **Drag-reorder** — drag a widget to another cell. Layout updates and persists across reload.
-   [ ] **Resize cell** — drag a cell handle. Span updates.
-   [ ] **Multi-page** — add a second page via the Page tab bar; drop a widget on each page; switch pages.
-   [ ] **Sidebar layout** — enable the dashboard sidebar; drag a widget into it.
-   [ ] **Nested grid** — drop a `LayoutGridContainer` inside another `LayoutGridContainer`. Children render in the inner grid.

### 1.3 Configure (Dashboard Config Modal)

Open the gear icon on the dashboard header (in edit mode).

-   [ ] **Providers tab** — the unresolved-count badge matches the number of widgets that need a provider. Bulk-assign a provider; save; close and reopen — assignments stuck.
-   [ ] **Listeners tab** — wire an event from one widget into another (e.g., a Kanban's `prospectSelected` into a detail widget). Save. **Then delete the source widget.** Reopen the Listeners tab → the deleted source is gone from the emitter list AND its checkbox is dropped from the receiver. (This is the v0.0.470 reconciliation fix and is a hot regression spot.)
-   [ ] **Widgets tab** — bulk-edit a `userPrefs` field across multiple instances of the same widget; save.
-   [ ] **Dependencies tab** — lists every distinct widget package used in the dashboard. Each row shows the scoped name (`@scope/name`).

### 1.4 Publish

-   [ ] **Plain dashboard** — Settings → Dashboards → select your dashboard → Publish. Walk Account → Details → Tags → Icon → Dependencies → Defaults Review → Publish. After success, find your package in Settings → Dashboards → Discover.
-   [ ] **Dashboard with @ai-built widget** — repeat with a dashboard that contains at least one widget under `@ai-built/<x>`. The Dependencies step should mark that widget **required to republish** with a default `patch` bump (you can't deselect it). The published manifest must reference your scope, not `@ai-built/`.
-   [ ] **Defaults review** — the Defaults Review step shows widget-config default values from each owned package's `.dash.js`. You can blank or edit them before the zip ships.
-   [ ] **Scope doubling sanity** — open the published dashboard's manifest (or look at its registry detail page). It must NOT contain `@trops/@ai-built/...` or any other doubled-scope string. (v0.0.46x fix.)

### 1.5 Install from registry

-   [ ] **Missing dependencies** — install a dashboard that depends on widgets you don't have. The Install Progress modal shows each widget downloading.
-   [ ] **Bundled theme** — install a dashboard that bundles a theme. Settings → Themes shows the theme afterwards.
-   [ ] **Cancel + retry** — start an install, close the modal mid-flight, retry. Selections persist.
-   [ ] **Auth-gated install** — sign out → try to install a private dashboard → auth modal appears. Sign back in; install completes (covers the 401 retry contract).

### 1.6 Delete / Unsubscribe

-   [ ] **Local delete** — Settings → Dashboards → select → Delete. Confirmation modal lists widget references; confirm; dashboard is gone.
-   [ ] **Unpublish from registry** — for a dashboard you previously published, Settings → Dashboards → select → Unpublish. Verify in Discover that the package is gone. (This covers the registry delete + S3 IAM permissions added in v0.0.46x.)

### 1.7 Export / Import round-trip

-   [ ] Export your dashboard to a `.dashboard.json` zip.
-   [ ] Uninstall one of its widgets.
-   [ ] Import the zip → the missing widget is auto-fetched from the registry; dashboard renders.

### 1.8 Navigation

-   [ ] Open a dashboard via the sidebar.
-   [ ] Open a different one via the Tab bar (clicking an existing tab).
-   [ ] Open a third via the Command Palette.
-   [ ] Quit the app and reopen — the last-active dashboard restores.

---

## 2. Widgets — ~30 min

### 2.1 Install

-   [ ] **From registry** — Settings → Widgets → Discover → Install.
-   [ ] **From a local zip** — Settings → Widgets → Install Widgets → Install from File → pick a widget zip.
-   [ ] **From a folder** — Install Widgets → Load from Folder → pick a folder containing one or more widget packages. Non-widget folders are skipped, not failed.
-   [ ] **From scratch (AI builder)** — open AI Assistant → Create Widget. Prompt for something simple (e.g., "a clock"). The live preview pane updates as the model writes code. Click **Install** at the bottom — it lands in Settings → Widgets under `@ai-built/<name>`.
-   [ ] **Remix** — open the AI builder against an existing widget; ask for a small change; install. The remix preserves attribution to the original.

### 2.2 Configure

Drop a configurable widget onto a dashboard, then:

-   [ ] Right-click → **Configure** → edit a `userConfig` field → save → the widget visibly reflects the change.
-   [ ] Right-click → **Wire Events** (or equivalent) → wire a handler from another widget; the wiring persists across reload.
-   [ ] For a widget that supports multiple provider types, the **provider dropdown** in the widget's header lets you pick one.

### 2.3 Publish

-   [ ] Settings → Widgets → select an `@ai-built/<x>` widget → Publish.
-   [ ] **Sign-in gate** — if signed out, the modal first prompts auth.
-   [ ] **Personal-paths warning** — temporarily edit your widget source so it contains a literal `/Users/<your-username>/...` path. Try to publish. The modal must list that path and block publishing until you confirm or cancel. Remove the path; retry; succeeds.
-   [ ] **Bump preview** — patch / minor / major show the right next-version preview.
-   [ ] **Visibility toggle** — public ↔ private — verify the result in the registry detail page after publish.
-   [ ] **Scope remap** — `@ai-built/foo` published as `@<your-scope>/foo`. Search for the widget in Discover; the scoped name is correct, no doubling.

### 2.4 Update

-   [ ] Have someone else publish a patch bump (or do it yourself with a second account / branch).
-   [ ] Within ~5 min the **Update** badge appears on the widget in Settings → Widgets.
-   [ ] Click Update; new version installs; existing instances on dashboards keep working.

### 2.5 Uninstall

-   [ ] Drop a widget instance into a dashboard, save.
-   [ ] Settings → Widgets → select it → Uninstall.
-   [ ] Confirmation dialog lists the affected workspace and instance count.
-   [ ] Confirm. Reopen the dashboard → the widget is gone, AND any listeners on other widgets that referenced it are dropped (the v0.0.470 workspace-reconciliation fix).

### 2.6 Debug

-   [ ] **Runtime error** — pick (or write) a widget that throws on mount. The dashboard's error boundary catches it and shows a "Send to AI" action (v0.0.412 enhancement).
-   [ ] **Debug Console** — Cmd+Shift+D / Ctrl+Shift+D. Three tabs: Log Stream, API Catalog, Widget Events. Log Stream shows live `console.*` output; API Catalog renders the IPC method list.
-   [ ] **AI builder preview error isolation** — in the AI builder, intentionally type a syntax error in the widget code. The preview pane shows the error, but the rest of the app stays alive (no app-level crash).

---

## 3. Themes — ~15 min

-   [ ] **Install from registry** — Settings → Themes → Discover → pick → Install.
-   [ ] **Install from file** — Settings → Themes → drag-drop or the file picker, with a theme zip.
-   [ ] **Create from preset** — Settings → Themes → New → pick a preset / use the Color Harmony picker → save. The theme appears in your themes list.
-   [ ] **Edit tokens** — Theme Detail → tweak a color, font size, or spacing token → save → previews update.
-   [ ] **Apply app-wide** — set the new theme as the global theme; the whole app re-skins.
-   [ ] **Apply to a single dashboard** — open a dashboard → header theme dropdown → pick the new theme. Only that dashboard re-skins.
-   [ ] **Publish** — Settings → Themes → select your theme → Publish. Walk the multi-step modal (Account → Details → Tags → Publish).
-   [ ] **Delete** — Theme Detail → Delete. Confirmation modal; confirm; theme is gone.

---

## 4. Providers / MCP / Credentials — ~25 min

The provider system is where most "but it doesn't work for me" findings come from. Spend some time here.

### 4.1 Credential providers

-   [ ] Settings → Providers → New → pick a credential-style provider (e.g., Algolia, OpenAI). Enter an API key. Save.
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

-   [ ] Settings → Providers → New → Custom MCP server.
-   [ ] Configure transport + command + env vars. **On Windows specifically, leave one env var blank.** Save and start the server. It should not crash on parse (this is the v0.0.46x Windows tokenization fix).

### 4.5 WebSocket provider

-   [ ] Settings → Providers → New → WebSocket provider. URL + optional headers. Save. It connects (or shows a clean disconnected state if the URL is unreachable — no crash).

### 4.6 Provider resolution layering

-   [ ] Bind a provider at the **workspace level** via the Dashboard Config modal → Providers tab.
-   [ ] Override it at the **widget instance level** via the widget's Configure → Providers section.
-   [ ] Confirm the widget reads the most-specific binding (instance > workspace > app default). Removing the instance override falls back to workspace; removing that falls back to app default.

### 4.7 Delete an in-use provider

-   [ ] Bind a provider to a widget on a dashboard.
-   [ ] Settings → Providers → select that provider → Delete.
-   [ ] Reopen the dashboard. The unresolved badge appears on the widget. App must NOT crash.

---

## 5. Settings & Account — ~10 min

-   [ ] **General** — toggle Debug Mode; click "Open Data Directory" — file manager opens to the user-data folder.
-   [ ] **Folders** — create a folder with name and icon (icon picker has search). Rename it. Move a dashboard into it. Delete the folder; confirmation says how many dashboards live there.
-   [ ] **Notifications** — toggle global on/off. Pick a widget that emits notifications, toggle the per-widget setting, verify the change.
-   [ ] **MCP Server (Settings tab)** — toggle the embedded server on. Copy the auth token. Change the port; restart; verify the new port.
-   [ ] **AI Assistant (Settings tab)** — switch backend Claude Code CLI ↔ Anthropic API. The model picker updates accordingly.
-   [ ] **Account** — sign out (token cleared). Sign back in (different account is fine, or the same one). Owned-packages list reflects the signed-in user.

---

## 6. AI Assistant — ~15 min

-   [ ] Type a prompt; response streams in without flicker.
-   [ ] Tool-call blocks render and can be expanded/collapsed.
-   [ ] Use one of the [1]–[6] menu shortcuts the assistant offers on first response (Dashboards / Widgets / Themes / Providers / Layouts / Setup). The assistant performs the action against the right surface.
-   [ ] Open the Widget Builder from the assistant. Code → live preview → Install. The new widget shows up in `@ai-built/<name>`.
-   [ ] Provider picker above the preview pane lets you choose a provider for each declared provider type the widget needs.

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

| Fix                                                                  | Re-run scenario                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Listener reconciliation on widget delete (v0.0.470)                  | §1.3 Listeners tab — delete-and-reopen check                                                    |
| `algoliaProvider` ReferenceError in dynamic widget loader (v0.0.471) | App startup with `AlgoliaSearchPage` widget installed; check console for ReferenceError on load |
| AI-built widgets force-included on dashboard publish (v0.0.46x)      | §1.4 — publish-with-@ai-built scenario                                                          |
| Defaults-review step in PublishDashboardModal (v0.0.46x)             | §1.4 Defaults Review                                                                            |
| Scope doubling on publish (v0.0.46x)                                 | §1.4 — manifest never contains `@scope/@scope/...`                                              |
| Folder ID collision on dashboard install (v0.0.46x)                  | §1.5 — install a dashboard whose default folder already exists locally                          |
| Registry delete S3 IAM (v0.0.46x)                                    | §1.6 unpublish                                                                                  |
| Windows MCP config tokenization (v0.0.46x)                           | §4.4 — empty env on Windows                                                                     |
| Widget preview error isolation in builder                            | §2.6 — preview syntax error doesn't crash app                                                   |

---

## 9. Reporting

Use [REPORT-TEMPLATE.md](./REPORT-TEMPLATE.md). One finding per issue / message. Include:

-   App version (Settings → General).
-   OS + arch (e.g., macOS 14.4 arm64).
-   Whether you're signed in.
-   Steps from a clean state.
-   Screenshot or short screen recording.

Thank you for testing.
