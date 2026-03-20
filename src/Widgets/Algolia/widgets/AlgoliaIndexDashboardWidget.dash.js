import { AlgoliaIndexDashboardWidget } from "./AlgoliaIndexDashboardWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaIndexDashboardWidget",
    name: "AlgoliaIndexDashboardWidget",
    displayName: "Algolia Index Dashboard",
    component: AlgoliaIndexDashboardWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "database",
    description:
        "Overview of all Algolia indices with record counts, sizes, and metadata.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Indices",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
