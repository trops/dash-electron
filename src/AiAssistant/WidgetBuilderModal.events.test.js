/**
 * Pins the AI builder prompt's Event publishing guidance.
 *
 * Goal: when the AI generates a widget that has interactions worth
 * sharing (item selected, query changed, file opened), it should
 * proactively publish events via the cross-widget pub/sub channel —
 * AND tell the user in the chat response what it published, so the
 * user can wire subscribers in another widget later. The guidance
 * lives in all three prompt branches (credential / mcp / no-provider)
 * so any widget the AI builds gets it.
 *
 * Static source-presence test: anchor on the section heading and
 * assert the key tokens are present in each occurrence.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal — Event publishing guidance in all three branches", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    const SECTION_MARKER = "## Event publishing";

    function getSectionSlices() {
        const slices = [];
        let cursor = 0;
        while (cursor < source.length) {
            const start = source.indexOf(SECTION_MARKER, cursor);
            if (start < 0) break;
            // End at the next markdown header (`\n## `) or template
            // close (a backtick on its own).
            const next = source.indexOf("\\n## ", start + 1);
            const end = next > 0 ? next : source.indexOf("`;", start + 1);
            if (end < 0) break;
            slices.push(source.slice(start, end));
            cursor = end;
        }
        return slices;
    }

    test("Event publishing section appears in all three prompt branches", () => {
        expect(getSectionSlices().length).toBe(3);
    });

    test("each section uses the props.publishEvent API (NOT window.dispatchEvent)", () => {
        // The canonical API is `props.publishEvent(eventName, payload)`
        // — injected as a prop by WidgetFactory. The lower-level
        // `window.dispatchEvent("widget-event:publish", ...)` form is
        // internal IPC and shouldn't be in widget code.
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/publishEvent\s*\(\s*["']/);
            // No raw window.dispatchEvent guidance — the framework
            // wraps it. We DO allow incidental mention if it explicitly
            // says "DON'T use", but the canonical example must show
            // props.publishEvent.
            const dispatchHits = (
                slice.match(/window\.dispatchEvent\s*\(/g) || []
            ).length;
            expect(dispatchHits).toBe(0);
        }
    });

    test("each section uses camelCase event-name examples", () => {
        // Codebase convention: queryChanged, itemSelected,
        // searchQuerySelected, etc. NOT kebab-case (item-selected) or
        // colon-prefixed (filebrowser:item-selected) — the framework
        // auto-prefixes scope so the AI just supplies the suffix.
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            // Find the example calls — `publishEvent("..."...)` — and
            // assert at least one uses camelCase (lowercase first
            // letter, then a capital letter somewhere).
            const calls = [
                ...slice.matchAll(/publishEvent\s*\(\s*["']([^"']+)["']/g),
            ];
            expect(calls.length).toBeGreaterThan(0);
            const camelCase = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;
            const anyCamel = calls.some((m) => camelCase.test(m[1]));
            expect(anyCamel).toBe(true);
            // Reject colon-prefixed forms in any example.
            for (const m of calls) {
                expect(m[1]).not.toMatch(/:/);
            }
        }
    });

    test("each section instructs the AI to tell the user what events it published", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            const lower = slice.toLowerCase();
            // Tolerant phrasing — the AI should mention published
            // events back to the user in the chat response.
            const hasInformUserHint =
                /tell\s+the\s+user/.test(lower) ||
                /list\s+(?:each|the|emitted|published)/.test(lower) ||
                /mention[^.]*(?:emit|publish|event)/.test(lower) ||
                /document[^.]*(?:emit|publish|event)/.test(lower);
            expect(hasInformUserHint).toBe(true);
        }
    });

    test("each section mentions declaring events in the .dash.js config as a string array", () => {
        // Canonical format is `events: ["eventName"]` — plain string
        // array. The object form `{ name, description }` is wrong;
        // the framework reads the bare strings. Pin the array-of-
        // strings example so the AI doesn't drift back to the
        // object form.
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/\bevents:\s*\[/);
            // Must contain at least one string-array literal example,
            // e.g. `events: ["itemSelected"]` — quoted name directly
            // inside the array, no object wrapper.
            expect(slice).toMatch(/events:\s*\[\s*["'][a-z][A-Za-z0-9]*["']/);
            // Must NOT contain the wrong object form anywhere — that
            // shape leaked into earlier AI output and broke the
            // Configure tab's parser.
            expect(slice).not.toMatch(
                /\{\s*name:\s*["'][^"']+["'],\s*description:/
            );
        }
    });
});
