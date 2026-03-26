import { GongCallDetail } from "./GongCallDetail";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongCallDetail",
    name: "GongCallDetail",
    displayName: "Gong Call Detail",
    component: GongCallDetail,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "circle-info",
    description:
        "Call metadata and participants for a Gong call. Listens for callSelected events.",
    type: "widget",
    events: [],
    eventHandlers: ["callSelected"],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Call Detail",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
