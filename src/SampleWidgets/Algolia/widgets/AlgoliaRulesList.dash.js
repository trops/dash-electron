import { AlgoliaRulesList } from "./AlgoliaRulesList";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaRulesList",
    name: "AlgoliaRulesList",
    displayName: "Algolia Rules List",
    component: AlgoliaRulesList,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "list-check",
    description:
        "Paginated list of an Algolia index's rules with enabled state, condition/action counts, and search filtering. Publishes ruleSelected when a rule is clicked; listens for indexSelected to swap indices on the fly.",
    type: "widget",
    events: ["ruleSelected"],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Rules",
            displayName: "Title",
            instructions:
                "Header shown above the rules list. Defaults to 'Algolia Rules'.",
            required: false,
        },
        indexName: {
            type: "text",
            defaultValue: "",
            displayName: "Index Name",
            instructions:
                "Algolia index whose rules to show (e.g. 'products'). Leave blank to wait for an indexSelected event from a paired widget. Required for standalone use.",
            required: false,
        },
        hitsPerPage: {
            type: "number",
            defaultValue: 25,
            displayName: "Rules per page",
            instructions:
                "How many rules to fetch per page (1–1000). The list paginates automatically when the index has more than this many rules.",
            required: false,
        },
    },
};
export default widgetDefinition;
