import { DataTransformer } from "./DataTransformer";

export default {
    name: "DataTransformer",
    displayName: "Data Transformer",
    description:
        "Convert between CSV, JSON, TSV, and NDJSON formats. Paste or upload data, preview and edit columns, set field types, and export to any format.",
    component: DataTransformer,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    author: "Dash Team",
    icon: "shuffle",
    type: "widget",
    events: ["dataTransformed"],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Data Transformer",
            displayName: "Title",
            instructions: "Widget title",
            required: false,
        },
    },
};
