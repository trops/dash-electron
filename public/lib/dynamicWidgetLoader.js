/**
 * Dynamic Widget Loader
 *
 * Loads React components and configurations from downloaded/local widget paths
 * Works with widgets that follow the Dash widget structure:
 * - widgets/
 *   - WidgetName.js (React component)
 *   - WidgetName.dash.js (configuration)
 *
 * Integrates with ComponentManager for automatic registration
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { findWidgetsDir } = require("./widgetCompiler");

class DynamicWidgetLoader {
    constructor(componentManager = null) {
        this.loadedWidgets = new Map();
        this.moduleCache = new Map();
        this.componentManager = componentManager;
    }

    /**
     * Set ComponentManager instance for automatic widget registration
     * @param {Object} manager - ComponentManager instance from @trops/dash-react
     */
    setComponentManager(manager) {
        this.componentManager = manager;
    }

    /**
     * Load a widget from a local path
     * @param {string} widgetName - Name of the widget (e.g., "MyFirstWidget")
     * @param {string} widgetPath - Path to the widget directory
     * @param {string} componentName - Name of the component file (e.g., "MyFirstWidgetWidget")
     * @param {boolean} autoRegister - Automatically register with ComponentManager (if available)
     * @returns {Promise<Object>} { component, config, registered }
     */
    async loadWidget(
        widgetName,
        widgetPath,
        componentName,
        autoRegister = true
    ) {
        try {
            const cacheKey = `${widgetName}:${componentName}`;

            if (this.loadedWidgets.has(cacheKey)) {
                console.log(
                    `[DynamicWidgetLoader] Loading ${widgetName} from cache`
                );
                return this.loadedWidgets.get(cacheKey);
            }

            console.log(
                `[DynamicWidgetLoader] Loading widget: ${widgetName} from ${widgetPath}`
            );

            const widgetsDir =
                findWidgetsDir(widgetPath) || path.join(widgetPath, "widgets");
            const componentPath = path.join(widgetsDir, `${componentName}.js`);
            const configPath = path.join(
                widgetsDir,
                `${componentName}.dash.js`
            );

            if (!fs.existsSync(componentPath)) {
                throw new Error(`Component file not found: ${componentPath}`);
            }
            if (!fs.existsSync(configPath)) {
                throw new Error(`Config file not found: ${configPath}`);
            }

            const config = await this.loadConfigFile(configPath);

            const component = {
                path: componentPath,
                name: componentName,
            };

            let registered = false;

            if (autoRegister && this.componentManager) {
                try {
                    this.componentManager.registerWidget(config, componentName);
                    registered = true;
                    console.log(
                        `[DynamicWidgetLoader] ✓ Registered ${componentName} with ComponentManager`
                    );
                } catch (regError) {
                    console.warn(
                        `[DynamicWidgetLoader] Failed to register with ComponentManager:`,
                        regError
                    );
                }
            }

            const result = { component, config, registered };
            this.loadedWidgets.set(cacheKey, result);

            return result;
        } catch (error) {
            console.error(
                `[DynamicWidgetLoader] Error loading widget ${widgetName}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Load and parse a .dash.js configuration file
     * @param {string} configPath - Path to the .dash.js file
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfigFile(configPath) {
        try {
            const source = fs.readFileSync(configPath, "utf8");

            const exportMatch = source.match(
                /export\s+default\s+({[\s\S]*});?\s*$/
            );

            if (!exportMatch) {
                throw new Error("Could not find default export in config file");
            }

            const exportedObjectStr = exportMatch[1];

            const context = vm.createContext({ module: { exports: {} } });
            vm.runInContext(`module.exports = ${exportedObjectStr}`, context);

            return context.module.exports;
        } catch (error) {
            console.error(`[DynamicWidgetLoader] Error loading config:`, error);
            throw error;
        }
    }

    /**
     * Discover available widgets in a directory
     * @param {string} widgetPath - Path to search for widgets
     * @returns {Array} List of available widget names
     */
    discoverWidgets(widgetPath) {
        try {
            const widgetsDir = findWidgetsDir(widgetPath);
            if (!widgetsDir) {
                return [];
            }

            const files = fs.readdirSync(widgetsDir);
            const widgets = new Set();

            files.forEach((file) => {
                if (file.endsWith(".dash.js")) {
                    const componentName = file.replace(".dash.js", "");
                    widgets.add(componentName);
                }
            });

            return Array.from(widgets);
        } catch (error) {
            console.error(
                `[DynamicWidgetLoader] Error discovering widgets:`,
                error
            );
            return [];
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.loadedWidgets.clear();
        this.moduleCache.clear();
    }
}

const dynamicWidgetLoader = new DynamicWidgetLoader();

module.exports = DynamicWidgetLoader;
module.exports.dynamicWidgetLoader = dynamicWidgetLoader;
