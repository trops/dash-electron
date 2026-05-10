# dash-react Components — Exact Prop Names

> **Read this BEFORE writing widget JSX.** dash-react components SILENTLY
> ignore unknown props and render with empty defaults. Passing the wrong
> prop name produces a widget tree with structure but zero visible content
> — the preview looks black with no console error. This is the #1 cause
> of "preview is black" bugs.

## ⚠️ Hard rule — only the props in the table below are valid

These components do NOT accept the props you might know from other React
component libraries (Material UI, shadcn, Bootstrap, Ant Design, Chakra,
Radix). The following are **NOT real props** on any dash-react primitive:

-   `variant=` (no `"primary"` / `"secondary"` / `"outline"` / `"danger"` etc.)
-   `size=` (no `"sm"` / `"md"` / `"lg"`)
-   `color=` (no `"success"` / `"warning"` / `"error"` etc.)
-   `text=` (the prop is `title=` everywhere except `<Alert>` and `<ErrorMessage>` which use `message=`)
-   `appearance=`, `intent=`, `tone=`, `kind=`, `theme=`

If you want different visual treatment, **choose a different component**
(`<ButtonIcon>` for an inline action button, `<Tag>` for a small inline
label) — don't pass invented props. If you genuinely need styling that no
listed component provides, fall through to inline `style={{...}}` on a
wrapping `<div>` (with theme tokens from `ThemeContext`, see Section 6).

Passing an unknown prop produces NO console error — the component just
renders empty. If your preview is blank, the first thing to check is
whether you typed `variant=` / `size=` / `text=` / `color=` anywhere.

## Table of Contents

1. Component Prop Reference
2. Layout & Container Components
3. Interactive Components
4. Input Components
5. Feedback / Status Components
6. Why dash-react Components (Not Raw HTML)
7. Tailwind Safelist Caveats

---

## 1. Component Prop Reference — use these prop names VERBATIM

| Component                                             | Prop name              | Notes                                                                                                                 |
| ----------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `<Heading title="..." />`                             | `title`                | NEVER `text=`, NEVER `<Heading>children</Heading>`. Visible label goes in `title`.                                    |
| `<SubHeading title="..." />`                          | `title`                | Same shape as Heading. `title` only.                                                                                  |
| `<Button title="..." onClick={...} disabled={...} />` | `title`                | Visible label goes in `title`. NEVER `text=`. Without `title`, Button renders the literal string "Cancel" by default. |
| `<ButtonIcon icon="..." title="..." onClick={...} />` | `icon`, `title`        | `icon` is a FontAwesome name string, `title` is the visible label / tooltip.                                          |
| `<EmptyState title="..." description="..." />`        | `title`, `description` | NEVER `message=`. Optional `children` for action buttons.                                                             |
| `<Alert title="..." message="..." />`                 | `title`, `message`     | Both valid. Alert is the EXCEPTION — most other components use `title=` only.                                         |
| `<ErrorMessage message="..." />`                      | `message`              | The visible error text.                                                                                               |
| `<Tag title="..." />`                                 | `title`                | Visible label in `title`.                                                                                             |
| `<Paragraph>text</Paragraph>`                         | children               | Use children.                                                                                                         |
| `<Card>...</Card>`                                    | children               | Use children.                                                                                                         |
| `<Panel>...</Panel>`                                  | children               | Use children. The canonical widget chrome.                                                                            |
| `<Menu>...</Menu>`                                    | children               | Use children.                                                                                                         |
| `<MenuItem>...</MenuItem>`                            | children               | Use children. Optional `onClick`.                                                                                     |

If a primitive isn't listed here, prefer `<Paragraph>` + `<Heading>` over guessing. **Don't fall back to raw `<h2>` / `<button>` / `<p>`** — those bypass the active theme.

---

## 2. Layout & Container Components

```jsx
import {
    Panel, // REQUIRED widget chrome — wrap every widget in this
    Card, // Bordered group — for sub-sections inside a Panel
    Heading, // <Heading title="..." />
    SubHeading, // <SubHeading title="..." />
    Paragraph, // <Paragraph>text</Paragraph>
    Tabs, // Tab container
    Accordion, // Collapsible group
    DataList, // Definition-list style key/value display
} from "@trops/dash-react";
```

-   **Always** wrap the widget body in `<Panel>` so theme tokens apply.
-   Use `<Card>` for nested groups; do NOT nest `<Panel>` inside `<Panel>`.

---

## 3. Interactive Components

