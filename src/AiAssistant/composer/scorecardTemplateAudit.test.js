/**
 * @jest-environment jsdom
 *
 * Regression pin: every Compose-mode starter template must emit code
 * that passes the AcceptanceScorecard with ZERO failures. A user
 * who clicks Compose → Intent → Sample Layout should land on a
 * widget that the rubric is happy with — anything else is the bug
 * the user complained about ("the scorecard had a bunch of errors").
 *
 * "Pass" means: `failed.length === 0`. Items the scorecard can't
 * statically check resolve to n/a (pass === null) and don't count
 * as failures — that's intentional, see hasDataFetchSurface() in
 * AcceptanceScorecard.js for the rationale.
 *
 * If a new template ships and fails this, the fix is one of:
 *   - Add the missing primitive to the template (most common —
 *     a missing SubHeading2 title is the usual culprit)
 *   - Audit whether the rubric item really applies to the new
 *     template's shape; if not, the scorecard's conditional gate
 *     needs extending (rare)
 */
import { SAMPLE_LAYOUTS } from "./composerSampleLayouts";
import { emitGridWidgetCode } from "./gridEmitter";
import { evaluateScorecard } from "./AcceptanceScorecard";

describe("Compose-mode starter templates — scorecard pass guarantee", () => {
    test.each(SAMPLE_LAYOUTS.map((t) => [t.id, t]))(
        "%s emits code that the scorecard accepts without failures",
        (id, tmpl) => {
            const grid = tmpl.buildGrid();
            const { componentCode } = emitGridWidgetCode(grid);
            const rows = evaluateScorecard(componentCode);
            const failed = rows.filter((r) => r.pass === false);
            if (failed.length > 0) {
                // Surface the offending rule(s) in the assertion
                // message so a regression points at exactly what to
                // fix in the template definition.
                const detail = failed
                    .map((r) => `  [${r.index}] ${r.item}`)
                    .join("\n");
                throw new Error(
                    `Template "${id}" emits code that fails ${failed.length} scorecard rule(s):\n${detail}\n\nEmitted code:\n${componentCode}`
                );
            }
            expect(failed.length).toBe(0);
        }
    );

    test("every template has a stable id + label + buildGrid", () => {
        // Defense in depth — without these the test.each loop above
        // would crash with a less useful error.
        for (const tmpl of SAMPLE_LAYOUTS) {
            expect(typeof tmpl.id).toBe("string");
            expect(tmpl.id.length).toBeGreaterThan(0);
            expect(typeof tmpl.label).toBe("string");
            expect(typeof tmpl.buildGrid).toBe("function");
        }
    });
});
