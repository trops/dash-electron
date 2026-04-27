import React from "react";
import { Routes, Route, useParams } from "react-router-dom";

// Core framework from @trops/dash-core
import * as dashCore from "@trops/dash-core";
import {
    DashboardStage,
    WidgetPopoutStage,
    ComponentManager,
    ElectronDashboardApi,
    ErrorBoundary,
    ExternalWidget,
    loadWidgetBundle,
    evaluateBundle,
    extractWidgetConfigs,
    setHostModules,
    makeScopedComponentId,
} from "@trops/dash-core";

// Debug Console (standalone window)
import { DebugConsole } from "./DebugConsole";

// AI Assistant panel (app shell)
import { AiAssistantPanel } from "./AiAssistant/AiAssistantPanel";
import { WidgetBuilderModal } from "./AiAssistant/WidgetBuilderModal";
import { InstallExternalMcpModal } from "./AiAssistant/InstallExternalMcpModal";

// Local widgets that integrate with Dash. We discover every
// `src/Widgets/<Package>/<Widget>.dash.js` via webpack's require.context
// and register each under the canonical scoped id
// `local.<package>.<Component>`. The folder name becomes the package
// name; the filename's component prefix becomes the component name.
// Adding a new widget = drop a new .dash.js in a folder under
// src/Widgets/. No manual export wiring required.
const localWidgetCtx = require.context("./Widgets", true, /\.dash\.js$/);

// Inject dash-core module reference for the widget require shim.
// This avoids the self-referential import in widgetBundleLoader.js that
// breaks under webpack scope hoisting in production builds.
setHostModules({ "@trops/dash-core": dashCore });

// the mainApi from electron bridge
// you can overwrite this API with an abstraction for React
// if you are not using Electron
const mainApi = window.mainApi;

// App identifier with fallback to package name when .env is missing
const appId = process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron";

console.log("[Dash.js] mainApi available:", !!mainApi);
console.log("[Dash.js] appId:", appId);

// Register every local widget under `local.<package>.<Component>`.
// Origin metadata (scope, packageName, id) is derived from the file's
// path under `src/Widgets/` so a developer can drop a new widget in
// without editing any registration code. The .dash.js may still set
// `scope` / `packageName` / `id` explicitly — those win, since they
// might point to e.g. a `local.shared.<Comp>` override.
function registerLocalWidgets() {
    localWidgetCtx.keys().forEach((modulePath) => {
        // modulePath looks like `./<Package>/<Widget>.dash.js`. The
        // first path segment is the package; the file basename minus
        // `.dash.js` is the component name.
        const match = modulePath.match(/^\.\/([^/]+)\/([^/]+)\.dash\.js$/);
        if (!match) {
            console.warn(
                `[Dash.js] Skipping local widget at non-conforming path: ${modulePath}. Expected src/Widgets/<Package>/<Component>.dash.js.`
            );
            return;
        }
        const [, folder, componentName] = match;
        const mod = localWidgetCtx(modulePath);
        const config = mod?.default || mod;
        if (!config || !config.component) {
            console.warn(
                `[Dash.js] Skipping ${modulePath} — module did not export a widget config with a React component.`
            );
            return;
        }
        // Stamp local scope. Existing values in the .dash.js win (a
        // widget can opt into a different package by setting these).
        const scope = config.scope || "local";
        const packageName = config.packageName || folder.toLowerCase();
        const name = config.name || componentName;
        const id =
            config.id || makeScopedComponentId(`${scope}/${packageName}`, name);
        ComponentManager.registerWidget(
            { ...config, scope, packageName, name, id },
            id
        );
        console.log(`[Dash.js] Registered ${id}`);
    });
}

try {
    registerLocalWidgets();
    console.log("[Dash.js] Local widget registration complete");
} catch (error) {
    console.error("[Dash.js] Error registering local widgets:", error);
}

// Only set app ID if mainApi is available
if (mainApi && mainApi.setAppId) {
    mainApi.setAppId(appId);
    console.log("[Dash.js] App ID set");
}

// instantiate the ElectronApi
let electronApi = null;
if (mainApi) {
    electronApi = new ElectronDashboardApi(mainApi, appId);
}

