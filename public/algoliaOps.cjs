/**
 * Algolia operation helpers — the actual SDK calls behind each
 * algolia-* IPC handler in electron.js. Extracted so they're
 * unit-testable with a mocked SDK; without this every signature
 * mistake (like calling `index.searchRules({query, options})`
 * instead of `index.searchRules(query, options)`) only surfaces
 * at widget runtime, where it produces opaque main-process
 * rejections.
 *
 * Each export takes a resolved Algolia client + the payload that
 * arrived on the IPC channel. The handler in electron.js stays
 * thin: resolve client → call the helper → return.
 *
 * The shape of each helper deliberately mirrors the corresponding
 * IPC handler 1:1 so refactoring electron.js to use these is a
 * mechanical edit (no behavior change).
 */

"use strict";

/**
 * Algolia v4 SDK: index.searchRules(query: string, options?: {...}).
 * Passing a single merged object stringifies to "[object Object]"
 * and Algolia throws "Expecting a string (near 1:11)" — the bug we
 * caught at runtime. Positional args are the only correct call.
 */
async function searchRules(client, { indexName, query, hitsPerPage, page }) {
    const index = client.initIndex(indexName);
    const options = {};
    if (hitsPerPage != null) options.hitsPerPage = hitsPerPage;
    if (page != null) options.page = page;
    return await index.searchRules(query || "", options);
}

/**
 * saveRule(rule) — `rule` is the full rule object including objectID.
 * Single positional arg.
 */
async function saveRule(client, { indexName, rule }) {
    const index = client.initIndex(indexName);
    return await index.saveRule(rule);
}

/**
 * deleteRule(objectID) — positional string arg.
 */
async function deleteRule(client, { indexName, objectID }) {
    const index = client.initIndex(indexName);
    return await index.deleteRule(objectID);
}

/**
 * getSettings() — no args.
 */
async function getSettings(client, { indexName }) {
    const index = client.initIndex(indexName);
    return await index.getSettings();
}

/**
 * setSettings(settings) — single object arg.
 */
async function setSettings(client, { indexName, settings }) {
    const index = client.initIndex(indexName);
    return await index.setSettings(settings);
}

module.exports = {
    searchRules,
    saveRule,
    deleteRule,
    getSettings,
    setSettings,
};
