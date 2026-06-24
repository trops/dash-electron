/**
 * Tiny Promise wrapper around the streaming LLM bridge for the
 * Compose-mode AI Suggest buttons (slice 20.C5).
 *
 * The dash-core renderer API streams deltas via onStreamDelta /
 * onStreamComplete / onStreamError event subscribers. ChatCore
 * consumes that for the conversational UI; for one-shot calls
 * (suggest a layout, fill defaults) we just want a Promise<string>
 * that resolves when the model is done.
 *
 * This file does not depend on any composer state — caller passes
 * the apiKey + model + systemPrompt + userMessage and gets back the
 * concatenated assistant text. Suggest-button parsing happens in
 * the calling code.
 *
 * Note on backend: when no apiKey is supplied (and the user is on
 * the Claude Code CLI backend) the bridge spawns the CLI and
 * streams its NDJSON. When apiKey is supplied it goes direct to
 * the Anthropic SDK. Either way the delta events look the same
 * from the renderer's perspective, so this helper doesn't care.
 */

let nextRequestSeq = 1;

/**
 * Send one message and resolve with the full assistant text.
 *
 * `params`:
 *   - model:        string (e.g., "claude-opus-4-8")
 *   - apiKey:       string | null
 *   - systemPrompt: string
 *   - userMessage:  string
 *   - backend:      "claude-code" | "anthropic"  (forwarded to the
 *                   bridge; defaults to "anthropic" when omitted)
 *   - timeoutMs:    number (defaults to 60_000)
 *
 * Resolves with the full text. Rejects on stream error, missing
 * bridge, or timeout. The caller is responsible for parsing.
 */
