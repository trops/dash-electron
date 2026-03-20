import { NotificationWidget } from "./NotificationWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.NotificationWidget",
    name: "NotificationWidget",
    displayName: "NotificationWidget",
    component: NotificationWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "bell",
    description: "Notification API demo via useNotifications().notify().",
    type: "widget",
    events: [],
    eventHandlers: [],
    notifications: [
        {
            key: "info",
            displayName: "Info",
            description: "Informational notification",
            defaultEnabled: true,
        },
        {
            key: "success",
            displayName: "Success",
            description: "Success notification",
            defaultEnabled: true,
        },
        {
            key: "warning",
            displayName: "Warning",
            description: "Warning notification",
            defaultEnabled: true,
        },
        {
            key: "critical",
            displayName: "Critical Alert",
            description: "Critical alert notification",
            defaultEnabled: true,
        },
    ],
    styles: {
        backgroundColor: "bg-rose-900",
        borderColor: "border-rose-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Notifications",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
