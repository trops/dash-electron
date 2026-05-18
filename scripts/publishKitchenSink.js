#!/usr/bin/env node

/**
 * publishKitchenSink.js
 *
 * Creates and publishes the Kitchen Sink prebuilt dashboard to the registry.
 * This is a one-off script for initial publishing.
 *
 * Usage:
 *   node scripts/publishKitchenSink.js              # Publish
 *   node scripts/publishKitchenSink.js --dry-run     # Preview only
 */

const fs = require("fs");
const path = require("path");
const { authenticate, getScope, publishToApi } = require("./lib/registryAuth");

const ROOT = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env") });

const REGISTRY_BASE_URL =
    process.env.DASH_REGISTRY_API_URL ||
    "https://main.d919rwhuzp7rj.amplifyapp.com";

const isDryRun = process.argv.includes("--dry-run");

// ── Kitchen Sink Dashboard Config ────────────────────────────────────

const dashboardConfig = {
    schemaVersion: "1.0.0",
    name: "Kitchen Sink",
    description:
        "A showcase dashboard with all available widgets — chat, productivity, dev tools, events, and samples.",
    author: { name: "John P. Giatropoulos", id: "trops" },
    shareable: true,
    tags: ["showcase", "demo", "samples"],
    icon: "grip",
    workspace: {
        id: 1,
        name: "Kitchen Sink",
        type: "workspace",
        label: "Kitchen Sink",
        version: 1,
        layout: [
            {
                id: 1,
                order: 1,
                component: "LayoutGridContainer",
                type: "grid",
                hasChildren: 1,
                scrollable: false,
                parent: 0,
                menuId: 1,
                workspace: "layout",
                width: "w-full",
                height: "h-full",
                grid: {
                    rows: 6,
                    cols: 3,
                    gap: "gap-2",
                    1.1: { component: 2, hide: false },
                    1.2: { component: 3, hide: false },
                    1.3: { component: 4, hide: false },
                    2.1: { component: 5, hide: false },
                    2.2: { component: 6, hide: false },
                    2.3: { component: 7, hide: false },
                    3.1: { component: 8, hide: false },
                    3.2: { component: 9, hide: false },
                    3.3: { component: 10, hide: false },
                    4.1: { component: 11, hide: false },
                    4.2: { component: 12, hide: false },
                    4.3: { component: 13, hide: false },
                    // Phase B widgets — one row per PR cluster. Row 5
                    // is the Slack pair (channels list ↔ messages, via
                    // channelSelected) plus the Algolia rules list.
                    // Row 6 starts with GitHubPRList in standalone mode.
                    5.1: { component: 14, hide: false }, // SlackListChannels
                    5.2: { component: 15, hide: false }, // SlackChannelMessages
                    5.3: { component: 16, hide: false }, // AlgoliaRulesList
                    6.1: { component: 17, hide: false }, // GitHubPRList (configRepo)
                    6.2: { component: 18, hide: false }, // GmailUnreadCount (stat)
                    6.3: { component: 19, hide: false }, // GoogleDriveRecentFiles
                },
            },
            {
                id: 2,
                component: "trops.chat.ChatClaudeCodeWidget",
                type: "widget",
                parent: 1,
                order: 1,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 3,
                component: "trops.dash-samples.NotepadWidget",
                type: "widget",
                parent: 1,
                order: 2,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 4,
                component: "trops.dash-samples.ThemeViewerWidget",
                type: "widget",
                parent: 1,
                order: 3,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 5,
                component: "trops.git-hub.GitHubWidget",
                type: "widget",
                parent: 1,
                order: 4,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 6,
                component: "trops.slack.SlackWidget",
                type: "widget",
                parent: 1,
                order: 5,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 7,
                component: "trops.gmail.GmailWidget",
                type: "widget",
                parent: 1,
                order: 6,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 8,
                component: "trops.google-calendar.GoogleCalendarWidget",
                type: "widget",
                parent: 1,
                order: 7,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 9,
                component: "trops.notion.NotionWidget",
                type: "widget",
                parent: 1,
                order: 8,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 10,
                component: "trops.filesystem.FilesystemWidget",
                type: "widget",
                parent: 1,
                order: 9,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 11,
                component: "trops.dash-samples.EventSenderWidget",
                type: "widget",
                parent: 1,
                order: 10,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                listeners: {
                    customEvent: [
                        "trops.dash-samples.EventSenderWidget[11].customEvent",
                    ],
                },
            },
            {
                id: 12,
                component: "trops.dash-samples.EventReceiverWidget",
                type: "widget",
                parent: 1,
                order: 11,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                listeners: {
                    customEvent: [
                        "trops.dash-samples.EventSenderWidget[11].customEvent",
                    ],
                },
            },
            {
                id: 13,
                component: "trops.dash-samples.NotificationWidget",
                type: "widget",
                parent: 1,
                order: 12,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 14,
                component: "trops.slack.SlackListChannels",
                type: "widget",
                parent: 1,
                order: 13,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 15,
                component: "trops.slack.SlackChannelMessages",
                type: "widget",
                parent: 1,
                order: 14,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                // Listens for channelSelected published by widget id 14
                // (SlackListChannels). The cross-widget event flow is
                // resolved at runtime by useWidgetEvents — this
                // listener entry is just declarative documentation
                // matching the existing EventSender/Receiver pattern.
                listeners: {
                    channelSelected: [
                        "trops.slack.SlackListChannels[14].channelSelected",
                    ],
                },
            },
            {
                id: 16,
                component: "trops.algolia.AlgoliaRulesList",
                type: "widget",
                parent: 1,
                order: 15,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                // Demonstrates the credential-provider pattern
                // (window.mainApi.algolia.searchRules via the
                // providerHash triplet). Set indexName in widget
                // settings, or pair with a widget that publishes
                // indexSelected (e.g. AlgoliaIndexDashboardWidget).
            },
            {
                id: 17,
                component: "trops.git-hub.GitHubPRList",
                type: "widget",
                parent: 1,
                order: 16,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                // Standalone mode: set the Repository in widget
                // settings (e.g. "trops/dash-electron") to see open
                // PRs without needing a paired GitHubRepoList. Also
                // accepts repoSelected events as before.
            },
            {
                id: 18,
                component: "trops.gmail.GmailUnreadCount",
                type: "widget",
                parent: 1,
                order: 17,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                // Stat widget — single big number for unread-email
                // count. Auto-refreshes every 60s by default; publishes
                // unreadCountUpdated so notification widgets can react.
            },
            {
                id: 19,
                component: "trops.google-drive.GoogleDriveRecentFiles",
                type: "widget",
                parent: 1,
                order: 18,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                // Top N most-recently modified files; auto-refreshes
                // every 5 minutes by default. Click opens the file
                // in the browser AND publishes fileSelected.
            },
        ],
        menuId: 1,
    },
    widgets: [
        {
            id: "trops.chat.ChatClaudeCodeWidget",
            scope: "trops",
            packageName: "chat",
            widgetName: "ChatClaudeCodeWidget",
            package: "chat",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.dash-samples.NotepadWidget",
            scope: "trops",
            packageName: "dash-samples",
            widgetName: "NotepadWidget",
            package: "dash-samples",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.dash-samples.ThemeViewerWidget",
            scope: "trops",
            packageName: "dash-samples",
            widgetName: "ThemeViewerWidget",
            package: "dash-samples",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.git-hub.GitHubWidget",
            scope: "trops",
            packageName: "git-hub",
            widgetName: "GitHubWidget",
            package: "git-hub",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.slack.SlackWidget",
            scope: "trops",
            packageName: "slack",
            widgetName: "SlackWidget",
            package: "slack",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.slack.SlackListChannels",
            scope: "trops",
            packageName: "slack",
            widgetName: "SlackListChannels",
            package: "slack",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.slack.SlackChannelMessages",
            scope: "trops",
            packageName: "slack",
            widgetName: "SlackChannelMessages",
            package: "slack",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.algolia.AlgoliaRulesList",
            scope: "trops",
            packageName: "algolia",
            widgetName: "AlgoliaRulesList",
            package: "algolia",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.git-hub.GitHubPRList",
            scope: "trops",
            packageName: "git-hub",
            widgetName: "GitHubPRList",
            package: "git-hub",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.gmail.GmailUnreadCount",
            scope: "trops",
            packageName: "gmail",
            widgetName: "GmailUnreadCount",
            package: "gmail",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.google-drive.GoogleDriveRecentFiles",
            scope: "trops",
            packageName: "google-drive",
            widgetName: "GoogleDriveRecentFiles",
            package: "google-drive",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.gmail.GmailWidget",
            scope: "trops",
            packageName: "gmail",
            widgetName: "GmailWidget",
            package: "gmail",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.google-calendar.GoogleCalendarWidget",
            scope: "trops",
            packageName: "google-calendar",
            widgetName: "GoogleCalendarWidget",
            package: "google-calendar",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.notion.NotionWidget",
            scope: "trops",
            packageName: "notion",
            widgetName: "NotionWidget",
            package: "notion",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.filesystem.FilesystemWidget",
            scope: "trops",
            packageName: "filesystem",
            widgetName: "FilesystemWidget",
            package: "filesystem",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.dash-samples.EventSenderWidget",
            scope: "trops",
            packageName: "dash-samples",
            widgetName: "EventSenderWidget",
            package: "dash-samples",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.dash-samples.EventReceiverWidget",
            scope: "trops",
            packageName: "dash-samples",
            widgetName: "EventReceiverWidget",
            package: "dash-samples",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
        {
            id: "trops.dash-samples.NotificationWidget",
            scope: "trops",
            packageName: "dash-samples",
            widgetName: "NotificationWidget",
            package: "dash-samples",
            version: "*",
            required: true,
            author: "John P. Giatropoulos",
        },
    ],
    providers: [
        {
            type: "github",
            providerClass: "mcp",
            required: false,
            usedBy: ["GitHubWidget", "GitHubPRList"],
        },
        {
            type: "slack",
            providerClass: "mcp",
            required: false,
            usedBy: [
                "SlackWidget",
                "SlackListChannels",
                "SlackChannelMessages",
            ],
        },
        {
            type: "gmail",
            providerClass: "mcp",
            required: false,
            usedBy: ["GmailWidget", "GmailUnreadCount"],
        },
        {
            type: "google-calendar",
            providerClass: "mcp",
            required: false,
            usedBy: ["GoogleCalendarWidget"],
        },
        {
            type: "notion",
            providerClass: "mcp",
            required: false,
            usedBy: ["NotionWidget"],
        },
        {
            type: "filesystem",
            providerClass: "mcp",
            required: false,
            usedBy: ["FilesystemWidget"],
        },
        {
            type: "google-drive",
            providerClass: "mcp",
            required: false,
            usedBy: ["GoogleDriveRecentFiles"],
        },
        {
            type: "algolia",
            providerClass: "credential",
            required: false,
            usedBy: ["AlgoliaRulesList"],
        },
    ],
    eventWiring: [
        {
            source: { widget: "EventSenderWidget", event: "customEvent" },
            target: { widget: "EventReceiverWidget", handler: "customEvent" },
        },
    ],
};

// ── Registry manifest ────────────────────────────────────────────────

function buildManifest(scope) {
    return {
        githubUser: scope,
        scope: scope,
        name: "kitchen-sink",
        displayName: "Kitchen Sink",
        author: "John P. Giatropoulos",
        description:
            "A showcase dashboard with all available widgets — chat, productivity, dev tools, events, and samples.",
        version: "1.0.0",
        type: "dashboard",
        category: "general",
        tags: ["showcase", "demo", "samples"],
        icon: "grip",
        downloadUrl: `${REGISTRY_BASE_URL}/api/packages/${scope}/kitchen-sink/download?version={version}`,
        repository: "https://github.com/trops/dash-electron",
        publishedAt: new Date().toISOString(),
        appOrigin: "@trops/dash-electron",
        widgets: dashboardConfig.widgets.map((w) => ({
            id: w.id,
            scope: w.scope,
            packageName: w.packageName,
            widgetName: w.widgetName,
            name: w.widgetName,
            package: w.package,
            version: w.version,
            required: w.required,
            author: w.author,
        })),
        providers: dashboardConfig.providers,
        eventWiring: dashboardConfig.eventWiring,
    };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    const scope = "trops";
    const manifest = buildManifest(scope);

    console.log("── Kitchen Sink Dashboard ──");
    console.log(JSON.stringify(manifest, null, 2));
    console.log(
        `\nWidgets: ${manifest.widgets.map((w) => w.widgetName).join(", ")}`
    );

    if (isDryRun) {
        console.log(
            "\n[Dry run] Dashboard would be published. No changes made."
        );
        return;
    }

    // Authenticate
    const token = await authenticate(REGISTRY_BASE_URL);
    const authScope = await getScope(REGISTRY_BASE_URL, token);
    console.log(`Authenticated as: ${authScope}`);

    // Rebuild manifest with real scope
    const finalManifest = buildManifest(authScope);

    // Create ZIP with dashboard config + manifest
    const AdmZip = require("adm-zip");
    const zip = new AdmZip();

    zip.addFile(
        "kitchen-sink.dashboard.json",
        Buffer.from(JSON.stringify(dashboardConfig, null, 2), "utf-8")
    );
    zip.addFile(
        "manifest.json",
        Buffer.from(JSON.stringify(finalManifest, null, 2), "utf-8")
    );

    const zipPath = path.join(ROOT, "dashboard-kitchen-sink-v1.0.0.zip");
    zip.writeZip(zipPath);
    console.log(`\nCreated ZIP: ${zipPath}`);

    // Publish to registry
    console.log("Publishing to registry...");
    const result = await publishToApi(
        REGISTRY_BASE_URL,
        token,
        finalManifest,
        zipPath
    );

    if (!result.success) {
        console.error(`Publish failed: ${result.error}`);
        if (result.details) {
            result.details.forEach((d) => console.error(`  - ${d}`));
        }
        process.exit(1);
    }

    console.log(`\nPublished Kitchen Sink dashboard!`);
    console.log(`Registry: ${result.registryUrl}`);
    console.log(`Version: ${result.version}`);

    // Clean up ZIP
    fs.unlinkSync(zipPath);
    console.log("Cleaned up ZIP file.");
    console.log("\nDone!");
}

main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
