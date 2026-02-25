import { SampleReaderWidget } from "./SampleReaderWidget";

const widgetDefinition = {
    name: "SampleReaderWidget",
    displayName: "SampleReaderWidget",
    component: SampleReaderWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "book-open",
    description:
        "Listens for noteSaved events from SampleNotepadWidget and displays received notes.",
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
