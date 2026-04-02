import { AlgoliaPaginationWidget } from "./AlgoliaPaginationWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaPaginationWidget",
    name: "AlgoliaPaginationWidget",
    displayName: "Algolia Pagination Settings",
    component: AlgoliaPaginationWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "list-ol",
    description:
        "Configure pagination limits — hits per page, max pagination depth, and facet value counts.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-slate-800",
        borderColor: "border-slate-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Pagination Settings",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
