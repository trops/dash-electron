# Automation Coverage Matrix

Map of every item in the [Manual QA Test Plan](./MANUAL-TEST-PLAN.md) to a Playwright spec — existing or proposed — and the mocks each one needs. Goal: get to ~85% automated coverage so a tester sweep is mostly redundant, and so we can run the full suite in CI without humans.

## Legend

-   ✅ **Existing** — already automated in `e2e/tests/`. Re-running is free.
-   🟡 **Proposed** — not yet written; the spec file name and mocks are listed so we can land it.
-   🔴 **Manual only** — not worth automating (real OAuth consent screens, OS installers, "looks right" checks, real network).

Difficulty:

-   **S** = small — pure UI assertion, no new mock infra.
-   **M** = medium — needs an existing mock plus a fixture, or a new mock layer that's a small extension.
-   **L** = large — needs a brand-new mock subsystem (LLM stub, MCP transport stub, OAuth-token injector, file-dialog override).

---

## Mock infrastructure

What we already have under `e2e/helpers/`:

-   **`electron-app.js`** — launches a packaged Electron build with custom `env`.
-   **`mock-registry.js`** — local HTTP server that serves theme zip downloads. Switched in via `DASH_REGISTRY_API_URL`.
-   **`test-server.js`** — generic local HTTP fixture server.

What we need to add (each one unlocks a tier of automation):

| Mock                             | Purpose                                                                                                                                              | Unlocks                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **`mock-registry.js` extension** | serve widget + dashboard zip downloads, `/api/packages` index, `/api/publish`, `/api/delete-package`, `checkUpdates`                                 | All §1, §2, §3 registry CRUD                                  |
| **`auth-token-injector.js`**     | pre-seed `dash-registry-auth` electron-store with a fake token (already used in `registry-theme-install.spec.js`) and stub the device-flow endpoints | All auth-gated flows                                          |
| **`mock-llm-server.js`**         | local SSE server speaking the Anthropic streaming format with canned responses keyed by prompt                                                       | All §6 AI Assistant + AI builder flows in §2                  |
| **`mock-mcp-transport.js`**      | stub the MCP client transport so `tools/list` and `tools/call` return canned data; fake "Authenticated" status for OAuth servers                     | §4.2, §4.3 (tool list mount; not the consent screen)          |
| **`file-dialog-override.js`**    | override `dialog.showOpenDialog` / `showSaveDialog` to return fixture paths from `test/fixtures/`                                                    | All "Install from File", "Import zip", "Export to file" flows |

All five are bounded — each is ~100-300 LOC. Build them before the specs that depend on them.

---

## Section 0 — Pre-flight (12 items)

| #      | Item                                                | Status | Spec file                    | Mocks                | Diff |
| ------ | --------------------------------------------------- | ------ | ---------------------------- | -------------------- | ---- |
| 0.2a   | App opens to Welcome panel                          | ✅     | `empty-state.spec.js`        | —                    | S    |
| 0.2b   | No red console errors on launch                     | ✅     | `app-launch.spec.js`         | —                    | S    |
| 0.2c   | Title bar shows "Dash"                              | ✅     | `app-launch.spec.js`         | —                    | S    |
| 0.3a   | Sign in via Cognito hosted UI                       | 🔴     | —                            | (real OAuth)         | —    |
| 0.3b   | Username appears under Account                      | 🟡     | `account-signin.spec.js`     | auth-token-injector  | M    |
| 0.3c   | Owned packages list renders                         | 🟡     | `account-signin.spec.js`     | auth + mock-registry | M    |
| 0.4a-c | Discover lists populate (widgets/dashboards/themes) | 🟡     | `discover-tabs.spec.js`      | mock-registry        | S    |
| 0.5a   | AI Assistant panel mounts                           | 🟡     | `ai-assistant-mount.spec.js` | —                    | S    |
| 0.5b   | Input is enabled                                    | 🟡     | `ai-assistant-mount.spec.js` | —                    | S    |

**Net: 9 of 12 automatable; 1 hard (real OAuth handshake).** The 0.1 download row has no checkboxes — humans must confirm artifact existence on the GitHub release page.

---

## Section 1 — Dashboards (33 items)

### 1.1 Create

