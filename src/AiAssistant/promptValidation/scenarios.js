/**
 * promptValidation/scenarios — the canonical 10 user-prompt scenarios
 * the runner drives Claude through, one-shot per scenario, to validate
 * that the system prompt produces good widgets without iteration.
 *
 * Each scenario captures the inputs the Widget Builder modal would
 * hand to `buildSystemPrompt` plus the user's first chat message.
 * The runner script (`scripts/run-prompt-validation.js`) spawns the
 * Claude CLI with these inputs the same way `cliController.js` does
 * for the live app, persists the raw response under
 * `test/fixtures/widgets/@ai-built/prompt-validation/widgets/`, and
 * scores the result via AcceptanceScorecard.
 *
 * One-shot only: the runner does NOT send follow-ups. We're measuring
 * the very first response so the test surfaces what the AI does when
 * it has no chance to course-correct. If the first response is a
 * clarifying question (per buildSystemPrompt's first-response style),
 * that's the data — capture it and surface it.
 *
 * Selection criteria — these 10 mirror what a real user would type
 * in the Build tab, covering: MCP providers (Slack/GitHub/Gmail/
 * Notion/GoogleDrive/GoogleCalendar/Filesystem), credential providers
 * (Algolia), and no-provider widgets (counter, notepad).
 *
 * No iteration. No "Ask AI to fix it". The fixtures the runner writes
 * are the AI's initial output, period — that's what the user reviews.
 */

const SCENARIOS = [
    {
        id: "01-slack-channels",
        userPrompt:
            "Build me a Slack channel browser. List channels, click to select, refresh button.",
        selectedProvider: { type: "slack", providerClass: "mcp" },
        installedProviders: {
            slack: { name: "Slack", type: "slack", providerClass: "mcp" },
        },
    },
    {
        id: "02-github-prs",
        userPrompt:
            "I want to see open pull requests in trops/dash-electron with their state.",
        selectedProvider: { type: "github", providerClass: "mcp" },
        installedProviders: {
            github: { name: "GitHub", type: "github", providerClass: "mcp" },
        },
    },
    {
        id: "03-gmail-unread-stat",
        userPrompt:
            "Show my unread email count as one big number, refresh every minute.",
        selectedProvider: { type: "gmail", providerClass: "mcp" },
        installedProviders: {
            gmail: { name: "Gmail", type: "gmail", providerClass: "mcp" },
        },
    },
    {
        id: "04-notion-search",
        userPrompt: "Search Notion pages by title, show matching results.",
        selectedProvider: { type: "notion", providerClass: "mcp" },
        installedProviders: {
            notion: { name: "Notion", type: "notion", providerClass: "mcp" },
        },
    },
    {
        id: "05-gdrive-recent",
        userPrompt: "List my recently modified Google Drive files.",
        selectedProvider: { type: "google-drive", providerClass: "mcp" },
        installedProviders: {
            "google-drive": {
                name: "Google Drive",
                type: "google-drive",
                providerClass: "mcp",
            },
        },
    },
    {
        id: "06-gcal-today",
        userPrompt: "Show my next 5 calendar events for today.",
        selectedProvider: { type: "google-calendar", providerClass: "mcp" },
        installedProviders: {
            "google-calendar": {
                name: "Google Calendar",
                type: "google-calendar",
                providerClass: "mcp",
            },
        },
    },
    {
        id: "07-algolia-rules",
        userPrompt:
            "List rules for an Algolia index with their on/off state, search to filter.",
        selectedProvider: { type: "algolia", providerClass: "credential" },
        installedProviders: {
            algolia: {
                name: "Algolia",
                type: "algolia",
                providerClass: "credential",
            },
        },
    },
    {
        id: "08-filesystem-dir",
        userPrompt:
            "Show files in a directory I configure, click to publish fileSelected.",
        selectedProvider: { type: "filesystem", providerClass: "mcp" },
        installedProviders: {
            filesystem: {
                name: "Filesystem",
                type: "filesystem",
                providerClass: "mcp",
            },
        },
    },
    {
        id: "09-counter-noprovider",
        userPrompt:
            "A counter with + and - buttons and a reset. No data source.",
        selectedProvider: { sentinel: "none" },
        installedProviders: {},
    },
    {
        id: "10-notepad-noprovider",
        userPrompt: "A notepad — text area that auto-saves to userPrefs.",
        selectedProvider: { sentinel: "none" },
        installedProviders: {},
    },
];

module.exports = { SCENARIOS };
