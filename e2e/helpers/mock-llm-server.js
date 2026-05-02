/**
 * Mock LLM SSE server for E2E tests.
 *
 * Stands up a local HTTP server speaking Anthropic's `/v1/messages`
 * streaming format. Tests point the app at it via the `ANTHROPIC_BASE_URL`
 * env var, then exercise AI Assistant / Widget Builder flows without
 * burning real tokens or coupling tests to model output drift.
 *
 * The mock returns canned responses keyed by a matcher against the
 * last user message in the request body. Each response can be a plain
 * text answer, a tool_use block, or a multi-block sequence.
 *
 * Usage:
 *
 *   const { startMockLlm, stopMockLlm } = require("../helpers/mock-llm-server");
 *
 *   let llmPort;
 *   test.beforeAll(async () => {
 *     llmPort = await startMockLlm({
 *       responses: [
 *         {
 *           match: { lastUserContains: "create a clock" },
 *           blocks: [{ type: "text", text: "Sure, here's a clock:" }],
 *         },
 *         { match: { default: true }, blocks: [{ type: "text", text: "Hello!" }] },
 *       ],
 *     });
 *     ({ electronApp, window } = await launchApp({
 *       env: { ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmPort}` },
 *     }));
 *   });
 *
 *   test.afterAll(async () => {
 *     await closeApp(electronApp);
 *     await stopMockLlm();
 *   });
 *
 * The mock also speaks the non-streaming `/v1/messages` shape (when the
 * request body has `stream: false` or omits it) for callers that don't
 * use SSE.
 *
 * Limitations:
 *   - Claude Code CLI mode spawns a subprocess; this mock does NOT
 *     intercept that. Use the Anthropic-API backend in tests that need
 *     this mock.
 */

const http = require("http");

let serverInstance = null;
let serverPort = null;
let configuredResponses = [];
let requestHistory = [];

function pickResponse(parsedBody) {
    const messages = Array.isArray(parsedBody?.messages)
        ? parsedBody.messages
        : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = (() => {
        if (!lastUser) return "";
        if (typeof lastUser.content === "string") return lastUser.content;
        if (Array.isArray(lastUser.content)) {
            return lastUser.content
                .map((c) =>
                    typeof c === "string"
                        ? c
                        : c?.type === "text"
                        ? c.text || ""
                        : ""
                )
                .join("\n");
        }
        return "";
    })();

    let fallback = null;
    for (const entry of configuredResponses) {
        const m = entry.match || {};
        if (m.default) {
            fallback = entry;
            continue;
        }
        if (
            typeof m.lastUserContains === "string" &&
            lastUserText.includes(m.lastUserContains)
        ) {
            return entry;
        }
        if (typeof m.lastUserMatches === "object" && m.lastUserMatches) {
            // RegExp gets serialized to {} via JSON; require strings here.
            // Tests can pass a real RegExp, we just instanceof-check.
            if (
                m.lastUserMatches instanceof RegExp &&
                m.lastUserMatches.test(lastUserText)
            ) {
                return entry;
            }
        }
    }
    return (
        fallback || {
            blocks: [
                {
                    type: "text",
                    text: "[mock-llm] no canned response configured",
                },
            ],
        }
    );
}

function writeSseEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function streamResponse(res, blocks) {
    const messageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });

    writeSseEvent(res, "message_start", {
        type: "message_start",
        message: {
            id: messageId,
            type: "message",
            role: "assistant",
            content: [],
            model: "claude-mock",
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
        },
    });

    blocks.forEach((block, index) => {
        if (block.type === "text") {
            writeSseEvent(res, "content_block_start", {
                type: "content_block_start",
                index,
                content_block: { type: "text", text: "" },
            });
            // Stream the text in one or two chunks. The renderer should
            // not depend on chunk granularity.
            writeSseEvent(res, "content_block_delta", {
                type: "content_block_delta",
                index,
                delta: { type: "text_delta", text: block.text || "" },
            });
            writeSseEvent(res, "content_block_stop", {
                type: "content_block_stop",
                index,
            });
        } else if (block.type === "tool_use") {
            const toolUseId = `toolu_${Date.now()}_${index}`;
            writeSseEvent(res, "content_block_start", {
                type: "content_block_start",
                index,
                content_block: {
                    type: "tool_use",
                    id: toolUseId,
                    name: block.name,
                    input: {},
                },
            });
            writeSseEvent(res, "content_block_delta", {
                type: "content_block_delta",
                index,
                delta: {
                    type: "input_json_delta",
                    partial_json: JSON.stringify(block.input || {}),
                },
            });
            writeSseEvent(res, "content_block_stop", {
                type: "content_block_stop",
                index,
            });
        }
    });

    writeSseEvent(res, "message_delta", {
        type: "message_delta",
        delta: {
            stop_reason: blocks.some((b) => b.type === "tool_use")
                ? "tool_use"
                : "end_turn",
            stop_sequence: null,
        },
        usage: { output_tokens: 10 },
    });

    writeSseEvent(res, "message_stop", { type: "message_stop" });

    res.end();
}

