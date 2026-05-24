const path = require("path");
const os = require("os");

/**
 * Build explicit safelist entries for arbitrary-value classes
 * referencing CSS custom properties — e.g. `bg-[var(--primary-700)]`.
 *
 * Tailwind's pattern-based safelist only matches classes it already
 * generated during the content scan. Arbitrary-value classes are
 * never pre-generated, so a regex pattern matches nothing (Tailwind
 * even warns about this — see arbitrary-color-themes PRD Phase 1).
 * Listing each class explicitly is the supported way to keep them
 * in the bundle.
 *
 * 4 channels × 11 shades × (3 props × 2 variants + 3 gradient stops) = 396 entries.
 */
function buildArbitraryColorClasses() {
    const channels = ["primary", "secondary", "tertiary", "neutral"];
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const props = ["bg", "text", "border"];
    const gradientStops = ["from", "via", "to"];
    const out = [];
    for (const channel of channels) {
        for (const shade of shades) {
            const v = `var(--${channel}-${shade})`;
            for (const prop of props) {
                out.push(`${prop}-[${v}]`);
                out.push(`hover:${prop}-[${v}]`);
            }
            for (const stop of gradientStops) {
                out.push(`${stop}-[${v}]`);
            }
        }
    }
    // Per-token hex overrides emitted by ThemeModel for the Studio's
    // per-shade override editor. Pattern:
    //   `bg-[var(--ovr-bg-{channel}-{level})]`, etc.
    // 4 channels × 5 levels × 3 props = 60 entries.
    const levels = ["very-light", "light", "medium", "dark", "very-dark"];
    for (const channel of channels) {
        for (const level of levels) {
            for (const prop of props) {
                const v = `var(--ovr-${prop}-${channel}-${level})`;
                out.push(`${prop}-[${v}]`);
            }
        }
    }
    return out;
}

// Include installed widget source for Tailwind class scanning at build time.
// Skip in dev mode to prevent webpack file watcher from triggering rebuilds
// when AI-generated widgets are installed at runtime.
const isDev = process.env.NODE_ENV !== "production";
const widgetCachePath = isDev
    ? null
    : path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Dash",
          "widgets",
          "**",
          "*.{js,jsx,ts,tsx}"
      );

module.exports = {
    important: true,
    darkMode: "class",
    content: [
        "./src/**/*.js",
        "./node_modules/@trops/dash-react/dist/**/*.js",
        "./node_modules/@trops/dash-core/dist/**/*.js",
        ...(widgetCachePath ? [widgetCachePath] : []),
    ],
    theme: {
        extend: {
            padding: {
                "1/2": "50%",
                "1/5": "20%",
                full: "100%",
            },
        },
    },
    safelist: [
        // Theme system: bg/text/border colors with specific shade patterns
        {
            pattern:
                /bg-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        {
            pattern:
                /text-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        {
            pattern:
                /border-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        // Gradient stops
        {
            pattern:
                /from-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        {
            pattern:
                /via-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        {
            pattern:
                /to-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        // Arbitrary-value color tokens for custom-color themes (PRD:
        // arbitrary-color-themes.md). ThemeModel emits these for hex
        // channels: `bg-[var(--primary-700)]`, etc. The CSS variable
        // is injected to :root by ThemePreviewProvider on theme
        // activation. 396 entries total (see buildArbitraryColorClasses).
        // Listed as explicit strings rather than regex patterns —
        // Tailwind's pattern matching only retains classes Tailwind
        // already generated from source, and these arbitrary-value
        // classes are never in source so the pattern matches nothing.
        ...buildArbitraryColorClasses(),
        // Named colors without shades
        "bg-black",
        "bg-white",
        "bg-transparent",
        "text-black",
        "text-white",
        // Layout utilities used by theme system
        { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
        { pattern: /grid-rows-(1|2|3|4|5|6)/ },
        {
            pattern: /opacity-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)/,
        },
    ],
    plugins: [require("tailwind-scrollbar"), require("@tailwindcss/forms")],
};
