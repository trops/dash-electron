# PRD: Arbitrary-Color Themes (CSS Custom Properties)

**Status:** Draft
**Last Updated:** 2026-05-22
**Owner:** trops
**Related PRDs:** N/A
**Affected Repos:** `dash-react` (theme model + safelist), `dash-core` (theme picker UI), `dash-electron` (settings surface + safelist build)

---

## Executive Summary

Today, when a Dash user opens **Settings → Themes** and picks a primary color, they're limited to **22 named Tailwind color families** (`gray`, `blue`, `indigo`, `rose`, `slate`, …). A brand-specific hue like Slack's burgundy `#4A154B`, GitHub black `#0D1117`, or Stripe purple `#635BFF` is not selectable — even though those colors define the brand identity of the apps users are integrating with.

This PRD proposes extending the theme system to accept **arbitrary hex/RGB values** alongside the existing named palette, using **CSS custom properties** to plumb the color through the existing class-string resolution pipeline. The result: users get the full color spectrum without ballooning the prebuilt Tailwind CSS bundle, existing themes remain byte-identical, and the implementation is bounded to ~3 files in `dash-react`, one in `dash-core` (UI), and a small safelist addition in `dash-electron`.

---

## Context & Background

### Problem Statement

**What problem are we solving?**

The current theme picker constrains users to the Tailwind named-color palette (`dash-react/src/Utils/colors.js:58-81` — a fixed array of 22 family names). The constraint is structural, not a UX choice: `dash-electron` ships a **prebuilt** Tailwind CSS bundle, so any class not statically present in the safelist at build time won't render. Safelisting every possible Tailwind color × shade combo already pushes ~1500 entries (`dash-electron/tailwind.config.js:38-80`); safelisting arbitrary hex values is infeasible.

This means users can't:

-   Match a workspace to a brand color (Slack burgundy, Notion's specific gray, Linear's purple).
-   Build dashboards that match a company style guide.
-   Express themselves with anything outside the Tailwind palette — which doesn't include muted brand-neutral tones (off-blacks, mauves, navy variants) common in modern design systems.

**Who experiences this problem?**

-   **Primary:** Dashboard creators and Dash workspace owners. They want their dashboards to look "on-brand" for their company or the service they're integrating with.
-   **Secondary:** Widget developers (e.g., the AI Widget Builder) who use theme tokens — they're constrained by what colors the _user_ picked, but the user couldn't pick a brand color in the first place.

**What happens if we don't solve it?**

Dash's visual identity is bounded by Tailwind's palette. Polished, brand-aware dashboards require dropping out of the theme system entirely (inline `style={{ backgroundColor: "#4A154B" }}` hardcoded), which the project's "use dash-react primitives for all UX" rule explicitly forbids and which won't survive theme switches. As Dash's surface area grows (slack-pack, gong-pack, gmail-pack, …) the visual mismatch between dashboards-and-the-services-they-integrate becomes more obvious.

### Current State

**What exists today?**

-   Themes are stored as JSON with `primary`, `secondary`, `tertiary` (and others) as **Tailwind color family name strings**: `{ "primary": "blue", "secondary": "indigo", … }` (see `dash-electron/src/Mock/theme.js:4-11`).
-   `ThemeModel` (`dash-core/src/Models/ThemeModel.js:75-100`) expands each named color into ~80 derived theme tokens — `theme["bg-primary-medium"] = "bg-blue-700"`, `theme["text-primary-light"] = "text-blue-100"`, etc. Tokens are **Tailwind class strings**, not CSS color values.
-   Components consume tokens through `getStylesForItem(themeObjects.X, currentTheme, ...)` which routes the strings into a `className=` attribute on rendered elements.
-   The Tailwind safelist (`dash-electron/tailwind.config.js`) declares regex patterns covering all `bg-{color}-{shade}` / `text-…` / `border-…` permutations across 22 colors × 11 shades × 2 hover-variants.
-   Live preview works because `ThemePreviewProvider` (`dash-react/src/Context/ThemePreviewProvider.js:36-98`) wraps the React tree with an overridden `currentTheme` map — switching colors triggers a re-render with new class strings, no CSS-in-JS or stylesheet injection.
-   No existing path supports arbitrary hex/RGB values in the theme. Inline styling escapes (e.g., `style={{ backgroundColor: "#4A154B" }}`) bypass the system but don't propagate through theme switches.

**Limitations:**

1. Color choices are bounded by the Tailwind palette.
2. Adding more colors means more safelist entries → larger CSS bundle. Today's safelist already adds ~50KB to the bundle; doubling it would be measurably worse.
3. Class-string-only resolution means consumers that try to use theme values as inline CSS color values get a no-op (class name silently rendered as a non-existent CSS value).
4. No theme-export support for custom colors — the JSON shape assumes named palette.

---

## Goals & Success Metrics

### Primary Goals

