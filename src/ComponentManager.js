// TODO, move this into a argument as opposed to a file...
import { LayoutContainer, LayoutGridContainer } from "./Components/Layout";
import { deepCopy } from "@trops/dash-react";
import { ComponentConfigModel } from "./Models";

let _componentMap = {};

export const ComponentManager = {
    // _componentMap: {},

    /**
     * init
     * @param {object} configs
     */
    init: function (configs) {
        if (configs) {
            Object.keys(configs).forEach((key) => {
                this.registerWidget(configs[key], key);
            });
        }
    },

    setComponentMap: function (cm) {
        _componentMap = cm;
    },

    componentMap: function () {
        return _componentMap;
    },

    /**
     * The method for registering the widget into the Dashboard application
     * This is a requirement for the widget to be included into the Dash
     *
     * @param {Object} widgetConfig the widget configuration script created by the developer
     * @param {*} widgetKey the unique id for the widget
     */
    registerWidget: function (widgetConfig, widgetKey) {
        const tempComponentMap = this.componentMap();
        // Handle both module exports (widgetConfig.default) and direct config objects
        const config = widgetConfig.default || widgetConfig;
        tempComponentMap[widgetKey] = ComponentConfigModel(config);
        this.setComponentMap(tempComponentMap);
    },

    /**
     * map
     * Get a map of all of the registered components in the application
     * @returns object
     */
    map: function () {
        // copy
        let componentsCopy = deepCopy(this.componentMap());
        if (componentsCopy) {
            // additional INTERNAL components that we need

            // Legacy flexbox container (deprecated, use LayoutGridContainer)
            componentsCopy["Container"] = {
                name: "Container",
                component: LayoutContainer,
                canHaveChildren: true,
                userConfig: {},
                workspace: "layout",
                type: "workspace",
                width: "w-full",
            };

            // Grid-first container (primary container type)
            componentsCopy["LayoutGridContainer"] = {
                name: "LayoutGridContainer",
                component: LayoutGridContainer,
                canHaveChildren: true,
                userConfig: {},
                workspace: "layout",
                type: "grid",
                width: "w-full",
                grid: {
                    rows: 1,
                    cols: 1,
                    gap: "gap-2",
                    1.1: { component: null, hide: false },
                },
            };

            return componentsCopy;
        }
        return {};
    },
    /**
     * Fetch the React Component from the map of registered components
     * @param {string} component the component/widget in the componentMap
     * @returns {Widget} the Widget in the component map
     */
    getComponent: function (component, data = {}) {
        try {
            // console.log("get component");
            if (component && this.componentMap()) {
                if (ComponentManager.isLayoutContainer(component) === false) {
                    const m = this.componentMap();
                    const cmp = component in m ? m[component] : null;
                    if (cmp !== null) {
                        cmp["componentName"] = component;
                        return cmp;
                    }
                } else {
                    // Handle LayoutGridContainer (new grid-first architecture)
                    if (component === "LayoutGridContainer") {
                        return {
                            name: "LayoutGridContainer",
                            component: LayoutGridContainer,
                            canHaveChildren: true,
                            userConfig: {},
                            workspace: "layout",
                            type: "grid",
                            width: "w-full",
                            grid: {
                                rows: 1,
                                cols: 1,
                                gap: "gap-2",
                                1.1: { component: null, hide: false },
                            },
                        };
                    }

                    // Handle legacy Container (flexbox)
                    return {
                        name: "Container",
                        component: LayoutContainer,
                        canHaveChildren: true,
                        userConfig: {},
                        workspace: "layout",
                        type: "workspace",
                        width: "w-full",
                    };
                }
            }
        } catch (e) {
            return null;
        }
    },

    getWorkspaceByName: function (workspaceName) {
        try {
            const m = this.componentMap();
            let workspaceComponent = null;
            if (m) {
                Object.keys(m).forEach((componentName) => {
                    const cmp = m[componentName];
                    if (
                        (cmp.workspace === `${workspaceName}-workspace` ||
                            cmp.workspace === workspaceName) &&
                        cmp["type"] === "workspace"
                    ) {
                        cmp["component"] = componentName;
                        workspaceComponent = cmp;
                    }
                });
                return workspaceComponent;
            }
        } catch (e) {
            return null;
        }
    },

    getCompatibleWidgetsForWorkspace: function (workspaceName) {
        try {
            const m = this.componentMap();
            if (m) {
                return Object.keys(m).filter((componentName) => {
                    const cmp = m[componentName];
                    if (
                        (cmp.workspace === `${workspaceName}-workspace` ||
                            cmp.workspace === workspaceName) &&
                        cmp["type"] === "widget"
                    ) {
                        cmp["component"] = componentName;
                        return componentName;
                    }
                    return false;
                });
            }
        } catch (e) {
            return null;
        }
    },

    getWorkspaces: function () {
        try {
            const m = this.componentMap();
            if (m) {
                return Object.keys(m).filter((componentName) => {
                    const cmp = m[componentName];
                    if (cmp["type"] === "workspace") {
                        cmp["component"] = componentName;
                        return componentName;
                    }
                    return false;
                });
            }
        } catch (e) {
            return null;
        }
    },

    getWidgets: function () {
        try {
            const m = this.componentMap();
            if (m) {
                console.log("widget names available ", Object.keys(m));
                return Object.keys(m).filter((componentName) => {
                    const cmp = m[componentName];
                    if (cmp["type"] === "widget") {
                        cmp["component"] = componentName;
                        return componentName;
                    }
                    return false;
                });
            }
        } catch (e) {
            return null;
        }
    },

    getContextsForLayout: function (config) {
        try {
            const m = this.componentMap();
            const contexts = [];
            if (m) {
                config.layout.forEach((item) => {
                    if ("contexts" in item && item.contexts) {
                        item.contexts.forEach((context) => {
                            // we want to push the Context component and the user configuration data
                            contexts.push({
                                provider: m[context],
                                props: item,
                            });
                        });
                    }
                });
            }
            return contexts;
        } catch (e) {
            console.log("error getting contexts ", e);
            return null;
        }
    },
    /**
     * Get the context by name, so that we can render all of the contexts around the dashboard widgets selected
     * @param {String} contextName the name of the context to be fetched
     * @returns
     */
    getContextByName: function (contextName) {
        try {
            const m = this.componentMap();
            let contextComponent = null;
            if (m) {
                Object.keys(m).forEach((componentName) => {
                    const cmp = m[componentName];
                    if (
                        cmp.workspace === `${contextName}-context` &&
                        cmp["type"] === "context"
                    ) {
                        cmp["component"] = componentName;
                        contextComponent = cmp;
                    }
                });
                return contextComponent;
            }
        } catch (e) {
            return null;
        }
    },

    config: function (component, data = {}) {
        try {
            if (component) {
                // console.log("config");
                const requiredFields = {
                    type: { value: "text" },
                    required: { value: false },
                    options: { value: [] },
                    defaultValue: { value: "" },
                };

                // get the component configuration from the map
                const components = this.map();
                if (component in components) {
                    // let c = deepCopy(components['component']);

                    // we have to make sure that we remove the component if this is a context

                    const tempComponent = components[component];
                    delete tempComponent["component"];
                    let c = JSON.parse(JSON.stringify(tempComponent));

                    // tack on the component name
                    c["component"] = component;

                    // if no userConfig key. let's add it for the next step
                    if ("userConfig" in c === false) {
                        c["userConfig"] = {};
                    }

                    // if (isLayout === false) {
                    let userPrefs = {};
                    // now we can make sure the configuration is "complete"
                    if ("userConfig" in c) {
                        Object.keys(c["userConfig"]).forEach((key) => {
                            // check the required fields!
                            Object.keys(requiredFields).forEach((k) => {
                                if (k in c["userConfig"][key]) {
                                    if (k in c["userConfig"][key] === false) {
                                        c["userConfig"][key] =
                                            requiredFields[k]["value"];
                                    }
                                }
                            });
                            // set the user preferences
                            userPrefs[key] = ComponentManager.userPrefsForItem(
                                "userPrefs" in data ? data : c,
                                key,
                                c["userConfig"][key]
                            );
                        });
                    }

                    // set the user preferences here
                    c["userPrefs"] = userPrefs;

                    return {
                        type: c["type"],
                        name: c["name"],
                        workspace: c["workspace"],
                        canHaveChildren: c["canHaveChildren"],
                        userPrefs: c["userPrefs"],
                        userConfig: c["userConfig"],
                        styles: "styles" in c ? c["styles"] : {},
                        events: "events" in c ? c["events"] : [],
                        eventHandlers:
                            "eventHandlers" in c ? c["eventHandlers"] : [],
                        providers: "providers" in c ? c["providers"] : [],
                        icon: "icon" in c ? c["icon"] : null,
                    };
                }
                return null;
            }
            return null;
        } catch (e) {
            console.log("error getting config for component ", component, e);
            return null;
        }
    },
    /**
     * userConfig
     * We want to make sure all of the keys are available, and if not, set defaults...
     * @param {object} config the current configuration object
     * @returns
     */
    userPrefsForItem: function (item, key, config) {
        try {
            let prefsForItem = {};
            if ("userPrefs" in item) {
                if (key in item["userPrefs"]) {
                    prefsForItem = item["userPrefs"][key];
                } else {
                    if ("defaultValue" in config) {
                        prefsForItem = config["defaultValue"];
                    }
                }
            } else {
                // no user preferences in the item yet so we can try and set the defaults.
                prefsForItem =
                    "defaultValue" in config ? config["defaultValue"] : "";
            }
            return prefsForItem;
        } catch (e) {
            return {};
        }
    },
    /**
     * isLayoutContainer
     * Check if the component is a layout container (includes both grid and flexbox containers)
     * @param {string} component the string name of the component to be matched in the component config file
     * @returns boolean
     */
    isLayoutContainer: function (component) {
        return (
            component === "LayoutContainer" ||
            component === "Container" ||
            component === "LayoutGridContainer"
        );
    },

    /**
     * isGridContainer
     * Check if the component is a grid container (new grid-first architecture)
     * @param {string|object} component the component name (string) or component object
     * @returns boolean
     */
    isGridContainer: function (component) {
        // Handle string component names
        if (typeof component === "string") {
            return component === "LayoutGridContainer";
        }

        // Handle component objects
        if (component && typeof component === "object") {
            // Check by component name
            if (component.component === "LayoutGridContainer") {
                return true;
            }

            // Check by type
            if (component.type === "grid") {
                return true;
            }

            // Check if it has a grid property
            if (component.grid !== null && component.grid !== undefined) {
                return true;
            }
        }

        return false;
    },
};
