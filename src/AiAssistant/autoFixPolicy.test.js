import {
    INITIAL_AUTO_FIX,
    MAX_AUTO_FIX,
    buildFixRequest,
    onBuildError,
    resetAutoFix,
} from "./autoFixPolicy";

describe("autoFixPolicy", () => {
    test("a build error is sent to the AI by itself", () => {
        const r = onBuildError(INITIAL_AUTO_FIX, {
            code: "A",
            kind: "compile",
        });
        expect(r).toEqual({
            send: true,
            state: { attempts: 1, lastCode: "A" },
            exhausted: false,
        });
    });

    test("errors a widget throws while running are never auto-sent", () => {
        const r = onBuildError(INITIAL_AUTO_FIX, {
            code: "A",
            kind: "runtime",
        });
        expect(r.send).toBe(false);
        expect(r.exhausted).toBe(false);
    });

    test("the same failing code is sent only once", () => {
        const first = onBuildError(INITIAL_AUTO_FIX, {
            code: "A",
            kind: "compile",
        });
        const again = onBuildError(first.state, { code: "A", kind: "compile" });
        expect(again.send).toBe(false);
        expect(again.exhausted).toBe(false);
        expect(again.state).toBe(first.state);
    });

    test(`stops after ${MAX_AUTO_FIX} tries and shows the error`, () => {
        let s = INITIAL_AUTO_FIX;
        s = onBuildError(s, { code: "A", kind: "compile" }).state;
        const second = onBuildError(s, { code: "B", kind: "compile" });
        expect(second.send).toBe(true);
        const third = onBuildError(second.state, {
            code: "C",
            kind: "compile",
        });
        expect(third.send).toBe(false);
        expect(third.exhausted).toBe(true);
        // The last failing code shown again stays exhausted.
        const again = onBuildError(second.state, {
            code: "B",
            kind: "compile",
        });
        expect(again.exhausted).toBe(true);
    });

    test("reset starts the count over", () => {
        expect(resetAutoFix()).toEqual({ attempts: 0, lastCode: null });
    });

    test("the request uses the code checker's correction when there is one", () => {
        expect(
            buildFixRequest("boom", { correction: "Use Panel, not Modal" })
        ).toBe("Use Panel, not Modal");
        expect(buildFixRequest("Build failed: x", null)).toMatch(
            /^Fix this compilation error:\n\nBuild failed: x\n\nPlease output both/
        );
    });
});
