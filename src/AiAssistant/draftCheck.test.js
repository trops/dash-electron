/**
 * draftCheck — the Widget Builder checks code while it's written (Widget
 * Builder edit fixes): the fast checks on each version, then the Checker;
 * problems go back to the AI; Install waits for a pass of the exact code.
 */
import {
    codeKeyOf,
    fastCheckProblems,
    verdictOf,
    checksFixRequest,
    draftCheckRequest,
    MAX_CHECK_FIXES,
    userAskOf,
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

describe("checksFixRequest — problems go back to the AI", () => {
    test("lists them and asks for both code blocks", () => {
        const text = checksFixRequest("AlgoliaHits", ["one", "two"]);
        expect(text).toMatch(/The checks found problems with AlgoliaHits/);
        expect(text).toMatch(/- one\n- two/);
        expect(text).toMatch(/output BOTH the component and the config/);
        expect(MAX_CHECK_FIXES).toBe(2);
    });
});

describe("what the user asked goes to the Checker", () => {
    test("the user's latest messages, not hidden ones or the AI's", () => {
        const ask = userAskOf([
            { role: "user", content: "Make an Algolia hits widget" },
            { role: "assistant", content: "Done" },
            {
                role: "user",
                content: "The checks found problems…",
                hidden: true,
            },
            { role: "user", content: "Show 'No products found' when empty" },
        ]);
        expect(ask).toBe(
            "Make an Algolia hits widget\n\nShow 'No products found' when empty"
        );
        expect(userAskOf([])).toBe("");
    });
    test("the request carries it", () => {
        expect(
            draftCheckRequest("AlgoliaHits", "Show 'No products found'")
        ).toMatch(/The user asked:\n\nShow 'No products found'/);
        expect(draftCheckRequest("AlgoliaHits", "")).not.toMatch(
            /The user asked/
        );
    });
});
