import { remixAllowed, remixBlockedText } from "./remixGate";

describe("remixGate", () => {
    it("follows the author's choice, else public yes / private no", () => {
        expect(remixAllowed({ visibility: "public" })).toBe(true);
        expect(remixAllowed({ visibility: "private" })).toBe(false);
        expect(remixAllowed({ visibility: "private", allowRemix: true })).toBe(
            true
        );
        expect(remixAllowed({ visibility: "public", allowRemix: false })).toBe(
            false
        );
        expect(remixAllowed(null)).toBeNull();
    });

    it("explains a refusal; says nothing when allowed or unknown", () => {
        expect(
            remixBlockedText({ visibility: "private" }, "Merchandising")
        ).toMatch(/author of "Merchandising" doesn't allow remixes/);
        expect(remixBlockedText({ visibility: "public" }, "X")).toBeNull();
        expect(remixBlockedText(null, "X")).toBeNull();
    });
});
