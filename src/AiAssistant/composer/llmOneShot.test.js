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
