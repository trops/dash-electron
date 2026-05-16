/**
 * @jest-environment jsdom
 *
 * Tests for llmOneShot — the Promise-wrapped streaming LLM bridge
 * used by the Compose-mode Suggest buttons.
 *
 * extractJsonBlock:
 *   - extracts content from fenced ```json blocks
 *   - extracts the first balanced bare object or array
 *   - ignores brackets inside strings
 *   - returns null when nothing is parseable
 *
 * sendOneShot:
 *   - resolves with accumulated stream text on complete
 *   - filters events by requestId (other in-flight requests ignored)
 *   - rejects on stream error
 *   - rejects on missing bridge
 *
 * sendOneShotJson:
 *   - returns the parsed JSON value
 *   - rejects on no JSON block
 *   - rejects on parse failure
 */

import { extractJsonBlock, sendOneShot, sendOneShotJson } from "./llmOneShot";

function setupFakeBridge() {
    const listeners = {
        delta: [],
        complete: [],
        error: [],
    };
    let nextId = 1;
    const llm = {
        sendMessage: jest.fn().mockResolvedValue(undefined),
        onStreamDelta: jest.fn((cb) => {
            const id = `delta-${nextId++}`;
            listeners.delta.push({ id, cb });
            return id;
        }),
        onStreamComplete: jest.fn((cb) => {
            const id = `complete-${nextId++}`;
            listeners.complete.push({ id, cb });
            return id;
        }),
        onStreamError: jest.fn((cb) => {
            const id = `error-${nextId++}`;
            listeners.error.push({ id, cb });
            return id;
        }),
        removeStreamListener: jest.fn(),
    };
    window.mainApi = { llm };
    const fire = (kind, evt) => {
        for (const { cb } of listeners[kind]) cb(evt);
    };
    return { llm, fire };
}

function teardownBridge() {
    delete window.mainApi;
}

describe("extractJsonBlock", () => {
    test("extracts content from a ```json fence", () => {
        const text = 'Here you go:\n```json\n{"a":1}\n```\nthanks.';
        expect(extractJsonBlock(text)).toBe('{"a":1}');
    });

    test("extracts a bare object", () => {
        expect(extractJsonBlock('prelude {"a":1} trailer')).toBe('{"a":1}');
    });

    test("extracts a bare array", () => {
        expect(extractJsonBlock("see [1,2,3] more")).toBe("[1,2,3]");
    });

    test("respects nested braces", () => {
        const text = '{"a":{"b":[1,2]}}';
        expect(extractJsonBlock(text)).toBe('{"a":{"b":[1,2]}}');
    });

    test("ignores brackets inside strings", () => {
        expect(extractJsonBlock('{"k":"has } in it"}')).toBe(
            '{"k":"has } in it"}'
        );
    });

    test("returns null when no JSON present", () => {
        expect(extractJsonBlock("no json here")).toBeNull();
        expect(extractJsonBlock("")).toBeNull();
        expect(extractJsonBlock(null)).toBeNull();
    });
});