| #    | Item                                               | Status | Spec file                   | Mocks                              | Diff |
| ---- | -------------------------------------------------- | ------ | --------------------------- | ---------------------------------- | ---- |
| 1.1a | Blank from sidebar "+"                             | 🟡     | `dashboard-create.spec.js`  | —                                  | S    |
| 1.1b | From template (LayoutManagerModal)                 | 🟡     | `dashboard-create.spec.js`  | —                                  | S    |
| 1.1c | Wizard (Discover → Name → Folder → Theme → Review) | 🟡     | `dashboard-wizard.spec.js`  | mock-registry                      | M    |
| 1.1d | Import from `.dashboard.json` zip                  | 🟡     | `dashboard-import.spec.js`  | file-dialog-override + fixture zip | M    |
| 1.1e | Install from registry (with Install Options)       | 🟡     | `dashboard-install.spec.js` | mock-registry + auth               | M    |
| 1.1f | Duplicate                                          | 🟡     | `dashboard-create.spec.js`  | —                                  | S    |

### 1.2 Edit layout

| #    | Item                                       | Status | Spec file                       | Mocks | Diff                                     |
| ---- | ------------------------------------------ | ------ | ------------------------------- | ----- | ---------------------------------------- |
| 1.2a | Add widget via picker                      | 🟡     | `dashboard-layout-edit.spec.js` | —     | S                                        |
| 1.2b | Drag-reorder                               | 🟡     | `dashboard-layout-edit.spec.js` | —     | M (HTML5 DnD; need `dispatchEvent` shim) |
| 1.2c | Resize cell                                | 🟡     | `dashboard-layout-edit.spec.js` | —     | M                                        |
| 1.2d | Multi-page (add page, drop widget on each) | 🟡     | `dashboard-pages.spec.js`       | —     | S                                        |
| 1.2e | Sidebar layout                             | 🟡     | `dashboard-pages.spec.js`       | —     | S                                        |
| 1.2f | Nested LayoutGridContainer                 | 🟡     | `dashboard-layout-edit.spec.js` | —     | S                                        |

### 1.3 Configure (DashboardConfigModal)

| #    | Item                                                        | Status | Spec file                              | Mocks | Diff                                |
| ---- | ----------------------------------------------------------- | ------ | -------------------------------------- | ----- | ----------------------------------- |
| 1.3a | Providers tab unresolved-count + bulk-assign                | 🟡     | `dashboard-config-providers.spec.js`   | —     | S                                   |
| 1.3b | Listeners tab + delete-and-reopen reconciliation (v0.0.470) | 🟡     | `dashboard-config-listeners.spec.js`   | —     | S — high priority regression magnet |
| 1.3c | Widgets tab bulk-edit userPrefs                             | 🟡     | `dashboard-config-widgets-tab.spec.js` | —     | S                                   |
| 1.3d | Dependencies tab lists every package                        | 🟡     | `dashboard-config-deps.spec.js`        | —     | S                                   |

### 1.4 Publish

| #    | Item                                               | Status | Spec file                               | Mocks                          | Diff |
| ---- | -------------------------------------------------- | ------ | --------------------------------------- | ------------------------------ | ---- |
| 1.4a | Plain dashboard publish round-trip                 | 🟡     | `dashboard-publish.spec.js`             | mock-registry (publish) + auth | M    |
| 1.4b | Dashboard with @ai-built widget — forced republish | 🟡     | `dashboard-publish-aibuilt.spec.js`     | mock-registry + auth           | M    |
| 1.4c | Defaults review step                               | 🟡     | `dashboard-publish.spec.js`             | mock-registry + auth           | M    |
| 1.4d | Manifest never contains doubled scope              | 🟡     | `dashboard-publish.spec.js` (assertion) | mock-registry + auth           | S    |

### 1.5 Install from registry

| #    | Item                                           | Status | Spec file                              | Mocks                | Diff |
| ---- | ---------------------------------------------- | ------ | -------------------------------------- | -------------------- | ---- |
| 1.5a | Missing-deps install with progress modal       | 🟡     | `dashboard-install.spec.js`            | mock-registry + auth | M    |
| 1.5b | Bundled theme installed                        | 🟡     | `dashboard-install-with-theme.spec.js` | mock-registry + auth | M    |
| 1.5c | Cancel mid-install + retry; selections persist | 🟡     | `dashboard-install-cancel.spec.js`     | mock-registry + auth | M    |
| 1.5d | Auth-gated install — sign out, retry, succeed  | 🟡     | `dashboard-install-auth.spec.js`       | mock-registry + auth | M    |