console.log("[Dash.js] electronApi created:", !!electronApi);

/**
 * Create a lazy-loaded wrapper for an external widget.
 *
 * Uses React.lazy to defer loading until the widget actually renders.
 * The factory calls `readBundle` via IPC, which auto-compiles (esbuild)
 * if no CJS bundle exists yet, then evaluates the bundle in the renderer
 * using the existing require-shim pipeline.
 *
 * Returns a plain function component (typeof === "function") so it passes
 * the WidgetFactory type check at WidgetFactory.js:123.
 *
 * @param {string} widgetPackage - Widget package name (registry key)
 * @param {string} componentName - Component name to extract from bundle exports
 * @returns {Function} React function component
 */
function createLazyWidget(widgetPackage, componentName) {
    const LazyComponent = React.lazy(() => {
        if (!window.mainApi || !window.mainApi.widgets.readBundle) {
            console.warn(
                `[createLazyWidget] mainApi not available for "${componentName}"`
            );
            return Promise.resolve({ default: ExternalWidget });
        }

        return window.mainApi.widgets
            .readBundle(widgetPackage)
            .then((result) => {
                if (!result.success) {
                    console.warn(
                        `[createLazyWidget] readBundle failed for "${widgetPackage}":`,
                        result.error
                    );
                    return { default: ExternalWidget };
                }

                const bundleExports = evaluateBundle(
                    result.source,
                    widgetPackage
                );
                const configs = extractWidgetConfigs(bundleExports);

                // Find the matching component by name
                const match = configs.find((c) => c.key === componentName);
                if (match && typeof match.config.component === "function") {
                    console.log(
                        `[createLazyWidget] Resolved "${componentName}" from "${widgetPackage}"`
                    );
                    return { default: match.config.component };
                }

                // If no exact match, try the first available component
                if (
                    configs.length > 0 &&
                    typeof configs[0].config.component === "function"
                ) {
                    console.log(
                        `[createLazyWidget] Using first component from "${widgetPackage}" for "${componentName}"`
                    );
                    return { default: configs[0].config.component };
                }

                console.warn(
                    `[createLazyWidget] No component found in bundle for "${componentName}"`
                );
                return { default: ExternalWidget };
            })
            .catch((error) => {
                console.error(
                    `[createLazyWidget] Error loading "${componentName}":`,
                    error
                );
                return { default: ExternalWidget };
            });
    });

    // Wrap in a function component so typeof === "function" (passes WidgetFactory check)
    // and provide a self-contained Suspense boundary
    const LazyWidgetWrapper = (props) => (
        <React.Suspense
            fallback={
                <ExternalWidget
                    {...props}
                    title={props.title || componentName}
                />
            }
        >
            <LazyComponent {...props} />
        </React.Suspense>
    );
    LazyWidgetWrapper.displayName = `LazyWidget(${componentName})`;
    return LazyWidgetWrapper;
}

/**
 * Two-phase loading for installed widgets.
 *
 * Phase 1 — Try CJS bundles: evaluate real React components.
 * Phase 2 — Fallback: for widgets WITHOUT bundles, use getComponentConfigs()
 *           to read .dash.js metadata and register with ExternalWidget placeholder.
 *
 * This ensures widgets like the weather widget (no CJS bundle) still appear
 * in the sidebar.
 */
