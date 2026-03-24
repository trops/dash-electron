import { EventReceiverWidget } from "./EventReceiverWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.EventReceiverWidget",
    name: "EventReceiverWidget",
    displayName: "EventReceiverWidget",
    component: EventReceiverWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "inbox",
    description: "Event listening via useWidgetEvents().listen().",
    type: "widget",
    events: [],
    eventHandlers: ["onEventReceived"],
    styles: {
        backgroundColor: "bg-indigo-900",
        borderColor: "border-indigo-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Event Receiver",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
