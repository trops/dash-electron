import React, { useContext, Component } from "react";
import { LayoutContainer } from "../Components/Layout";
import { ComponentManager } from "../ComponentManager";
import { DashboardPublisher } from "../Components/Dashboard";
import { DashboardContext, WidgetContext } from "../Context";
import { WidgetHelpers } from "../Api/WidgetHelpers";
import { WidgetApi } from "../Api/WidgetApi";
import { getUUID } from "@trops/dash-react";

/**
 * WidgetErrorBoundary - Catches errors from widget rendering
 * Provides helpful messages when widgets are misconfigured
 */
class WidgetErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[WidgetErrorBoundary] Widget rendering error:", {
            widget: this.props.widgetName,
            error: error.message,
            errorInfo,
        });
    }

    render() {
        if (this.state.hasError) {
            const { widgetName } = this.props;
            const errorMessage = this.state.error?.message || "Unknown error";

            // Check if it's a WidgetContext error
            const isContextError =
                errorMessage.includes("Widget ID not found in Context") ||
                errorMessage.includes("WidgetContext");

            return (
                <div className="flex flex-col h-full w-full bg-red-900 border-2 border-red-600 rounded p-4 text-red-100">
                    <div className="text-xl font-bold mb-2">
                        ⚠️ Widget Error
                    </div>
                    <div className="text-sm mb-3">
                        <strong>Widget:</strong> {widgetName}
                    </div>
                    <div className="text-sm mb-3">
                        <strong>Error:</strong> {errorMessage}
                    </div>
                    {isContextError && (
                        <div className="text-sm bg-red-800 border border-red-700 rounded p-3 mt-2">
                            <strong>Fix:</strong> This widget uses{" "}
                            <code>WidgetContext</code> but is missing the{" "}
                            <code>&lt;Widget&gt;</code> wrapper.
                            <br />
                            <br />
                            Add the wrapper in your widget component:
                            <pre className="bg-gray-900 p-2 rounded mt-2 text-xs overflow-auto">
                                {`import { Widget } from "@trops/dash-react";

export const ${widgetName} = (props) => {
  return (
    <Widget {...props}>
      {/* Your widget content */}
    </Widget>
  );
};`}
                            </pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * WidgetRenderer component - wraps the render logic to use React hooks
 */
const WidgetRenderer = ({
    component,
    widgetKey,
    params = {},
    children = null,
}) => {
    const { dashApi } = useContext(DashboardContext);

    try {
        const m = ComponentManager.componentMap();

        if (component && m) {
            const isLayout = ComponentManager.isLayoutContainer(component);
            // grab the component from the map
            const WidgetComponent =
                isLayout === false
                    ? m[component]["component"]
                    : LayoutContainer;

            // get the config details from the .dash file
            const config = ComponentManager.config(component, params);
            console.log("WidgetFactory config", config, component, params);

            let styles = null;
            // if the config is not null, then we can check for styles
            if (config !== null && config !== undefined) {
                // check to see if the config has styles
                // if it does, then we can use those styles
                // otherwise, we will use the default styles
                // styles will be an object with the styles for the widget
                // and set the styles from the config if they exist
                styles = "styles" in config ? config["styles"] : null;
            }

            // user input for the customization of the widget
            const userPrefs = params["userPrefs"];

            // Check to make sure this is a Component
            if (typeof WidgetComponent !== "function") return null;

            if (isLayout === false) {
                params["width"] = "w-full";
            }

            if ("width" in params === false) {
                params["width"] = "w-full";
            }

            params["componentName"] = component;

            // init will inject the params from the widget into the widgetAPI
            // widgetApi.init(params);

            let bgColor = "";
            if (styles !== null) {
                bgColor =
                    "backgroundColor" in styles
                        ? styles["backgroundColor"]
                        : "";
            }

            // Build widgetData for WidgetContext — hooks read from this
            const uuidString = getUUID(params.uuid);
            const widgetData = {
                ...params,
                uuidString,
                providers: config?.providers || [],
            };

            // need to set the electron api here.
            const w = WidgetApi;
            w.init({ id: widgetKey, name: component });
            w.setElectronApi(dashApi);
            w.setPublisher(DashboardPublisher);

            // init the helpers — pass WidgetApi (which has publishEvent/registerListeners
            // that delegate to DashboardPublisher), not the raw Electron dashApi
            const helpers = new WidgetHelpers(params, w);

            // Memoize context value to prevent unnecessary re-renders
            const widgetContextValue = { widgetData };

            // Wrap widget rendering with WidgetContext + error boundary
            return (
                <WidgetContext.Provider value={widgetContextValue}>
                    <WidgetErrorBoundary widgetName={component}>
                        {children === null ? (
                            <WidgetComponent
                                id={`widget-nokids-${widgetKey}`}
                                key={`widget-nokids-${widgetKey}`}
                                listen={(listeners, handlers) =>
                                    helpers.listen(listeners, handlers)
                                }
                                publishEvent={(eventName, payload) =>
                                    helpers.publishEvent(eventName, payload)
                                }
                                api={w}
                                {...params}
                                {...userPrefs}
                                backgroundColor={bgColor}
                                widgetConfig={helpers.config()}
                                widgetEventNames={helpers.events()}
                            />
                        ) : (
                            <WidgetComponent
                                listen={(listeners, handlers) =>
                                    helpers.listen(listeners, handlers)
                                }
                                publishEvent={(eventName, payload) =>
                                    helpers.publishEvent(eventName, payload)
                                }
                                api={w}
                                id={`widget-kids-${widgetKey}`}
                                key={`widget-kids-${widgetKey}`}
                                {...params}
                                {...userPrefs}
                                backgroundColor={bgColor}
                            >
                                {children}
                                {/* {WidgetFactory.renderChildren(children)} */}
                            </WidgetComponent>
                        )}
                    </WidgetErrorBoundary>
                </WidgetContext.Provider>
            );
        }
    } catch (e) {
        console.log(e.message);
        return null;
    }

    return null;
};

/**
 * WidgetFactory
 * Get the "component" and params and dynamically generate the Component
 */
const WidgetFactory = {
    getComponent: (component) => {
        try {
            return ComponentManager.getComponent(component);
        } catch (e) {
            return null;
        }
    },
    render: (component, key, params = {}, children = null) => {
        return (
            <WidgetRenderer
                component={component}
                widgetKey={key}
                params={params}
                children={children}
            />
        );
    },
    renderChildren: (children) => {
        return React.Children.map(children, (el) => {
            return el;
            // const clonedComponent = React.cloneElement(el);
            // return clonedComponent;
        });
    },
    /**
     * config
     * Get the developer's component configuration and enhance that configuration with
     * required fields if they are not present
     *
     * @param {object} component
     * @returns
     */
    config: (component) => {
        if (component) {
            const requiredFields = {
                type: { value: "text" },
                required: { value: false },
                options: { value: [] },
                defaultValue: { value: "" },
                events: [], // events that will be published
            };

            // get the component configuration from the map
            const components = ComponentManager.map();

            // let c = deepCopy(components['component']);
            let c = JSON.parse(JSON.stringify(components[component]));
            c["component"] = component;

            if ("userConfig" in c === false) {
                c["userConfig"] = {};
                return c;
            }

            let userPrefs = {};
            // now we can make sure the configuration is "complete"
            Object.keys(c["userConfig"]).forEach((key) => {
                // check the required fields!
                Object.keys(requiredFields).forEach((k) => {
                    if (k in c["userConfig"][key] === false) {
                        c["userConfig"][key][k] = requiredFields[k]["value"];
                    }
                });
                // tack on the user preferences
                userPrefs[key] = WidgetFactory.userPrefsForItem(
                    c,
                    key,
                    c["userConfig"][key]
                );
            });

            c["userPrefs"] = userPrefs;

            return c;
        }
        return null;
    },

    workspace: (component) => {
        const components = WidgetFactory.map();
        if (component !== undefined && components) {
            if (component in components) {
                const c = components[component];
                if ("workspace" in c) {
                    return c["workspace"];
                }
            }
        }
        return null;
    },

    map: () => ComponentManager.map(),

    /**
     * userConfig
     * We want to make sure all of the keys are available, and if not, set defaults...
     * @param {object} config the current configuration object
     * @returns
     */
    userPrefsForItem: (item, key, config) => {
        try {
            // console.log('value: ', item['userPrefs'][key]);
            // console.log('user prefs config item ', item, key, config);

            let prefsForItem = {};
            if ("userPrefs" in item) {
                if (key in item["userPrefs"]) {
                    prefsForItem = { [key]: item["userPrefs"][key] };
                } else {
                    if ("defaultValue" in config) {
                        prefsForItem = { [key]: config["defaultValue"] };
                    }
                }
            } else {
                // no user preferences in the item yet so we can try and set the defaults.
                // console.log('config item ', config);
                prefsForItem[key] =
                    "defaultValue" in config ? config["defaultValue"] : "";
            }

            // console.log('config item prefs ', prefsForItem);
            return prefsForItem;
        } catch (e) {
            return {};
        }
    },
};

export { WidgetFactory };