### 1.6 Delete / Unsubscribe

| #    | Item                                        | Status | Spec file                     | Mocks                         | Diff |
| ---- | ------------------------------------------- | ------ | ----------------------------- | ----------------------------- | ---- |
| 1.6a | Local delete with confirmation              | 🟡     | `dashboard-delete.spec.js`    | —                             | S    |
| 1.6b | Unpublish from registry (S3 IAM regression) | 🟡     | `dashboard-unpublish.spec.js` | mock-registry (DELETE) + auth | M    |

### 1.7 Export / Import round-trip

| #    | Item                                            | Status | Spec file                     | Mocks                                | Diff |
| ---- | ----------------------------------------------- | ------ | ----------------------------- | ------------------------------------ | ---- |
| 1.7a | Export → uninstall widget → import → auto-fetch | 🟡     | `dashboard-roundtrip.spec.js` | mock-registry + file-dialog-override | M    |

### 1.8 Navigation

| #    | Item                                    | Status | Spec file                 | Mocks | Diff                          |
| ---- | --------------------------------------- | ------ | ------------------------- | ----- | ----------------------------- |
| 1.8a | Open via sidebar                        | ✅     | `sidebar.spec.js`         | —     | S                             |
| 1.8b | Open via tab bar                        | 🟡     | `dashboard-nav.spec.js`   | —     | S                             |
| 1.8c | Open via Command Palette                | ✅     | `command-palette.spec.js` | —     | S                             |
| 1.8d | Quit/relaunch — last dashboard restored | 🟡     | `app-persistence.spec.js` | —     | M (close + relaunch electron) |

**Net for §1: 32 of 33 automatable** (only the cosmetic "(Copy)" suffix sniff is trivial; no manual-only items).

---

## Section 2 — Widgets (24 items)

### 2.1 Install

| #    | Item                           | Status | Spec file                       | Mocks                                                                        | Diff |
| ---- | ------------------------------ | ------ | ------------------------------- | ---------------------------------------------------------------------------- | ---- |
| 2.1a | From registry                  | 🟡     | `widget-install.spec.js`        | mock-registry + auth                                                         | M    |
| 2.1b | From local zip                 | 🟡     | `widget-install.spec.js`        | file-dialog-override + fixture zip                                           | M    |
| 2.1c | From folder (Load from Folder) | 🟡     | `widget-install-folder.spec.js` | file-dialog-override + `test/fixtures/folder-install-test/` (already exists) | S    |
| 2.1d | From scratch via AI builder    | 🟡     | `widget-builder.spec.js`        | mock-llm + canned response                                                   | L    |
| 2.1e | Remix existing widget          | 🟡     | `widget-builder.spec.js`        | mock-llm                                                                     | L    |

### 2.2 Configure

| #    | Item                                      | Status | Spec file                      | Mocks | Diff |
| ---- | ----------------------------------------- | ------ | ------------------------------ | ----- | ---- |
| 2.2a | Right-click → Configure → edit userConfig | 🟡     | `widget-configure.spec.js`     | —     | S    |
| 2.2b | Wire Events via PanelEditItemHandlers     | 🟡     | `widget-listeners.spec.js`     | —     | S    |
| 2.2c | Provider dropdown for multi-type widget   | 🟡     | `widget-provider-pick.spec.js` | —     | S    |

### 2.3 Publish

| #    | Item                                  | Status | Spec file                            | Mocks                 | Diff |
| ---- | ------------------------------------- | ------ | ------------------------------------ | --------------------- | ---- |
| 2.3a | Sign-in gate before publish           | 🟡     | `widget-publish.spec.js`             | auth                  | S    |
| 2.3b | Personal-paths warning blocks publish | 🟡     | `widget-publish.spec.js`             | auth + fixture widget | S    |
| 2.3c | Bump preview (patch/minor/major)      | 🟡     | `widget-publish.spec.js`             | —                     | S    |
| 2.3d | Visibility toggle round-trips         | 🟡     | `widget-publish.spec.js`             | mock-registry + auth  | M    |
| 2.3e | Scope remap @ai-built → @user         | 🟡     | `widget-publish.spec.js` (assertion) | mock-registry + auth  | S    |

