import { SampleNotepadWidget } from "./SampleNotepadWidget";

const widgetDefinition = {
    name: "SampleNotepadWidget",
    displayName: "SampleNotepadWidget",
    component: SampleNotepadWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "sticky-note",
    description:
        "Demonstrates widget data persistence with storeData/readData.",
    type: "widget",
    events: ["noteSaved"],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-amber-900",
        borderColor: "border-amber-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Sample Notepad",
            displayName: "Title",
            required: false,
        },
        placeholder: {
            type: "text",
            defaultValue: "Type your notes here...",
            displayName: "Placeholder",
            required: false,
        },
        autoSave: {
            type: "select",
            defaultValue: "off",
            displayName: "Auto-Save",
            options: [
                { value: "off", displayName: "Off" },
                { value: "5s", displayName: "Every 5 seconds" },
                { value: "30s", displayName: "Every 30 seconds" },
            ],
        },
    },
};
export default widgetDefinition;
