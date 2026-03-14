import { SchedulerWidget } from "./SchedulerWidget";

const widgetDefinition = {
    name: "SchedulerWidget",
    displayName: "SchedulerWidget",
    component: SchedulerWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "clock",
    description: "Scheduler API demo via useScheduler() hook.",
    type: "widget",
    events: [],
    eventHandlers: [],
    scheduledTasks: [
        {
            key: "refreshData",
            handler: "refreshData",
            displayName: "Refresh Data",
            description: "Simulate refreshing data from an external source",
        },
        {
            key: "generateReport",
            handler: "generateReport",
            displayName: "Generate Report",
            description: "Simulate generating a periodic report",
        },
    ],
    styles: {
        backgroundColor: "bg-indigo-900",
        borderColor: "border-indigo-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Scheduler",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
