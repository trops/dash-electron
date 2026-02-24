export default {
    name: "CurrentWeather",
    canHaveChildren: false,
    workspace: "weather-workspace",
    author: "John Giatropoulos",
    description:
        "Shows current weather conditions including temperature, humidity, and wind speed.",
    icon: "sun",
    type: "widget",
    styles: {
        backgroundColor: "bg-sky-900",
        borderColor: "border-sky-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Current Weather",
            displayName: "Title",
            required: false,
        },
        location: {
            type: "text",
            defaultValue: "San Francisco, CA",
            displayName: "Location",
            required: false,
        },
    },
};
