# Dash — Design Language (Refresh)

> Status: **Phase 0 proposal** — react to this + `styleguide.html`, nothing in the
> app changes until it's signed off. Direction locked with the team:
> **light-first, clean, airy, quiet premium depth** (calibrated to Kimi's
> restraint — subtle translucency, not loud gradients). Dark theme is kept and
> designed as a first-class second pass.

This is the single source of truth for the visual refresh. It's a **refresh, not
a re-layout**: same navigation and screens, new skin driven by the existing
CSS-variable theme system (`ThemePreviewProvider` already injects `--*` vars on
`:root`, so colors are freely retunable — no Tailwind-shade or safelist ceiling
for color).

---

## 1. Principles

1. **Clarity over decoration.** Every element earns its place. Chrome recedes; content leads.
2. **Air over density.** Hierarchy comes from whitespace and type, not boxes and borders.
3. **Quiet depth.** Depth via subtle translucency, hairline borders, and opacity — never glow or heavy gradients.
4. **One confident accent.** A calm neutral base + a single accent used sparingly for action and focus.
5. **Light-first, dark-equal.** Design light as the flagship; dark inherits the same tokens, tuned second.
6. **Intent per surface.** A dashboard, a settings pane, and onboarding have different jobs — density and emphasis adapt (see §9).

---

## 2. Color

