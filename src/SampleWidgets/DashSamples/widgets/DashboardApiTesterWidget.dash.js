import { DashboardApiTesterWidget } from "./DashboardApiTesterWidget";

const widgetDefinition = {
    packageName: "dash-samples",
    scope: "trops",
    id: "trops.dash-samples.DashboardApiTesterWidget",
    name: "DashboardApiTesterWidget",
    displayName: "Dashboard API Tester",
    component: DashboardApiTesterWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "flask",
    description:
        "Test widget for DashboardActionsApi: page navigation, sidebar control, notifications, dashboard nav, and read methods.",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-slate-900",
        borderColor: "border-slate-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Dashboard API Tester",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
