/**
 * @jest-environment jsdom
 *
 * Pins the AI scaffold's system prompt — specifically the Phase C
 * additions that interpolate from widgetConventions.js:
 *
 *   - HEADING VARIANT RULE section (the user's H1 complaint fix)
 *   - REQUIRED VISIBLE STATES section
 *   - FEW-SHOT EXAMPLES section
 *
 * If any of these silently disappear from buildSystemPrompt, the AI
 * loses its anchor for "what good looks like" — the most visible
 * failure mode is widgets reverting to raw <Heading>. These tests
 * catch the regression at CI rather than as a quality drop in
 * shipped widgets.
 */

jest.mock(
    "@trops/dash-react",
    () => ({
        MenuItem: ({ children }) => <button>{children}</button>,
        ButtonIcon: () => <button />,
    }),
    { virtual: false }
);
jest.mock(
    "@trops/dash-core",
    () => ({
        Widget: ({ children }) => <div>{children}</div>,
    }),
    { virtual: false }
);

import { buildSystemPrompt } from "./QuickStartPane";
import {
    WIDGET_CONVENTIONS,
    FEW_SHOT_EXAMPLES,
    HEADING_CONVENTIONS,
} from "./widgetConventions";

// Manual scan that walks a string looking for ``` json … ``` fences
// and returns the parsed JSON bodies. Used instead of String.matchAll
// + regex to keep the test simple and avoid imports.
function extractJsonBlocks(text) {
    const fence = "```json\n";
    const closer = "\n```";
    const out = [];
    let cursor = 0;
    while (true) {
        const start = text.indexOf(fence, cursor);
        if (start < 0) break;
        const bodyStart = start + fence.length;
        const end = text.indexOf(closer, bodyStart);
        if (end < 0) break;
        out.push(JSON.parse(text.slice(bodyStart, end)));
        cursor = end + closer.length;
    }
    return out;
}

describe("buildSystemPrompt — Phase C interpolations", () => {
    const promptDefault = buildSystemPrompt();
    const promptWithIntent = buildSystemPrompt({
        intentHint: "Search widget — user wants to query and pick.",
    });
    const promptWithProvider = buildSystemPrompt({
        providerHint: "Widget uses the Slack provider.",
    });
    const promptRetry = buildSystemPrompt({ retry: true });

    test("includes the HEADING VARIANT RULE section", () => {
        expect(promptDefault).toContain("HEADING VARIANT RULE");
        expect(promptDefault).toContain(HEADING_CONVENTIONS.rule);
        expect(promptDefault).toContain(HEADING_CONVENTIONS.preferredTitle);
        expect(promptDefault).toContain(
            HEADING_CONVENTIONS.preferredSubsection
        );
    });

    test("forbidden heading types are named so the AI sees them as banned", () => {
        for (const banned of HEADING_CONVENTIONS.forbidden) {
            // The forbidden list itself is interpolated; check it.
            const interpolated = HEADING_CONVENTIONS.forbidden.join(", ");
            expect(promptDefault).toContain(interpolated);
            expect(promptDefault).toContain(banned);
        }
    });

    test("REQUIRED VISIBLE STATES section names each state by name", () => {
        expect(promptDefault).toContain("REQUIRED VISIBLE STATES");
        for (const state of WIDGET_CONVENTIONS.requiredStates) {
            // Each state appears on its own line ("- loading: render…").
            expect(promptDefault).toContain(`- ${state}:`);
        }
    });

    test("FEW-SHOT EXAMPLES section is appended and contains one block per example", () => {
        expect(promptDefault).toContain("FEW-SHOT EXAMPLES");
        for (let i = 0; i < FEW_SHOT_EXAMPLES.length; i += 1) {
            expect(promptDefault).toContain(`Example ${i + 1} —`);
            expect(promptDefault).toContain(FEW_SHOT_EXAMPLES[i].description);
        }
    });

    test("each few-shot example renders as a parseable JSON suggestion block", () => {
        const fewShotIdx = promptDefault.indexOf("FEW-SHOT EXAMPLES");
        expect(fewShotIdx).toBeGreaterThan(-1);
        const tail = promptDefault.slice(fewShotIdx);
        const parsed = extractJsonBlocks(tail);
        expect(parsed.length).toBe(FEW_SHOT_EXAMPLES.length);
        for (const p of parsed) {
            expect(Array.isArray(p.suggestions)).toBe(true);
            expect(p.suggestions.length).toBe(1);
            expect(p.suggestions[0].root.type).toBe("Panel");
        }
    });

    test("intent + provider hints still flow through (Phase C didn't break the existing branches)", () => {
        expect(promptWithIntent).toContain("INTENT CONTEXT:");
        expect(promptWithIntent).toContain(
            "Search widget — user wants to query and pick."
        );
        expect(promptWithProvider).toContain("PROVIDER CONTEXT:");
        expect(promptWithProvider).toContain("Widget uses the Slack provider.");
    });

    test("retry mode still appends the PRIOR ATTEMPT FAILED nudge", () => {
        expect(promptRetry).toContain("PRIOR ATTEMPT FAILED");
        expect(promptDefault).not.toContain("PRIOR ATTEMPT FAILED");
    });

    test("the strict 'first character must be `{`' rule is preserved (the most-violated rule)", () => {
        expect(promptDefault).toContain(
            "first character of your response must be"
        );
    });
});
