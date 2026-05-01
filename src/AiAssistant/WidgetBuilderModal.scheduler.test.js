/**
 * Pins the AI builder prompt's Scheduled tasks guidance.
 *
 * Goal: the AI knows about the `useScheduler()` hook + the
 * `scheduledTasks: [...]` declaration shape so it can proactively
 * add timer-driven handlers to widgets that benefit (data refresh,
 * polling, periodic reports). The guidance lives in all three
 * prompt branches (credential / mcp / no-provider) so any widget
 * the AI builds can use it.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal — Scheduled tasks guidance in all three branches", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    const SECTION_MARKER = "## Scheduled tasks";

    function getSectionSlices() {
        const slices = [];
        let cursor = 0;
        while (cursor < source.length) {
            const start = source.indexOf(SECTION_MARKER, cursor);
            if (start < 0) break;
            const next = source.indexOf("\\n## ", start + 1);
            const end = next > 0 ? next : source.indexOf("`;", start + 1);
            if (end < 0) break;
            slices.push(source.slice(start, end));
            cursor = end;
        }
        return slices;
    }

    test("Scheduled tasks section appears in all three prompt branches", () => {
        expect(getSectionSlices().length).toBe(3);
    });

    test("each section names the useScheduler hook", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/useScheduler/);
        }
    });

    test("each section shows the scheduledTasks: [ ... ] declaration shape", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            expect(slice).toMatch(/scheduledTasks:\s*\[/);
            // Show the entry shape with at least key + handler
            // (matching the codebase's SchedulerWidget convention).
            expect(slice).toMatch(/\bkey:/);
            expect(slice).toMatch(/\bhandler:/);
        }
    });

    test("each section instructs the AI to tell the user about added tasks", () => {
        const slices = getSectionSlices();
        expect(slices.length).toBe(3);
        for (const slice of slices) {
            const lower = slice.toLowerCase();
            const hasInformUserHint =
                /tell\s+the\s+user/.test(lower) ||
                /list\s+(?:each|the|added|scheduled)/.test(lower) ||
                /mention[^.]*(?:scheduled|task)/.test(lower);
            expect(hasInformUserHint).toBe(true);
        }
    });
});
