import { NotepadWidget } from "./NotepadWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.NotepadWidget",
    name: "NotepadWidget",
    displayName: "NotepadWidget",
    component: NotepadWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "sticky-note",
    description: "Persistent notes with auto-save and event publishing.",
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
            defaultValue: "Notepad",
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
