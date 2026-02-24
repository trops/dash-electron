/**
 * ThemeApi
 * Wrapper for the Electron Bridge for themes
 *
 * @description Developers can use this wrapper to change the "api" from Electron to another source abstraction
 */

export const ThemeApi = {
    /**
     * @var {object} _api to the api methods events
     * @description The api interface (see /public/lib/api/ for structure in electron-skeleton..)
     */
    _api: null,

    /**
     * @var {object} _themes an array of available themes for the dashboard
     */
    _themes: null,

    /**
     * uuid
     * @returns string the UUID for this Widget
     */
    uuid: function () {
        return this._uuid;
    },

    setUuid: function (data) {
        this._uuid = data;
    },

    api: function () {
        return this._api;
    },

    /**
     * setApi
     * Set the interface to be used as the api
     * @param {object} myApi the interface for the theme methods
     */
    setApi: function (myApi) {
        // we should trim this to only the bare essentials that a dev would need.
        // the developer can also pass in their own API such that we can switch
        // out Electron for another API (node etc)
        const minified = {};
        minified["data"] = myApi.data;
        // minified['algolia'] = myApi.algolia;
        minified["events"] = myApi.events;

        this._api = minified;
    },

    setThemes: function (data) {
        this._themes = data;
    },

    themes: function () {
        return this._themes;
    },

    /**
     * init
     *
     * @description Initialize the ThemeAPI
     * @param {string} uuidInput the unique identifier for the dashboard (or whatever you wish to use)
     * @param {object} apiInput the api for accessing outside data and performing operations
     */
    init: function (uuidInput, apiInput) {
        try {
            this.setUuid(uuidInput);
            this.setApi(apiInput);
        } catch (e) {
            console.log(e);
        }
    },

    /**
     * loadThemes
     * @param {int} id the unique identifier to associate with the themes
     * @param {object} args the optional arguments (callbacks)
     */
    loadThemes: function (
        id,
        { callbackComplete = null, callbackError = null }
    ) {
        const a = this.api();
        try {
            if (a) {
                a.removeAllListeners();
                callbackComplete !== null &&
                    a.on(a.events.THEME_LIST_COMPLETE, callbackComplete);
                callbackError !== null &&
                    a.on(a.events.THEME_LIST_ERROR, callbackError);
                a.themes.listThemesForApplication(id);
            }
        } catch (e) {
            callbackError !== null &&
                a.on(a.events.THEME_LIST_ERROR, (e, message) =>
                    callbackError(e, message)
                );
        }
    },
};
