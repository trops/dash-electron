import { GongCallSummary } from "./GongCallSummary";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongCallSummary",
    name: "GongCallSummary",
    displayName: "Gong Call Summary",
    component: GongCallSummary,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "file-lines",
    description:
        "AI-generated summary for a Gong call. Listens for callSelected events.",
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
            defaultValue: "Call Summary",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