describe("sendOneShot", () => {
    afterEach(() => {
        teardownBridge();
    });

    test("rejects when LLM bridge is unavailable", async () => {
        teardownBridge();
        await expect(
            sendOneShot({
                model: "x",
                systemPrompt: "p",
                userMessage: "m",
            })
        ).rejects.toThrow(/bridge unavailable/);
    });

    test("resolves with accumulated deltas on complete", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShot({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        // Grab the requestId from the sendMessage call.
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("delta", { requestId, text: "Hello, " });
        fire("delta", { requestId, text: "world." });
        fire("complete", { requestId });
        await expect(p).resolves.toBe("Hello, world.");
    });

    test("ignores events for unrelated requestIds", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShot({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("delta", { requestId: "other-id", text: "wrong" });
        fire("delta", { requestId, text: "right" });
        fire("complete", { requestId });
        await expect(p).resolves.toBe("right");
    });

    test("rejects on stream error", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShot({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("error", { requestId, error: "blew up" });
        await expect(p).rejects.toThrow("blew up");
    });

    test("CLI backend: fetches a scratch cwd from mainApi.aiAssistant and passes it to sendMessage", async () => {
        const { fire, llm } = setupFakeBridge();
        window.mainApi.aiAssistant = {
            composerScratchDir: jest
                .fn()
                .mockResolvedValue("/tmp/dash-composer-suggest"),
        };
        const p = sendOneShot({
            model: "x",
            backend: "claude-code",
            systemPrompt: "p",
            userMessage: "m",
        });
        // Wait for the cwd lookup + sendMessage call to flush.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(
            window.mainApi.aiAssistant.composerScratchDir
        ).toHaveBeenCalledTimes(1);
        expect(llm.sendMessage).toHaveBeenCalled();
        const [requestId, params] = llm.sendMessage.mock.calls[0];
        expect(params.cwd).toBe("/tmp/dash-composer-suggest");
        // Each Suggest run uses a fresh CLI session (no widgetUuid).
        expect(params.widgetUuid).toBeUndefined();
        // Settle the promise so jest doesn't complain about a
        // hanging request at end of test.
        fire("complete", { requestId, text: "ok" });
        await expect(p).resolves.toBe("ok");
    });

    test("anthropic backend: does NOT call composerScratchDir", async () => {
        const { fire, llm } = setupFakeBridge();
        window.mainApi.aiAssistant = {
            composerScratchDir: jest.fn(),
        };
        const p = sendOneShot({
            model: "x",
            apiKey: "sk-test",
            backend: "anthropic",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(
            window.mainApi.aiAssistant.composerScratchDir
        ).not.toHaveBeenCalled();
        const [requestId, params] = llm.sendMessage.mock.calls[0];
        expect(params.cwd).toBeUndefined();
        fire("complete", { requestId, text: "ok" });
        await expect(p).resolves.toBe("ok");
    });

    test("uses text on the complete event when present (no deltas)", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShot({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("complete", { requestId, text: "all at once" });
        await expect(p).resolves.toBe("all at once");
    });

    test("resolves with accumulated deltas after the quiescence window when complete never fires", async () => {
        // The Claude CLI bridge sometimes finishes a stream-json
        // run without ever emitting a `result` line, so no
        // LLM_STREAM_COMPLETE event reaches the renderer. The
        // wrapper must still resolve — once deltas stop arriving
        // for `deltaQuiescenceMs`, we treat the stream as done and
        // return the accumulated text.
        jest.useFakeTimers();
        try {
            const { fire, llm } = setupFakeBridge();
            const p = sendOneShot({
                model: "x",
                systemPrompt: "p",
                userMessage: "m",
                deltaQuiescenceMs: 100,
            });
            await Promise.resolve();
            const [requestId] = llm.sendMessage.mock.calls[0];
            fire("delta", { requestId, text: "part 1 " });
            fire("delta", { requestId, text: "part 2" });
            // No complete event. Advance past the quiescence window.
            jest.advanceTimersByTime(150);
            await expect(p).resolves.toBe("part 1 part 2");
        } finally {
            jest.useRealTimers();
        }
    });

    test("complete event arriving inside the quiescence window wins over the timer", async () => {
        jest.useFakeTimers();
        try {
            const { fire, llm } = setupFakeBridge();
            const p = sendOneShot({
                model: "x",
                systemPrompt: "p",
                userMessage: "m",
                deltaQuiescenceMs: 100,
            });
            await Promise.resolve();
            const [requestId] = llm.sendMessage.mock.calls[0];
            fire("delta", { requestId, text: "streaming" });
            jest.advanceTimersByTime(50);
            fire("complete", {
                requestId,
                content: [{ type: "text", text: "final" }],
            });
            await expect(p).resolves.toBe("final");
            // Ensure no late quiescence resolve fires (would surface
            // as an unhandled promise warning).
            jest.advanceTimersByTime(200);
        } finally {
            jest.useRealTimers();
        }
    });

    test("unwraps content[] shape on the complete event (CLI bridge shape)", async () => {
        // The CLI bridge emits LLM_STREAM_COMPLETE with shape
        //   { requestId, content: [{ type: "text", text: "..." }], stopReason, usage }
        // and NOT with a top-level `text` field. The Anthropic
        // streaming branch uses `text`. The wrapper has to handle
        // both.
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShot({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("complete", {
            requestId,
            content: [
                { type: "text", text: "hello " },
                { type: "tool_use", id: "x" },
                { type: "text", text: "world" },
            ],
            stopReason: "end_turn",
        });
        await expect(p).resolves.toBe("hello world");
    });
});

describe("sendOneShotJson", () => {
    afterEach(() => {
        teardownBridge();
    });

    test("returns the parsed JSON from a fenced block", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShotJson({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("complete", {
            requestId,
            text: 'pre ```json\n{"hello":"world"}\n``` post',
        });
        await expect(p).resolves.toEqual({ hello: "world" });
    });

    test("rejects when no JSON block is found", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShotJson({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        fire("complete", { requestId, text: "no json" });
        await expect(p).rejects.toThrow(/did not contain a JSON block/);
    });

    test("rejects on JSON parse error", async () => {
        const { fire, llm } = setupFakeBridge();
        const p = sendOneShotJson({
            model: "x",
            systemPrompt: "p",
            userMessage: "m",
        });
        await Promise.resolve();
        const [requestId] = llm.sendMessage.mock.calls[0];
        // Braces balance, so extractJsonBlock returns the content,
        // but the body is not valid JSON (unquoted token).
        fire("complete", { requestId, text: "{not valid}" });
        await expect(p).rejects.toThrow(/parse error/i);
    });
});