1. **Custom primary color** — User can paste a hex value (e.g., `#4A154B`) in Settings → Themes and have the entire app re-skin with that color and auto-derived shades. _Measurable: setting `primary: "#4A154B"` in a saved theme renders correctly in all dash-react primitives without any code change to widgets._
2. **Bounded bundle impact** — CSS bundle grows by less than 10KB (vs. the ~50KB current safelist). _Measurable: `dash-electron` `npm run build:css` output size delta < 10KB before/after._
3. **Zero regression** — Existing themes (with named colors) render byte-identical to today. _Measurable: snapshot tests of all dash-react primitives with the default Tailwind named-color theme pass unchanged._

### Success Metrics

| Metric                               | Target                        | How Measured                                                               |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------- |
| Custom-color theme renders correctly | 100% of dash-react primitives | Visual regression test against a `#4A154B` theme on a kitchen-sink page    |
| CSS bundle delta                     | < 10KB                        | Pre/post `npm run build:css` size diff                                     |
| Theme switch latency                 | < 50ms (P95)                  | Stopwatch the React commit on `setPreviewTheme(customColorTheme)`          |
| Backwards compat                     | Zero failures                 | All existing snapshot/visual tests pass unchanged                          |
| Color picker discoverability         | < 3s to find                  | UX walkthrough; new hex input must be visible alongside named-color picker |

### Non-Goals

-   **Multi-stop gradient themes** — Out of scope; gradient handling is a deeper change. Phase 4+ if ever.
-   **Per-component color overrides** ("make this button red, regardless of theme") — that's an override-prop feature, not a theme feature. Out of scope.
-   **Color palette generators** (Coolors-style hue suggestions) — Out of scope; users provide a hex.
-   **Automatic accessibility correction** (auto-adjusting picked colors to meet WCAG AA) — Out of scope; we'll surface a _warning_ in the picker but not auto-modify the user's choice.
-   **Custom shades beyond the standard 11 (50–900)** — The model derives standard shades only. Users can't pick shade 350.
-   **Theme-import from external sources** (CSS files, Figma plugins, etc.) — Out of scope; the in-app picker is the only entry point.

---

## User Personas

### Workspace Owner (Brand-Sensitive)

**Role:** Power user who configures Dash workspaces for their team or for personal use, with a strong brand-aesthetic preference.

**Goals:**