function nonStreamResponse(res, blocks) {
    const messageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    const content = blocks.map((b) => {
        if (b.type === "text") return { type: "text", text: b.text || "" };
        if (b.type === "tool_use")
            return {
                type: "tool_use",
                id: `toolu_${Date.now()}`,
                name: b.name,
                input: b.input || {},
            };
        return b;
    });
    const body = {
        id: messageId,
        type: "message",
        role: "assistant",
        content,
        model: "claude-mock",
        stop_reason: blocks.some((b) => b.type === "tool_use")
            ? "tool_use"
            : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 10 },
    };
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": buf.length,
    });
    res.end(buf);
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

function createMockLlmServer() {
    return http.createServer(async (req, res) => {
        const url = req.url || "";
        const method = req.method || "GET";

        if (method === "POST" && /\/v1\/messages\/?$/.test(url)) {
            const raw = await readBody(req);
            let parsed = {};
            try {
                parsed = JSON.parse(raw.toString("utf8"));
            } catch (_) {
                /* malformed body — fall through to default */
            }

            requestHistory.push({
                receivedAt: new Date().toISOString(),
                model: parsed.model || null,
                stream: parsed.stream === true,
                lastUserText: (() => {
                    const last = [...(parsed.messages || [])]
                        .reverse()
                        .find((m) => m.role === "user");
                    if (!last) return "";
                    if (typeof last.content === "string") return last.content;
                    if (Array.isArray(last.content)) {
                        return last.content
                            .map((c) => (c?.type === "text" ? c.text : ""))
                            .join("\n");
                    }
                    return "";
                })(),
            });

            const entry = pickResponse(parsed);
            const blocks = entry.blocks || [
                { type: "text", text: "[mock-llm]" },
            ];

            if (parsed.stream === true) {
                streamResponse(res, blocks);
            } else {
                nonStreamResponse(res, blocks);
            }
            return;
        }

        // Default 404
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    });
}

/**
 * Start the mock LLM server.
 *
 * @param {Object} [opts]
 * @param {number} [opts.port=0]
 * @param {Array<{
 *   match: {
 *     default?: boolean,
 *     lastUserContains?: string,
 *     lastUserMatches?: RegExp,
 *   },
 *   blocks: Array<
 *     | { type: "text", text: string }
 *     | { type: "tool_use", name: string, input?: object }
 *   >,
 * }>} [opts.responses]
 * @returns {Promise<number>} bound port
 */
async function startMockLlm(opts = {}) {
    const { port = 0, responses = [] } = opts;
    configuredResponses = responses.slice();
    requestHistory = [];
    serverInstance = createMockLlmServer();
    return new Promise((resolve) => {
        serverInstance.listen(port, "127.0.0.1", () => {
            serverPort = serverInstance.address().port;
            resolve(serverPort);
        });
    });
}

async function stopMockLlm() {
    if (serverInstance) {
        return new Promise((resolve) => {
            serverInstance.close(resolve);
            serverInstance = null;
            serverPort = null;
        });
    }
}

function getRequestHistory() {
    return requestHistory.slice();
}

function setResponses(responses) {
    configuredResponses = (responses || []).slice();
}

module.exports = {
    startMockLlm,
    stopMockLlm,
    getRequestHistory,
    setResponses,
};
