var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
    for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === "object") || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, {
                    get: () => from[key],
                    enumerable:
                        !(desc = __getOwnPropDesc(from, key)) ||
                        desc.enumerable,
                });
    }
    return to;
};
var __toESM = (mod, isNodeMode, target) => (
    (target = mod != null ? __create(__getProtoOf(mod)) : {}),
    __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule
            ? __defProp(target, "default", { value: mod, enumerable: true })
            : target,
        mod
    )
);
var __toCommonJS = (mod) =>
    __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// test/fixtures/folder-install-test/weekly-forecast/__compile_entry.js
var compile_entry_exports = {};
__export(compile_entry_exports, {
    WeeklyForecast: () => WeeklyForecast2,
});
module.exports = __toCommonJS(compile_entry_exports);

// test/fixtures/folder-install-test/weekly-forecast/widgets/WeeklyForecast.dash.js
var WeeklyForecast_dash_default = {
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

// test/fixtures/folder-install-test/weekly-forecast/widgets/WeeklyForecast.js
var import_react = __toESM(require("react"));
var import_dash_react = require("@trops/dash-react");
var forecast = [
    { day: "Mon", icon: "sun", high: 75, low: 58 },
    { day: "Tue", icon: "cloud-sun", high: 72, low: 56 },
    { day: "Wed", icon: "cloud", high: 68, low: 54 },
    { day: "Thu", icon: "cloud-rain", high: 63, low: 51 },
    { day: "Fri", icon: "cloud-rain", high: 61, low: 50 },
    { day: "Sat", icon: "cloud-sun", high: 70, low: 55 },
    { day: "Sun", icon: "sun", high: 76, low: 59 },
];
var WeeklyForecast = (props) => {
    const { title = "7-Day Forecast", ...rest } = props;
    return /* @__PURE__ */ import_react.default.createElement(
        import_dash_react.Panel,
        { ...rest },
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pt-3 pb-1 flex items-center gap-2" },
            /* @__PURE__ */ import_react.default.createElement(
                import_dash_react.FontAwesomeIcon,
                {
                    icon: "calendar",
                    className: "h-4 w-4 text-white/70",
                }
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "h3",
                { className: "text-sm font-semibold text-white" },
                title
            )
        ),
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pb-3 space-y-1" },
            forecast.map((day) =>
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    {
                        key: day.day,
                        className:
                            "flex items-center justify-between py-1 border-b border-white/5 last:border-0",
                    },
                    /* @__PURE__ */ import_react.default.createElement(
                        "span",
                        { className: "text-xs text-white/70 w-8" },
                        day.day
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        import_dash_react.FontAwesomeIcon,
                        {
                            icon: day.icon,
                            className: "h-3 w-3 text-white/50",
                        }
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "div",
                        { className: "flex gap-2 text-xs" },
                        /* @__PURE__ */ import_react.default.createElement(
                            "span",
                            { className: "text-white/90" },
                            day.high,
                            "\xB0"
                        ),
                        /* @__PURE__ */ import_react.default.createElement(
                            "span",
                            { className: "text-white/40" },
                            day.low,
                            "\xB0"
                        )
                    )
                )
            )
        )
    );
};
var WeeklyForecast_default = WeeklyForecast;

// test/fixtures/folder-install-test/weekly-forecast/__compile_entry.js
var WeeklyForecast2 = {
    ...WeeklyForecast_dash_default,
    component: WeeklyForecast_default,
};
