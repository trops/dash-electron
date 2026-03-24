import { FlipClockWidget } from "./FlipClockWidget";

const widgetDefinition = {
    packageName: "clock",
    scope: "trops",
    id: "trops.clock.FlipClockWidget",
    name: "FlipClockWidget",
    displayName: "Flip Clock",
    component: FlipClockWidget,
    canHaveChildren: false,
    workspace: "Clock-workspace",
    package: "Clock",
    author: "Dash Team",
    icon: "layer-group",
    description:
        "Retro split-flap style clock with dark cards and horizontal dividers.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-neutral-900",
        borderColor: "border-neutral-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "",
            displayName: "Title",
            required: false,
        },
        showSeconds: {
            type: "select",
            defaultValue: "true",
            displayName: "Show Seconds",
            required: false,
            options: [
                { displayName: "Yes", value: "true" },
                { displayName: "No", value: "false" },
            ],
        },
        hourFormat: {
            type: "select",
            defaultValue: "12",
            displayName: "Hour Format",
            required: false,
            options: [
                { displayName: "12-hour", value: "12" },
                { displayName: "24-hour", value: "24" },
            ],
        },
        showDate: {
            type: "select",
            defaultValue: "true",
            displayName: "Show Date",
            required: false,
            options: [
                { displayName: "Yes", value: "true" },
                { displayName: "No", value: "false" },
            ],
        },
        timezone: {
            type: "text",
            defaultValue: "",
            displayName: "Timezone (e.g. America/New_York)",
            required: false,
        },
    },
};
export default widgetDefinition;
