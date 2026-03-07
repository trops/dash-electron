/**
 * Shared provider declaration for all Algolia InstantSearch widgets.
 *
 * Uses type "algolia-search" (not "algolia") to avoid conflict with the
 * existing Algolia MCP provider which has different credential fields.
 * The user creates a dedicated credential provider with appId, apiKey,
 * and indexName for these InstantSearch widgets.
 */
export const algoliaProvider = {
    type: "algolia-search",
    providerClass: "credential",
    required: true,
    credentialSchema: {
        appId: {
            type: "text",
            required: true,
            displayName: "Application ID",
            instructions: "Your Algolia Application ID",
        },
        apiKey: {
            type: "password",
            required: true,
            displayName: "Search API Key",
            instructions: "Search-only API key (never use your Admin API key)",
        },
        indexName: {
            type: "text",
            required: true,
            displayName: "Default Index Name",
            instructions: "The Algolia index to search",
        },
    },
};
