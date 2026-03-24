import { MinimalTextClockWidget } from "./MinimalTextClockWidget";

const widgetDefinition = {
    packageName: "clock",
    scope: "trops",
    id: "trops.clock.MinimalTextClockWidget",
    name: "MinimalTextClockWidget",
    displayName: "Minimal Text Clock",
    component: MinimalTextClockWidget,
    canHaveChildren: false,
    workspace: "Clock-workspace",
    package: "Clock",
    author: "Dash Team",
    icon: "quote-left",
    description:
        "Spells out the time in natural English with optional greeting and numeric reference.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-zinc-900",
        borderColor: "border-zinc-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "",
            displayName: "Title",
            required: false,
        },
        showGreeting: {
            type: "select",
            defaultValue: "true",
            displayName: "Show Greeting",
            required: false,
            options: [
                { displayName: "Yes", value: "true" },
                { displayName: "No", value: "false" },
            ],
        },
        showNumeric: {
            type: "select",
            defaultValue: "true",
            displayName: "Show Numeric Time",
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
