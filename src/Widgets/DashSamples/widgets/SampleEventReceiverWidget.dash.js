import { SampleEventReceiverWidget } from "./SampleEventReceiverWidget";

const widgetDefinition = {
    name: "SampleEventReceiverWidget",
    displayName: "SampleEventReceiverWidget",
    component: SampleEventReceiverWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "inbox",
    description: "Demonstrates event listening via useWidgetEvents().listen().",
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