Light-first, restrained. A near-white canvas, near-black text, one violet accent
(a calmer nod to Dash's purple heritage). Values are the **semantic tokens** the
components read; they map onto the existing `--primary/--neutral/…` scales in §10.

### Light (flagship)

| Token | Value | Use |
|---|---|---|
| `--surface-canvas` | `#FBFBFD` | App background |
| `--surface-raised` | `#FFFFFF` | Cards, panels, modals |
| `--surface-sunken` | `#F4F5F7` | Inset wells, inputs |
| `--surface-hover`  | `#F0F1F4` | Hover fills |
| `--border-hairline`| `#E7E8EC` | Default 1px separators/edges |
| `--border-strong`  | `#D8DAE0` | Emphasis edges |
| `--text-primary`   | `#1C1E23` | Headings, primary text |
| `--text-secondary` | `#5B606B` | Body, labels |
| `--text-tertiary`  | `#8A8F9A` | Hints, captions, secondary icons |
| `--text-disabled`  | `#B4B8C0` | Disabled |
| `--accent-500`     | `#5B4FE0` | Primary action, focus, links |
| `--accent-600`     | `#4B3FD0` | Hover |
| `--accent-700`     | `#3D33B0` | Active/pressed |
| `--accent-50`      | `#EEECFE` | Accent tint (selected rows, badges) |
| `--on-accent`      | `#FFFFFF` | Text/icon on accent |
| `--success` / bg   | `#1F9D6B` / `#E7F6EF` | Positive |
| `--warning` / bg   | `#C7861A` / `#FBF1DE` | Caution |
| `--danger`  / bg   | `#D64545` / `#FBE9E9` | Destructive/error |

### Dark (second pass)

| Token | Value |
|---|---|
| `--surface-canvas` | `#0E0F13` (cool near-black — **not** today's saturated purple) |
| `--surface-raised` | `#16181D` |
| `--surface-sunken` | `#0A0B0E` |
| `--border-hairline`| `rgba(255,255,255,0.08)` |
| `--text-primary`   | `#ECEDF0` |
| `--text-secondary` | `rgba(255,255,255,0.62)` |
| `--text-tertiary`  | `rgba(255,255,255,0.42)` |
| `--accent-500`     | `#7B6EF6` (slightly brighter for dark) |
| `--accent-50`      | `rgba(123,110,246,0.14)` |

### Glass / depth tokens (the "quiet premium" layer)

Subtle, safelist-friendly (a small fixed set, bound to vars — not arbitrary
opacity utilities).

| Token | Light | Dark |
|---|---|---|
| `--glass-bg`     | `rgba(255,255,255,0.65)` | `rgba(22,24,30,0.55)` |
| `--glass-border` | `rgba(20,22,28,0.06)` | `rgba(255,255,255,0.08)` |
| `--glass-blur`   | `16px` | `16px` |
| `--shadow-e1`    | `0 1px 2px rgba(16,18,24,0.05)` | `0 1px 2px rgba(0,0,0,0.4)` |
| `--shadow-e2`    | `0 1px 2px rgba(16,18,24,0.04), 0 4px 12px rgba(16,18,24,0.06)` | `0 4px 14px rgba(0,0,0,0.5)` |
| `--shadow-e3`    | `0 8px 24px rgba(16,18,24,0.08), 0 2px 6px rgba(16,18,24,0.05)` | `0 12px 32px rgba(0,0,0,0.6)` |

Depth rules: **borders before shadows; one elevation step at a time.** Glass is
for *floating* surfaces only (command palette, dropdowns, the assistant/bot
dock, toasts) — never for everything.

---

## 3. Typography

- **UI font:** `Inter` (variable) → fallback `system-ui, -apple-system, Segoe UI, sans-serif`. (Proposal — swap-in only if you're open to it; otherwise keep current sans.)
- **Mono:** `ui-monospace, SFMono-Regular, Menlo, monospace` for code/keys.
- Moderate weights (400/500/600 only). Tight tracking on large sizes, normal on body.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Display | 32 / 40 | 600 | -0.02em |
| H1 | 24 / 32 | 600 | -0.01em |
| H2 | 20 / 28 | 600 | -0.01em |
| H3 | 16 / 24 | 600 | 0 |
| Body | 14 / 22 | 400 | 0 |
| Body-strong | 14 / 22 | 500 | 0 |
| Small | 13 / 20 | 400 | 0 |
| Caption | 12 / 16 | 500 | 0.02em |

Body **14** is the workhorse. Secondary text uses `--text-secondary`, not a
smaller size, wherever possible.

---

## 4. Spacing & density

8pt rhythm, generous by default (Kimi's air):
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

- Control padding: **10–12** vertical, **12–14** horizontal.
- Form field gap: **16**; section gap: **24–32**.
- Panels: **20–24** inner padding.
- Density adapts per surface (§9) — dashboards tighten, settings/onboarding breathe.

---

## 5. Shape

Softer, consistent radii:

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Tags, small chips |
| `--radius-md` | 10px | Buttons, inputs |
| `--radius-lg` | 14px | Cards, panels |
| `--radius-xl` | 20px | Modals, sheets |
| `--radius-pill` | 9999px | Pills, avatars |

Default edge is `1px solid var(--border-hairline)`.

---

## 6. Elevation

Four steps: `e0` (flat, border-only) → `e1` (raised card) → `e2` (menu/popover)
→ `e3` (modal). Light uses the soft layered shadows in §2; dark leans on surface
steps + hairlines, with shadow only for true overlays.

---

## 7. Iconography

- **Line icons, single stroke, 18px** standard (20px for primary nav, 16px inline).
- Keep FontAwesome but standardize on the **regular/light** weight for a lighter feel.
- Secondary/inactive icons at `--text-tertiary` (~0.45 opacity feel), active at `--text-primary` or `--accent-500`.

---

## 8. Motion

Fast and quiet: **120–180ms**, `ease-out` for enter, `ease-in` for exit.
Hover/press are subtle (opacity/background shift, ~1px translate on press).
Panels/sheets slide **200ms**. No bounce, no long fades.

---

## 9. Intent per surface

| Surface | Job | Density / emphasis |
|---|---|---|
| **Dashboards / widgets** | Task + monitor | Tighter; content-first; chrome recedes; grid breathes |
| **Settings** | Clarity | Generous; single column; grouped; label + helper text; one primary action per pane |
| **Onboarding** | Guidance | Big type, lots of air, one clear next step |
| **Assistant / Bots** | Focus | Calm; conversation/compose-first; quiet glass dock; approvals read clearly |
| **Command palette / menus** | Speed | Glass surface, keyboard-first, tight rows |

---

## 10. Mapping to the existing token system

The app already injects `--primary-{50..900}`, `--secondary-*`, `--tertiary-*`,
`--neutral-*` on `:root` per theme. The refresh **adds a semantic layer** on top
(the tokens above) and re-tunes the raw scales:

- `--neutral-*` → the surface/border/text ramp (§2).
- `--primary-*` → the accent ramp (`--accent-500 = --primary-500`, etc.).
- **New semantic vars** (`--surface-canvas/raised/sunken`, `--border-hairline`,
  `--text-primary/secondary/tertiary`, `--glass-*`, `--shadow-e*`, `--radius-*`)
  are added to each theme definition and consumed by dash-react primitives.

This means **Phase 1 ships as a new selectable theme** ("Refresh — Light") with
these values, side-by-side with today's themes. Deselect to revert; zero risk.

---

## 11. Component direction (targets for Phase 2)

- **Button** — 10px radius, 14/500 label, 10×14 padding. Primary = `--accent-500` on white text, `e1` on hover. Secondary = `--surface-raised` + hairline border. Ghost = text + hover fill. Quiet, no gradients.
- **Input / Select** — `--surface-sunken` fill, hairline border, 10px radius, 2px accent focus ring at low alpha. Generous height (36–40px).
- **Card / Panel** — `--surface-raised`, 14px radius, hairline border, `e1`; no heavy shadow.
- **Modal / Sheet** — `--surface-raised`, 20px radius, `e3`, dim backdrop `rgba(16,18,24,0.4)`.
- **Dock / palette / dropdown** — the **glass** surfaces: `--glass-bg` + blur + `--glass-border` + `e2`.
- **Tag / Badge** — pill, `--accent-50` fill + accent text, or neutral.

---

## 12. Rollout (reversibility ladder)

0. **This doc + `styleguide.html`** — react, sign off. *(you are here)*
1. **New "Refresh — Light" theme** — tokens only; selectable next to current themes; deselect to revert.
2. **dash-react primitives** — restyle Button/Card/Panel/Modal/inputs/Tabs to the tokens (on `feat/ui-refresh`, linked locally, nothing published).
3. **Chrome polish** — shell inherits the primitives; targeted tweaks.
4. **Audit** — contrast/a11y, "does glass read on every theme," clarity pass before anything merges.
