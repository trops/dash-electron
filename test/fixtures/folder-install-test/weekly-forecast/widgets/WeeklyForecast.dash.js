export default {
    name: "WeeklyForecast",
    canHaveChildren: false,
    workspace: "weather-workspace",
    author: "John Giatropoulos",
    description:
        "Weekly weather forecast with daily high/low temperatures and conditions.",
    icon: "calendar",
    type: "widget",
    styles: {
        backgroundColor: "bg-indigo-900",
        borderColor: "border-indigo-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "7-Day Forecast",
            displayName: "Title",
            required: false,
        },
    },
};
