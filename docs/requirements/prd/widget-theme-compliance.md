# PRD: Widget Theme Compliance

**Status:** In Progress
**Last Updated:** 2026-10-05
**Owner:** trops
**Related PRDs:** [arbitrary-color-themes.md](arbitrary-color-themes.md)
**Affected Repos:** `dash-react` (theme-aware status colors), `dash-electron` (sample widgets)

---

## Executive Summary

The sample widgets in `src/SampleWidgets/` hardcode dark-mode Tailwind colors (`bg-gray-800`, `text-gray-400`, `bg-red-900/30 text-red-300`, …). On a light theme they render as dark boxes and unreadable pale-on-pale text — e.g. the Algolia Analytics "missing analytics ACL" error is light red on light pink. This effort makes every sample widget follow the active theme (light or dark) by replacing hardcoded colors with dash-react primitives and theme tokens, and adds a guard test so regressions fail CI.

---

## Context & Background

### Problem Statement

Themes already carry a full `light` and `dark` token map (`ThemeModel`), and the active variant (`themeVariant`) is exposed on `ThemeContext` — including inside dashboard-scoped themes (`DashboardThemeProvider` spreads the parent context). The widgets simply don't use it: an inventory on 2026-10-05 found **2,088 hardcoded color classes in 104 files across 14 packages**, 336 of them opacity-modifier classes (`bg-white/5`, `bg-red-900/30`) that the prebuilt CSS bundle does not reliably include, and 65 files carrying the same hand-rolled error banner.

There is also no theme-aware primitive for status colors: dash-react `AlertBanner` is fixed to light-mode pastels, `Alert` only uses theme primary colors, and themes have no error/success/warning tokens.

**Who experiences this problem?**

-   Primary: dashboard users on a light theme — errors, inputs and secondary text are hard or impossible to read.
-   Secondary: widget authors (including the AI Widget Builder) copying sample widgets as exemplars, propagating the hardcoded pattern.

### Current State

-   Neutral/primary theme tokens flip per variant (`ThemeModel` maps light to the 100–300 shade range, dark to 500–900).
-   `themeVariant` reaches widgets via `ThemeContext`.
-   Sample widgets read neither.

---

## Goals & Success Metrics

1. **Readable in light mode** — every sample widget's text, inputs and status messages meet a legible contrast on light and dark themes.
2. **No hardcoded colors** — zero raw color utility classes in `src/SampleWidgets/**` (excluding tests and `.dash.js`), enforced by a test.
3. **Accent colors follow the theme** — decorative accents (indigo/emerald highlights, chart series) use theme primary/secondary tokens.

| Metric                                   | Target | How Measured                                  |
| ---------------------------------------- | ------ | --------------------------------------------- |
| Hardcoded color classes in SampleWidgets | 0      | `src/SampleWidgets/noHardcodedColors.test.js` |
| Packages converted                       | 14/14  | Guard test allowlist empty                    |

### Non-Goals

-   App chrome (dash-core) — covered by the Aurora UI refresh.
-   Arbitrary hex status colors — status colors use fixed Tailwind shades per variant.

---

## User Stories

**US-001: Theme-aware status colors (dash-react)** — P0

> As a widget author, I want error/success/warning/info colors that adapt to light and dark themes, so that status messages are readable everywhere.

-   [ ] AC1: `AlertBanner` renders light pastels on `themeVariant="light"` and dark-tinted solid backgrounds with light text on `themeVariant="dark"`.
-   [ ] AC2: `AlertBanner` supports `size="compact"` (smaller padding/icon) for small widgets.
-   [ ] AC3: `useStatusTokens()` returns `{ error, success, warning, info }`, each with `bg`, `text`, `border`, `strongText` class strings appropriate to the current variant, using only solid safelisted classes (no opacity modifiers).

**US-002: Guard against hardcoded colors** — P0

> As a maintainer, I want CI to fail when a sample widget hardcodes a color, so that regressions don't ship.

-   [ ] AC1: Test scans `src/SampleWidgets/**` source (excluding tests, stories, `.dash.js`) for raw color utilities.
-   [ ] AC2: Unconverted packages are listed in an allowlist; each conversion PR removes its package.

**US-003: Convert sample widget packages** — P0

> As a light-theme user, I want every sample widget to follow my theme.

