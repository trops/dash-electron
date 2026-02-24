/**
 * algoliaController.js
 *
 * This is a sample controller that is called from the electron.js file
 *
 * The electron.js file contains listeners from the renderer that will call
 * the controller methods as seen below.
 */
const algoliasearch = require("algoliasearch");
const events = require("../events");
const AlgoliaIndex = require("../utils/algolia");
var fs = require("fs");

const algoliaController = {
    /**
     * loadPagesForApplication
     * Load the pages for the application <userdata>/appId/pages.json
     * - filter out the indices that are "rule" indices
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id from Algolia
     */
    listIndices: (win, application) => {
        try {
            const searchClient = algoliasearch(
                application["appId"],
                application["key"]
            );
            searchClient
                .listIndices()
                .then(({ items }) => {
                    const filtered = items.filter(
                        (item) => item.name.substring(0, 7) !== "sitehub"
                    );
                    win.webContents.send(
                        events.ALGOLIA_LIST_INDICES_COMPLETE,
                        filtered
                    );
                })
                .catch((e) => {
                    win.webContents.send(events.ALGOLIA_LIST_INDICES_ERROR, {
                        error: e.message,
                    });
                });
        } catch (e) {
            win.webContents.send(events.ALGOLIA_LIST_INDICES_ERROR, {
                error: e.message,
            });
        }
    },

    getAnalyticsForQuery: (win, application, indexName, query) => {
        try {
            const baseUrl = "https://analytics.us.algolia.com";
            const headers = {
                "X-Algolia-Application-Id": application["appId"],
                "X-Algolia-API-Key": application["key"],
            };
            const url = `${baseUrl}/2/hits?search=${encodeURIComponent(
                query
            )}&clickAnalytics=true&index=${indexName}`;
            axios
                .get(url, {
                    headers: headers,
                })
                .then((resp) => {
                    if (resp.status === 200) {
                        win.webContents.send(
                            events.ALGOLIA_ANALYTICS_FOR_QUERY_COMPLETE,
                            {
                                result: resp.data,
                                indexName: indexName,
                                query: query,
                            }
                        );
                    } else {
                        win.webContents.send(
                            events.ALGOLIA_ANALYTICS_FOR_QUERY_ERROR,
                            {
                                error: true,
                                message: "Failed request",
                            }
                        );
                    }
                })
                .catch((e) => {
                    win.webContents.send(
                        events.ALGOLIA_ANALYTICS_FOR_QUERY_ERROR,
                        {
                            error: true,
                            message: e.message,
                        }
                    );
                });
        } catch (e) {
            win.webContents.send(events.ALGOLIA_ANALYTICS_FOR_QUERY_ERROR, {
                error: true,
                message: e.message,
            });
        }
    },

    /**
     * browseObjectsToFile
     * Lets try and browse an index and pull down the hits and save as a file
     *
     * @param {*} win
     * @param {*} appId
     * @param {*} apiKey
     * @param {*} indexName
     * @param {*} toFilename
     * @param {*} query
     */
    browseObjectsToFile: (
        win,
        appId,
        apiKey,
        indexName,
        toFilename,
        query = ""
    ) => {
        try {
            if (
                toFilename !== "" &&
                apiKey !== "" &&
                indexName !== "" &&
                appId !== ""
            ) {
                // init the Algolia Index helper
                const a = new AlgoliaIndex(appId, apiKey, indexName);
                // create the write stream to store the hits
                const writeStream = fs.createWriteStream(toFilename);
                writeStream.write("[");

                let sep = "";

                // call the algolia browseObjects helper method
                a.browseObjects(query, (hits) => {
                    win.webContents.send(
                        events.ALGOLIA_BROWSE_OBJECTS_UPDATE,
                        hits
                    );

                    let count = 0;
                    // write to the file
                    hits.forEach((hit) => {
                        writeStream.write(sep + JSON.stringify(hit));
                        count++;
                        sep = ",\n";
                    });
                })
                    .then((result) => {
                        writeStream.write("]");
                        win.webContents.send(
                            events.ALGOLIA_BROWSE_OBJECTS_COMPLETE,
                            result
                        );
                    })
                    .catch((e) => {
                        win.webContents.send(
                            events.ALGOLIA_BROWSE_OBJECTS_ERROR,
                            e
                        );
                    });
            } else {
                win.webContents.send(
                    events.ALGOLIA_BROWSE_OBJECTS_ERROR,
                    new Error("Missing parameters")
                );
            }
        } catch (e) {
            win.webContents.send(events.ALGOLIA_BROWSE_OBJECTS_ERROR, {
                error: e.message,
            });
        }
    },

    async partialUpdateObjectsFromDirectory(
        win,
        appId,
        apiKey,
        indexName,
        dir,
        createIfNotExists = false
    ) {
        try {
            const a = new AlgoliaIndex(appId, apiKey, indexName);
            // now we can make the call to the utility and we are passing in the createIfNotExists FALSE by default
            a.partialUpdateObjectsFromDirectorySync(
                dir,
                createIfNotExists,
                (data) => {
                    win.webContents.send(
                        events.ALGOLIA_PARTIAL_UPDATE_OBJECTS_UPDATE,
                        data
                    );
                }
            )
                .then((result) => {
                    win.webContents.send(
                        events.ALGOLIA_PARTIAL_UPDATE_OBJECTS_COMPLETE,
                        result
                    );
                })
                .catch((e) => {
                    win.webContents.send(
                        events.ALGOLIA_PARTIAL_UPDATE_OBJECTS_ERROR,
                        e
                    );
                });
        } catch (e) {
            win.webContents.send(events.ALGOLIA_PARTIAL_UPDATE_OBJECTS_ERROR, {
                error: e.message,
            });
        }
    },

    /**
     * createBatchesFromFile
     * @param {*} win
     * @param {*} filepath
     * @param {*} batchFilepath
     * @param {*} batchSize
     * @param {*} callback
     */
    createBatchesFromFile: (
        win,
        filepath,
        batchFilepath = "/data/batch",
        batchSize = 500
    ) => {
        try {
            const a = new AlgoliaIndex();
            a.createBatchesFromJSONFile(
                filepath,
                batchFilepath,
                batchSize,
                (data) => {
                    win.webContents.send(
                        events.ALGOLIA_CREATE_BATCH_UPDATE,
                        data
                    );
                }
            )
                .then((result) => {
                    win.webContents.send(
                        events.ALGOLIA_CREATE_BATCH_COMPLETE,
                        result
                    );
                })
                .catch((e) => {
                    win.webContents.send(events.ALGOLIA_CREATE_BATCH_ERROR, e);
                });
        } catch (e) {
            win.webContents.send(events.ALGOLIA_CREATE_BATCH_ERROR, {
                error: e.message,
            });
        }
    },
};

module.exports = algoliaController;
