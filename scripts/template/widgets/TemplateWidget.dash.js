import { TemplateWidget } from "./TemplateWidget";

/**
 * Widget & Workspace Configuration options
 *
 * For detailed provider configuration documentation, see:
 * docs/WIDGET_PROVIDER_CONFIGURATION.md
 *
 * @example
 * {
 * "component": AnalyticsReportsWidget,
 *  "type":"widget",
 *  "workspace":"algolia-analytics",
 *  "author":"Your Name or Organization",
 * "canHaveChildren": false,
 *  "providers": [
 *      {
 *          type: "algolia",
 *          required: true,
 *          credentialSchema: {
 *              appId: {
 *                  type: "text",
 *                  displayName: "Application ID",
 *                  instructions: "Your Algolia Application ID",
 *                  required: true,
 *                  secret: true
 *              },
 *              apiKey: {
 *                  type: "text",
 *                  displayName: "API Key",
 *                  instructions: "Your Algolia API Key",
 *                  required: true,
 *                  secret: true
 *              }
 *          }
 *      }
 *  ],
 *  "userConfig": {
 *      "report": { type: 'select', displayName: "Report Type", instructions: "Select the report from the list", options: [
            {
                value: '',
                displayName: 'User Select'
            },
        ], required: false },
        "indexName": { type: "text", defaultValue: "dev_find_accelerator", instructions: "Type the name of the index you wish to search", options: [], displayName: "Index Name", required: true },
    },
    "styles": {
        "backgroundColor": "bg-blue-900",
        "borderColor": "border-blue-900"
    },
    "events": ["fetchAnalyticsComplete"],
    "eventHandlers":['handleSearchChange','handleRefinementChange']
    },
 */
export default {
    name: "TemplateWidget",
    displayName: "TemplateWidget",
    component: TemplateWidget,
    canHaveChildren: false,
    workspace: "TemplateWorkspace-workspace",
    author: "Your Name or Organization", // Used for filtering in widget dropdown
    type: "widget",
    events: [],
    eventHandlers: [],
    // Provider configuration (optional)
    // Uncomment and configure if your widget requires external services
    // providers: [
    //     {
    //         type: "api-name",           // e.g., "slack", "algolia", "github"
    //         required: true,             // Is this provider required?
    //         credentialSchema: {
    //             apiKey: {
    //                 type: "text",
    //                 displayName: "API Key",
    //                 instructions: "Enter your API key",
    //                 required: true,
    //                 secret: true        // Will be encrypted
    //             }
    //         }
    //     }
    // ],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-900",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Hi.",
            instructions: "Type in the title for your widget.",
            options: [],
            displayName: "Title",
            required: false,
        },
        subtitle: {
            type: "text",
            defaultValue: "I am a widget :-)",
            instructions: "Type in the sub title for your widget.",
            options: [],
            displayName: "SubTitle",
            required: false,
        },
    },
};
