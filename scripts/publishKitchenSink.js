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
const { execSync } = require("child_process");

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
                    rows: 4,
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
                },
            },
            {
                id: 2,
                component: "ChatClaudeCodeWidget",
                type: "widget",
                parent: 1,
                order: 1,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 3,
                component: "NotepadWidget",
                type: "widget",
                parent: 1,
                order: 2,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 4,
                component: "ThemeViewerWidget",
                type: "widget",
                parent: 1,
                order: 3,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 5,
                component: "GitHubWidget",
                type: "widget",
                parent: 1,
                order: 4,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 6,
                component: "SlackWidget",
                type: "widget",
                parent: 1,
                order: 5,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 7,
                component: "GmailWidget",
                type: "widget",
                parent: 1,
                order: 6,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 8,
                component: "GoogleCalendarWidget",
                type: "widget",
                parent: 1,
                order: 7,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 9,
                component: "NotionWidget",
                type: "widget",
                parent: 1,
                order: 8,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 10,
                component: "FilesystemWidget",
                type: "widget",
                parent: 1,
                order: 9,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
            },
            {
                id: 11,
                component: "EventSenderWidget",
                type: "widget",
                parent: 1,
                order: 10,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                listeners: {
                    customEvent: ["EventSenderWidget[11].customEvent"],
                },
            },
            {
                id: 12,
                component: "EventReceiverWidget",
                type: "widget",
                parent: 1,
                order: 11,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
                listeners: {
                    customEvent: ["EventSenderWidget[11].customEvent"],
                },
            },
            {
                id: 13,
                component: "NotificationWidget",
                type: "widget",
                parent: 1,
                order: 12,
                hasChildren: 0,
                scrollable: true,
                workspace: "layout",
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
            usedBy: ["GitHubWidget"],
        },
        {
            type: "slack",
            providerClass: "mcp",
            required: false,
            usedBy: ["SlackWidget"],
        },
        {
            type: "gmail",
            providerClass: "mcp",
            required: false,
            usedBy: ["GmailWidget"],
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

// ── Auth helpers (copied from publishToRegistry.js) ──────────────────

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authenticate() {
    console.log("\nAuthenticating with the registry...");

    const initRes = await fetch(`${REGISTRY_BASE_URL}/api/auth/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });

    if (!initRes.ok) {
        console.error(
            `Error: Device flow initiation failed (HTTP ${initRes.status})`
        );
        process.exit(1);
    }

    const initData = await initRes.json();
    const { device_code, user_code, verification_uri_complete, interval } =
        initData;

    console.log(`\nOpening browser for authentication...`);
    console.log(`Code: ${user_code}`);
    console.log(`URL:  ${verification_uri_complete}\n`);

    try {
        execSync(`open "${verification_uri_complete}"`, { stdio: "ignore" });
    } catch {
        console.log(
            "Could not open browser automatically. Please visit the URL above."
        );
    }

    console.log("Waiting for authorization...");
    const maxAttempts = Math.ceil(900 / (interval || 5));
    const pollInterval = (interval || 5) * 1000;

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(pollInterval);

        const pollRes = await fetch(
            `${REGISTRY_BASE_URL}/api/auth/device?device_code=${encodeURIComponent(
                device_code
            )}`
        );

        if (pollRes.ok) {
            const data = await pollRes.json();
            console.log("Authorized!\n");
            return data.access_token;
        }

        if (pollRes.status === 428) continue;

        if (pollRes.status === 400) {
            const data = await pollRes.json();
            if (data.error === "expired_token") {
                console.error("Error: Device code expired. Please try again.");
                process.exit(1);
            }
            continue;
        }

        console.error(
            `Error: Unexpected poll response (HTTP ${pollRes.status})`
        );
        process.exit(1);
    }

    console.error("Error: Authorization timed out.");
    process.exit(1);
}

async function getScope(token) {
    const res = await fetch(`${REGISTRY_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        console.error(
            `Error: Could not fetch user profile (HTTP ${res.status})`
        );
        process.exit(1);
    }
    const data = await res.json();
    return data.user.username;
}

async function getFormDataImpl() {
    if (
        typeof globalThis.FormData !== "undefined" &&
        typeof globalThis.File !== "undefined"
    ) {
        return { FormData: globalThis.FormData, File: globalThis.File };
    }
    const undici = await import("undici");
    return { FormData: undici.FormData, File: undici.File };
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
    const token = await authenticate();
    const authScope = await getScope(token);
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
    const zipBuffer = fs.readFileSync(zipPath);
    const { FormData, File } = await getFormDataImpl();
    const form = new FormData();
    form.append(
        "file",
        new File([zipBuffer], "dashboard-kitchen-sink-v1.0.0.zip", {
            type: "application/zip",
        })
    );
    form.append("manifest", JSON.stringify(finalManifest));

    console.log("Publishing to registry...");
    const res = await fetch(`${REGISTRY_BASE_URL}/api/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(`Publish failed: ${data.error || `HTTP ${res.status}`}`);
        if (data.details) {
            data.details.forEach((d) => console.error(`  - ${d}`));
        }
        process.exit(1);
    }

    console.log(`\nPublished Kitchen Sink dashboard!`);
    console.log(`Registry: ${data.registryUrl}`);
    console.log(`Version: ${data.version}`);

    // Clean up ZIP
    fs.unlinkSync(zipPath);
    console.log("Cleaned up ZIP file.");
    console.log("\nDone!");
}

main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
