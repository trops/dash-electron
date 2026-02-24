import React from "react";
import { Routes, Route } from "react-router-dom";

// Core framework from @trops/dash-core
import {
    DashboardStage,
    ComponentManager,
    ElectronDashboardApi,
    ErrorBoundary,
    ExternalWidget,
    loadWidgetBundle,
    evaluateBundle,
    extractWidgetConfigs,
} from "@trops/dash-core";

// Local Widgets that integrate with Dash
import * as myWidgets from "./Widgets";

console.log("[Dash.js] Imported widgets:", myWidgets);

// the mainApi from electron bridge
// you can overwrite this API with an abstraction for React
// if you are not using Electron
const mainApi = window.mainApi;

console.log("[Dash.js] mainApi available:", !!mainApi);
console.log(
    "[Dash.js] process.env.REACT_APP_IDENTIFIER:",
    process.env.REACT_APP_IDENTIFIER
);

// initialize the widgets,
// NOTE: YOU MUST DO THIS ITERATION FOR ALL WIDGET LIBRARIES
// THIS SATISFIES LOCAL ONLY
try {
    Object.keys(myWidgets).forEach((widgetKey) => {
        const widget = myWidgets[widgetKey];
        console.log(`[Dash.js] Processing widget: ${widgetKey}`, widget);

        // Handle nested widget exports (namespace re-exports with multiple widgets)
        if (widget && typeof widget === "object" && !widget.component) {
            // This is a namespace with multiple widgets
            Object.keys(widget).forEach((subKey) => {
                const subWidget = widget[subKey];
                if (subWidget && subWidget.component) {
                    console.log(`[Dash.js] Registering ${widgetKey}.${subKey}`);
                    ComponentManager.registerWidget(
                        subWidget,
                        `${widgetKey}_${subKey}`
                    );
                }
            });
        } else if (widget && widget.component) {
            // This is a direct widget export
            console.log(`[Dash.js] Registering ${widgetKey}`);
            ComponentManager.registerWidget(widget, widgetKey);
        }
    });

    console.log("[Dash.js] Widget registration complete");
} catch (error) {
    console.error("[Dash.js] Error registering widgets:", error);
}

// Only set app ID if mainApi is available
if (mainApi && mainApi.setAppId) {
    mainApi.setAppId(process.env.REACT_APP_IDENTIFIER);
    console.log("[Dash.js] App ID set");
}

// instantiate the ElectronApi
let electronApi = null;
if (mainApi) {
    electronApi = new ElectronDashboardApi(
        mainApi,
        process.env.REACT_APP_IDENTIFIER
    );
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

    // Phase 1: Try loading CJS bundles
    if (window.mainApi.widgets.readAllBundles) {
        try {
            const bundles = await window.mainApi.widgets.readAllBundles();
            console.log(
                `[Dash.js] Phase 1: Loading ${bundles.length} widget bundles`
            );

            for (const { widgetName, source } of bundles) {
                try {
                    registerBundleConfigs(widgetName, source);
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
                // Skip if already registered via bundle (Phase 1) or built-in
                if (ComponentManager.componentMap()[componentName]) {
                    console.log(
                        `[Dash.js] Phase 2: Skipping "${componentName}" — already registered`
                    );
                    continue;
                }

                // Register with lazy-loaded component
                ComponentManager.registerWidget(
                    {
                        ...config,
                        component: createLazyWidget(
                            widgetPackage,
                            componentName
                        ),
                        _sourcePackage: widgetPackage,
                        type: config.type || "widget",
                        canHaveChildren: config.canHaveChildren || false,
                        userConfig: config.userConfig || {
                            title: {
                                type: "text",
                                defaultValue: componentName,
                                displayName: "Title",
                                required: false,
                            },
                        },
                    },
                    componentName
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
 */
function registerBundleConfigs(widgetName, source) {
    try {
        const { configs } = loadWidgetBundle(source, widgetName);
        console.log(
            `[Dash.js] Bundle "${widgetName}" yielded ${configs.length} configs`
        );

        for (const { key, config } of configs) {
            // Skip if already registered (built-in widgets take priority)
            if (ComponentManager.componentMap()[key]) {
                console.log(`[Dash.js] Skipping "${key}" — already registered`);
                continue;
            }

            config._sourcePackage = widgetName;
            ComponentManager.registerWidget(config, key);
            console.log(
                `[Dash.js] Registered external widget: ${key} (${config.type})`
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

// Main App
class App extends React.Component {
    async componentDidMount() {
        console.log("[Dash App] componentDidMount called");
        // Listen for widget installation events (hot reload)
        if (window.mainApi) {
            window.mainApi.widgets.onInstalled(this.handleWidgetInstalled);
            window.mainApi.widgets.onLoaded(this.handleWidgetsLoaded);
            console.log("[Dash App] Widget listeners registered");
        }

        // Load installed widgets (bundles first, then config fallback)
        await loadInstalledWidgets();
        window.dispatchEvent(new Event("dash:widgets-updated"));
    }

    componentWillUnmount() {
        // Clean up event listeners
        if (window.mainApi) {
            window.mainApi.widgets.removeInstalledListener(
                this.handleWidgetInstalled
            );
            window.mainApi.widgets.removeLoadedListener(
                this.handleWidgetsLoaded
            );
        }
    }

    handleWidgetInstalled = async ({ widgetName, config }) => {
        console.log(`[App] Widget installed: ${widgetName}`, config);

        let bundleLoaded = false;

        // Try loading CJS bundle first
        if (window.mainApi && window.mainApi.widgets.readBundle) {
            const result = await window.mainApi.widgets.readBundle(widgetName);
            if (result.success) {
                try {
                    registerBundleConfigs(widgetName, result.source);
                    bundleLoaded = true;
                } catch (err) {
                    console.warn(
                        `[App] Bundle eval failed for ${widgetName}:`,
                        err
                    );
                }
            }
        }

        // Fallback: register via config + ExternalWidget
        if (
            !bundleLoaded &&
            window.mainApi &&
            window.mainApi.widgets.getComponentConfigs
        ) {
            try {
                const configs =
                    await window.mainApi.widgets.getComponentConfigs();
                for (const {
                    componentName,
                    widgetPackage,
                    config: cfg,
                } of configs) {
                    if (ComponentManager.componentMap()[componentName])
                        continue;
                    ComponentManager.registerWidget(
                        {
                            ...cfg,
                            component: createLazyWidget(
                                widgetPackage,
                                componentName
                            ),
                            _sourcePackage: widgetPackage,
                            type: cfg.type || "widget",
                            canHaveChildren: cfg.canHaveChildren || false,
                            userConfig: cfg.userConfig || {
                                title: {
                                    type: "text",
                                    defaultValue: componentName,
                                    displayName: "Title",
                                    required: false,
                                },
                            },
                        },
                        componentName
                    );
                    console.log(
                        `[App] Registered "${componentName}" via lazy loader`
                    );
                }
            } catch (error) {
                console.error(
                    `[App] Config fallback failed for ${widgetName}:`,
                    error
                );
            }
        }

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
            <Routes>
                <Route
                    path="/"
                    element={
                        <ErrorBoundary>
                            <DashboardStage
                                dashApi={electronApi}
                                credentials={{
                                    appId: process.env.REACT_APP_IDENTIFIER,
                                }}
                                backgroundColor="bg-gray-900"
                                height="h-full"
                                grow={true}
                            />
                        </ErrorBoundary>
                    }
                />
            </Routes>
        );
    }
}

export default App;