```jsx
import {
    Button, // <Button title="Save" onClick={...} />
    ButtonIcon, // <ButtonIcon icon="trash" title="Delete row" onClick={...} />
    Menu,
    MenuItem,
    DropdownPanel,
    Tag, // <Tag title="critical" />
    Toggle,
    Switch,
    Checkbox,
    RadioGroup,
    Slider,
    FontAwesomeIcon, // import via dash-react, NEVER directly from @fortawesome
} from "@trops/dash-react";
```

`FontAwesomeIcon` MUST come from `@trops/dash-react` (re-exported from `@fortawesome/react-fontawesome`). Importing directly from `@fortawesome/*` duplicates the dependency and can break theming.

---

## 4. Input Components

```jsx
import {
    InputText,
    TextArea,
    SearchInput,
    SelectInput,
    CodeEditor,
    CodeRenderer,
} from "@trops/dash-react";
```

Inputs accept the standard `value` / `onChange` pattern.

---

## 5. Feedback / Status Components

```jsx
import {
    Alert,
    ErrorMessage,
    EmptyState,
    Skeleton,
    ProgressBar,
    Toast,
    Spinner,
} from "@trops/dash-react";
```

-   `<EmptyState title="No results" description="Try a different query" />` — never `message=`.
-   `<ErrorMessage message="..." />` — for error-state rendering inside a widget body. **Never silently swallow errors** with `catch { setData([]) }`. Render the error so the user sees it.

---

## 6. Why dash-react Components (Not Raw HTML)

`@trops/dash-react` is the UX library for the entire Dash ecosystem. Every UI element should come from it so user theme switches propagate without per-component overrides.

-   `<Heading>` reads from `ThemeContext` automatically.
-   A raw `<h2>` does not — it renders with browser defaults and visually breaks when the user switches themes.
-   The same applies to `<button>`, `<input>`, `<p>`, `<div>` for "card-like" structures.

If a primitive truly isn't in dash-react and you must reach for raw HTML, **read theme tokens from `ThemeContext`**:

```jsx
import { useContext } from "react";
import { ThemeContext, Panel } from "@trops/dash-react";

export default function MyWidget() {
    const { currentTheme } = useContext(ThemeContext);
    // Each value is a Tailwind class string. Always pair it with a
    // hardcoded fallback so the className stays valid when a theme is
    // missing a key.
    const bg = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const text = currentTheme?.["text-primary-light"] || "text-gray-100";
    const border = currentTheme?.["border-primary-dark"] || "border-gray-700";
    return (
        <Panel>
            <div className={`${bg} ${text} ${border} border rounded p-3`}>
                ...
            </div>
        </Panel>
    );
}
```

Common theme keys follow `{role}-{intent}-{shade}`:

-   role: `bg` / `text` / `border`
-   intent: `primary` / `secondary`
-   shade: `light` / `medium` / `dark` / `very-dark`

So: `bg-primary-dark`, `bg-primary-medium`, `bg-secondary-medium`, `border-primary-dark`, `border-primary-medium`, `text-primary-light`, `text-primary-medium`, `text-secondary-light`, etc.

---

## 7. Tailwind Safelist Caveats

dash-electron ships a **prebuilt CSS bundle** with a narrow Tailwind safelist. Classes outside the safelist silently fail to render.

**ALLOWED:**

-   `bg-{color}-{shade}` (e.g. `bg-gray-800`, `bg-blue-500`)
-   `text-{color}-{shade}`
-   `border-{color}-{shade}`
-   `opacity-0` through `opacity-100`
-   `grid-cols-{1..12}`
-   Standard spacing/sizing utilities (`p-3`, `m-2`, `w-full`, `h-screen`, `flex`, `gap-2`)
-   Gradient stops `from-{color}-{shade}`, `via-{color}-{shade}`, `to-{color}-{shade}`

**FORBIDDEN — silently no-op in production:**

-   Opacity modifiers: `bg-white/10`, `text-gray-200/40`, `border-black/60`
-   Arbitrary values: `text-[10px]`, `w-[440px]`, `bg-[#abc123]`
-   `ring-*` color variants (e.g. `ring-blue-500`)
-   `divide-*` color variants (e.g. `divide-gray-700`)
-   `outline-*` color variants

**Inline `style={{...}}` is the escape hatch** for one-off cases that genuinely don't fit the safelist:

```jsx
<div style={{ width: 440, fontSize: "10px" }}>...</div>
```

Prefer dash-react components first, theme tokens second, inline styles last. Never expand the safelist locally to bypass these rules — the same prebuilt CSS ships to every user.
