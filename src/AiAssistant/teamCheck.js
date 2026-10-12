/**
 * teamCheck — the Dash team's Checker after a Widget Builder install
 * (create-entry PRD CRE-011 AC5, phase 3 slice 4). The Checker runs
 * check_widget on the installed widget and ends with a verdict; a failure
 * can go back to the builder ("Let Builder fix it") at most twice.
 */

export const MAX_TEAM_FIXES = 2;

/** "VERDICT: PASSED" / "VERDICT: FAILED" at the end of the Checker's answer. */
export function verdictOf(text) {
    const m = /VERDICT:\s*(PASSED|FAILED)/i.exec(String(text || ""));
    return m ? m[1].toUpperCase() : null;
}

/** What the builder chat gets when the user lets it fix the Checker's finds. */
export function fixRequestText(widgetName, checkerAnswer) {
    return `The Checker found problems with ${widgetName}:\n\n${String(
        checkerAnswer || ""
    ).trim()}\n\nFix them, keeping every existing setting and event, and output BOTH the component and the config (.dash.js) code blocks.`;
}

/** The Checker's request for an installed widget. */
export function checkRequestText(widgetName) {
    return `Check ${widgetName}. Run check_widget, read the code if you need to, and end with VERDICT: PASSED or VERDICT: FAILED.`;
}
