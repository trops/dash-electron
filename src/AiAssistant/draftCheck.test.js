/**
 * draftCheck — the Widget Builder checks code while it's written (Widget
 * Builder edit fixes): the fast checks on each version, then the Checker;
 * problems are listed for the user; Install waits for a pass of the exact code.
 */
import {
    codeKeyOf,
    fastCheckProblems,
    verdictOf,
    draftCheckRequest,
} from "./draftCheck";

describe("codeKeyOf — a pass belongs to this exact code", () => {
    test("same code, same key; any edit, a new one", () => {
        const a = { componentCode: "A", configCode: "C" };
        expect(codeKeyOf(a)).toBe(codeKeyOf({ ...a }));
        expect(codeKeyOf(a)).not.toBe(codeKeyOf({ ...a, configCode: "C2" }));
        expect(codeKeyOf({ componentCode: "" })).toBeNull();
    });
});

describe("fastCheckProblems", () => {
    test("a build failure, code problems and must-fix checklist items, as lines", () => {
        expect(
            fastCheckProblems({
                success: true,
                compile: {
                    ok: false,
                    error: "The widget didn't build:\n- A.js: Unexpected token",
                },
                problems: [
                    'setting "apiKey" asks for a key the algolia connection already provides',
                ],
                scorecard: {
                    failed: [
                        {
                            item: "Error state rendered when the provider call fails",
                            mustFix: true,
                        },
                        { item: "Title uses SubHeading2", mustFix: false },
                    ],
                },
            })
        ).toEqual([
            "It doesn't build: The widget didn't build:\n- A.js: Unexpected token",
            'setting "apiKey" asks for a key the algolia connection already provides',
            "Error state rendered when the provider call fails",
        ]);
    });
    test("clean code has none; a check that couldn't run says so", () => {
        expect(
            fastCheckProblems({
                success: true,
                compile: { ok: true },
                problems: [],
                scorecard: { failed: [] },
            })
        ).toEqual([]);
        expect(
            fastCheckProblems({ success: false, error: "Which widget?" })
        ).toEqual(["The checks couldn't run: Which widget?"]);
    });
});

describe("the Checker", () => {
    test("its verdict is read from the end of its answer", () => {
        expect(verdictOf("PASS compiles\nVERDICT: PASSED")).toBe("PASSED");
        expect(verdictOf("…\nVERDICT: FAILED")).toBe("FAILED");
        expect(verdictOf("no verdict")).toBeNull();
    });
    test("it's asked to check the unsaved code by its draft name", () => {
        expect(draftCheckRequest("AlgoliaHits")).toMatch(
            /check_widget on draft:AlgoliaHits/
        );
        expect(draftCheckRequest("AlgoliaHits")).toMatch(
            /VERDICT: PASSED or VERDICT: FAILED/
        );
    });
});

describe("built by hand", () => {
    test("the Checker is told empty lists and placeholder buttons are expected", () => {
        const req = draftCheckRequest("QaGhStarter", "", { byHand: true });
        expect(req).toMatch(/built by hand in the layout editor/);
        expect(req).toMatch(/buttons with no action yet are expected/);
        expect(req).toMatch(/VERDICT: PASSED or VERDICT: FAILED/);
        expect(draftCheckRequest("QaGhStarter", "")).not.toMatch(/by hand/);
    });

    test("what the user asked still wins", () => {
        expect(draftCheckRequest("A", "Show PRs", { byHand: true })).toMatch(
            /does what the user asked/
        );
    });
});

describe("what the user asked goes to the Checker", () => {
    test("the request carries it", () => {
        expect(
            draftCheckRequest("AlgoliaHits", "Show 'No products found'")
        ).toMatch(/The user asked:\n\nShow 'No products found'/);
        expect(draftCheckRequest("AlgoliaHits", "")).not.toMatch(
            /The user asked/
        );
    });
});
