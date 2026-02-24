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

// test/fixtures/folder-install-test/current-weather/__compile_entry.js
var compile_entry_exports = {};
__export(compile_entry_exports, {
    CurrentWeather: () => CurrentWeather2,
});
module.exports = __toCommonJS(compile_entry_exports);

// test/fixtures/folder-install-test/current-weather/widgets/CurrentWeather.dash.js
var CurrentWeather_dash_default = {
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

// test/fixtures/folder-install-test/current-weather/widgets/CurrentWeather.js
var import_react = __toESM(require("react"));
var import_dash_react = require("@trops/dash-react");
var conditions = {
    icon: "sun",
    label: "Sunny",
    temp: 72,
    humidity: 45,
    wind: 8,
    feelsLike: 70,
};
var CurrentWeather = (props) => {
    const {
        title = "Current Weather",
        location = "San Francisco, CA",
        ...rest
    } = props;
    return /* @__PURE__ */ import_react.default.createElement(
        import_dash_react.Panel,
        { ...rest },
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pt-3 pb-1 flex items-center gap-2" },
            /* @__PURE__ */ import_react.default.createElement(
                import_dash_react.FontAwesomeIcon,
                { icon: "sun", className: "h-4 w-4 text-white/70" }
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "h3",
                { className: "text-sm font-semibold text-white" },
                title
            )
        ),
        /* @__PURE__ */ import_react.default.createElement(
            "div",
            { className: "px-3 pb-3" },
            /* @__PURE__ */ import_react.default.createElement(
                "p",
                { className: "text-xs text-white/50 mb-2" },
                location
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "div",
                { className: "flex items-center gap-3 mb-3" },
                /* @__PURE__ */ import_react.default.createElement(
                    import_dash_react.FontAwesomeIcon,
                    {
                        icon: conditions.icon,
                        className: "h-8 w-8 text-yellow-300",
                    }
                ),
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    null,
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-3xl font-bold text-white" },
                        conditions.temp,
                        "\xB0F"
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/60" },
                        conditions.label
                    )
                )
            ),
            /* @__PURE__ */ import_react.default.createElement(
                "div",
                { className: "grid grid-cols-3 gap-2 text-center" },
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    { className: "bg-white/5 rounded p-2" },
                    /* @__PURE__ */ import_react.default.createElement(
                        import_dash_react.FontAwesomeIcon,
                        {
                            icon: "droplet",
                            className: "h-3 w-3 text-blue-300 mb-1",
                        }
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/80" },
                        conditions.humidity,
                        "%"
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/40" },
                        "Humidity"
                    )
                ),
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    { className: "bg-white/5 rounded p-2" },
                    /* @__PURE__ */ import_react.default.createElement(
                        import_dash_react.FontAwesomeIcon,
                        {
                            icon: "wind",
                            className: "h-3 w-3 text-blue-300 mb-1",
                        }
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/80" },
                        conditions.wind,
                        " mph"
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/40" },
                        "Wind"
                    )
                ),
                /* @__PURE__ */ import_react.default.createElement(
                    "div",
                    { className: "bg-white/5 rounded p-2" },
                    /* @__PURE__ */ import_react.default.createElement(
                        import_dash_react.FontAwesomeIcon,
                        {
                            icon: "temperature-half",
                            className: "h-3 w-3 text-blue-300 mb-1",
                        }
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/80" },
                        conditions.feelsLike,
                        "\xB0F"
                    ),
                    /* @__PURE__ */ import_react.default.createElement(
                        "p",
                        { className: "text-xs text-white/40" },
                        "Feels Like"
                    )
                )
            )
        )
    );
};
var CurrentWeather_default = CurrentWeather;

// test/fixtures/folder-install-test/current-weather/__compile_entry.js
var CurrentWeather2 = {
    ...CurrentWeather_dash_default,
    component: CurrentWeather_default,
};
