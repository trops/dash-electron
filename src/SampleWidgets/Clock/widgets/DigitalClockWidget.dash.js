import { DigitalClockWidget } from "./DigitalClockWidget";

const widgetDefinition = {
    packageName: "clock",
    scope: "trops",
    id: "trops.clock.DigitalClockWidget",
    name: "DigitalClockWidget",
    displayName: "Digital Clock",
    component: DigitalClockWidget,
    canHaveChildren: false,
    workspace: "Clock-workspace",
    package: "Clock",
    author: "Dash Team",
    icon: "stopwatch",
    description:
        "Bold digital time display with optional blinking colon, date, and AM/PM badge.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-gray-950",
        borderColor: "border-gray-800",
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
        blinkColon: {
            type: "select",
            defaultValue: "true",
            displayName: "Blinking Colon",
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
