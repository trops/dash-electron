/**
 * TemplateWorkspace.dash.js
 *
 * This file contains the configuration of the Workspace/Widget
 * The information contained in this configuration will let Dash know how this component
 * should behave, expose inputs to the users to customize the component, styles, and more.
 *
 * @param {string} name the name of your Widget
 * @param {object} component the actual React Component (super important!)
 * @param {boolean} canHaveChildren whether this Workspace can have children (useless for Widgets)
 * @param {string} workspace the unique workspace identifier (similar to a package name). Any widget with a similar workspace identifier can be used in layout
 * @param {string} type the type of component, at the moment "widget" and "workspace" are the options.
 * @param {object} userConfig
 */
import { TemplateWorkspace } from "./TemplateWorkspace";

const workspaceDefinition = {
    name: "TemplateWorkspace",
    component: TemplateWorkspace,
    canHaveChildren: true,
    workspace: "TemplateWorkspace-workspace",
    author: "Dash Team",
    type: "workspace",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-900",
    },
    userConfig: {},
};
export default workspaceDefinition;
