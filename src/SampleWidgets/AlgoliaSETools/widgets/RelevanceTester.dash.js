import { RelevanceTester } from "./RelevanceTester";

export default {
    name: "RelevanceTester",
    displayName: "Relevance Tester",
    description:
        "Run search queries, mark expected results, and measure relevance quality with precision, recall, and MRR metrics. Core demo tool for customer presentations.",
    component: RelevanceTester,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
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
