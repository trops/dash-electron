import { GongCallSearch } from "./GongCallSearch";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongCallSearch",
    name: "GongCallSearch",
    displayName: "Gong Call Search",
    component: GongCallSearch,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "magnifying-glass",
    description:
        "Search and browse Gong calls. Click a call to publish callSelected for other widgets.",
    type: "widget",
    events: ["callSelected"],
    eventHandlers: [],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gong Calls",
            displayName: "Title",
            required: false,
        },
        defaultDaysBack: {
            type: "text",
            defaultValue: "30",
            displayName: "Days Back",
            instructions: "Number of days back to show calls",
            required: false,
        },
    },
};
export default widgetDefinition;
