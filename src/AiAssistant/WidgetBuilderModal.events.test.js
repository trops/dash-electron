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

    test("each section names the widget-event:publish IPC channel", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/widget-event:publish/);
        }
    });

    test("each section teaches the <package>:<verb-noun> naming convention", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            // Look for the explicit pattern OR a concrete example
            // following the convention. Either form is acceptable
            // evidence the convention is taught.
            const hasPattern = /<\s*package\s*>:<\s*verb-noun\s*>/.test(slice);
            const hasExample =
                /[a-z][a-z0-9-]*:[a-z][a-z0-9-]*-[a-z][a-z0-9-]*/.test(slice);
            expect(hasPattern || hasExample).toBe(true);
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

    test("each section mentions declaring events in the .dash.js config", () => {
        // Declaration in `events: [...]` is what the Configure tab
        // reads — required so users can see what the widget emits
        // and wire subscribers manually.
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/\bevents:\s*\[/);
        }
    });
});