### 2.4 Update

| #    | Item                                        | Status | Spec file               | Mocks                | Diff |
| ---- | ------------------------------------------- | ------ | ----------------------- | -------------------- | ---- |
| 2.4a | Update badge appears after registry bump    | 🟡     | `widget-update.spec.js` | mock-registry + auth | M    |
| 2.4b | Click Update — new version installs cleanly | 🟡     | `widget-update.spec.js` | mock-registry + auth | M    |

### 2.5 Uninstall

| #    | Item                                                    | Status | Spec file                            | Mocks | Diff              |
| ---- | ------------------------------------------------------- | ------ | ------------------------------------ | ----- | ----------------- |
| 2.5a | Confirmation lists workspace + instance count           | 🟡     | `widget-uninstall.spec.js`           | —     | S                 |
| 2.5b | Listener references dropped on other widgets (v0.0.470) | 🟡     | `widget-uninstall-reconcile.spec.js` | —     | S — high priority |

### 2.6 Debug

| #    | Item                                              | Status | Spec file                                | Mocks                                   | Diff |
| ---- | ------------------------------------------------- | ------ | ---------------------------------------- | --------------------------------------- | ---- |
| 2.6a | Runtime error → ErrorBoundary "Send to AI"        | 🟡     | `widget-error-boundary.spec.js`          | fixture widget that throws              | S    |
| 2.6b | Debug Console — Log Stream + API Catalog          | 🟡     | `debug-console.spec.js`                  | —                                       | S    |
| 2.6c | AI builder preview syntax error doesn't crash app | 🟡     | `widget-builder-error-isolation.spec.js` | mock-llm (or just inject bad code path) | M    |

**Net for §2: 22 of 24 with mocks.** AI-builder slots (2.1d, 2.1e, 2.6c) need an LLM stub.

---

## Section 3 — Themes (8 items)

| #   | Item                                 | Status | Spec file                        | Mocks                           | Diff |
| --- | ------------------------------------ | ------ | -------------------------------- | ------------------------------- | ---- |
| 3a  | Install from registry                | ✅     | `registry-theme-install.spec.js` | mock-registry + auth (existing) | —    |
| 3b  | Install from file                    | 🟡     | `theme-install-file.spec.js`     | file-dialog-override + fixture  | M    |
| 3c  | Create from preset                   | 🟡     | `theme-create.spec.js`           | —                               | S    |
| 3d  | Edit color/typography/spacing tokens | 🟡     | `theme-edit.spec.js`             | —                               | S    |
| 3e  | Apply app-wide                       | ✅     | `theme-toggle.spec.js`           | —                               | —    |
| 3f  | Apply per-dashboard                  | 🟡     | `theme-per-dashboard.spec.js`    | —                               | S    |
| 3g  | Publish theme                        | 🟡     | `theme-publish.spec.js`          | mock-registry + auth            | M    |
| 3h  | Delete theme                         | 🟡     | `theme-delete.spec.js`           | —                               | S    |

**Net for §3: 8 of 8 automatable.** Theme is the most fully-covered topic by existing infra.

---

## Section 4 — Providers / MCP / Credentials (22 items)

### 4.1 Credential providers

| #    | Item                                       | Status | Spec file                          | Mocks | Diff |
| ---- | ------------------------------------------ | ------ | ---------------------------------- | ----- | ---- |
| 4.1a | Create credential provider with API key    | 🟡     | `provider-credential-crud.spec.js` | —     | S    |
| 4.1b | `isDefaultForType` single-winner invariant | 🟡     | `provider-default-toggle.spec.js`  | —     | S    |

### 4.2 MCP catalog (9 servers)

| #        | Item                                                                                                       | Status     | Spec file                     | Mocks              | Diff                     |
| -------- | ---------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- | ------------------ | ------------------------ |
| 4.2 (×9) | filesystem, github, gmail, gcal, gdrive, slack, gong, notion, algolia — config saves and tools list mounts | ✅ partial | `mcp-provider-status.spec.js` | mock-mcp-transport | M — extend existing spec |