-   Match Dash's visual identity to the company's brand (or to the brand of the SaaS they're integrating with — Slack burgundy, Stripe purple, Notion gray).
-   Make dashboards "feel native" when shared in a brand context.
-   Keep the visual experience consistent across all widgets and dashboard surfaces.

**Pain Points:**

-   The 22 Tailwind colors are _generic_; none match modern brand palettes exactly.
-   Hardcoding hex values into widgets bypasses theme switches and looks broken in dark mode.
-   No way to express a workspace's identity in a meaningful visual signal.

**Technical Level:** Intermediate — comfortable pasting a hex code, not comfortable editing JSON theme files by hand.

**Success Scenario:** Opens Settings → Themes → clicks the new "Custom hex" input → pastes `#4A154B` → sees a live preview update within 50ms → saves → the rest of the app (sidebar accents, button fills, focus rings, dashboard tabs) all skin to that burgundy.

### Widget Developer (AI Assistant + Hand-Written)

**Role:** Builds widgets via the AI Widget Builder or hand-writes new packs.

**Goals:**

-   Consume theme tokens in widget code without knowing whether the user picked a named or custom color.
-   Theme-token-based styling propagates correctly through theme switches.

**Pain Points:**

-   Inline `style={{ color: "#xxx" }}` escape hatches in widgets are fragile under theme switches.
-   Currently no canonical way to get a CSS color value for a theme token — `currentTheme["bg-primary-medium"]` returns a Tailwind class string, which is useless as a CSS color.

**Technical Level:** Mixed — AI-generated widgets follow the cookbook, hand-written ones follow the patterns we document.

**Success Scenario:** Writes `<div className={`${tokens["bg-primary-medium"]} ...`}>` (or via `getStylesForItem`). Whether the user's theme is `primary: "blue"` (named) or `primary: "#4A154B"` (custom), the widget renders correctly.

---

## User Stories

### Must-Have (P0)

**US-001: Pick a custom primary color via hex input**

> As a workspace owner,
> I want to enter a hex value (e.g. `#4A154B`) for the primary theme color,
> so that my Dash workspace skins to a brand color outside the Tailwind named palette.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Given the Settings → Themes panel is open, when I type `#4A154B` in the new "Custom hex" input, then the theme preview updates within 50ms with that color applied to all `primary-*` tokens.
-   [ ] AC2: Given a hex value is entered, when I click Save, then the persisted theme JSON contains `"primary": "#4A154B"` (not a Tailwind name).
-   [ ] AC3: Given the theme is saved with a custom primary, when I quit and reopen Dash, then the theme reloads correctly with the custom primary still applied.
-   [ ] AC4: Given an invalid hex (e.g. `#zzz`), when I enter it, then I see a validation error inline and the preview does not update.

**Edge Cases:**

-   Very dark base color (`#000000`) → shade derivation algorithm produces a visible "50" by interpolating toward white. Tested with `#000` and `#0a0a0a`.
-   Very light base color (`#ffffff`) → derivation toward black for "900". Tested.
-   Color with insufficient contrast against the background variant → see US-005 (warning, not block).
-   User pastes `4A154B` without `#` → input normalizes to `#4A154B` before validation.
-   User pastes a 3-digit shorthand (`#abc`) → input expands to `#aabbcc`.

**Technical Notes:**

-   New helper `deriveShades(hex)` in `dash-react/src/Utils/colorMath.js` returns the 11-shade map (50..950) via HSL interpolation.
-   `ThemeModel` detects hex vs. Tailwind name via regex; routes to two different token-emission paths.
-   Token values for custom-color themes are `bg-[var(--primary-700)]` (arbitrary-value Tailwind syntax) instead of `bg-blue-700`.

**Example Scenario:**

```
User opens Settings → Themes.
Theme picker shows current "blue" selection with the named-color grid.
Below the grid, a new "Custom" section has a hex input field.
User pastes "#4A154B".
Preview pane shows the entire dashboard re-skinned to burgundy.
Sidebar fill, active channel highlight, primary buttons, focus rings all
take on burgundy variants.
User clicks Save.
Theme persists: { primary: "#4A154B", secondary: "indigo", ... }.
```

**Definition of Done:**

-   [ ] `colorMath.js` helper + tests
-   [ ] `ThemeModel` hex-path tests
-   [ ] `tailwind.config.js` safelist additions ship with `dash-electron`
-   [ ] Color picker UI lands in `dash-core`
-   [ ] One end-to-end visual test (Slack burgundy theme renders kitchen-sink correctly)
-   [ ] No regression in existing named-color theme snapshots

---

**US-002: Components render correctly under a custom-color theme**

> As a widget developer,
> I want my widget code that uses theme tokens to work identically whether the user picked a named or custom color,
> so that I don't have to write two code paths.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: A component reading `currentTheme["bg-primary-medium"]` and using it as a `className=` (the canonical path via `getStylesForItem`) renders correctly under both named and custom themes.
-   [ ] AC2: All Tier-1 dash-react primitives (`Button`, `Panel`, `MenuItem`, `Tag`, `Alert`, `InputText`, `TextArea`) visually match expectations under a custom `primary: "#4A154B"` theme.
-   [ ] AC3: Live preview switches between named and custom themes without page reload, within 50ms.

**Edge Cases:**

-   Component using `getStylesForItem` that resolves to `hover-bg-primary-medium` → Tailwind hover variant of the arbitrary-value class must be safelisted (covered in `tailwind.config.js` change).
-   Widget using inline `style={{ backgroundColor: currentTheme["bg-primary-medium"] }}` (which is _wrong_ in the current contract since tokens return class strings) → see US-007 (separate channel `cssVars` on theme for genuine CSS color values).

**Technical Notes:**

-   `tailwind.config.js` adds a bounded set of arbitrary-value patterns: `bg-\[var\(--primary-{shade}\)\]`, etc.
-   ThemePreviewProvider gains a side effect: when the active theme has a custom color, it writes `--primary-{50..950}` to `document.documentElement.style` (`setProperty`) on mount + theme change.

**Example Scenario:**

```
A SlackWidget that uses `<MenuItem selectedBackgroundColor="bg-primary-medium">`
renders with #4A154B fill when the user's theme has `primary: "#4A154B"`.
Same code, same MenuItem, no widget-side change.
```

**Definition of Done:**

-   [ ] All Tier-1 primitives have visual snapshots under both a named-color and a custom-color theme; both pass.
-   [ ] Storybook entries demonstrate both paths.

---

**US-003: Existing named-color themes continue working unchanged**

> As an existing Dash user with a saved theme,
> I want my current named-color theme to render byte-identically after this change ships,
> so that nothing I've already configured visually shifts.

**Priority:** P0
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Loading a saved theme with `primary: "blue"` produces the exact same `currentTheme` map as today.
-   [ ] AC2: All existing dash-react snapshot tests pass without updates.
-   [ ] AC3: No additional CSS variables are written to `:root` for named-color themes (the fast path).

**Edge Cases:**

-   Mixed theme: `primary: "blue"` (named) + `secondary: "#4A154B"` (custom). Each channel routes through its own path independently.

**Technical Notes:**

-   ThemeModel's hex-detection is a single early-return branch. Named path is unmodified.

**Example Scenario:**

```
A user upgrades dash-react from v1.0.51 to vX (where X carries this feature).
They never touch Settings → Themes.
The app looks identical post-upgrade. No visual shift, no flash-of-default.
```

**Definition of Done:**

-   [ ] Diff of `currentTheme` map (before vs after) for a named-color theme is empty.
-   [ ] Snapshot suite passes.

---

### Should-Have (P1)

**US-004: Custom secondary + tertiary + neutral colors**

> As a workspace owner,
> I want to also pick custom hex values for secondary / tertiary / neutral,
> so that I can build a complete brand palette.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: Each of `secondary`, `tertiary`, `neutral` can independently take a named OR a hex value.
-   [ ] AC2: Mixed themes (e.g. named primary + custom secondary) work without conflict.

**Edge Cases:**

-   All four channels custom → bundle still under +10KB target (the safelist additions are independent of how many channels use them).

**Technical Notes:**

-   Same plumbing as US-001, just applied to all four named channels. No new model branches.

**Example Scenario:**

```
Theme: { primary: "#4A154B", secondary: "#36C5F0", tertiary: "#ECB22E", neutral: "gray" }
(Slack's full brand palette + gray neutral)
Every `*-primary-*` token resolves to burgundy variants.
Every `*-secondary-*` token resolves to Slack-blue variants.
Etc.
```

**Definition of Done:**

-   [ ] All four channels covered by tests.

---

**US-005: Accessibility warning (not block) on poor contrast**

> As a workspace owner,
> I want to be warned (not blocked) if my custom color creates a WCAG-AA failing contrast against the canonical background,
> so that I can knowingly choose to proceed.

**Priority:** P1
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: When I enter a hex with text-on-medium contrast below 4.5:1 against the default light/dark canonical background, an inline warning appears next to the input with the computed ratio.
-   [ ] AC2: The warning is dismissable; I can still save and use the color.
-   [ ] AC3: The warning text includes the actual ratio (e.g., "Contrast ratio 2.8:1 — below WCAG AA 4.5:1 target").

**Edge Cases:**

-   Default text colors derived from the same hue will sometimes hit unavoidable contrast issues at shade extremes; the warning is per-token, not per-theme.

**Technical Notes:**

-   Use [WCAG relative luminance formula](https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio). ~15 lines of helper.

**Example Scenario:**

```
User enters #FFFF00 (bright yellow) as primary.
Picker shows: "⚠️ Contrast 1.07:1 against `bg-primary-very-light` — below
WCAG AA 4.5:1. Text on this color may be unreadable."
User can still save.
```

**Definition of Done:**

-   [ ] Helper + tests.
-   [ ] UI message component shows ratio + threshold.

---

### Nice-to-Have (P2)

**US-006: Brand color presets**

> As a workspace owner,
> I want a curated list of brand color presets (Slack, Notion, Stripe, GitHub, …),
> so that I can apply a familiar brand identity with one click.

**Priority:** P2
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: A "Presets" section in the Themes panel lists ~10 well-known brand palettes by name with swatches.
-   [ ] AC2: Clicking a preset populates the hex input(s) and updates the preview.

**Edge Cases:**

-   A preset that includes a custom secondary/tertiary/neutral applies all four; one that's primary-only applies just primary and leaves the others.

**Technical Notes:**

-   Static JSON list shipped with dash-react. No service call.

---

**US-007: `cssVars` accessor on theme for inline-style consumers**

> As a widget developer,
> I want a parallel accessor `currentTheme.cssVars["primary-700"]` that returns a CSS-color value (e.g. `"var(--primary-700)"` for custom themes or `"#1d4ed8"` for named themes),
> so that I can write inline `style={{ backgroundColor: ... }}` without dropping out of the theme system.

**Priority:** P1 (promoted from P2 on 2026-05-22 — required to fix SlackWidget inline-style theme bug)
**Status:** Backlog

**Acceptance Criteria:**

-   [ ] AC1: `currentTheme.cssVars["primary-700"]` returns a string usable as a CSS color (either a `var(...)` reference or a hex literal).
-   [ ] AC2: The value updates on theme switch.
-   [ ] AC3: Documented in the widget-builder skill.

**Edge Cases:**

-   For named themes, the value is a hex (looked up from Tailwind's `tailwind/colors.cjs`). For custom themes, a `var(...)` reference.

**Technical Notes:**

-   Bolt on to ThemeModel. Doesn't replace existing `currentTheme[token]` (class string). Additive.

---

## Feature Requirements

### Functional Requirements

**FR-001: Hex input on theme picker**

-   **Description:** Settings → Themes panel grows a "Custom" subsection with one hex input per color channel (primary, secondary, tertiary, neutral).
-   **User Story:** US-001, US-004
-   **Priority:** P0
-   **Validation:** UI test: input accepts `#xxx` and `#xxxxxx`; rejects `#zzz`; normalizes leading-`#`-missing inputs; emits the validated value on blur.

**FR-002: Hex detection in ThemeModel**

-   **Description:** `ThemeModel(themeItem)` branches on whether each color channel is a Tailwind name or a hex. Hex branch derives shades and emits `bg-[var(--{channel}-{shade})]`-style tokens. Named branch is unchanged.
-   **User Story:** US-001, US-003
-   **Priority:** P0
-   **Validation:** Unit test: `ThemeModel({ primary: "blue" })` → identical to today. `ThemeModel({ primary: "#4A154B" })` → tokens are `bg-[var(--primary-...)]`. Mixed shape works.

**FR-003: CSS-variable injection on theme switch**

-   **Description:** When the active theme contains custom colors, `ThemePreviewProvider` (and the saved-theme provider) write `--{channel}-{shade}` CSS variables to `document.documentElement.style` on mount + theme change. Removes them when switching back to a named-only theme.
-   **User Story:** US-001, US-002
-   **Priority:** P0
-   **Validation:** Integration test: switch theme; check `getComputedStyle(document.documentElement).getPropertyValue("--primary-700")` returns the expected value.

**FR-004: Safelist additions for arbitrary-value classes**

-   **Description:** `dash-electron/tailwind.config.js` adds patterns for `bg-\[var\(--{channel}-{shade}\)\]`, `text-\[…\]`, `border-\[…\]`, with `hover:` variants. Bounded set: 4 channels × 11 shades × 3 properties × 2 variants = 264 entries.
-   **User Story:** US-002
-   **Priority:** P0
-   **Validation:** `npm run build:css` produces a bundle that contains all expected classes; size delta < 10KB.

**FR-005: Shade derivation algorithm**

-   **Description:** New helper `deriveShades(hex)` in `dash-react/src/Utils/colorMath.js` returns the 11-shade map (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) given a base hex. Uses HSL interpolation: shade 500 = the user's input, lighter shades interpolate toward white, darker toward black. Mimics Tailwind's palette structure.
-   **User Story:** US-001
-   **Priority:** P0
-   **Validation:** Unit test: derived shades for known hexes (e.g. `#3b82f6` ≈ Tailwind's `blue-500`) produce shade values close to the named-blue palette (RGB diff < 30 per channel).

**FR-006: Theme JSON schema (additive)**

-   **Description:** Theme JSON accepts either named strings OR hex strings for `primary` / `secondary` / `tertiary` / `neutral`. No schema-version bump needed — detection is intrinsic. Tooling that reads themes must accept both.
-   **User Story:** US-001, US-003, US-004
-   **Priority:** P0
-   **Validation:** Saved + reloaded themes with mixed shapes round-trip identically.

### Non-Functional Requirements

**NFR-001: Performance**

-   Theme switch latency (named ↔ custom) under 50ms P95, measured from `setPreviewTheme` to React commit.
-   Shade derivation cached per hex (computed once, reused across token emissions).
-   No CSS variable writes on every render — only on theme change.

**NFR-002: Bundle size**

-   CSS bundle delta < 10KB. Measured: `dash-electron/public/tailwind.css` size before vs. after.

**NFR-003: Backwards compatibility**

-   All existing named-color themes render byte-identical. Zero changes to existing token strings.
-   Theme JSON files saved by older versions of Dash load unchanged.

**NFR-004: Accessibility**

-   Contrast-ratio warning surfaces on poor-contrast hex picks (P1).
-   Color picker is keyboard-navigable (tab to hex input, type, blur to commit).
-   Saved themes pass the same a11y bar as today (custom colors don't lower the floor).

**NFR-005: Browser support**

-   CSS custom properties are supported in all Electron-supported Chromium versions (any > Chromium 49 / 2016+). No polyfill needed.

---

## User Workflows

### Workflow 1: Setting a custom primary color (Slack burgundy)

**Trigger:** User opens Settings → Themes.

**Steps:**

1. User clicks the avatar/account button.
2. Settings opens. User clicks "Themes" in the left sub-nav.
3. Themes panel renders. User sees the existing named-color picker (22 swatches) at the top.
4. Below the named picker, a new "Custom" section has 4 hex-input rows (Primary, Secondary, Tertiary, Neutral) plus a "Presets" expander (P2).
5. User pastes `#4A154B` into the Primary hex field. Validation runs on blur. Input shows a small color-preview swatch next to it.
6. The Themes panel's live preview pane updates within 50ms: sidebar tints toward burgundy, primary buttons fill with burgundy variants, focus rings, dashboard tabs etc. all skin to the new color.
7. User reviews the preview. If contrast warnings show (P1), user reads them.
8. User clicks "Save". Theme persists.

**Success State:** Theme is saved. Closing + reopening Settings → Themes shows the picker populated with the custom hex. Closing + reopening Dash itself loads the custom theme correctly.

**Error Scenarios:**

-   Invalid hex → inline error, no preview update, Save button disabled until corrected.
-   Network/storage failure on Save → error toast surfaces, theme stays in preview state until retry.

**Time Estimate:** ~30 seconds from opening Settings to a saved custom-color theme.

**Example:**

```
User: Brand-conscious workspace owner
Initial state: Theme = { primary: "blue", secondary: "indigo", ... }
Action: Pastes "#4A154B" in primary hex field, clicks Save.
Expected: Theme = { primary: "#4A154B", secondary: "indigo", ... }; app re-skins.
```

---

### Workflow 2: Reverting a custom color to a named one

**Trigger:** User has a custom-color theme saved; wants to go back to a named color.

**Steps:**

1. User opens Settings → Themes.
2. User clears the hex input (or clicks a named-color swatch in the existing picker).
3. Picker recognizes the change and updates the preview.
4. User saves.

**Success State:** Theme reverts to named-color path; CSS variables are removed from `:root`; bundle behaves identically to a never-customized theme.

**Time Estimate:** < 10 seconds.

---

## Design Considerations

### UI/UX Requirements

**Mockup (text wireframe):**

```
┌─ Settings → Themes ───────────────────────────────────────┐
│                                                             │
│  ▾ Named palette                                           │
│   ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●    [22 swatches]│
│                                                             │
│  ▾ Custom (NEW)                                            │
│   Primary    [#4A154B]  ▣  ⚠ Contrast 3.1:1 — below AA   │
│   Secondary  [        ]  ▢                                  │
│   Tertiary   [        ]  ▢                                  │
│   Neutral    [        ]  ▢                                  │
│                                                             │
│  ▸ Presets (Slack · Notion · Stripe · GitHub · …)         │
│                                                             │
│  ── Preview ──────────────────────────────────────────┐   │
│  │ [Sidebar mock] [Channel header mock] [Buttons mock] │   │
│  └───────────────────────────────────────────────────┘   │
│                                                             │
│  [Reset to defaults]                          [Cancel] [Save]│
└─────────────────────────────────────────────────────────────┘
```

-   ▣ swatch beside the hex input shows the live color.
-   The named-palette swatches and the hex inputs are mutually-exclusive per channel: picking a named swatch clears the hex input for that channel and vice versa. Visible affordance.
-   Contrast warning (P1) is inline, dismissable, non-blocking.

### Architecture Requirements

**Data flow:**

```
User input → ThemePicker UI → setPreviewTheme(newTheme)
                              ↓
ThemePreviewProvider:
  1. If theme has custom colors: writes CSS vars to :root
  2. Else: removes any prior custom-color CSS vars
  3. Provides new currentTheme map via React context
                              ↓
Components read currentTheme[token] → className=...
                              ↓
Tailwind resolves class:
  - Named path: "bg-blue-700" → existing safelist hit
  - Custom path: "bg-[var(--primary-700)]" → arbitrary-value safelist hit,
    resolves CSS variable from :root
                              ↓
Pixel output
```

**Component changes:**

-   `dash-react/src/Utils/colorMath.js` — NEW: shade derivation + contrast ratio helpers + tests.
-   `dash-react/src/Models/ThemeModel.js` — split the token-emission loop into named vs hex branches.
-   `dash-react/src/Context/ThemePreviewProvider.js` — add useEffect that writes/removes CSS variables on `currentTheme` change.
-   `dash-react/src/Context/ThemeContext.js` — augment provided value with `cssVars` accessor (P2 only).
-   `dash-core/src/Components/Theme/Panel/PanelThemePicker.js` — add "Custom" subsection with hex inputs.
-   `dash-electron/tailwind.config.js` — add 264 arbitrary-value safelist entries.
-   `dash-react/src/Common/__tests__/*` — visual + snapshot tests for custom-theme rendering.

### Dependencies

**Internal:**

-   `dash-react` v1.0.51+ (current top-5 prop overrides shipped).
-   `dash-core`'s ThemeModel — primary edit target.

**External:**

-   None. Pure CSS custom properties + Tailwind safelist. No new npm dependencies (color math is small enough to inline; we don't pull in `chroma-js` or similar).

---

## Open Questions & Decisions

### Open Questions

1. **Q: Should custom colors apply to both `dark` and `light` theme variants, or per-variant?**

    - Context: ThemeModel today emits BOTH dark and light variant maps from a single named color (uses different shades for each). A custom hex could be auto-applied to both with the same shade-derivation logic — OR the user could pick separate hexes per variant.
    - Options:
        - A: Single hex applies to both variants (same hue, derived shades automatically differ).
        - B: User picks two hexes (dark base + light base).
    - **Decision: A** for v1 — single hex applies to both variants. Per-variant deferrable to v2. Decided 2026-05-22.

2. **Q: Where does the PRD live — dash-electron or dash-core?**

    - Context: Cross-repo feature. Theme model is dash-react/dash-core. UI is dash-core. Safelist is dash-electron.
    - Decision: This PRD is filed in `dash-electron/docs/requirements/prd/` (where similar cross-repo PRDs live). dash-core may reference it from `dash-core/docs/requirements/prd/`.
    - Status: Decided 2026-05-22.

3. **Q: Should we ship the brand-presets list (US-006) in v1 or v2?**

    - Context: P2 nice-to-have; users explicitly asked for arbitrary colors, not presets.
    - **Decision: v2.** Decided 2026-05-22.

4. **Q: How do we handle the existing inline-style consumers like SlackWidget that read `currentTheme["bg-primary-medium"]` as a CSS value (which is broken in the current contract since tokens return class strings)?**

    - Context: During the SlackWidget polish pass, code like `style={{ backgroundColor: tokens["bg-action-medium"] }}` was written. With class strings as values, this silently doesn't apply the theme color — falls back to the hardcoded hex. This is a pre-existing bug, not caused by this PRD.
    - **Decision:** US-007 (`cssVars` accessor) promoted from P2 to **P1** (Phase 2). Required to make widget inline-style consumers genuinely theme-reactive — without it, custom-color themes can't fully reach inline-styled surfaces like SlackWidget's frosted-pill date dividers, hover toolbar backgrounds, composer borders, etc. Until cssVars lands, SlackWidget will use direct hex hardcodes (no silent theme pretense) — see separate bugfix tracked in working tree. Decided 2026-05-22.

5. **Q: What happens with the existing `shadeBackgroundFrom`/`shadeBorderFrom`/`shadeTextFrom` theme fields when a color is custom?**
    - Context: The current schema includes per-token shade offsets. With derived shades, these offsets might shift differently.
    - Recommendation: Apply offsets identically — `shadeBackgroundFrom: 600` still picks the 600 shade, whether named or derived.
    - Status: Open; needs implementation-time verification.

### Decisions Made

| Date       | Decision                                                                       | Rationale                                                                                                 | Owner |
| ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----- |
| 2026-05-22 | Use CSS custom properties + arbitrary-value Tailwind classes for custom colors | Bounded bundle impact; no new dependencies; works with existing class-string token contract               | trops |
| 2026-05-22 | Auto-derive shades from a single hex (no manual shade picking)                 | Matches Tailwind's palette structure; reduces UX surface                                                  | trops |
| 2026-05-22 | Backwards compat: named-color themes byte-identical                            | Zero-risk upgrade for existing users                                                                      | trops |
| 2026-05-22 | Single hex applies to both dark + light variants in v1                         | Simpler UX; per-variant deferrable                                                                        | trops |
| 2026-05-22 | Brand presets deferred to v2 (out of Phase 1 + 2)                              | Users explicitly asked for arbitrary colors first; presets are a polish layer on top                      | trops |
| 2026-05-22 | US-007 cssVars accessor promoted P2 → P1 (Phase 2)                             | Required to fix SlackWidget inline-style theme bug; custom-color themes must reach inline-styled surfaces | trops |
| 2026-05-22 | Theme editor / create UX work tracked as separate Phase 3 scope                | User flagged need for unified picker UX (named + hex + presets) post-MVP                                  | trops |

---

## Out of Scope

**Explicitly excluded from this PRD:**

-   **Multi-stop gradient themes** — Gradient handling requires reworking the token emission to produce gradient classes; out of scope for arbitrary single-color extension.
-   **Per-component color overrides** ("make this one button red") — That's a prop-override feature on individual primitives (e.g. `<Button color="#ff0000">`) which is separate scope and probably ill-advised at the component level.
-   **Color palette generators** (Coolors-style hue suggestion) — Users provide the hex; we don't generate palettes.
-   **Automatic accessibility auto-correction** — We warn but don't modify the user's color.
-   **Custom shades beyond standard 11** — 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 only.
-   **Theme import from external sources** (CSS files, Figma plugins) — No external entry points.
-   **Re-implementing all components to read `cssVars` accessor first** — Existing class-string contract stays. `cssVars` is additive (P2).

**Future Considerations:**

-   **Per-variant custom colors** (different dark vs light hex) — v2 candidate.
-   **Brand color presets** — v2 candidate.
-   **Workspace-level themes** (different theme per dashboard) — Separate PRD; orthogonal.
-   **Auto-derive accessible palettes** (constrained hex picker that only allows AA-passing colors) — Possibly v3.

---

## Implementation Phases

### Phase 1: MVP — Custom Primary Color (P0)

**Timeline:** ~1 week dev + 2 days QA.

**Deliverables:**

-   [ ] US-001: Hex input for primary color, save + load round-trip.
-   [ ] US-002: All Tier-1 primitives render correctly under a custom-primary theme.
-   [ ] US-003: Backwards compat — named themes byte-identical.
-   [ ] FR-001 through FR-006 implemented.

**Success Criteria:**

-   All P0 acceptance criteria met.
-   Bundle delta < 10KB.
-   No regressions in existing snapshot tests.

**Risks:**

-   **Shade derivation algorithm doesn't match Tailwind palette tonally.** Mitigation: Compare derived shades for known hexes (e.g. `#3b82f6` should derive shades close to Tailwind blue's 50..950). Iterate the HSL math until match is acceptable.
-   **Arbitrary-value Tailwind classes have unexpected escaping behavior.** Mitigation: Build a smoke-test CSS file early to confirm `bg-[var(--primary-700)]` resolves correctly in the prebuilt bundle.
-   **Live preview slow on custom themes (CSS variable write thrashes layout).** Mitigation: Batch CSS variable writes (single `setProperty` per shade in a single rAF tick).

---

### Phase 2: Multi-Channel + cssVars + Accessibility (P1)

**Timeline:** ~3-5 days additional.

**Deliverables:**

-   [ ] US-004: Custom secondary, tertiary, neutral colors.
-   [ ] US-007: `cssVars` accessor on theme context — promoted from P2 (required to fix SlackWidget inline-style theme bug; without it, custom-color themes don't reach inline-styled surfaces).
-   [ ] US-005: Accessibility contrast warning.

**Success Criteria:**

-   All P1 acceptance criteria met.
-   Contrast warnings render inline; no false positives on named-palette themes.
-   SlackWidget inline-style surfaces (date pills, hover toolbars, composer borders, etc.) update with the theme via `currentTheme.cssVars[...]`.

**Dependencies:**

-   Requires Phase 1 (color math, picker UI, plumbing).

---

### Phase 3: Polish (P2)

**Timeline:** ~1 week.

**Deliverables:**

-   [ ] US-006: Brand color presets (curated list).
-   [ ] Theme editor / create UX work (separate scope per session 2026-05-22 — picker that unifies named-color grid + hex input + presets into a coherent surface).

**Success Criteria:**

-   Presets one-click apply.
-   Theme editor flow lets users discover and pick named or hex colors fluidly.

**Dependencies:**

-   Requires Phase 1 + 2.

---

## Technical Documentation

**See related technical docs:**

-   `dash-react/src/Utils/colors.js` — current color resolution
-   `dash-core/src/Models/ThemeModel.js` — current theme expansion
-   `dash-react/src/Context/ThemePreviewProvider.js` — current preview mechanism
-   `dash-electron/tailwind.config.js` — current safelist

**Implementation Status:** Backlog. No code yet.

---

## Testing Requirements

### Unit Tests

**Coverage Target:** 90% on new code (`colorMath.js`, ThemeModel hex branch).

**Test Cases:**

-   [ ] `deriveShades("#3b82f6")` produces values close to Tailwind's blue palette (RGB diff < 30 per channel for shades 100..900).
-   [ ] `deriveShades("#000000")` produces a usable 50-shade (interpolated toward white).
-   [ ] `deriveShades("#ffffff")` produces a usable 900-shade (interpolated toward black).
-   [ ] `isHexColor("#abc")` → true; `isHexColor("blue")` → false; `isHexColor("#zzz")` → false.
-   [ ] `contrastRatio("#000000", "#ffffff")` → 21 (max).
-   [ ] `contrastRatio("#777777", "#888888")` → < 1.5 (low).
-   [ ] ThemeModel: named theme produces identical tokens as today.
-   [ ] ThemeModel: custom-primary theme produces `bg-[var(--primary-{shade})]` tokens.
-   [ ] ThemeModel: mixed theme (named + custom) routes each channel correctly.

**Test File:** `dash-react/src/Utils/colorMath.test.js`, `dash-core/src/Models/ThemeModel.test.js`

### Integration Tests

**Test Scenarios:**

-   [ ] Switching from a named to a custom theme in `ThemePreviewProvider` writes the expected CSS variables to `:root`.
-   [ ] Switching back removes them.
-   [ ] All Tier-1 primitives render with the expected fill under a custom-primary theme.

**Test File:** `dash-react/src/Context/ThemePreviewProvider.test.js`

### E2E Tests

**Test Workflows:**

-   [ ] Open Settings → Themes → enter `#4A154B` → save → verify the rendered sidebar/buttons/etc. show the expected hue.
-   [ ] Restart the app → verify the saved custom theme reloads correctly.

**Test File:** `dash-electron/e2e/themes/custom-color.spec.js`

### Manual Testing

**Test Checklist:**

-   [ ] Visual: pick `#4A154B` and verify SlackWidget looks Slack-burgundy.
-   [ ] Visual: pick `#0D1117` (GitHub black) and verify the app skins to a near-black neutral.
-   [ ] A11y: keyboard-navigate to the hex input, paste, blur, save.
-   [ ] Performance: chrome DevTools Performance tab; theme switch must commit in < 50ms.
-   [ ] Bundle: `wc -c < public/tailwind.css` before/after — delta < 10KB.

**Test Evidence:** Screenshots in PR; performance trace JSON attached.

---

## Revision History

| Version | Date       | Author | Changes        |
| ------- | ---------- | ------ | -------------- |
| 1.0     | 2026-05-22 | trops  | Initial draft. |