export function sendOneShot({
    model,
    apiKey = null,
    systemPrompt,
    userMessage,
    backend = "claude-code",
    timeoutMs = 60_000,
    // CLI quiescence window: after this many ms with no new delta
    // event, assume the stream is done and resolve with whatever
    // has accumulated. The Claude CLI bridge's close handler only
    // emits LLM_STREAM_COMPLETE if the final stdout line parses as
    // a stream-json `result` event. When the model finishes via
    // `assistant`+text deltas and exits without a result line (the
    // common case for prompt-mode runs with no tool use), no
    // complete event ever fires — we'd otherwise wait until the
    // 60s hard timeout despite having the full answer in hand.
    deltaQuiescenceMs = 4_000,
} = {}) {
    return new Promise((resolve, reject) => {
        // Test-only override hook. E2E specs can install
        // `window.__DASH_LLM_ONE_SHOT_OVERRIDE` as an async
        // function taking the same params object and resolving to
        // a string — used to exercise the SuggestLayoutButton
        // pipeline without depending on the real CLI or mock-LLM
        // server (contextBridge freezes window.mainApi so direct
        // bridge stubbing isn't possible from the page side).
        // The override completely short-circuits the listener
        // plumbing below.
        if (
            typeof window !== "undefined" &&
            typeof window.__DASH_LLM_ONE_SHOT_OVERRIDE === "function"
        ) {
            Promise.resolve(
                window.__DASH_LLM_ONE_SHOT_OVERRIDE({
                    model,
                    apiKey,
                    backend,
                    systemPrompt,
                    userMessage,
                })
            ).then(resolve, reject);
            return;
        }
        if (
            typeof window === "undefined" ||
            !window.mainApi ||
            !window.mainApi.llm ||
            typeof window.mainApi.llm.sendMessage !== "function"
        ) {
            reject(new Error("LLM bridge unavailable (window.mainApi.llm)"));
            return;
        }
        const llm = window.mainApi.llm;
        const requestId = `composer-suggest-${Date.now()}-${nextRequestSeq++}`;

        // Diagnostic breadcrumbs — kept on window so devtools can
        // surface them without console-strip in dash-core eating
        // them. Helped chase the v0.0.713 "timeout, no events" bug
        // where the CLI bridge was being called but no stream
        // events came back to the renderer.
        if (typeof window !== "undefined") {
            window.__DASH_DEBUG = window.__DASH_DEBUG || [];
            window.__DASH_DEBUG.push({
                t: Date.now(),
                kind: "llmOneShot.start",
                requestId,
                backend,
                hasApiKey: !!apiKey,
                model,
            });
        }

        let accumulated = "";
        let settled = false;
        let quiescenceTimer = null;
        const listenerIds = [];
        const events = [];

        const cleanup = () => {
            for (const id of listenerIds) {
                try {
                    llm.removeStreamListener(id);
                } catch {
                    /* ignore */
                }
            }
            clearTimeout(timer);
            if (quiescenceTimer) clearTimeout(quiescenceTimer);
        };

        // Bumped after every accepted delta. When this fires without
        // a prior settle, we resolve with whatever has accumulated.
        const bumpQuiescence = () => {
            if (quiescenceTimer) clearTimeout(quiescenceTimer);
            quiescenceTimer = setTimeout(() => {
                if (typeof window !== "undefined") {
                    window.__DASH_DEBUG = window.__DASH_DEBUG || [];
                    window.__DASH_DEBUG.push({
                        t: Date.now(),
                        kind: "llmOneShot.quiescence-resolve",
                        requestId,
                        accumulatedLen: accumulated.length,
                    });
                }
                settle(resolve, accumulated);
            }, deltaQuiescenceMs);
        };

        const settle = (fn, val) => {
            if (settled) return;
            settled = true;
            cleanup();
            fn(val);
        };

        const timer = setTimeout(() => {
            if (typeof window !== "undefined") {
                window.__DASH_DEBUG = window.__DASH_DEBUG || [];
                window.__DASH_DEBUG.push({
                    t: Date.now(),
                    kind: "llmOneShot.timeout",
                    requestId,
                    backend,
                    eventsObserved: events.length,
                    events,
                });
            }
            const hint =
                events.length === 0
                    ? " (no stream events received — the LLM bridge fired sendMessage but no delta/complete/error came back. Check Settings → Claude CLI auth, then DevTools window.__DASH_DEBUG.)"
                    : "";
            settle(
                reject,
                new Error(`LLM request timed out after ${timeoutMs}ms${hint}`)
            );
        }, timeoutMs);

        try {
            listenerIds.push(
                llm.onStreamDelta((evt) => {
                    events.push({
                        k: "delta",
                        reqMatch: evt?.requestId === requestId,
                        gotReqId: evt?.requestId,
                        textLen:
                            typeof evt?.text === "string"
                                ? evt.text.length
                                : null,
                    });
                    // Defensive: if events arrive with no requestId
                    // field at all (a future bridge shape change),
                    // accept them too — better to overflow with text
                    // than time out silently.
                    if (
                        evt &&
                        evt.requestId !== undefined &&
                        evt.requestId !== null &&
                        evt.requestId !== requestId
                    ) {
                        return;
                    }
                    if (typeof evt?.text === "string") accumulated += evt.text;
                    else if (typeof evt?.delta === "string")
                        accumulated += evt.delta;
                    bumpQuiescence();
                })
            );
            listenerIds.push(
                llm.onStreamComplete((evt) => {
                    events.push({
                        k: "complete",
                        reqMatch: evt?.requestId === requestId,
                        gotReqId: evt?.requestId,
                        hasContent: Array.isArray(evt?.content),
                        hasText: typeof evt?.text === "string",
                    });
                    if (
                        evt &&
                        evt.requestId !== undefined &&
                        evt.requestId !== null &&
                        evt.requestId !== requestId
                    ) {
                        return;
                    }
                    // CLI bridge emits { requestId, content: [{type,text}],
                    // stopReason, usage }; Anthropic bridge may emit a
                    // top-level `text`. Try every reasonable surface
                    // before falling back to the accumulated deltas.
                    const finalText =
                        (typeof evt?.text === "string" && evt.text) ||
                        (Array.isArray(evt?.content)
                            ? evt.content
                                  .filter((b) => b && b.type === "text")
                                  .map((b) => b.text || "")
                                  .join("")
                            : "") ||
                        accumulated;
                    settle(resolve, finalText);
                })
            );
            listenerIds.push(
                llm.onStreamError((evt) => {
                    events.push({
                        k: "error",
                        reqMatch: evt?.requestId === requestId,
                        gotReqId: evt?.requestId,
                        msg: evt?.error || evt?.message,
                    });
                    if (
                        evt &&
                        evt.requestId !== undefined &&
                        evt.requestId !== null &&
                        evt.requestId !== requestId
                    ) {
                        return;
                    }
                    settle(
                        reject,
                        new Error(
                            (evt && (evt.error || evt.message)) ||
                                "LLM stream error"
                        )
                    );
                })
            );
        } catch (err) {
            settle(reject, err);
            return;
        }

        // Resolve a scratch cwd for the CLI backend so the
        // dash-electron project's CLAUDE.md and skills folder don't
        // auto-load and make the model conversational. The renderer
        // can't read os.tmpdir() directly — go through the bridge
        // helper added in preload. Non-CLI backends ignore cwd, so
        // we only bother to fetch it for claude-code.
        const cwdPromise =
            backend === "claude-code" &&
            window.mainApi &&
            window.mainApi.aiAssistant &&
            typeof window.mainApi.aiAssistant.composerScratchDir === "function"
                ? Promise.resolve(
                      window.mainApi.aiAssistant
                          .composerScratchDir()
                          .catch(() => undefined)
                  )
                : Promise.resolve(undefined);

        const messages = [{ role: "user", content: userMessage }];
        cwdPromise.then((cwd) =>
            Promise.resolve(
                llm.sendMessage(requestId, {
                    model,
                    // For the CLI backend, passing apiKey: null is a
                    // no-op; passing it as undefined matches what
                    // ChatCore does and avoids any defensive branch
                    // in the bridge that might treat null as "use
                    // anthropic path" by accident.
                    apiKey: backend === "claude-code" ? undefined : apiKey,
                    backend,
                    systemPrompt,
                    messages,
                    // Scratch cwd keeps the CLI from auto-loading
                    // CLAUDE.md + skills folder. Undefined for
                    // non-CLI backends — they ignore cwd anyway.
                    cwd,
                    // INTENTIONALLY no widgetUuid — each Suggest
                    // call is a fresh CLI session with no context
                    // continuity. A previous shared-session bug had
                    // the model responding "I just built..." because
                    // it remembered an earlier turn.
                    // Lock down tool usage — these are pure
                    // structured completions, no MCP / Bash / Read
                    // needed.
                    replaceSystemPrompt: true,
                    disableTools: true,
                    maxToolRounds: 0,
                })
            ).catch((err) => settle(reject, err))
        );
    });
}

