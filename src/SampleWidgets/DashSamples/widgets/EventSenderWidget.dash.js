import { EventSenderWidget } from "./EventSenderWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.EventSenderWidget",
    name: "EventSenderWidget",
    displayName: "EventSenderWidget",
    component: EventSenderWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "paper-plane",
    description: "Event publishing via useWidgetEvents().publishEvent().",
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