The existing `mcp-provider-status.spec.js` already verifies status for one provider; extending it to cover all 9 with a stubbed transport is one new mock + a parameterized test.

### 4.3 OAuth round-trip

| #    | Item                                | Status | Spec file                        | Mocks                                                    | Diff |
| ---- | ----------------------------------- | ------ | -------------------------------- | -------------------------------------------------------- | ---- |
| 4.3a | Real Google consent screen          | 🔴     | —                                | (real OAuth)                                             | —    |
| 4.3b | Auth state persists across relaunch | 🟡     | `provider-oauth-persist.spec.js` | auth-token-injector for the OAuth provider's local store | M    |

### 4.4 Custom MCP server (Windows tokenization)

| #   | Item                                          | Status | Spec file                   | Mocks                   | Diff |
| --- | --------------------------------------------- | ------ | --------------------------- | ----------------------- | ---- |
| 4.4 | Empty env var on Windows doesn't crash parser | 🟡     | `mcp-custom-config.spec.js` | — (pure config-save UI) | S    |

### 4.5 WebSocket provider

| #   | Item                                                 | Status | Spec file                    | Mocks                                        | Diff |
| --- | ---------------------------------------------------- | ------ | ---------------------------- | -------------------------------------------- | ---- |
| 4.5 | Connect / unreachable URL → clean disconnected state | 🟡     | `provider-websocket.spec.js` | local WS test server (extend test-server.js) | M    |

### 4.6 Provider resolution layering

| #    | Item                                                    | Status | Spec file                     | Mocks | Diff                       |
| ---- | ------------------------------------------------------- | ------ | ----------------------------- | ----- | -------------------------- |
| 4.6a | Workspace-level binding                                 | 🟡     | `provider-resolution.spec.js` | —     | S — high value, pure state |
| 4.6b | Widget-instance override                                | 🟡     | `provider-resolution.spec.js` | —     | S                          |
| 4.6c | App-default fallback chain (instance > workspace > app) | 🟡     | `provider-resolution.spec.js` | —     | S                          |

### 4.7 Delete in-use provider

| #   | Item                                                | Status | Spec file                        | Mocks | Diff |
| --- | --------------------------------------------------- | ------ | -------------------------------- | ----- | ---- |
| 4.7 | Bind → delete → reload → unresolved badge, no crash | 🟡     | `provider-delete-in-use.spec.js` | —     | S    |

**Net for §4: 19 of 22.** OAuth consent (4.3a) is the only true blocker; everything else falls to a stubbed MCP transport.

---

## Section 5 — Settings & Account (6 items)

| #   | Item                                       | Status | Spec file                        | Mocks                       | Diff |
| --- | ------------------------------------------ | ------ | -------------------------------- | --------------------------- | ---- |
| 5a  | Toggle Debug Mode + Open Data Directory    | 🟡     | `settings-general.spec.js`       | spy on `shell.openPath` IPC | S    |
| 5b  | Folders CRUD                               | 🟡     | `settings-folders.spec.js`       | —                           | S    |
| 5c  | Notifications global + per-widget toggle   | 🟡     | `settings-notifications.spec.js` | —                           | S    |
| 5d  | MCP Server toggle, copy token, port change | 🟡     | `settings-mcp-server.spec.js`    | —                           | S    |
| 5e  | AI Assistant backend switch                | 🟡     | `settings-ai-assistant.spec.js`  | —                           | S    |
| 5f  | Sign out → sign in (different account)     | 🟡     | `account-switch.spec.js`         | auth-token-injector         | M    |

**Net: 6 of 6.**

---

## Section 6 — AI Assistant (5 items)

| #   | Item                                       | Status | Spec file                                    | Mocks                           | Diff |
| --- | ------------------------------------------ | ------ | -------------------------------------------- | ------------------------------- | ---- |
| 6a  | Streaming response renders without flicker | 🟡     | `ai-streaming.spec.js`                       | mock-llm (SSE)                  | L    |
| 6b  | Tool-call blocks render expand/collapse    | 🟡     | `ai-tool-calls.spec.js`                      | mock-llm with tool_use response | L    |
| 6c  | [1]-[6] menu shortcuts dispatch correctly  | 🟡     | `ai-menu-shortcuts.spec.js`                  | mock-llm                        | L    |
| 6d  | Widget Builder install via builder         | 🟡     | `widget-builder.spec.js` (shared with §2.1d) | mock-llm                        | L    |
| 6e  | Provider picker above preview              | 🟡     | `widget-builder.spec.js`                     | —                               | S    |

