import { ComponentManager } from "../ComponentManager";
import { deepCopy } from "@trops/dash-react";
import { getNearestParentWorkspace } from "../utils/layout";
/**
 * The model for all layout components used primarily in the renderLayout method
 * @param {Object} layoutItem an object containing various attributes of the layout item
 * @param {Object} workspaceLayout the layout property from the DashboardModel
 * @param {Number} dashboardId the id of the dashboard we are making
 * @returns {Object} the layout object to be rendered
 */

function sortObjectByKeys(obj) {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
        sortedObj[key] = obj[key];
    }
    return sortedObj;
}

export const LayoutModel = (layoutItem, workspaceLayout, dashboardId) => {
    try {
        if (layoutItem === null || layoutItem === undefined) {
            return null;
        }
        const obj = deepCopy(layoutItem);
        const layout = {};

        /**
         * @param {Number} id the unique id of the layout item
         */
        layout.id = "id" in obj ? obj["id"] : 1;

        /**
         * @param {Number} order the order in which this layout item will be rendered
         * @deprecated Use grid cell positioning instead of flexbox order
         */
        layout.order = "order" in obj ? obj.order : 1;

        /**
         * @param {Boolean} scrollable if the layout item can scroll
         */
        layout.scrollable =
            "scrollable" in obj
                ? obj["scrollable"] === "false" || obj["scrollable"] === false
                    ? false
                    : true
                : false;

        /**
         * @param {Boolean} space Add spacing between child elements
         * @deprecated Use grid gap property instead
         */
        layout.space =
            "space" in obj
                ? obj["space"] === "false" || obj["space"] === false
                    ? false
                    : true
                : false;

        /**
         * @param {Boolean} grow Allow container to grow to fill available space
         * @deprecated Grid layouts handle sizing automatically
         */
        layout.grow =
            "grow" in obj
                ? obj["grow"] === "false" || obj["grow"] === false
                    ? false
                    : true
                : false;

        layout.component = "component" in obj ? obj.component : "Container";

        /**
         * @param {Array} contexts the contexts in which this layout item can be used
         */
        layout.contexts = "contexts" in obj ? obj.contexts : [];

        // could be a component name as well...
        if ("componentName" in obj) {
            layout.component = obj["componentName"];
        }

        /**
         * @param {String} direction Layout direction (row|col)
         * @deprecated Use grid layout instead of flexbox direction
         */
        layout.direction = "direction" in obj ? obj.direction : "col";

        /**
         * @param {Boolean} hasChildren if the container has children, but potentially deprecated for canHaveChildren
         */
        layout.hasChildren = "hasChildren" in obj ? obj.hasChildren : 0;

        /**
         * @param {Boolean} canHaveChildren if the layout item can have children (if widget - cannot!)
         */
        layout.canHaveChildren =
            "canHaveChildren" in obj
                ? obj.canHaveChildren !== undefined
                    ? obj.canHaveChildren
                    : obj.type !== "widget"
                : true;

        layout.width = "width" in obj ? obj.width : "w-full";
        layout.height = "height" in obj ? obj.height : "h-full";
        layout.parent = "parent" in obj ? obj.parent : 0;

        /**
         * @param {String} type The type of the component (widget|grid|workspace|layout)
         * Note: "grid" is the new primary container type, "layout"/"workspace" are deprecated
         */
        layout.type = "type" in obj ? obj.type : "layout";

        /**
         * @param {String} workspace The name of the Workspace the component belongs to (can exist in as a child)
         */
        layout.workspace = "workspace" in obj ? obj.workspace : "layout";

        // Space and Grow

        // Add the MAIN workspace that
        layout.dashboardId = dashboardId;

        /**
         * @param {Object} listeners Event listeners and corresponding handlers exposed by the developer in the configuration
         */
        layout.listeners = "listeners" in obj ? obj["listeners"] : {};

        /**
         * @param {Array} events the events this widget can publish
         */
        layout.events = "events" in obj ? obj["events"] : [];

        /**
         * @param {Array} eventHandlers the available event handler (naming) for the layout item
         */
        layout.eventHandlers =
            "eventHandlers" in obj ? obj["eventHandlers"] : [];

        layout.siblingCount = "siblingCount" in obj ? obj["siblingCount"] : 0;

        // let's get some specifics from the configuration file
        // just in case these were missing

        // layout.componentData = ComponentManager.getComponent(layout.component);

        // generate a unique name so that we can store files, publish events etc
        // all with this very specific identifier

        layout.uuid =
            dashboardId !== undefined
                ? `${dashboardId}-${layout["component"]}-${layout.id}`
                : `${layout["component"]}-${layout.id}`;

        /// widget configuration
        const widgetConfig = ComponentManager.config(layout["component"], obj);
        layout.userPrefs = {};
        layout.widgetConfig = widgetConfig;
        if (widgetConfig !== null && widgetConfig !== undefined) {
            layout.userPrefs =
                "userPrefs" in widgetConfig ? widgetConfig["userPrefs"] : {};

            // Always refresh events/eventHandlers from the component config
            // (developer-defined, should reflect the latest widget definition)
            if (Array.isArray(widgetConfig.events)) {
                layout.events = widgetConfig.events;
            }
            if (Array.isArray(widgetConfig.eventHandlers)) {
                layout.eventHandlers = widgetConfig.eventHandlers;
            }
        }

        // Merge user-entered config values (from EnhancedWidgetDropdown) into userPrefs
        if ("userConfigValues" in obj && obj.userConfigValues) {
            layout.userPrefs = {
                ...layout.userPrefs,
                ...obj.userConfigValues,
            };
        }

        // Preserve provider selections for this widget
        layout.selectedProviders =
            "selectedProviders" in obj ? obj.selectedProviders : {};

        /**
         * @param {Object} grid Grid layout configuration
         * Structure: {
         *   rows: Number,
         *   cols: Number,
         *   gap: String (Tailwind class, e.g., "gap-4"),
         *   "row.col": {
         *     component: Number (layout item ID),
         *     hide: Boolean,
         *     span: { row: Number, col: Number } // For merged cells (future enhancement)
         *   }
         * }
         */
        layout.grid = "grid" in obj ? obj["grid"] : null;

        // Enhance grid structure with defaults if grid exists
        if (layout.grid !== null) {
            // Ensure grid has rows and cols
            if (!layout.grid.rows) layout.grid.rows = 1;
            if (!layout.grid.cols) layout.grid.cols = 1;

            // Set default gap if not specified
            if (!layout.grid.gap) layout.grid.gap = "gap-2";

            // Sort grid object keys for consistent ordering
            layout.grid = sortObjectByKeys(layout.grid);

            // If type is not explicitly set and grid exists, set type to "grid"
            if (layout.type === "layout" && "grid" in obj) {
                layout.type = "grid";
            }
        }

        layout.parentWorkspaceName =
            "parentWorkspaceName" in obj ? obj["parentWorkspaceName"] : null;

        // last check for this being a container...
        // we are forcing ALL containers to be w full and h full
        // not sure this is a good idea, but...
        if ("workspace" in layout || layout.type !== "widget") {
            // if (layout.workspace === "layout") {
            if (layout.width === "") {
                layout.width = "w-full";
            }
            // if (layout.height === "") {
            layout.height = "h-full";
            // }
            // if (layout.scrollable === "") {
            //     layout.scrollable = true;
            // }
            if (layout.direction === "") {
                layout.direction = "col";
            }
            // }
        }

        // lets check to see if we already have the parent workspace?
        if (layout.parentWorkspaceName === null) {
            // get the nearest workspace and assign this as the parent for rendering
            const tempLayout = deepCopy(layout);
            const parentWS = getNearestParentWorkspace(
                workspaceLayout,
                tempLayout,
                tempLayout
            );

            let parentWorkspaceName = "layout";
            if (parentWS) {
                if ("workspace" in parentWS) {
                    parentWorkspaceName = parentWS["workspace"];
                }
            }
            layout.parentWorkspaceName = parentWorkspaceName;
        }
        return layout;
    } catch (e) {
        return null;
    }
};
