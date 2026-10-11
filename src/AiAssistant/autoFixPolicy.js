/**
 * autoFixPolicy — when the Widget Builder sends a build error back to the
 * AI by itself (create-entry PRD, phase 2d), instead of making the user
 * press "Send error to AI".
 *
 * Only build errors (compile failures and the builder's code checks),
 * never errors a widget throws while running. At most MAX_AUTO_FIX tries
 * in a row; each failing piece of code is sent once. A successful compile,
 * a message the user sends, Try again, or New Chat starts the count over.
 *
 * State: { attempts, lastCode } — lastCode is the component source the
 * last fix request was sent for.
 */

export const MAX_AUTO_FIX = 2;

export const INITIAL_AUTO_FIX = { attempts: 0, lastCode: null };

/**
 * A build error appeared for `code`. What now?
 * @returns {{ send: boolean, state: object, exhausted: boolean }}
 *   send       — send the fix request now
 *   exhausted  — tries are used up: show the error to the user
 */
export function onBuildError(state, { code, kind }) {
    const s = state || INITIAL_AUTO_FIX;
    if (kind !== "compile" || !code) {
        return { send: false, state: s, exhausted: false };
    }
    // Already asked for this exact code — wait for the AI's answer.
    if (code === s.lastCode) {
        return { send: false, state: s, exhausted: s.attempts >= MAX_AUTO_FIX };
    }
    if (s.attempts >= MAX_AUTO_FIX) {
        return { send: false, state: s, exhausted: true };
    }
    return {
        send: true,
        state: { attempts: s.attempts + 1, lastCode: code },
        exhausted: false,
    };
}

/** A compile succeeded, the user sent a message, Try again, or New Chat. */
export function resetAutoFix() {
    return INITIAL_AUTO_FIX;
}

/** The message sent to the AI — the same text "Send error to AI" sends. */
export function buildFixRequest(previewError, previewErrorMeta) {
    if (previewErrorMeta && previewErrorMeta.correction) {
        return previewErrorMeta.correction;
    }
    return `Fix this compilation error:\n\n${previewError}\n\nPlease output both the corrected jsx component code block and the javascript config code block.`;
}
