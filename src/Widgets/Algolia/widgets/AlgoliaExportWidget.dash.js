import { AlgoliaExportWidget } from "./AlgoliaExportWidget";

const widgetDefinition = {
    name: "AlgoliaExportWidget",
    displayName: "Algolia Export",
    component: AlgoliaExportWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "file-export",
    description:
        "Export Algolia index records to a JSON file with progress tracking.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-amber-900",
        borderColor: "border-amber-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Export",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
