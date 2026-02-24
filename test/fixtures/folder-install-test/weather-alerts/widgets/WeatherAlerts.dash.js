export default {
    name: "WeatherAlerts",
    canHaveChildren: false,
    workspace: "weather-workspace",
    author: "John Giatropoulos",
    description: "Displays active severe weather alerts for your area.",
    icon: "triangle-exclamation",
    type: "widget",
    styles: {
        backgroundColor: "bg-amber-900",
        borderColor: "border-amber-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Weather Alerts",
            displayName: "Title",
            required: false,
        },
    },
};
