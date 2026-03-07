import { AlgoliaBatchManagerWidget } from "./AlgoliaBatchManagerWidget";

const widgetDefinition = {
    name: "AlgoliaBatchManagerWidget",
    displayName: "Algolia Batch Manager",
    component: AlgoliaBatchManagerWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "upload",
    description:
        "Bulk upload and update Algolia records from JSON files with batch splitting and progress tracking.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-rose-900",
        borderColor: "border-rose-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Batch Manager",
            displayName: "Title",
            required: false,
        },
        defaultBatchSize: {
            type: "number",
            defaultValue: 500,
            displayName: "Default Batch Size",
            instructions: "Number of records per batch (default 500)",
            required: false,
        },
    },
};
export default widgetDefinition;
