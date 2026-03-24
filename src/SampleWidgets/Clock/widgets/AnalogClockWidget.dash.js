import { AnalogClockWidget } from "./AnalogClockWidget";

const widgetDefinition = {
    packageName: "clock",
    scope: "trops",
    id: "trops.clock.AnalogClockWidget",
    name: "AnalogClockWidget",
    displayName: "Analog Clock",
    component: AnalogClockWidget,
    canHaveChildren: false,
    workspace: "Clock-workspace",
    package: "Clock",
    author: "Dash Team",
    icon: "clock",
    description:
        "Classic circular clock face with hour, minute, and second hands.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-slate-900",
        borderColor: "border-slate-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Analog Clock",
            displayName: "Title",
            required: false,
        },
        showSeconds: {
            type: "select",
            defaultValue: "true",
            displayName: "Show Seconds Hand",
            required: false,
            options: [
                { displayName: "Yes", value: "true" },
                { displayName: "No", value: "false" },
            ],
        },
        showDigital: {
            type: "select",
            defaultValue: "false",
            displayName: "Show Digital Readout",
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
        timezone: {
            type: "text",
            defaultValue: "",
            displayName: "Timezone (e.g. America/New_York)",
            required: false,
        },
    },
};
export default widgetDefinition;
