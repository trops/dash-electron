import { SampleEventSenderWidget } from "./SampleEventSenderWidget";

const widgetDefinition = {
    name: "SampleEventSenderWidget",
    displayName: "SampleEventSenderWidget",
    component: SampleEventSenderWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "paper-plane",
    description:
        "Demonstrates event publishing via useWidgetEvents().publishEvent().",
    type: "widget",
    events: ["buttonClicked", "messageSent"],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Event Sender",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
