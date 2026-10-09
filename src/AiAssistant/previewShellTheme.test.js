/**
 * @jest-environment jsdom
 *
 * The preview iframe shell writes the theme's CSS variables onto its own
 * <html>. dash-react classes are `text-[var(--neutral-400)]` etc.; the app
 * sets those variables on its own document only, so without this every
 * widget in the preview rendered black text on the canvas colour.
 *
 * The shell is a plain script in public/; this loads the helper from
 * between its markers and runs it.
 */
const fs = require("fs");
const path = require("path");

const shell = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "widget-preview-shell.js"),
    "utf8"
);
const match = shell.match(
    /\/\/ BEGIN applyThemeCssVars\n([\s\S]*?)\/\/ END applyThemeCssVars/
);

const iconMatch = shell.match(
    /\/\/ BEGIN copyIconStyles\n([\s\S]*?)\/\/ END copyIconStyles/
);

function loadCopyIconStyles() {
    // eslint-disable-next-line no-new-func
    return new Function(`${iconMatch[1]}; return copyIconStyles;`)();
}

function load() {
    // eslint-disable-next-line no-new-func
    return new Function(`${match[1]}; return applyThemeCssVars;`)();
}

describe("preview shell — theme CSS variables", () => {
    it("is defined in the shell and used when the theme arrives", () => {
        expect(match).toBeTruthy();
        expect(shell).toMatch(
            /applyThemeCssVars\(\s*document\.documentElement/
        );
    });

    it("writes the theme's cssVars onto the root", () => {
        const applyThemeCssVars = load();
        const root = document.createElement("div");
        applyThemeCssVars(
            root,
            { currentTheme: { cssVars: { "--primary-700": "#2e21bd" } } },
            []
        );
        expect(root.style.getPropertyValue("--primary-700")).toBe("#2e21bd");
    });

    it("clears variables the next theme doesn't set", () => {
        const applyThemeCssVars = load();
        const root = document.createElement("div");
        const written = applyThemeCssVars(
            root,
            {
                currentTheme: {
                    cssVars: {
                        "--primary-700": "#111",
                        "--neutral-400": "#222",
                    },
                },
            },
            []
        );
        applyThemeCssVars(
            root,
            { currentTheme: { cssVars: { "--primary-700": "#333" } } },
            written
        );
        expect(root.style.getPropertyValue("--primary-700")).toBe("#333");
        expect(root.style.getPropertyValue("--neutral-400")).toBe("");
    });

    it("handles a missing theme", () => {
        const applyThemeCssVars = load();
        const root = document.createElement("div");
        expect(applyThemeCssVars(root, null, [])).toEqual([]);
    });
});

describe("preview shell — icon CSS", () => {
    // FontAwesome injects its sizing CSS into the app document only, so
    // icons in the preview rendered at 0×0 (empty + / − buttons).
    it("is used when the shell starts and when a widget loads", () => {
        expect(iconMatch).toBeTruthy();
        expect(shell.match(/copyIconStyles\(/g).length).toBeGreaterThanOrEqual(
            3
        );
    });

    it("copies the FontAwesome style block from the app once", () => {
        const copyIconStyles = loadCopyIconStyles();
        const app = document.implementation.createHTMLDocument("app");
        const fa = app.createElement("style");
        fa.textContent = ".svg-inline--fa { height: 1em; }";
        app.head.appendChild(fa);
        const other = app.createElement("style");
        other.textContent = "body { color: red; }";
        app.head.appendChild(other);
        const frame = document.implementation.createHTMLDocument("frame");
        copyIconStyles(app, frame);
        copyIconStyles(app, frame);
        const styles = frame.head.querySelectorAll("style");
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toContain("svg-inline--fa");
    });

    it("does nothing without an app document", () => {
        const copyIconStyles = loadCopyIconStyles();
        const frame = document.implementation.createHTMLDocument("frame");
        expect(() => copyIconStyles(null, frame)).not.toThrow();
    });
});
