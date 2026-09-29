import { reduceFeed } from "./runFeed";

describe("reduceFeed", () => {
    it("accumulates consecutive text deltas into one block", () => {
        let f = [];
        f = reduceFeed(f, { type: "text", text: "Hel" });
        f = reduceFeed(f, { type: "text", text: "lo" });
        expect(f).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("pairs tool_call with its tool_result by id", () => {
        let f = reduceFeed([], {
            type: "tool_call",
            id: "t1",
            name: "get_prs",
            input: { repo: "x" },
        });
        expect(f[0]).toMatchObject({
            type: "tool",
            id: "t1",
            status: "running",
        });
        f = reduceFeed(f, {
            type: "tool_result",
            id: "t1",
            name: "get_prs",
            output: "3 PRs",
            isError: false,
        });
        expect(f[0]).toMatchObject({
            type: "tool",
            id: "t1",
            output: "3 PRs",
            status: "done",
        });
        expect(f.length).toBe(1); // merged, not appended
    });

    it("marks a failed tool result as error", () => {
        let f = reduceFeed([], {
            type: "tool_call",
            id: "t1",
            name: "x",
            input: {},
        });
        f = reduceFeed(f, {
            type: "tool_result",
            id: "t1",
            output: "boom",
            isError: true,
        });
        expect(f[0].status).toBe("error");
        expect(f[0].isError).toBe(true);
    });

    it("appends done / error / skipped and ignores session", () => {
        expect(
            reduceFeed([], {
                type: "done",
                stopReason: "end_turn",
                usage: { inputTokens: 1 },
            })
        ).toEqual([
            { type: "done", stopReason: "end_turn", usage: { inputTokens: 1 } },
        ]);
        expect(reduceFeed([], { type: "error", message: "boom" })).toEqual([
            { type: "error", message: "boom" },
        ]);
        expect(reduceFeed([], { type: "skipped", reason: "busy" })).toEqual([
            { type: "skipped", reason: "busy" },
        ]);
        expect(reduceFeed([], { type: "session", session: {} })).toEqual([]);
    });

    it("is pure (does not mutate the input array)", () => {
        const orig = [];
        const out = reduceFeed(orig, { type: "text", text: "hi" });
        expect(orig).toEqual([]);
        expect(out).not.toBe(orig);
    });

    it("ignores malformed events", () => {
        expect(reduceFeed([], null)).toEqual([]);
        expect(reduceFeed([], {})).toEqual([]);
    });
});
