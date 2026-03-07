import { ThemeViewerWidget } from "./ThemeViewerWidget";

const widgetDefinition = {
    name: "ThemeViewerWidget",
    displayName: "ThemeViewerWidget",
    component: ThemeViewerWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "palette",
    description: "Theme inspection and preview using ThemeContext.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-violet-900",
        borderColor: "border-violet-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Theme Viewer",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
