/*
 "component": AnalyticsReportsWidget,
    "type":"widget",
    "workspace":"algolia-analytics",
    "canHaveChildren": false,
    "userConfig": {
        "report": { type: 'select', displayName: "Report Type", instructions: "Select the report from the list", options: [
            {
                value: '',
                displayName: 'User Select'
            },
            {
                value: 'top-searches',
                displayName: 'Top Searches'
            },
            {
                value: 'top-searches-count',
                displayName: 'Top Searches Count',
            },
            {
                value: 'no-results',
                displayName: 'No Results',
            },
            {
                value: 'query-analytics',
                displayName: 'Query Analytics',
            }
        ], required: false },
        "indexName": { type: "text", defaultValue: "dev_find_accelerator", instructions: "Type the name of the index you wish to search", options: [], displayName: "Index Name", required: true },
        "appId": { type: "text", defaultValue: process.env.REACT_APP_APP_ID, instructions: "Type the name of the appId", options: [], displayName: "App Id", required: true },
        "apiKey": { type: "secret", defaultValue: process.env.REACT_APP_ALGOLIA_KEY, instructions: "Type the api key for this appId", options: [], displayName: "Api Key", required: true },
    },
    "styles": {
        "backgroundColor": "bg-blue-900",
        "borderColor": "border-blue-900"
    },
    "events": ["fetchAnalyticsComplete"],
    "eventHandlers":['handleSearchChange','handleRefinementChange']
*/
/**
 * ComponentConfigModel
 * @param {object} o the data passed in to generate the model
 * @returns <ComponentConfigModel>Object
 */
export const ComponentConfigModel = (obj = {}) => {
    /**
     * id
     * The unique identifer for the component
     */
    obj.id = "id" in obj ? obj["id"] : null;

    /**
     * name
     * The name of the component for display purposes
     */
    obj.name = "name" in obj ? obj["name"] : "My Workspace";

    /**
     * type
     * The type of component (widget|workspace)
     */
    obj.type = "type" in obj ? obj["type"] : "workspace";

    obj.contexts = "contexts" in obj ? obj["contexts"] : [];

    /**
     * workspace
     * The workspace this component belongs to
     */
    obj.workspace = "workspace" in obj ? obj["workspace"] : "workspace-dash";

    /**
     * userConfig
     * Allow the end users to edit/input parameters into the edit widget layout panel
     */
    obj.userConfig = "userConfig" in obj ? obj["userConfig"] : {};

    /**
     * canHaveChildren
     * If the component is allowed to have child components
     */
    obj.canHaveChildren =
        "canHaveChildren" in obj ? obj["canHaveChildren"] : false;

    /**
     * events
     * The events that the component is emitting
     */
    obj.events = "events" in obj ? obj["events"] : [];

    /**
     * eventHandlers
     * The Names of the functions that are listened to in the component and can be handled inside the component
     */
    obj.eventHandlers = "eventHandlers" in obj ? obj["eventHandlers"] : [];

    /**
     * layout builder styles
     */
    obj.styles =
        "styles" in obj
            ? obj["styles"]
            : {
                  backgroundColor: "bg-blue-800",
                  borderColor: "border-blue-900",
              };

    obj.author = "author" in obj ? obj["author"] : null;
    obj.description = "description" in obj ? obj["description"] : null;
    obj.icon = "icon" in obj ? obj["icon"] : null;
    obj.package = "package" in obj ? obj["package"] : null;
    obj.providers = "providers" in obj ? obj["providers"] : [];

    return obj;
};
