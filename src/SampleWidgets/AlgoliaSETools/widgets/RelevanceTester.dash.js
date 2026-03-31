import { RelevanceTester } from "./RelevanceTester";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.RelevanceTester",
    name: "RelevanceTester",
    displayName: "Relevance Tester",
    description:
        "Run search queries, mark expected results, and measure relevance quality with precision, recall, and MRR metrics. Core demo tool for customer presentations.",
    component: RelevanceTester,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "bullseye",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Relevance Tester",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
