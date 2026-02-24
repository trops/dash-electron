/**
 * algoliaApi.js
 *
 * This is a stub sample that can be used as a template for other api's
 */
// ipcRenderer that must be used to invoke the events
const { ipcRenderer } = require("electron");

const {
    ALGOLIA_LIST_INDICES,
    ALGOLIA_ANALYTICS_FOR_QUERY,
    ALGOLIA_SAVE_SYNONYMS,
    ALGOLIA_PARTIAL_UPDATE_OBJECTS,
    ALGOLIA_CREATE_BATCH,
    ALGOLIA_BROWSE_OBJECTS,
} = require("../events");

const algoliaApi = {
    listIndices: (application) =>
        ipcRenderer.invoke(ALGOLIA_LIST_INDICES, application),

    browseObjects: (appId, apiKey, indexName) => {
        ipcRenderer.invoke(ALGOLIA_BROWSE_OBJECTS, {
            appId,
            apiKey,
            indexName,
            dir,
        });
    },

    saveSynonyms: () => ipcRenderer.invoke(ALGOLIA_SAVE_SYNONYMS, {}),

    getAnalyticsForQuery: (application, indexName, query) =>
        ipcRenderer.invoke(ALGOLIA_ANALYTICS_FOR_QUERY, {
            application,
            indexName,
            query,
        }),

    partialUpdateObjectsFromDirectory: (
        appId,
        apiKey,
        indexName,
        dir,
        createIfNotExists = false
    ) =>
        ipcRenderer.invoke(ALGOLIA_PARTIAL_UPDATE_OBJECTS, {
            appId,
            apiKey,
            indexName,
            dir,
            createIfNotExists,
        }),

    createBatchesFromFile: (filepath, batchFilepath, batchSize) => {
        ipcRenderer.invoke(ALGOLIA_CREATE_BATCH, {
            filepath,
            batchFilepath,
            batchSize,
        });
    },

    browseObjectsToFile: (appId, apiKey, indexName, toFilename, query = "") => {
        ipcRenderer.invoke(ALGOLIA_BROWSE_OBJECTS, {
            appId,
            apiKey,
            indexName,
            toFilename,
            query,
        });
    },

    // partialUpdateObjects: (application, objects) =>
    //   ipcRenderer.invoke(ALGOLIA_PARTIAL_UPDATE, { application, objects }),
    // browseObjects: (application, indexName) => ipcRenderer.invoke(ALGOLIA_BROWSE_OBJECTS, {application, indexName }),
};

module.exports = algoliaApi;
