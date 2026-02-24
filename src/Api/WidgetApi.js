/**
 * WidgetApi
 * Include developer methods to easily access the Electron bridge
 *
 * NOTE: This MUST be a class to avoid the Singleton pattern
 * This gets initialized and injected into each Widget initialized with
 * the UUID of the widget.
 * The UUID is then used for filenames, etc and MUST be unique.
 */

export const WidgetApi = {
    params: null,

    init: function (params) {
        this.params = params;
    },

    setPublisher: function (publisher) {
        this._pub = publisher;
    },

    setElectronApi: function (api) {
        try {
            /**
             * include the main electron apis that we want to expose ONLY
             */
            if (api !== undefined && api !== null) {
                // ElectronDashboardApi wraps the raw mainApi inside this.api.
                // Unwrap it so we get the actual IPC methods (on, data, events, etc).
                const rawApi = api.api || api;
                // set the mainApi to electron inside the widget.
                this._electronApi = {
                    on: rawApi.on || {},
                    removeAllListeners: rawApi.removeAllListeners || {},
                    data: rawApi.data || {},
                    algolia: rawApi.algolia || {},
                    events: rawApi.events || {},
                    dialog: rawApi.dialog || {},
                };
            }
        } catch (e) {
            console.log("Error Setting Electron API ", e.message);
        }
    },

    setSettings: function (settings) {
        this._settings = settings;
    },

    id: function () {
        return this.params.id;
    },

    name: function () {
        return this.params.name;
    },

    settings: function () {
        return this._settings;
    },

    electronApi: function () {
        return this._electronApi;
    },

    pub: function () {
        return this._pub;
    },

    /**
     * publishEvent
     * @param {string} name the name of the widget (TODO - uuid + handler)
     * @param {object} events the payload for the event published
     */
    publishEvent: function (name = null, events, uuid = null) {
        try {
            console.log("trying to publish event ", name, uuid);
            if (this.pub() !== null && name !== null && events !== null) {
                if ("pub" in this.pub()) {
                    this.pub().pub(name, events);
                }
            }
        } catch (e) {
            console.log("error ", e.message);
        }
    },

    /**
     * registerListeners
     *
     * Register an array of listeners (strings) and set the handler (object)
     * Each handler has a key and Component named the same so we can use the handler
     * methods in code.
     *
     * @param {array} listeners the listeners (event names) that the widget is listening FOR
     * @param {object} handlers the methods/function names that will be triggered when an event is "heard"
     */
    registerListeners: function (listeners, handlers, uuid) {
        try {
            // console.log("registering listeners ", listeners, handlers, uuid);
            if (this.pub() !== null && uuid !== null) {
                if ("registerListeners" in this.pub()) {
                    if (this.pub()["registerListeners"] !== null) {
                        this.pub().registerListeners(listeners, handlers, uuid);
                    }
                }
            }
        } catch (e) {
            console.log(e.message);
        }
    },

    /**
     * chooseFile
     */
    chooseFile: function () {
        try {
            console.log("e api trying to choose file");
            // grab the electron api
            const eApi = this.electronApi();
            if (eApi) {
                // remove the listeners (reset)
                if ("removeAllListeners" in eApi) {
                    console.log(eApi);
                    // eApi.removeAllListeners();
                    // eApi.on(eApi.events.CHOOSE_FILE_COMPLETE, (data) => {
                    //     console.log("chose a file");
                    // });
                    eApi.dialog.chooseFile();
                }
            }
        } catch (e) {
            console.log("choose file error ", e);
        }
    },
    /**
     * storeData
     *
     * Allow the widget to have access to "local storage"
     * Store any object data to the filesystem in a predetermined filepath
     * based on the widget information (dashboard.workspace.widget...)
     *
     * @param {object} data
     * @param {object} options filename - name of the file, callbacks for complete and error
     */
    storeData: function ({
        data,
        filename = null,
        callbackComplete = null,
        callbackError = null,
        append = true,
        returnEmpty = {},
        uuid,
    }) {
        try {
            // set the filename
            const toFilename = filename !== null ? filename : `${uuid}.json`;

            // grab the electron api
            const eApi = this.electronApi();
            if (eApi) {
                // remove the listeners (reset)
                if ("removeAllListeners" in eApi) {
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_COMPLETE
                    );
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_ERROR
                    );
                    if (callbackComplete !== null) {
                        eApi.on(
                            eApi.events.DATA_SAVE_TO_FILE_COMPLETE,
                            (_event, response) => callbackComplete(response)
                        );
                    }
                    if (callbackError !== null) {
                        eApi.on(
                            eApi.events.DATA_SAVE_TO_FILE_ERROR,
                            (_event, response) => callbackError(response)
                        );
                    }
                    // request.
                    eApi.data.saveData(data, toFilename, append, returnEmpty);
                }
            }
        } catch (e) {
            if (callbackError !== null) {
                callbackError({ message: e.message });
            }
        }
    },

    /**
     * readData
     * Read data from the filesystem (electron)
     *
     * @param {object} options
     * - filename - the name of the file if you want to override the default uuid as filename
     * - callbackComplete - the handler for dealing with the complete callback data
     * - callbackError - the handler for dealing with the error callback data
     * - uuid - the UUID for the widget/workspace
     */
    readData: function ({
        filename = null,
        callbackComplete = null,
        callbackError = null,
        uuid,
    }) {
        try {
            const toFilename = filename !== null ? filename : `${uuid}.json`;
            const eApi = this.electronApi();
            if ("removeAllListeners" in eApi) {
                eApi.removeAllListeners(
                    eApi.events.DATA_READ_FROM_FILE_COMPLETE
                );
                eApi.removeAllListeners(eApi.events.DATA_READ_FROM_FILE_ERROR);

                if (callbackComplete !== null) {
                    eApi.on(
                        eApi.events.DATA_READ_FROM_FILE_COMPLETE,
                        (_event, response) => {
                            // response.data is a JSON string from the main process;
                            // parse it so callers receive the actual object.
                            let parsed = response;
                            if (response?.data) {
                                try {
                                    parsed = JSON.parse(response.data);
                                } catch (_) {
                                    parsed = response.data;
                                }
                            }
                            callbackComplete(parsed);
                        }
                    );
                }
                if (callbackError !== null) {
                    eApi.on(
                        eApi.events.DATA_READ_FROM_FILE_ERROR,
                        (_event, response) => callbackError(response)
                    );
                }
                eApi.data.readData(toFilename);
            }
        } catch (e) {
            console.log(e);
        }
    },
};
