import { SampleThemeViewerWidget } from "./SampleThemeViewerWidget";

const widgetDefinition = {
    name: "SampleThemeViewerWidget",
    displayName: "SampleThemeViewerWidget",
    component: SampleThemeViewerWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "palette",
    description: "Demonstrates ThemeContext and useDashboard hook.",
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
