import { SocketWidget } from "./SocketWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.SocketWidget",
    name: "SocketWidget",
    displayName: "SocketWidget",
    component: SocketWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "plug",
    description: "WebSocket connection lifecycle and message exchange.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "websocket", providerClass: "websocket", required: true },
    ],
    styles: {
        backgroundColor: "bg-cyan-900",
        borderColor: "border-cyan-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Socket Connection",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
