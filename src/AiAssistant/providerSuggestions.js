/**
 * providerSuggestions — guess which provider types a widget description is
 * about, so the Widget Builder can ask "Which data should this widget use?"
 * with a few likely answers instead of the whole type list (create-entry PRD
 * CRE-005 AC2).
 *
 * Plain word matching, no AI call: a type's own name in the prompt scores
 * highest ("github", "slack", "google calendar"), then common words for what
 * it holds ("inbox" → gmail, "pull request" → github). Installed types win
 * ties. Nothing is picked for the user — these only become buttons.
 */

// Words that point at a type without naming it. Multi-word phrases match as
// a phrase. Keep these specific: a wrong guess costs a click, a noisy list
// costs trust.
const ALIASES = {
    gmail: ["email", "emails", "inbox", "mail", "unread"],
    "google-calendar": ["calendar", "meeting", "meetings", "agenda"],
    "google-drive": ["drive", "google docs", "google sheets", "spreadsheet"],
    github: [
        "pull request",
        "pull requests",
        "pr",
        "prs",
        "repo",
        "repos",
        "repository",
    ],
    slack: ["channel", "channels"],
    filesystem: ["folder", "folders", "directory", "local files"],
    notion: ["notion page", "notion pages"],
    algolia: ["search index", "index", "indices"],
    atlassian: ["jira", "confluence", "ticket", "tickets"],
    asana: ["task", "tasks"],
    fetch: ["url", "website", "web page", "webpage"],
    "web-fetch": ["url", "website", "web page", "webpage"],
    git: ["commit", "commits", "branch", "branches"],
};

// Server names that are ordinary words ("a clock that shows the time" isn't
// about the Time server). They're never guessed from the prompt; pick them
// from the full list.
const GENERIC_TYPES = new Set(["time", "memory", "everything"]);

const normalize = (text) =>
    ` ${String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()} `;

const hasPhrase = (haystack, phrase) =>
    haystack.includes(` ${normalize(phrase).trim()} `);

/**
 * @param {string} prompt
 * @param {Array<{type, providerClass, label?}>} typeOptions  the gate's list
 * @param {{ installedTypes?: Set<string>, limit?: number }} [opts]
 * @returns {Array<{type, providerClass, label?}>} best first, at most `limit`
 */
export function suggestProviderTypes(prompt, typeOptions = [], opts = {}) {
    const { installedTypes = new Set(), limit = 3 } = opts;
    const text = normalize(prompt);
    if (!text.trim()) return [];

    const scored = [];
    for (const opt of typeOptions || []) {
        if (!opt || !opt.type || GENERIC_TYPES.has(opt.type)) continue;
        let score = 0;
        // "google-calendar" matches "google calendar" and "google-calendar".
        if (hasPhrase(text, opt.type.replace(/-/g, " "))) score = 3;
        else if (opt.label && hasPhrase(text, opt.label)) score = 3;
        else if ((ALIASES[opt.type] || []).some((a) => hasPhrase(text, a))) {
            score = 2;
        }
        if (score === 0) continue;
        if (installedTypes.has(opt.type)) score += 0.5;
        scored.push({ opt, score });
    }
    scored.sort(
        (a, b) => b.score - a.score || a.opt.type.localeCompare(b.opt.type)
    );
    // One button per type, even if it's in the list under two classes.
    const seen = new Set();
    const out = [];
    for (const { opt } of scored) {
        if (seen.has(opt.type)) continue;
        seen.add(opt.type);
        out.push(opt);
        if (out.length >= limit) break;
    }
    return out;
}
