/**
 * DashboardApi
 * Wrapper for the Electron Bridge
 *
 * @description Developers can use this wrapper to change the "api" from Electron to another source abstraction
 */
import { ThemeApi } from "./ThemeApi";

export const DashboardApi = {
    /**
     * @var {string} _uuid the unique identifier for the dashboard we are using
     * @description We will store the information/config files in a folder with this uuid
     */
    _uuid: null,

    /**
     * @var {object} _api to the api methods events
     * @description The api interface (see /public/lib/api/ for structure in electron-skeleton..)
     */
    _api: null,
    _theme: null,

    // apis
    _settings: null,
    _themes: null,

    /**
     * init
     *
     * This will initialize the API
     * We do this automatically from the LayoutModel using the UUID generated
     * for the widget.
     *
     * We need this UUID for filenames, publishing events, etc.
     *
     * @param {string} uuid
     */
    init: function (uuidInput) {
        try {
            this._uuid = uuidInput;

            // initialize the apis
            this._theme = ThemeApi;
        } catch (e) {
            console.log(e);
        }
    },

    setApi: function (myApi) {
        // we should trim this to only the bare essentials that a dev would need.
        // the developer can also pass in their own API such that we can switch
        // out Electron for another API (node etc)
        const minified = {};
        minified["data"] = myApi.data;
        minified["algolia"] = myApi.algolia;
        minified["events"] = myApi.events;

        this._api = minified;
    },

    setSettings: function (settings) {
        this._settings = settings;
    },

    /**
     * uuid
     * @returns string the UUID for this Widget
     */
    uuid: function () {
        return this._uuid;
    },

    electronApi: function () {
        return this._electronApi;
    },
};
