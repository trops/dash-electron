#!/usr/bin/env node
/**
 * install-slack-pack — compile + register the @ai-built/slack-pack
 * widget package and install its bundled "Slack Pack" workspace.
 *
 * The pack source lives in the runtime widget cache at
 *   ~/Library/Application Support/Dash/widgets/@ai-built/slack-pack/
 * (where the AI Widget Builder also installs widgets). This script:
 *
 *   1. Compiles the 11 widget components into dist/index.cjs.js via
 *      dash-core's widgetCompiler.
 *   2. Updates the global registry.json so the running Dash app
 *      discovers the new components.
 *   3. Expands dashboards/slack-replacement.json into a full workspace
 *      and writes it to workspaces.json, auto-linking each widget's
 *      `selectedProviders.slack` to the user's configured Slack MCP
 *      provider (if any).
 *
 * Idempotent: re-runs replace the prior install of @ai-built/slack-pack
 * and the "Slack Pack" workspace entry (matched by id).
 *
 * After running, quit + reopen Dash (or `npm run dev` from scratch) to
 * pick up the new bundle.
 *
 * Usage:
 *   node scripts/install-slack-pack.js
 *   node scripts/install-slack-pack.js --dry-run
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PRODUCT_NAME = "Dash";
const USER_DATA_DIR = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    PRODUCT_NAME
);
const PACKAGE_NAME = "@ai-built/slack-pack";
const PACKAGE_INSTALL_DIR = path.join(
    USER_DATA_DIR,
    "widgets",
    "@ai-built",
    "slack-pack"
);
const REGISTRY_FILE = path.join(USER_DATA_DIR, "widgets", "registry.json");
const WORKSPACES_FILE = path.join(
    USER_DATA_DIR,
    "Dashboard",
    "@trops",
    "dash-electron",
    "workspaces.json"
);
const PROVIDERS_FILE = path.join(
    USER_DATA_DIR,
    "Dashboard",
    "@trops",
    "dash-electron",
    "providers.json"
);
const DASHBOARD_TEMPLATE = path.join(
    PACKAGE_INSTALL_DIR,
    "dashboards",
    "slack-replacement.json"
);

// Stable id so re-runs replace the same workspace entry rather than
// stacking duplicates. 9000000000002 sits next to the prompt-validation
// workspace (...0001) without colliding with any user-created id.
const WORKSPACE_ID = 9000000000002;

const isDryRun = process.argv.includes("--dry-run");

function log(...args) {
    console.log("[install-slack-pack]", ...args);
}

function readWidgetNames() {
    const widgetsDir = path.join(PACKAGE_INSTALL_DIR, "widgets");
    if (!fs.existsSync(widgetsDir)) {
        throw new Error(`Pack widgets dir missing: ${widgetsDir}`);
    }
    return fs
        .readdirSync(widgetsDir)
        .filter((f) => f.endsWith(".dash.js"))
        .map((f) => f.replace(/\.dash\.js$/, ""));
}

async function compilePackage() {
    if (isDryRun) {
        log("[dry-run] would compile pack via dash-core widgetCompiler");
        return;
    }
    const widgetCompiler = require(path.join(
        PROJECT_ROOT,
        "node_modules",
        "@trops",
        "dash-core",
        "electron",
        "widgetCompiler.js"
    ));
    await widgetCompiler.compileWidget(PACKAGE_INSTALL_DIR);
    log("Compiled pack bundle (dist/index.cjs.js)");
}

function updateRegistry(widgetNames) {
    if (isDryRun) {
        log(
            `[dry-run] would register ${widgetNames.length} component(s) under ${PACKAGE_NAME}`
        );
        return;
    }

    let registry = { lastUpdated: null, widgets: [] };
    if (fs.existsSync(REGISTRY_FILE)) {
        try {
            registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
        } catch (err) {
            log("Existing registry.json is malformed; rewriting from scratch.");
        }
    }

    // Drop any prior entry for this package; preserve everything else.
    const widgets = (registry.widgets || []).filter(
        ([name]) => name !== PACKAGE_NAME
    );

    widgets.push([
        PACKAGE_NAME,
        {
            name: PACKAGE_NAME,
            scope: "ai-built",
            packageId: PACKAGE_NAME,
            path: PACKAGE_INSTALL_DIR,
            registeredAt: new Date().toISOString(),
            version: "0.1.0",
            description:
                "Coordinated Slack widgets — channel list, messages, threads, compose, reactions, search, unreads, users. Built against slack-mcp-server (korotovsky).",
            displayName: "Slack Pack",
            componentNames: widgetNames,
            workspace: "ai-built",
        },
    ]);

    fs.writeFileSync(
        REGISTRY_FILE,
        JSON.stringify(
            { lastUpdated: new Date().toISOString(), widgets },
            null,
            2
        )
    );
    log(`Registered ${widgetNames.length} component(s) in ${REGISTRY_FILE}`);
}

/**
 * Read providers.json and return the name of the first Slack MCP
 * provider, or null. The user almost certainly has a single Slack MCP
 * provider configured (the one they set up earlier in this session);
 * if they have multiple, we pick the first to keep the auto-link
 * deterministic across re-runs.
 */
