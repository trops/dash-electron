/**
 * Static well-known tools catalog for MCP servers.
 *
 * The MCP listTools bridge can only enumerate tools against a
 * RUNNING server — which requires a configured + started provider
 * instance + (for OAuth servers) completed auth. That means a fresh
 * Compose-mode user picking "Google Drive" before configuring
 * anything has no way to see what's available.
 *
 * This file is a hand-curated approximation of the tools each
 * well-known MCP server exposes. Sourced from the public schemas
 * at github.com/modelcontextprotocol/servers and the vendor
 * documentation for each. It is NOT authoritative — when the user
 * configures the provider, the real listTools bridge takes over
 * and supersedes whatever's listed here.
 *
 * Maintenance contract:
 *   - Coverage for the servers in @trops/dash-core's
 *     mcpServerCatalog.json. Missing servers fall through to the
 *     free-text "tool name" input — still functional.
 *   - Tool names match what the server actually exposes (test by
 *     configuring + listTools).
 *   - Descriptions are short — one line, plain English, what the
 *     tool does at a high level.
 *
 * The UI surfaces these with a "(approximate — configure {type}
 * for the exact list)" hint so users know it might drift.
 */

export const MCP_KNOWN_TOOLS = {
    "google-drive": [
        {
            name: "search",
            description: "Search Drive files by query string.",
        },
        {
            name: "list_files",
            description: "List files in Drive (paginated).",
        },
        {
            name: "get_file",
            description: "Read a file by ID — text content or download URL.",
        },
        {
            name: "create_file",
            description: "Create a new file in Drive.",
        },
        {
            name: "update_file",
            description: "Update an existing file's content or metadata.",
        },
        {
            name: "delete_file",
            description: "Permanently delete a file by ID.",
        },
    ],
    gmail: [
        {
            name: "list_messages",
            description: "List messages from the inbox or a specific label.",
        },
        {
            name: "search_messages",
            description: "Search messages by Gmail query syntax.",
        },
        {
            name: "get_message",
            description: "Get a single message's full contents by ID.",
        },
        {
            name: "send_message",
            description: "Compose and send a new email.",
        },
        {
            name: "list_labels",
            description: "List all Gmail labels in the account.",
        },
        {
            name: "modify_message",
            description: "Add or remove labels on a message.",
        },
    ],
    "google-calendar": [
        {
            name: "list_events",
            description: "List events on a calendar within a date range.",
        },
        {
            name: "get_event",
            description: "Read a single event by ID.",
        },
        {
            name: "create_event",
            description: "Create a new calendar event.",
        },
        {
            name: "update_event",
            description: "Modify an existing event.",
        },
        {
            name: "delete_event",
            description: "Cancel an event.",
        },
        {
            name: "list_calendars",
            description: "List calendars the user has access to.",
        },
    ],
    github: [
        {
            name: "search_repositories",
            description: "Search GitHub repos by query string.",
        },
        {
            name: "get_file_contents",
            description: "Read a file from a repo at a given path.",
        },
        {
            name: "create_issue",
            description: "Open a new issue on a repo.",
        },
        {
            name: "list_issues",
            description: "List issues on a repo with filters.",
        },
        {
            name: "create_pull_request",
            description: "Open a new pull request.",
        },
        {
            name: "list_pull_requests",
            description: "List PRs on a repo with filters.",
        },
        {
            name: "search_issues",
            description: "Search issues across GitHub.",
        },
    ],
    slack: [
        {
            name: "slack_list_channels",
            description: "List channels in the workspace.",
        },
        {
            name: "slack_post_message",
            description: "Send a message to a channel.",
        },
        {
            name: "slack_reply_to_thread",
            description: "Reply to a thread by parent message ts.",
        },
        {
            name: "slack_get_channel_history",
            description: "Read recent messages from a channel.",
        },
        {
            name: "slack_get_thread_replies",
            description: "Read the replies in a thread.",
        },
        {
            name: "slack_get_users",
            description: "List users in the workspace.",
        },
    ],
    notion: [
        {
            name: "search",
            description: "Search Notion pages and databases.",
        },
        {
            name: "get_page",
            description: "Read a page's properties and content blocks.",
        },
        {
            name: "create_page",
            description: "Create a new page in a database or as a child.",
        },
        {
            name: "update_page",
            description: "Update page properties.",
        },
        {
            name: "get_database",
            description: "Read a database's schema.",
        },
        {
            name: "query_database",
            description: "Query rows in a database with filters/sorts.",
        },
    ],
    filesystem: [
        {
            name: "read_file",
            description: "Read the contents of a file.",
        },
        {
            name: "write_file",
            description: "Write contents to a file (creates or overwrites).",
        },
        {
            name: "list_directory",
            description: "List entries in a directory.",
        },
        {
            name: "create_directory",
            description: "Make a new directory (recursive).",
        },
        {
            name: "delete_file",
            description: "Delete a file or empty directory.",
        },
        {
            name: "move_file",
            description: "Move or rename a file or directory.",
        },
        {
            name: "search_files",
            description: "Search for files matching a pattern.",
        },
    ],
    postgres: [
        {
            name: "query",
            description: "Execute a read-only SQL query and return rows.",
        },
    ],
    "brave-search": [
        {
            name: "brave_web_search",
            description: "Search the web via Brave.",
        },
        {
            name: "brave_local_search",
            description: "Search for local businesses and places.",
        },
    ],
    memory: [
        {
            name: "create_entities",
            description: "Add new entities to the knowledge graph.",
        },
        {
            name: "create_relations",
            description: "Connect entities with typed relations.",
        },
        {
            name: "add_observations",
            description: "Attach observations (facts) to entities.",
        },
        {
            name: "search_nodes",
            description: "Search the graph for matching entities.",
        },
        {
            name: "read_graph",
            description: "Read the full knowledge graph.",
        },
    ],
    linear: [
        {
            name: "list_issues",
            description: "List Linear issues with filters.",
        },
        {
            name: "get_issue",
            description: "Read a single issue by id.",
        },
        {
            name: "create_issue",
            description: "Create a new Linear issue.",
        },
        {
            name: "update_issue",
            description: "Modify an existing issue.",
        },
        {
            name: "list_projects",
            description: "List projects in the workspace.",
        },
        {
            name: "list_teams",
            description: "List teams in the workspace.",
        },
    ],
    gong: [
        {
            name: "list_calls",
            description: "List Gong calls in a date range.",
        },
        {
            name: "get_call_transcript",
            description: "Read the transcript for a call.",
        },
        {
            name: "search_calls",
            description: "Search calls by attendee, account, etc.",
        },
    ],
};

/**
 * Returns the known tools for a given MCP type id, or null if
 * we don't have a static list for it. Callers should fall through
 * to the free-text tool-name input when null.
 */
export function getKnownToolsForType(typeId) {
    if (typeof typeId !== "string") return null;
    const tools = MCP_KNOWN_TOOLS[typeId];
    return Array.isArray(tools) && tools.length > 0 ? tools : null;
}
