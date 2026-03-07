/**
 * algoliaClientCache
 *
 * Module-level cache for algoliasearch/lite clients. All widgets sharing the
 * same appId reuse a single client instance, avoiding redundant initialisation.
 * Mirrors the clientCache.js pattern in dash-core's electron layer.
 */
import algoliasearch from "algoliasearch/lite";

const clients = new Map();

/**
 * Return a cached search client, creating one if needed.
 * Keyed by appId so credential rotation still gets a fresh client.
 */
export function getSearchClient(appId, apiKey) {
    if (clients.has(appId)) {
        return clients.get(appId);
    }
    const client = algoliasearch(appId, apiKey);
    clients.set(appId, client);
    return client;
}

/**
 * Drop a cached client (e.g. when provider credentials change).
 */
export function invalidateClient(appId) {
    clients.delete(appId);
}