function findSlackMcpProviderName() {
    if (!fs.existsSync(PROVIDERS_FILE)) return null;
    let providers;
    try {
        providers = JSON.parse(fs.readFileSync(PROVIDERS_FILE, "utf8"));
    } catch (err) {
        log(`providers.json unreadable (${err.message}); skipping auto-link.`);
        return null;
    }
    for (const [name, info] of Object.entries(providers || {})) {
        if (info?.type === "slack" && info?.providerClass === "mcp") {
            return name;
        }
    }
    return null;
}

function buildWorkspace(widgetNames) {
    if (!fs.existsSync(DASHBOARD_TEMPLATE)) {
        throw new Error(
            `Dashboard template missing: ${DASHBOARD_TEMPLATE}. ` +
                "The pack's dashboards/slack-replacement.json must exist before this script runs."
        );
    }
    const template = JSON.parse(fs.readFileSync(DASHBOARD_TEMPLATE, "utf8"));
    const slackProviderName = findSlackMcpProviderName();
    if (slackProviderName) {
        log(`Auto-linking Slack provider: "${slackProviderName}"`);
    } else {
        log(
            "No Slack MCP provider configured — widgets will show 'not connected' state until one is added in Settings."
        );
    }

    const componentToId = new Map();
    template.widgets.forEach((w, idx) => {
        componentToId.set(w.component, idx + 2);
    });

    // Sanity check: every component referenced in the template must
    // also exist as a built widget. Catches typos in the template.
    const missingComponents = template.widgets
        .map((w) => w.component)
        .filter(
            (c) =>
                !widgetNames.includes(c.replace(/^ai-built\.slack-pack\./, ""))
        );
    if (missingComponents.length > 0) {
        log(
            `WARN: template references components not in the compiled pack: ${missingComponents.join(
                ", "
            )}. They'll render as missing-component placeholders.`
        );
    }

    const grid = {
        rows: template.grid.rows,
        cols: template.grid.cols,
        gap: template.grid.gap || "gap-2",
    };
    template.widgets.forEach((w) => {
        grid[w.cell] = {
            component: componentToId.get(w.component),
            hide: false,
        };
    });

    const layoutItems = [
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
            grid,
        },
        ...template.widgets.map((w, idx) => ({
            id: idx + 2,
            order: idx + 1,
            component: w.component,
            componentName: w.component,
            type: "widget",
            parent: 1,
            hasChildren: 0,
            scrollable: true,
            workspace: "layout",
            width: "w-full",
            height: "h-full",
            userPrefs: w.userPrefs || {},
            selectedProviders: slackProviderName
                ? { slack: slackProviderName }
                : {},
            events: [],
            eventHandlers: [],
            listeners: {},
            uuid: `${WORKSPACE_ID}-${w.component}-${idx + 2}`,
            packageId: null,
            grid: null,
            parentWorkspaceName: "layout",
            siblingCount: 0,
            dashboardId: WORKSPACE_ID,
        })),
    ];

    return {
        id: WORKSPACE_ID,
        name: template.name,
        type: "workspace",
        label: template.label || template.name,
        version: Date.now(),
        layout: layoutItems,
        menuId: 1,
    };
}

function updateWorkspaces(workspace) {
    if (isDryRun) {
        log(
            `[dry-run] would write workspace '${workspace.name}' (id=${workspace.id}) into ${WORKSPACES_FILE}`
        );
        return;
    }
    const dir = path.dirname(WORKSPACES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let workspaces = [];
    if (fs.existsSync(WORKSPACES_FILE)) {
        try {
            workspaces = JSON.parse(fs.readFileSync(WORKSPACES_FILE, "utf8"));
            if (!Array.isArray(workspaces)) workspaces = [];
        } catch (err) {
            log("Existing workspaces.json is malformed; replacing.");
        }
    }
    const filtered = workspaces.filter((w) => w?.id !== workspace.id);
    filtered.push(workspace);
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(filtered, null, 2));
    log(`Updated ${WORKSPACES_FILE}`);
}

async function main() {
    log(`Pack install dir: ${PACKAGE_INSTALL_DIR}`);
    log(`Registry file:    ${REGISTRY_FILE}`);
    log(`Workspaces file:  ${WORKSPACES_FILE}`);
    if (isDryRun) log("Dry run — no files will be written.");

    if (!fs.existsSync(PACKAGE_INSTALL_DIR)) {
        throw new Error(
            `Pack directory missing: ${PACKAGE_INSTALL_DIR}. ` +
                "Place the widgets/, utils/, dashboards/, and dash.json files here first."
        );
    }

    await compilePackage();
    const widgetNames = readWidgetNames();
    log(`Component(s): ${widgetNames.join(", ")}`);
    updateRegistry(widgetNames);
    const workspace = buildWorkspace(widgetNames);
    updateWorkspaces(workspace);

    log("");
    log("Done. Quit + reopen Dash, then open the 'Slack Pack' workspace.");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