async function loadInstalledWidgets() {
    if (!window.mainApi) return;

    const bundleLoadedWidgets = new Set();

    // Fetch registry metadata once so we can enrich each registered widget
    // with its package's displayName / author. This is what makes ai-built
    // widgets group under their package name (e.g. "Sales Pipeline") instead
    // of falling through to "Other" in the widget sidebar / Settings.
    const regByName = {};
    try {
        const list = (await window.mainApi.widgets.list?.()) || [];
        list.forEach((w) => {
            if (w?.name) regByName[w.name] = w;
            if (w?.packageId) regByName[w.packageId] = w;
        });
    } catch (err) {
        console.warn(
            "[Dash.js] Could not fetch registry list for widget enrichment:",
            err
        );
    }

    // Phase 1: Try loading CJS bundles
    if (window.mainApi.widgets.readAllBundles) {
        try {
            const bundles = await window.mainApi.widgets.readAllBundles();
            console.log(
                `[Dash.js] Phase 1: Loading ${bundles.length} widget bundles`
            );

            for (const { widgetName, source } of bundles) {
                try {
                    registerBundleConfigs(
                        widgetName,
                        source,
                        regByName[widgetName]
                    );
                    bundleLoadedWidgets.add(widgetName);
                } catch (err) {
                    console.warn(
                        `[Dash.js] Phase 1: Bundle failed for "${widgetName}", will try fallback`,
                        err
                    );
                }
            }
        } catch (error) {
            console.error("[Dash.js] Phase 1: Error reading bundles:", error);
        }
    }

    // Phase 2: Config-based fallback for widgets without bundles
    if (window.mainApi.widgets.getComponentConfigs) {
        try {
            const configs = await window.mainApi.widgets.getComponentConfigs();
            console.log(
                `[Dash.js] Phase 2: Found ${configs.length} component configs`
            );

            for (const { componentName, widgetPackage, config } of configs) {
                // Skip if already registered via bundle (Phase 1) or built-in.
                // Check both plain componentName and scoped config.id since
                // Phase 1 registers under the canonical scoped ID only.
                if (
                    ComponentManager.componentMap()[componentName] ||
                    (config?.id && ComponentManager.componentMap()[config.id])
                ) {
                    console.log(
                        `[Dash.js] Phase 2: Skipping "${componentName}" — already registered`
                    );
                    continue;
                }

                // Register with lazy-loaded component, enriching with package
                // metadata from the registry when the widget config didn't
                // supply its own package/author (typical for ai-built widgets).
                // Use a scoped registration id so this lazy entry can't
                // collide with another package's same-named component.
                const reg = regByName[widgetPackage] || {};
                const lazyScopedId = makeScopedComponentId(
                    widgetPackage,
                    componentName
                );
                ComponentManager.registerWidget(
                    {
                        ...config,
                        id: lazyScopedId || config.id,
                        component: createLazyWidget(
                            widgetPackage,
                            componentName
                        ),
                        _sourcePackage: widgetPackage,
                        _bareName: componentName,
                        type: config.type || "widget",
                        canHaveChildren: config.canHaveChildren || false,
                        package:
                            config.package ||
                            reg.displayName ||
                            reg.name ||
                            null,
                        author: config.author || reg.author || null,
                        userConfig: config.userConfig || {
                            title: {
                                type: "text",
                                defaultValue: componentName,
                                displayName: "Title",
                                required: false,
                            },
                        },
                    },
                    lazyScopedId || componentName
                );
                console.log(
                    `[Dash.js] Phase 2: Registered "${componentName}" with lazy loader`
                );
            }
        } catch (error) {
            console.error(
                "[Dash.js] Phase 2: Error loading component configs:",
                error
            );
        }
    }
}

/**
 * Evaluate a single widget's CJS bundle and register its configs.
 * Falls back to ExternalWidget if evaluation fails.
 *
 * @param {string} widgetName  Scoped package name (e.g. "@ai-built/pipeline").
 * @param {string} source      CJS bundle source.
 * @param {object} [regEntry]  Registry metadata for the package, used to
 *                             enrich configs that didn't supply their own
 *                             package/author fields.
 */
