import { GongTrackers } from "./GongTrackers";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongTrackers",
    name: "GongTrackers",
    displayName: "Gong Trackers",
    component: GongTrackers,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "crosshairs",
    description: "View Gong keyword tracker definitions and tracked phrases.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Keyword Trackers",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
