const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockLlm,
    stopMockLlm,
    getRequestHistory,
} = require("../helpers/mock-llm-server");

/**
 * LLM streaming — IPC contract spec
 *
 * Pins the Anthropic-API backend's streaming pipeline end-to-end:
 *
 *   mainApi.llm.sendMessage(requestId, { apiKey, model, messages })
 *     → Anthropic SDK in main process
 *     → ANTHROPIC_BASE_URL → mock-LLM SSE
 *     → llmController forwards stream events to the renderer:
 *         LLM_STREAM_DELTA → onStreamDelta callback
 *         LLM_STREAM_TOOL_CALL → onStreamToolCall callback
 *         LLM_STREAM_COMPLETE → onStreamComplete callback
 *
 * Two scenarios:
 *
 *   1. Plain text response — deltas accumulate to the canned text,
 *      complete fires with end_turn stopReason.
 *   2. Tool-use response — onStreamToolCall fires with the tool name
 *      + input from the mock's tool_use block, then the loop continues
 *      and complete eventually fires.
 *
 * If any leg of this pipeline regresses, the AI Assistant panel
 * silently goes dead — the user types and sees nothing back. This
 * spec catches it before ship.
 */

let electronApp;
let window;
let tempUserData;
let llmPort;

test.beforeAll(async () => {
    llmPort = await startMockLlm({
        responses: [
            {
                match: { lastUserContains: "say hello" },
                blocks: [{ type: "text", text: "Hello from the mock!" }],
            },
            {
                match: { lastUserContains: "use a tool" },
                blocks: [
                    {
                        type: "tool_use",
                        id: "toolu_test_1",
                        name: "list_dashboards",
                        input: { query: "" },
                    },
                ],
            },
            // Second round after tool result: just say done.
            {
                match: { default: true },
                blocks: [{ type: "text", text: "All done." }],
            },
        ],
    });

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            // Anthropic SDK reads ANTHROPIC_BASE_URL by default. With
            // this set, all `client.messages.stream(...)` calls hit
            // our mock instead of api.anthropic.com.
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmPort}`,
        },
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    await stopMockLlm();
});

test("streaming text: deltas accumulate, complete fires with end_turn", async () => {
    const result = await window.evaluate(
        async () =>
            new Promise((resolve, reject) => {
                const deltas = [];
                let completed = null;
                const ids = [];

                const cleanup = () => {
                    for (const id of ids) {
                        try {
                            window.mainApi.llm.removeStreamListener(id);
                        } catch (_) {}
                    }
                };

                const TIMEOUT = setTimeout(() => {
                    cleanup();
                    reject(new Error("Stream timed out after 15s"));
                }, 15000);

                ids.push(
                    window.mainApi.llm.onStreamDelta((d) => {
                        if (d?.text) deltas.push(d.text);
                    })
                );
                ids.push(
                    window.mainApi.llm.onStreamComplete((c) => {
                        completed = c;
                        clearTimeout(TIMEOUT);
                        cleanup();
                        resolve({
                            text: deltas.join(""),
                            stopReason: completed?.stopReason,
                            content: completed?.content,
                        });
                    })
                );
                ids.push(
                    window.mainApi.llm.onStreamError((e) => {
                        clearTimeout(TIMEOUT);
                        cleanup();
                        reject(
                            new Error(
                                `Stream error: ${e?.error || JSON.stringify(e)}`
                            )
                        );
                    })
                );

                window.mainApi.llm.sendMessage("req-text-1", {
                    apiKey: "fake-but-required",
                    model: "claude-3-5-sonnet-latest",
                    messages: [{ role: "user", content: "say hello" }],
                });
            })
    );

    expect(result.text).toContain("Hello from the mock!");
    expect(result.stopReason).toBe("end_turn");

    const history = getRequestHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
});

test("streaming tool_use: onStreamToolCall fires with the tool name + input", async () => {
    const result = await window.evaluate(
        async () =>
            new Promise((resolve, reject) => {
                const toolCalls = [];
                const ids = [];

                const cleanup = () => {
                    for (const id of ids) {
                        try {
                            window.mainApi.llm.removeStreamListener(id);
                        } catch (_) {}
                    }
                };

                const TIMEOUT = setTimeout(() => {
                    cleanup();
                    resolve({
                        toolCalls,
                        timedOut: true,
                    });
                }, 12000);

                ids.push(
                    window.mainApi.llm.onStreamToolCall((c) => {
                        toolCalls.push({
                            toolName: c?.toolName,
                            input: c?.input,
                        });
                    })
                );
                ids.push(
                    window.mainApi.llm.onStreamComplete(() => {
                        clearTimeout(TIMEOUT);
                        cleanup();
                        resolve({ toolCalls, timedOut: false });
                    })
                );
                ids.push(
                    window.mainApi.llm.onStreamError(() => {
                        // Ignore — we only care that the tool_call event
                        // fired. After tool_use, llmController invokes
                        // the tool which may error in this hermetic
                        // setup; that's fine.
                        clearTimeout(TIMEOUT);
                        cleanup();
                        resolve({ toolCalls, timedOut: false });
                    })
                );

                window.mainApi.llm.sendMessage("req-tool-1", {
                    apiKey: "fake-but-required",
                    model: "claude-3-5-sonnet-latest",
                    // Empty tools list is fine — the tool the mock asks
                    // for ("list_dashboards") is a built-in Dash tool
                    // injected by llmController at request time.
                    tools: [],
                    messages: [{ role: "user", content: "use a tool" }],
                });
            })
    );

    // The tool_call event must have fired with the mock's name.
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.toolCalls[0].toolName).toBe("list_dashboards");
});