function registerBundleConfigs(
    widgetName,
    source,
    regEntry = null,
    { replaceExisting = false } = {}
) {
    try {
        const { configs } = loadWidgetBundle(source, widgetName);
        console.log(
            `[Dash.js] Bundle "${widgetName}" yielded ${configs.length} configs`
        );

        for (const { key, config } of configs) {
            // Canonical scoped registration id — `scope.package.Component`.
            // Two packages shipping the same bare component name (e.g.
            // both `@ai-built/prospectlistcolumn` and `@ai-built/pipeline`
            // exporting `ProspectListColumn`) used to silently collide:
            // the second registration was skipped and whichever loaded
            // first won. With scoped ids both register cleanly under
            // distinct keys; ComponentManager's bare-name fallback (with
            // packageId hint) routes legacy lookups correctly.
            const scopedId = makeScopedComponentId(widgetName, key);
            const registrationKey = scopedId || key;

            if (
                !replaceExisting &&
                ComponentManager.componentMap()[registrationKey]
            ) {
                console.log(
                    `[Dash.js] Skipping "${registrationKey}" — already registered`
                );
                continue;
            }

            config.id = scopedId || config.id;
            config._sourcePackage = widgetName;
            config._bareName = key;
            if (regEntry) {
                if (!config.package)
                    config.package = regEntry.displayName || regEntry.name;
                if (!config.author) config.author = regEntry.author;
            }
            ComponentManager.registerWidget(config, registrationKey);
            console.log(
                replaceExisting &&
                    ComponentManager.componentMap()[key] !== undefined
                    ? `[Dash.js] Re-registered external widget (post-install): ${key} (${config.type})`
                    : `[Dash.js] Registered external widget: ${key} (${config.type})`
            );
        }
    } catch (error) {
        console.error(
            `[Dash.js] Failed to evaluate bundle for "${widgetName}", using placeholder:`,
            error
        );

        // Fallback: register with lazy loader so it still appears in sidebar
        const fallbackKey = widgetName;
        if (!ComponentManager.componentMap()[fallbackKey]) {
            ComponentManager.registerWidget(
                {
                    component: createLazyWidget(widgetName, widgetName),
                    _sourcePackage: widgetName,
                    type: "widget",
                    canHaveChildren: false,
                    package: regEntry?.displayName || regEntry?.name || null,
                    author: regEntry?.author || null,
                    userConfig: {
                        title: {
                            type: "text",
                            defaultValue: widgetName,
                            displayName: "Title",
                            required: false,
                        },
                    },
                },
                fallbackKey
            );
        }
    }
}

// Popout window: renders a single dashboard in read-only mode
function PopoutDashboard() {
    const { workspaceId } = useParams();
    return (
        <ErrorBoundary>
            <DashboardStage
                dashApi={electronApi}
                credentials={{ appId }}
                height="h-full"
                grow={true}
                popout={true}
                popoutWorkspaceId={Number(workspaceId)}
            />
        </ErrorBoundary>
    );
}

// Widget popout window: renders a single widget in its own window.
//
// widgetId is passed as a STRING — it can be a uuid like
// `${dashboardId}-${component}-${id}` or a legacy numeric id. Do NOT
// Number()-coerce it; uuid strings become NaN and the popout matcher
// then fails to find anything. WidgetPopoutStage handles both shapes.
function WidgetPopoutDashboard() {
    const { workspaceId, widgetId } = useParams();
    return (
        <ErrorBoundary>
            <WidgetPopoutStage
                dashApi={electronApi}
                credentials={{ appId }}
                workspaceId={Number(workspaceId)}
                widgetId={widgetId}
            />
        </ErrorBoundary>
    );
}

// Main App
class App extends React.Component {
    _removeNotificationClickListener = null;
    // Suppress stageKey bump briefly after the widget builder closes
    // so a late-arriving IPC widget:installed event doesn't remount
    // the dashboard and discard unsaved layout edits.
    _suppressStageKeyUntil = 0;

    state = {
        stageKey: 0,
        isWidgetBuilderOpen: false,
    };