**Net: 5 of 5 once mock-llm exists.** Mock-llm is the single biggest unlock — it pays for §2.1d, §2.1e, §2.6c, and all of §6.

---

## Section 7 — App lifecycle & platform (5 items)

| #   | Item                                  | Status | Spec file                             | Mocks                                        | Diff |
| --- | ------------------------------------- | ------ | ------------------------------------- | -------------------------------------------- | ---- |
| 7a  | Quit/reopen — last dashboard restored | 🟡     | `app-persistence.spec.js`             | —                                            | M    |
| 7b  | Auto-update prompt                    | 🔴     | —                                     | (production-only against live update server) | —    |
| 7c  | Account switch updates owned packages | 🟡     | `account-switch.spec.js` (shared §5f) | auth + mock-registry                         | M    |
| 7d  | macOS native menu items               | 🔴     | —                                     | (Playwright Electron menu API is incomplete) | —    |
| 7e  | Windows Squirrel installer            | 🔴     | —                                     | (OS installer flow)                          | —    |

**Net: 2 of 5.** Update + native menus + Squirrel are genuinely hard and low-ROI to automate.

---

## Roll-up

| Section         |   Total | Already auto | Auto with new specs | Manual only |
| --------------- | ------: | -----------: | ------------------: | ----------: |
| 0. Pre-flight   |      12 |            3 |                   8 |           1 |
| 1. Dashboards   |      33 |            2 |                  30 |           1 |
| 2. Widgets      |      24 |            0 |                  24 |           0 |
| 3. Themes       |       8 |            2 |                   6 |           0 |
| 4. Providers    |      22 |            1 |                  20 |           1 |
| 5. Settings     |       6 |            0 |                   6 |           0 |
| 6. AI Assistant |       5 |            0 |                   5 |           0 |
| 7. Lifecycle    |       5 |            0 |                   2 |           3 |
| **Total**       | **115** |        **8** |             **101** |       **6** |

**~95% reachable. The 6 manual-only items: real OAuth (×2), auto-update prompt, native macOS menus, Squirrel installer, "looks right" cosmetic.**

---

## Build order — get the most coverage per unit of mock work

This is the recommended sequence so each new mock layer pays for itself before the next one starts. Numbers in parentheses are the count of plan items each unlocks.

1. **Mock-registry extension** (~40 items) — extend the existing `mock-registry.js` to serve widget zips, dashboard zips, the `/api/packages` index, `/api/publish`, and `/api/delete-package`. Single biggest unlock.
2. **Auth-token injector** (~25 items) — pattern is already in `registry-theme-install.spec.js` lines 41-51; promote it to a helper.
3. **File-dialog override** (~10 items) — patch `dialog.showOpenDialog` / `showSaveDialog` via `electronApp.evaluate()` so import/export specs can run headless.
4. **Mock-MCP transport** (~12 items) — stub the MCP `Client.connect` / `tools.list` / `tools.call` methods so the catalog and provider-status specs run without real servers.
5. **Mock-LLM SSE server** (~6 items) — local HTTP server speaking the Anthropic streaming format with prompt-keyed canned responses. Pays for AI Assistant + builder.

After steps 1-3 land we'd be at ~75/115 (~65%) automated. Steps 4-5 take us to ~95/115 (~83%).

---

## What stays manual, by design

-   **Real OAuth consent screens** (Google Drive, Gmail, Slack). Not the auth state — that's mockable — but the human-in-the-loop browser handshake.
-   **Auto-update prompt against the real `update.electronjs.org` endpoint.** Worth a manual smoke test once per release.
-   **Native macOS menu bar items.** Playwright's Electron API doesn't drive native menus reliably.
-   **Squirrel installer on Windows.** OS-level installer flow.
-   **Cosmetic / "looks right" judgment.** Spacing, alignment, color contrast, animation feel — humans are still the right oracle.

These six items belong in a 15-minute "smoke test" sub-plan rather than a 2.5-hour sweep. Everything else can be a green CI badge.
