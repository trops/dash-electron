import { ReaderWidget } from "./ReaderWidget";

const widgetDefinition = {
    name: "ReaderWidget",
    displayName: "ReaderWidget",
    component: ReaderWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "book-open",
    description:
        "Receives noteSaved events from NotepadWidget and displays notes.",
    type: "widget",
    events: [],
    eventHandlers: ["onNoteSaved"],
    styles: {
        backgroundColor: "bg-teal-900",
        borderColor: "border-teal-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Note Reader",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
