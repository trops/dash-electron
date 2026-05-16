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
 *   - model:        string (e.g., "claude-sonnet-4-20250514")
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
    backend = "anthropic",
    timeoutMs = 60_000,
} = {}) {
    return new Promise((resolve, reject) => {
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

        let accumulated = "";
        let settled = false;
        const listenerIds = [];

        const cleanup = () => {
            for (const id of listenerIds) {
                try {
                    llm.removeStreamListener(id);
                } catch {
                    /* ignore */
                }
            }
            clearTimeout(timer);
        };

        const settle = (fn, val) => {
            if (settled) return;
            settled = true;
            cleanup();
            fn(val);
        };

        const timer = setTimeout(
            () =>
                settle(
                    reject,
                    new Error(`LLM request timed out after ${timeoutMs}ms`)
                ),
            timeoutMs
        );

        try {
            listenerIds.push(
                llm.onStreamDelta((evt) => {
                    if (!evt || evt.requestId !== requestId) return;
                    if (typeof evt.text === "string") accumulated += evt.text;
                    else if (typeof evt.delta === "string")
                        accumulated += evt.delta;
                })
            );
            listenerIds.push(
                llm.onStreamComplete((evt) => {
                    if (!evt || evt.requestId !== requestId) return;
                    // Some backends include the final text on the complete
                    // event rather than via deltas — prefer it when present.
                    const finalText =
                        (typeof evt.text === "string" && evt.text) ||
                        accumulated;
                    settle(resolve, finalText);
                })
            );
            listenerIds.push(
                llm.onStreamError((evt) => {
                    if (!evt || evt.requestId !== requestId) return;
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

        const messages = [{ role: "user", content: userMessage }];
        Promise.resolve(
            llm.sendMessage(requestId, {
                model,
                apiKey,
                backend,
                systemPrompt,
                messages,
                // Lock down tool usage — these are pure structured
                // completions, no MCP / Bash / Read needed.
                replaceSystemPrompt: true,
                disableTools: true,
                maxToolRounds: 0,
            })
        ).catch((err) => settle(reject, err));
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
