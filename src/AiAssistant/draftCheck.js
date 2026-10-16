/**
 * draftCheck — the Widget Builder checks a widget while it's written, not
 * after it's saved (Widget Builder edit fixes; replaces the Checker after
 * install, CRE-011 AC5): each new version of the code gets the fast checks
 * (it builds inside its package, the code checks, the must-fix checklist —
 * window.mainApi.widgetBuilder.checkDraft), then the Dash team's Checker on
 * it as "draft:<Name>". Problems go back to the AI, at most MAX_CHECK_FIXES
 * times in a row; Install waits for a pass of this exact code.
 */

export const MAX_CHECK_FIXES = 2;

/** The code a check belongs to — any edit makes a new key. */
export function codeKeyOf(code) {
    const component = (code && code.componentCode) || "";
    if (!component) return null;
    return `${component.length}:${component}\n--config--\n${
        (code && code.configCode) || ""
    }`;
}

/** The fast checks' result as plain problem lines ([] when clean). */
export function fastCheckProblems(result) {
    if (!result || !result.success) {
        return [
            `The checks couldn't run: ${
                (result && result.error) || "no answer"
            }`,
        ];
    }
    const lines = [];
    if (result.compile && !result.compile.ok) {
        lines.push(
            `It doesn't build: ${result.compile.error || "unknown error"}`
        );
    }
    for (const p of result.problems || []) lines.push(p);
    for (const m of (result.scorecard && result.scorecard.failed) || []) {
        if (m && m.mustFix) lines.push(m.item);
    }
    return lines;
}

/** "PASSED" / "FAILED" at the end of the Checker's answer, or null. */
export function verdictOf(output) {
    const m = /VERDICT:\s*(PASSED|FAILED)/i.exec(String(output || ""));
    return m ? m[1].toUpperCase() : null;
}

/**
 * What the user asked for, for the Checker: their latest messages in the
 * builder's chat (not hidden ones — the greeting, automatic fix requests —
 * and not the AI's), newest last, at most ~1500 characters.
 */
export function userAskOf(messages, { max = 3, chars = 1500 } = {}) {
    const asks = (Array.isArray(messages) ? messages : [])
        .filter(
            (m) =>
                m &&
                m.role === "user" &&
                !m.hidden &&
                typeof m.content === "string" &&
                m.content.trim()
        )
        .map((m) => m.content.trim())
        .slice(-max);
    const text = asks.join("\n\n");
    return text.length > chars ? `…${text.slice(-chars)}` : text;
}

/** The Checker's request for the Widget Builder's unsaved code. */
export function draftCheckRequest(widgetName, asked = "") {
    const ask = String(asked || "").trim();
    return `Check the widget being written in the Widget Builder: run check_widget on draft:${widgetName} (it isn't installed yet; its code comes with the check). Judge whether the code does what the user asked, and end with VERDICT: PASSED or VERDICT: FAILED.${
        ask ? `\n\nThe user asked:\n\n${ask}` : ""
    }`;
}

/** What goes back to the AI when the checks find problems. */
export function checksFixRequest(widgetName, lines) {
    return `The checks found problems with ${widgetName}:\n\n${(lines || [])
        .map((l) => `- ${l}`)
        .join(
            "\n"
        )}\n\nFix them, keeping every existing setting, event and import of the package's own files, and output BOTH the component and the config (.dash.js) code blocks.`;
}
