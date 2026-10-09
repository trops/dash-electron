/**
 * Drafts list summary — the first thing the USER asked for. The builder's
 * automatic greeting ("Hi, I'd like to build a new widget.") is sent as a
 * hidden user message, so it must be skipped.
 */
jest.mock("@trops/dash-react", () => ({}), { virtual: true });

import { firstUserMessageExcerpt } from "./WidgetDraftsList";

describe("firstUserMessageExcerpt", () => {
    it("skips the hidden greeting", () => {
        expect(
            firstUserMessageExcerpt([
                {
                    role: "user",
                    content: "Hi, I'd like to build a new widget.",
                    hidden: true,
                },
                { role: "assistant", content: "What should it show?" },
                { role: "user", content: "A clock and a counter" },
            ])
        ).toBe("A clock and a counter");
    });

    it("is empty when the user hasn't asked anything yet", () => {
        expect(
            firstUserMessageExcerpt([
                { role: "user", content: "Hi", hidden: true },
                { role: "assistant", content: "Hello" },
            ])
        ).toBe("");
    });

    it("shortens long requests", () => {
        const long = "x".repeat(200);
        const out = firstUserMessageExcerpt([{ role: "user", content: long }]);
        expect(out.length).toBe(108);
        expect(out.endsWith("…")).toBe(true);
    });
});