-   [ ] AC1: Error `<div>`s replaced with `<AlertBanner variant="error" size="compact">`.
-   [ ] AC2: Inputs/selects use dash-react `InputText` / `SelectInput`.
-   [ ] AC3: Neutral text/border/background colors use theme neutral tokens from `ThemeContext`.
-   [ ] AC4: Status colors use `useStatusTokens()`; accents use theme primary/secondary tokens.
-   [ ] AC5: Verified by screenshot on a light and a dark theme.

---

## Implementation Phases

| PR  | Repo          | Scope                                                        |
| --- | ------------- | ------------------------------------------------------------ |
| 1   | dash-react    | `AlertBanner` variant + compact size, `useStatusTokens` hook |
| 2   | dash-electron | Guard test + dash-react bump + Algolia                       |
| 3   | dash-electron | AlgoliaSETools                                               |
| 4   | dash-electron | AlgoliaSearch                                                |
| 5   | dash-electron | Gong                                                         |
| 6   | dash-electron | GoogleCalendar, GoogleDrive, Gmail                           |
| 7   | dash-electron | GitHub, Slack, Notion, Filesystem                            |
| 8   | dash-electron | DashSamples, Chat, Clock                                     |

**Risks:**

-   Sample widgets run from **installed** bundles — each converted package must be rebuilt, republished to the registry and updated in the app before users see the fix.
-   Default dark look shifts slightly from fixed grays to theme neutral tokens (intended).

---

## Decisions Made

| Date       | Decision                                      | Rationale                                              | Owner |
| ---------- | --------------------------------------------- | ------------------------------------------------------ | ----- |
| 2026-10-05 | Full cleanup (all packages, all colors)       | Partial fixes leave visible light/dark rifts           | trops |
| 2026-10-05 | Accent/chart colors → theme primary/secondary | Accents should follow the user's theme                 | trops |
| 2026-10-05 | Status colors in dash-react, not ThemeModel   | `themeVariant` already on context; no dash-core change | trops |

---

## Implementation Notes

-   **PR 1 (dash-react #56, v1.0.62):** `Utils/statusColors.js` holds the light/dark status palette; `AlertBanner` and `useStatusTokens()` both read it, so banner and widget status colors can't drift. `StatusBadge` gained a light palette (dark unchanged).
-   **PR 2 (Algolia):** all 17 files converted. The guard lives in `src/AiAssistant/composer/widgetConventions.test.js` ("Sample widget theme compliance") rather than `src/SampleWidgets/`, because CI only runs jest under `src/AiAssistant`. Its regex is stricter than `COLOR_TAILWIND_REGEX` (white/black, `/NN` opacity, any variant prefix, ring/divide/placeholder/gradients). The widget-builder skill, `PRIMITIVE_CONVENTIONS.errorRegion` and the AcceptanceScorecard now recommend/accept `AlertBanner` for errors.
-   **PR 3 (AlgoliaSETools):** all 11 files converted; verified populated views (Attribute Explorer, Config Recommender) in light + dark. Verification surfaced an unrelated IPC validator bug that rejected Algolia's empty "match all" query — fixed separately in #817.
-   **PR 4 (AlgoliaSearch):** all 10 widget files converted; verified Algolia UI (results, Query Analytics, Template Editor tabs) and Algolia Test 1 (facets) in light + dark. `*.dash.js` widget-card colors and the hit-template help example left as-is. Follow-up: the Monaco `CodeEditorVS` stays dark on light themes.
-   **PR 5 (Gong):** all 11 files converted (8 widgets + CallList/CallSummary/CallTranscript components). Speaker colors rotate through theme accent + status tokens; workspace chips stay real buttons (Button active / Button2). Verified Workshop Command Center + Gong Testing in light + dark (empty states only — the Gong account returned no calls).
-   **Token mapping used:** raised rows/tiles `bg-primary-dark`, body text `text-primary-medium`, borders `border-primary-dark`, accent `text-secondary-medium`, muted text `Caption2`, inputs `SelectInput`/`InputText` (`h-7`), status `useStatusTokens()`.
-   **Known trade-offs:** `SelectInput` renders its placeholder disabled, so an index can't be cleared back to "none"; `text-[10px]` labels became `text-xs`; the dark-theme native date-picker icon is low contrast (dash-react follow-up).
-   **Lesson:** sample widgets run from installed bundles — verify by rebuilding the package zip and `installLocal` in the running app (the Widgets-page preview with an Algolia key lacking the analytics ACL reproduces the error banner).

---

## Revision History

| Version | Date       | Author | Changes       |
| ------- | ---------- | ------ | ------------- |
| 1.0     | 2026-10-05 | trops  | Initial draft |
