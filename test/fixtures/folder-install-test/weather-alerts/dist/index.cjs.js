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

// test/fixtures/folder-install-test/weather-alerts/__compile_entry.js
var compile_entry_exports = {};
__export(compile_entry_exports, {
    WeatherAlerts: () => WeatherAlerts2,
});
module.exports = __toCommonJS(compile_entry_exports);

// test/fixtures/folder-install-test/weather-alerts/widgets/WeatherAlerts.dash.js
var WeatherAlerts_dash_default = {
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

// test/fixtures/folder-install-test/weather-alerts/widgets/WeatherAlerts.js
var import_react = __toESM(require("react"));
var import_dash_react = require("@trops/dash-react");
var alerts = [
    {
        id: 1,
        severity: "Warning",
        title: "Heat Advisory",
        description:
            "Temperatures expected to reach 105\xB0F. Drink plenty of water and limit outdoor activity.",
        start: "Today 12:00 PM",
        end: "Tomorrow 8:00 PM",
        color: "text-red-400",
    },
    {
        id: 2,
        severity: "Watch",
        title: "Wind Advisory",
        description:
            "Sustained winds of 25-35 mph with gusts up to 55 mph expected.",
        start: "Tomorrow 6:00 AM",
        end: "Tomorrow 6:00 PM",
        color: "text-yellow-400",
    },
];
var WeatherAlerts = (props) => {
    const { title = "Weather Alerts", ...rest } = props;
    return /* @__PURE__ */ import_react.default.createElement(
        import_dash_react.Panel,
        { ...rest },
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pt-3 pb-1 flex items-center gap-2" },
            /* @__PURE__ */ import_react.default.createElement(
                import_dash_react.FontAwesomeIcon,
                {
                    icon: "triangle-exclamation",
                    className: "h-4 w-4 text-amber-400",
                }
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "h3",
                { className: "text-sm font-semibold text-white" },
                title
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "span",
                { className: "ml-auto text-xs text-white/40" },
                alerts.length,
                " active"
            )
        ),
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pb-3 space-y-2" },
            alerts.map((alert) =>
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    {
                        key: alert.id,
                        className: "bg-white/5 rounded p-2",
                    },
                    /* @__PURE__ */ import_react.default.createElement(
                        "div",
                        { className: "flex items-center gap-2 mb-1" },
                        /* @__PURE__ */ import_react.default.createElement(
                            "span",
                            {
                                className: `text-xs font-semibold ${alert.color}`,
                            },
                            alert.severity
                        ),
                        /* @__PURE__ */ import_react.default.createElement(
                            "span",
                            { className: "text-xs font-medium text-white" },
                            alert.title
                        )
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/60 mb-1" },
                        alert.description
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/30" },
                        alert.start,
                        " \u2014 ",
                        alert.end
                    )
                )
            )
        )
    );
};
var WeatherAlerts_default = WeatherAlerts;

// test/fixtures/folder-install-test/weather-alerts/__compile_entry.js
var WeatherAlerts2 = {
    ...WeatherAlerts_dash_default,
    component: WeatherAlerts_default,
};
