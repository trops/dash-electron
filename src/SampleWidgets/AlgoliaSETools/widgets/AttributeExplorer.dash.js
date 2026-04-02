import { AttributeExplorer } from "./AttributeExplorer";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.AttributeExplorer",
    name: "AttributeExplorer",
    displayName: "Attribute Explorer",
    description:
        "Scan Algolia index records to discover all attributes, their types, cardinality, fill rates, and sample values. Helps SEs understand customer data before configuring.",
    component: AttributeExplorer,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "table-cells",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Attribute Explorer",
            displayName: "Title",
            required: false,
        },
        sampleSize: {
            type: "select",
            defaultValue: "100",
            displayName: "Sample Size",
            instructions: "Number of records to sample for analysis",
            options: [
                { label: "50 records", value: "50" },
                { label: "100 records", value: "100" },
                { label: "250 records", value: "250" },
                { label: "500 records", value: "500" },
                { label: "1000 records", value: "1000" },
            ],
        },
    },
};
export default widgetDefinition;