/**
 * Extract the first balanced JSON block from a text response.
 *
 * Models often wrap structured output in ```json fences or prose
 * preamble. This walks the string finding the first `[` or `{`
 * and returns the substring up to its matching close, ignoring
 * brackets inside strings.
 *
 * Returns null if no balanced block is found.
 */
export function extractJsonBlock(text) {
    if (typeof text !== "string") return null;
    // Fenced ```json first — most reliable when present.
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence && fence[1]) {
        const trimmed = fence[1].trim();
        if (trimmed.length > 0) return trimmed;
    }
    // Bare-bracket walk.
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch !== "{" && ch !== "[") continue;
        const close = ch === "{" ? "}" : "]";
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (let j = i; j < text.length; j++) {
            const c = text[j];
            if (esc) {
                esc = false;
                continue;
            }
            if (c === "\\") {
                esc = true;
                continue;
            }
            if (c === '"') {
                inStr = !inStr;
                continue;
            }
            if (inStr) continue;
            if (c === ch) depth++;
            else if (c === close) {
                depth--;
                if (depth === 0) return text.slice(i, j + 1);
            }
        }
    }
    return null;
}

/**
 * Convenience: send one-shot, extract JSON, parse. Resolves with
 * the parsed value; rejects if no parseable JSON in the response.
 */
export async function sendOneShotJson(params) {
    const text = await sendOneShot(params);
    const block = extractJsonBlock(text);
    if (!block) {
        throw new Error(
            `LLM response did not contain a JSON block.\nRaw text:\n${text.slice(
                0,
                500
            )}`
        );
    }
    try {
        return JSON.parse(block);
    } catch (err) {
        throw new Error(
            `LLM JSON parse error: ${err.message}\nBlock:\n${block.slice(
                0,
                500
            )}`
        );
    }
}
