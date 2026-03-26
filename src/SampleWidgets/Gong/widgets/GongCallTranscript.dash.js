import { GongCallTranscript } from "./GongCallTranscript";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongCallTranscript",
    name: "GongCallTranscript",
    displayName: "Gong Call Transcript",
    component: GongCallTranscript,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "comment-dots",
    description:
        "Speaker-attributed transcript for a Gong call. Listens for callSelected events.",
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
            defaultValue: "Call Transcript",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
