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
            args: ["query", "pageSize", "pageToken"],
        },
        {
            name: "list_files",
            description: "List files in Drive (paginated).",
            args: ["pageSize", "pageToken"],
        },
        {
            name: "get_file",
            description: "Read a file by ID — text content or download URL.",
            args: ["fileId"],
        },
        {
            name: "create_file",
            description: "Create a new file in Drive.",
            args: ["name", "mimeType", "content"],
        },
        {
            name: "update_file",
            description: "Update an existing file's content or metadata.",
            args: ["fileId", "content"],
        },
        {
            name: "delete_file",
            description: "Permanently delete a file by ID.",
            args: ["fileId"],
        },
    ],
    gmail: [
        {
            name: "list_messages",
            description: "List messages from the inbox or a specific label.",
            args: ["labelIds", "maxResults", "pageToken"],
        },
        {
            name: "search_messages",
            description: "Search messages by Gmail query syntax.",
            args: ["query", "maxResults"],
        },
        {
            name: "get_message",
            description: "Get a single message's full contents by ID.",
            args: ["messageId"],
        },
        {
            name: "send_message",
            description: "Compose and send a new email.",
            args: ["to", "subject", "body"],
        },
        {
            name: "list_labels",
            description: "List all Gmail labels in the account.",
            args: [],
        },
        {
            name: "modify_message",
            description: "Add or remove labels on a message.",
            args: ["messageId", "addLabelIds", "removeLabelIds"],
        },
    ],
    "google-calendar": [
        {
            name: "list_events",
            description: "List events on a calendar within a date range.",
            args: ["calendarId", "timeMin", "timeMax", "maxResults"],
        },
        {
            name: "get_event",
            description: "Read a single event by ID.",
            args: ["calendarId", "eventId"],
        },
        {
            name: "create_event",
            description: "Create a new calendar event.",
            args: ["calendarId", "summary", "start", "end", "description"],
        },
        {
            name: "update_event",
            description: "Modify an existing event.",
            args: ["calendarId", "eventId", "summary", "start", "end"],
        },
        {
            name: "delete_event",
            description: "Cancel an event.",
            args: ["calendarId", "eventId"],
        },
        {
            name: "list_calendars",
            description: "List calendars the user has access to.",
            args: [],
        },
    ],
    github: [
        {
            name: "search_repositories",
            description: "Search GitHub repos by query string.",
            args: ["query", "perPage", "page"],
        },
        {
            name: "get_file_contents",
            description: "Read a file from a repo at a given path.",
            args: ["owner", "repo", "path", "ref"],
        },
        {
            name: "create_issue",
            description: "Open a new issue on a repo.",
            args: ["owner", "repo", "title", "body", "labels"],
        },
        {
            name: "list_issues",
            description: "List issues on a repo with filters.",
            args: ["owner", "repo", "state", "labels", "perPage"],
        },
        {
            name: "create_pull_request",
            description: "Open a new pull request.",
            args: ["owner", "repo", "title", "head", "base", "body"],
        },
        {
            name: "list_pull_requests",
            description: "List PRs on a repo with filters.",
            args: ["owner", "repo", "state", "perPage"],
        },
        {
            name: "search_issues",
            description: "Search issues across GitHub.",
            args: ["query", "perPage"],
        },
    ],
    slack: [
        {
            name: "slack_list_channels",
            description: "List channels in the workspace.",
            args: ["limit", "cursor"],
        },
        {
            name: "slack_post_message",
            description: "Send a message to a channel.",
            args: ["channel_id", "text"],
        },
        {
            name: "slack_reply_to_thread",
            description: "Reply to a thread by parent message ts.",
            args: ["channel_id", "thread_ts", "text"],
        },
        {
            name: "slack_get_channel_history",
            description: "Read recent messages from a channel.",
            args: ["channel_id", "limit"],
        },
        {
            name: "slack_get_thread_replies",
            description: "Read the replies in a thread.",
            args: ["channel_id", "thread_ts"],
        },
        {
            name: "slack_get_users",
            description: "List users in the workspace.",
            args: ["limit", "cursor"],
        },
    ],
    notion: [
        {
            name: "search",
            description: "Search Notion pages and databases.",
            args: ["query", "filter"],
        },
        {
            name: "get_page",
            description: "Read a page's properties and content blocks.",
            args: ["pageId"],
        },
        {
            name: "create_page",
            description: "Create a new page in a database or as a child.",
            args: ["parent", "properties", "children"],
        },
        {
            name: "update_page",
            description: "Update page properties.",
            args: ["pageId", "properties"],
        },
        {
            name: "get_database",
            description: "Read a database's schema.",
            args: ["databaseId"],
        },
        {
            name: "query_database",
            description: "Query rows in a database with filters/sorts.",
            args: ["databaseId", "filter", "sorts"],
        },
    ],
    filesystem: [
        {
            name: "read_file",
            description: "Read the contents of a file.",
            args: ["path"],
        },
        {
            name: "write_file",
            description: "Write contents to a file (creates or overwrites).",
            args: ["path", "content"],
        },
        {
            name: "list_directory",
            description: "List entries in a directory.",
            args: ["path"],
        },
        {
            name: "create_directory",
            description: "Make a new directory (recursive).",
            args: ["path"],
        },
        {
            name: "delete_file",
            description: "Delete a file or empty directory.",
            args: ["path"],
        },
        {
            name: "move_file",
            description: "Move or rename a file or directory.",
            args: ["source", "destination"],
        },
        {
            name: "search_files",
            description: "Search for files matching a pattern.",
            args: ["path", "pattern"],
        },
    ],
    postgres: [
        {
            name: "query",
            description: "Execute a read-only SQL query and return rows.",
            args: ["sql"],
        },
    ],
    "brave-search": [
        {
            name: "brave_web_search",
            description: "Search the web via Brave.",
            args: ["query", "count"],
        },
        {
            name: "brave_local_search",
            description: "Search for local businesses and places.",
            args: ["query", "count"],
        },
    ],
    memory: [
        {
            name: "create_entities",
            description: "Add new entities to the knowledge graph.",
            args: ["entities"],
        },
        {
            name: "create_relations",
            description: "Connect entities with typed relations.",
            args: ["relations"],
        },
        {
            name: "add_observations",
            description: "Attach observations (facts) to entities.",
            args: ["observations"],
        },
        {
            name: "search_nodes",
            description: "Search the graph for matching entities.",
            args: ["query"],
        },
        {
            name: "read_graph",
            description: "Read the full knowledge graph.",
            args: [],
        },
    ],
    linear: [
        {
            name: "list_issues",
            description: "List Linear issues with filters.",
            args: ["teamId", "assigneeId", "state"],
        },
        {
            name: "get_issue",
            description: "Read a single issue by id.",
            args: ["issueId"],
        },
        {
            name: "create_issue",
            description: "Create a new Linear issue.",
            args: ["teamId", "title", "description"],
        },
        {
            name: "update_issue",
            description: "Modify an existing issue.",
            args: ["issueId", "title", "description", "stateId"],
        },
        {
            name: "list_projects",
            description: "List projects in the workspace.",
            args: [],
        },
        {
            name: "list_teams",
            description: "List teams in the workspace.",
            args: [],
        },
    ],
    gong: [
        {
            name: "list_calls",
            description: "List Gong calls in a date range.",
            args: ["fromDateTime", "toDateTime"],
        },
        {
            name: "get_call_transcript",
            description: "Read the transcript for a call.",
            args: ["callId"],
        },
        {
            name: "search_calls",
            description: "Search calls by attendee, account, etc.",
            args: ["query"],
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

/**
 * Returns the known arg names for a given (typeId, toolName), or
 * null if no static catalog entry exists. The arg-row inspector
 * uses this to surface bindable args for MCP wires — without it
 * the user only sees args they've already bound (chicken-and-egg).
 */
export function getKnownToolArgs(typeId, toolName) {
    if (typeof typeId !== "string" || typeof toolName !== "string") return null;
    const tools = MCP_KNOWN_TOOLS[typeId];
    if (!Array.isArray(tools)) return null;
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) return null;
    return Array.isArray(tool.args) ? tool.args : null;
}
