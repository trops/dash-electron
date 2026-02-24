import { ComponentManager } from "../ComponentManager";
import { deepCopy } from "@trops/dash-react";
/**
 * ContextModel stores the context configuration object information for the application
 *
 */
export class ContextModel {
    /**
     * initialize the context model
     * @param {Object} item the context item
     */
    constructor(item) {
        this._initialize(item);
    }

    _initialize(item) {
        console.log("ContextModel _initialize", item);

        this.context = {};

        let obj = item !== null && item !== undefined ? deepCopy(item) : {};

        /**
         * @param {Number} id the unique id of the context that will be stored in the workspace configuration
         * and married to the component in the LayoutContexts during initialization of the dashboard.
         */
        this.id = "id" in obj ? obj["id"] : Date.now();

        /**
         * @param {String} name the name of the context
         */
        this.name = "name" in obj ? obj["name"] : "New Context";

        /**
         * @param {String} componentName the name of the component that this context is associated with
         */
        this.componentName =
            "componentName" in obj ? obj["componentName"] : null;

        /**
         * @param {Object} userPrefs the user preferences for this context supplied by the user
         */
        const componentConfig =
            this.componentName !== null
                ? ComponentManager.config(obj["componentName"]) || {}
                : {};
        const defaultUserPrefs = {};

        // set this as the default, then check the userConfig for any overrides
        this.userPrefs = {};

        // make sure we have some keys in there prior to setting the userPrefs
        if (
            componentConfig &&
            Object.keys(componentConfig.userConfig).length > 0
        ) {
            Object.keys(componentConfig.userConfig).forEach((key) => {
                defaultUserPrefs[key] =
                    componentConfig.userConfig[key].defaultValue || "";
            });
            const userConfigKeys = Object.keys(componentConfig.userConfig);
            const userPrefKeys = Object.keys(obj["userPrefs"] || {});

            this.userPrefs =
                userConfigKeys !== userPrefKeys
                    ? defaultUserPrefs
                    : obj["userPrefs"] || {};
        }

        /**
         * @param {Object} userConfig the user config inputs for this context supplied by the developer
         */
        this.userConfig =
            "userConfig" in obj
                ? obj["userConfig"]
                : componentConfig
                ? componentConfig.userConfig
                : {};

        obj = null;
    }

    context() {
        return {
            id: this.id,
            name: this.name,
            componentName: this.componentName,
            userPrefs: this.userPrefs,
            userConfig: this.userConfig,
        };
    }
}
