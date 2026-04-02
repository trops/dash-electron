import { AlgoliaTypoToleranceWidget } from "./AlgoliaTypoToleranceWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaTypoToleranceWidget",
    name: "AlgoliaTypoToleranceWidget",
    displayName: "Algolia Typo Tolerance",
    component: AlgoliaTypoToleranceWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "spell-check",
    description:
        "Configure typo tolerance — tolerance mode, minimum word sizes, numeric tokens, and per-attribute disabling.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-fuchsia-900",
        borderColor: "border-fuchsia-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Typo Tolerance",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
