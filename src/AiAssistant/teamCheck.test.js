import {
    verdictOf,
    fixRequestText,
    checkRequestText,
    MAX_TEAM_FIXES,
} from "./teamCheck";

describe("teamCheck (CRE-011 AC5)", () => {
    test("reads the Checker's verdict", () => {
        expect(verdictOf("PASS compiles\nVERDICT: PASSED")).toBe("PASSED");
        expect(verdictOf("… verdict: failed")).toBe("FAILED");
        expect(verdictOf("no verdict here")).toBeNull();
    });

    test("the fix request carries the Checker's answer and asks for both files", () => {
        const t = fixRequestText("@ai-built/x", "FAIL code checks");
        expect(t).toMatch(/The Checker found problems with @ai-built\/x/);
        expect(t).toMatch(/FAIL code checks/);
        expect(t).toMatch(/BOTH the component and the config/);
    });

    test("the check request names the widget; fixes are capped at 2", () => {
        expect(checkRequestText("@ai-built/x")).toMatch(
            /Check @ai-built\/x\. Run check_widget/
        );
        expect(MAX_TEAM_FIXES).toBe(2);
    });
});