    async componentDidMount() {
        console.log("[Dash App] componentDidMount called");

        // Listen for widget builder open event (with optional cell context)
        window.addEventListener("dash:open-widget-builder", (e) => {
            // Clear stale chat BEFORE mounting the modal so ChatCore
            // loads an empty conversation on its first render.
            try {
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ messages: [] })
                );
            } catch (_) {
                /* ignore */
            }
            if (window.mainApi?.llm?.endCliSession) {
                window.mainApi.llm.endCliSession("dash-widget-builder");
            }
            this.setState({
                isWidgetBuilderOpen: true,
                widgetBuilderCellContext: e.detail || null,
                widgetBuilderEditContext: null,
            });
        });

        // Listen for "Edit with AI" — reads source and opens builder in remix mode
        window.addEventListener("dash:edit-widget-with-ai", async (e) => {
            const detail = e.detail || {};
            const {
                widgetComponentName,
                sourcePackage,
                selectedProviders,
                userPrefs,
                cellNumber,
                gridItemId,
                workspaceId,
                widgetId,
            } = detail;

            // Resolve the package name. Priority:
            //   1. _sourcePackage from ComponentManager config
            //   2. Derive from scoped component ID (trops.algolia.Widget → @trops/algolia)
            //   3. Reverse lookup in the widget registry — find the
            //      installed package whose componentNames or widgets
            //      list includes widgetComponentName. Handles the
            //      common case where a multi-widget package (e.g.
            //      @ai-built/pipeline contains ProspectList) lost its
            //      _sourcePackage tag during registration, and the old
            //      guess "@ai-built/<componentname>" would miss.
            //   4. Fall back to @ai-built/<name> (still useful for
            //      single-widget AI-built packages where the package
            //      name literally is the lowercased component name).
            let packageName = sourcePackage;
            if (!packageName && widgetComponentName?.includes(".")) {
                const parts = widgetComponentName.split(".");
                if (parts.length >= 3) {
                    packageName = `@${parts[0]}/${parts[1]}`;
                }
            }
            if (!packageName && widgetComponentName) {
                try {
                    const installed =
                        (await window.mainApi.widgets.list?.()) || [];
                    const match = installed.find((pkg) => {
                        if (!pkg) return false;
                        if (
                            Array.isArray(pkg.componentNames) &&
                            pkg.componentNames.includes(widgetComponentName)
                        )
                            return true;
                        if (
                            Array.isArray(pkg.widgets) &&
                            pkg.widgets.some(
                                (w) => w && w.name === widgetComponentName
                            )
                        )
                            return true;
                        return false;
                    });
                    if (match) {
                        packageName =
                            match.packageId || match.name || packageName;
                    }
                } catch (err) {
                    console.warn(
                        "[Dash] Reverse package lookup failed:",
                        err?.message || err
                    );
                }
            }
            if (!packageName) {
                packageName = `@ai-built/${widgetComponentName?.toLowerCase()}`;
            }

            let editContext = null;
            try {
                const result = await window.mainApi.widgetBuilder.readSources(
                    packageName,
                    widgetComponentName
                );
                if (result?.success) {
                    editContext = {
                        componentCode: result.componentCode,
                        configCode: result.configCode,
                        manifest: result.manifest,
                        originalWidgetId: widgetId,
                        originalComponentName: widgetComponentName,
                        originalPackage: packageName,
                        selectedProviders: selectedProviders || null,
                        userPrefs: userPrefs || null,
                    };
                } else {
                    // Source unavailable — pass error so the modal can explain
                    editContext = {
                        sourceError: result?.error || "Source files not found",
                        originalWidgetId: widgetId,
                        originalComponentName: widgetComponentName,
                        originalPackage: packageName,
                        selectedProviders: selectedProviders || null,
                        userPrefs: userPrefs || null,
                    };
                }
            } catch (err) {
                console.warn("[Dash] Could not read widget sources:", err);
                editContext = {
                    sourceError: err.message || "Failed to read widget sources",
                    originalWidgetId: widgetId,
                    originalComponentName: widgetComponentName,
                    originalPackage: packageName,
                    selectedProviders: selectedProviders || null,
                    userPrefs: userPrefs || null,
                };
            }

            this.setState({
                isWidgetBuilderOpen: true,
                widgetBuilderCellContext: {
                    cellNumber,
                    gridItemId,
                    workspaceId,
                },
                widgetBuilderEditContext: editContext,
            });
        });

        // Listen for widget installation events (hot reload)
        if (window.mainApi) {
            window.mainApi.widgets.onInstalled(this.handleWidgetInstalled);
            window.mainApi.widgets.onLoaded(this.handleWidgetsLoaded);
            if (window.mainApi.widgets.onUninstalled) {
                window.mainApi.widgets.onUninstalled(
                    this.handleWidgetUninstalled
                );
            }
            console.log("[Dash App] Widget listeners registered");

            // Listen for notification click events to navigate to the widget's workspace
            if (
                window.mainApi.notifications &&
                window.mainApi.notifications.onClicked
            ) {
                this._removeNotificationClickListener =
                    window.mainApi.notifications.onClicked(
                        this.handleNotificationClicked
                    );
                console.log(
                    "[Dash App] Notification click listener registered"
                );
            }
        }

        // Load installed widgets (bundles first, then config fallback)
        await loadInstalledWidgets();
        window.dispatchEvent(new Event("dash:widgets-updated"));

        // Subscribe to Dash MCP state-change broadcasts so assistant-driven
        // mutations (apply_theme, add_widget, create_dashboard, etc.)
        // refresh the UI automatically. Uses the existing stageKey bump
        // pattern — DashboardStage remounts and re-bootstraps.
        if (window.mainApi?.mcpDashServer?.onStateChanged) {
            // Tools whose changes the renderer can pick up via other
            // mechanisms (workspace:saved → DashboardStage.loadWorkspaces,
            // dash:navigate-workspace, etc). Skipping the stageKey bump
            // for these avoids the visible full-remount while keeping
            // the UI in sync.
            const NO_REMOUNT_TOOLS = new Set([
                "create_dashboard",
                "delete_dashboard",
                "add_widget",
                "remove_widget",
                "configure_widget",
                "move_widget",
                "set_layout",
                "update_layout",
                // apply_theme: DashboardStage listens for
                // "dash:apply-theme" and calls changeCurrentTheme in
                // place, avoiding a full remount.
                "apply_theme",
                // install_known_mcp_server adds an MCP provider via
                // the InstallExternalMcpModal flow — that modal already
                // dispatches `dash:provider-installed` for any UI that
                // cares (e.g. the Widget Builder banner). A stageKey
                // bump here would tear down the open Widget Builder
                // modal and lose the user's generated widget code.
                "install_known_mcp_server",
            ]);

            this._unsubMcpStateChanged =
                window.mainApi.mcpDashServer.onStateChanged(
                    async ({ toolName, result }) => {
                        console.log(
                            "[Dash App] MCP state changed via:",
                            toolName,
                            result
                        );
                        // Reload widgets so install_widget takes effect.
                        await loadInstalledWidgets();
                        window.dispatchEvent(new Event("dash:widgets-updated"));
                        // Full-remount only for tools that mutate global
                        // state without their own propagation path (e.g.
                        // apply_theme — ThemeContext needs a rebootstrap).
                        if (
                            !NO_REMOUNT_TOOLS.has(toolName) &&
                            !this.state.isWidgetBuilderOpen &&
                            Date.now() > this._suppressStageKeyUntil
                        ) {
                            this.setState((prev) => ({
                                stageKey: prev.stageKey + 1,
                            }));
                        }
                        // Auto-navigate to the new dashboard after
                        // create_dashboard — workspace:saved triggers
                        // the list reload, then DashboardStage's
                        // navigate listener opens the tab once the ID
                        // appears in its config.
                        if (toolName === "create_dashboard" && result?.id) {
                            window.dispatchEvent(
                                new CustomEvent("dash:navigate-workspace", {
                                    detail: {
                                        workspaceId: Number(result.id),
                                    },
                                })
                            );
                        }
                        // Update the active theme in place (no remount)
                        // after apply_theme. DashboardStage consumes
                        // this and calls changeCurrentTheme via
                        // ThemeContext.
                        if (toolName === "apply_theme" && result?.name) {
                            window.dispatchEvent(
                                new CustomEvent("dash:apply-theme", {
                                    detail: { themeKey: result.name },
                                })
                            );
                        }
                    }
                );
        }
    }

    componentWillUnmount() {
        // Clean up event listeners
        if (window.mainApi) {
            window.mainApi.widgets.removeInstalledListener(
                this.handleWidgetInstalled
            );
            if (window.mainApi.widgets.removeUninstalledListener) {
                window.mainApi.widgets.removeUninstalledListener(
                    this.handleWidgetUninstalled
                );
            }
            window.mainApi.widgets.removeLoadedListener(
                this.handleWidgetsLoaded
            );
        }
        if (this._removeNotificationClickListener) {
            this._removeNotificationClickListener();
        }
        if (this._unsubMcpStateChanged) {
            this._unsubMcpStateChanged();
            this._unsubMcpStateChanged = null;
        }
    }

    handleNotificationClicked = ({ workspaceId }) => {
        console.log(
            `[Dash App] Notification clicked, navigating to workspace ${workspaceId}`
        );
        // Dispatch a custom event that DashboardStage can listen to for workspace navigation
        window.dispatchEvent(
            new CustomEvent("dash:navigate-workspace", {
                detail: { workspaceId },
            })
        );
    };

    handleWidgetInstalled = async ({ widgetName, config }) => {
        console.log(`[App] Widget installed: ${widgetName}`, config);

        // Re-register every installed widget. The single-widget
        // `readBundle(widgetName)` path was silently failing for fresh
        // registry installs (the bundle file path resolution differs
        // between read-one and read-all in main process), which is why
        // a manual app reload was previously required to see newly
        // installed widgets. `loadInstalledWidgets()` is the same code
        // that runs on boot — guaranteed to register every widget on
        // disk. Race-free, idempotent, and slightly cheaper than a
        // window reload.
        try {
            await loadInstalledWidgets();
        } catch (err) {
            console.error(
                `[App] Failed to refresh widget registry after install of ${widgetName}:`,
                err
            );
        }

        // Notify every list-rendering surface that the registry just
        // mutated. `useWidgetRegistryVersion` listens for this event
        // and re-derives — sidebar, Settings → Widgets, dropdowns,
        // dependencies tab, etc.
        window.dispatchEvent(new Event("dash:widgets-updated"));

        // Specific per-widget event — WidgetRenderer listens for this
        // and surgically re-mounts only instances whose `component`
        // matches `widgetName`. No more global stageKey bump tearing
        // down the app shell (sidebar, Settings modal, AI panel, etc.)
        // on every widget install. Uninstall still uses the legacy
        // event since every component map entry may be affected.
        if (
            !this.state.isWidgetBuilderOpen &&
            Date.now() > this._suppressStageKeyUntil
        ) {
            window.dispatchEvent(
                new CustomEvent("dash:widget-installed", {
                    detail: { widgetName },
                })
            );
        }
    };

    handleWidgetUninstalled = ({ widgetName }) => {
        console.log(`[App] Widget uninstalled: ${widgetName}`);
        // Remove matching ComponentManager entries so stale widgets don't persist
        const cMap = ComponentManager.componentMap() || {};
        Object.keys(cMap).forEach((key) => {
            if (cMap[key]._sourcePackage === widgetName) {
                delete cMap[key];
            }
        });
        window.dispatchEvent(new Event("dash:widgets-updated"));
    };

    handleWidgetsLoaded = async ({ count, widgets }) => {
        console.log(`[App] ${count} widgets loaded from folder`, widgets);
        // Re-load all widgets (bundles + config fallback)
        await loadInstalledWidgets();
        window.dispatchEvent(new Event("dash:widgets-updated"));
    };

    render() {
        console.log("[Dash App] render called, electronApi:", !!electronApi);
        return (
            <>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ErrorBoundary>
                                <DashboardStage
                                    key={this.state.stageKey}
                                    dashApi={electronApi}
                                    credentials={{ appId }}
                                    height="h-full"
                                    grow={true}
                                    renderAiAssistant={<AiAssistantPanel />}
                                />
                                {/* Always-mounted: handles
                                    install_known_mcp_server confirm
                                    requests from the dash MCP tool
                                    regardless of which view the user
                                    is currently in. */}
                                <InstallExternalMcpModal />
                                {this.state.isWidgetBuilderOpen && (
                                    <WidgetBuilderModal
                                        isOpen={this.state.isWidgetBuilderOpen}
                                        setIsOpen={async (open) => {
                                            if (!open) {
                                                // Modal closing — do all deferred work NOW
                                                const installed =
                                                    this.state
                                                        .installedWidgetInfo;
                                                const ctx =
                                                    this.state
                                                        .widgetBuilderCellContext;
                                                const editCtx =
                                                    this.state
                                                        .widgetBuilderEditContext;

                                                // Close modal and clear edit context.
                                                // Suppress stageKey bumps for 3s so
                                                // a late IPC event doesn't remount
                                                // the dashboard and lose dirty edits.
                                                this._suppressStageKeyUntil =
                                                    Date.now() + 3000;
                                                this.setState({
                                                    isWidgetBuilderOpen: false,
                                                    widgetBuilderEditContext:
                                                        null,
                                                });

                                                if (installed) {
                                                    // Register widget in renderer's ComponentManager
                                                    try {
                                                        const bundleResult =
                                                            await window.mainApi.widgets.readBundle(
                                                                installed.scopedName
                                                            );
                                                        if (
                                                            bundleResult?.success
                                                        ) {
                                                            // replaceExisting=true: we just
                                                            // installed this widget (possibly
                                                            // a post-edit update), so the
                                                            // freshly-compiled bundle must
                                                            // overwrite the stale component
                                                            // that may already be in
                                                            // ComponentManager from the
                                                            // pre-edit state.
                                                            registerBundleConfigs(
                                                                installed.scopedName,
                                                                bundleResult.source,
                                                                null,
                                                                {
                                                                    replaceExisting: true,
                                                                }
                                                            );
                                                        }
                                                    } catch (regErr) {
                                                        console.warn(
                                                            "[App] Widget registration:",
                                                            regErr
                                                        );
                                                    }

                                                    // Notify the widget sidebar (and anyone
                                                    // else listening) that the installed-widget
                                                    // list changed. This is the event the
                                                    // main-process `widget:installed` broadcast
                                                    // would normally trigger — but the ai-build
                                                    // handler suppresses that broadcast when
                                                    // cellContext is set (to avoid remounting
                                                    // the dashboard). We do it here instead so
                                                    // the sidebar refreshes without tearing
                                                    // down the app shell.
                                                    window.dispatchEvent(
                                                        new Event(
                                                            "dash:widgets-updated"
                                                        )
                                                    );
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            "dash:widget-installed",
                                                            {
                                                                detail: {
                                                                    widgetName:
                                                                        installed.scopedName,
                                                                },
                                                            }
                                                        )
                                                    );

                                                    if (
                                                        editCtx?.originalWidgetId &&
                                                        ctx?.gridItemId
                                                    ) {
                                                        // REMIX mode: swap existing widget in-place
                                                        window.dispatchEvent(
                                                            new CustomEvent(
                                                                "dash:swap-widget-in-cell",
                                                                {
                                                                    detail: {
                                                                        widgetComponentName:
                                                                            installed.componentName,
                                                                        widgetId:
                                                                            editCtx.originalWidgetId,
                                                                        cellNumber:
                                                                            ctx.cellNumber,
                                                                        gridItemId:
                                                                            ctx.gridItemId,
                                                                    },
                                                                }
                                                            )
                                                        );
                                                    } else if (
                                                        ctx?.cellNumber &&
                                                        ctx?.gridItemId
                                                    ) {
                                                        // NEW mode: place in empty cell
                                                        window.dispatchEvent(
                                                            new CustomEvent(
                                                                "dash:place-widget-in-cell",
                                                                {
                                                                    detail: {
                                                                        widgetComponentName:
                                                                            installed.componentName,
                                                                        cellNumber:
                                                                            ctx.cellNumber,
                                                                        gridItemId:
                                                                            ctx.gridItemId,
                                                                    },
                                                                }
                                                            )
                                                        );
                                                    }
                                                }
                                            } else {
                                                this.setState({
                                                    isWidgetBuilderOpen: true,
                                                });
                                            }
                                        }}
                                        onInstalled={(
                                            componentName,
                                            scopedName
                                        ) => {
                                            this.setState({
                                                installedWidgetInfo: {
                                                    componentName,
                                                    scopedName,
                                                },
                                            });
                                        }}
                                        cellContext={
                                            this.state.widgetBuilderCellContext
                                        }
                                        editContext={
                                            this.state
                                                .widgetBuilderEditContext ||
                                            null
                                        }
                                    />
                                )}
                            </ErrorBoundary>
                        }
                    />
                    <Route
                        path="/popout/:workspaceId"
                        element={<PopoutDashboard />}
                    />
                    <Route
                        path="/popout-widget/:workspaceId/:widgetId"
                        element={<WidgetPopoutDashboard />}
                    />
                    <Route path="/debug-console" element={<DebugConsole />} />
                </Routes>
            </>
        );
    }
}

export default App;
