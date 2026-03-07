/**
 * AlgoliaInstantSearchWrapper
 *
 * Shared wrapper used by every InstantSearch widget. Reads Algolia credentials
 * from the widget's "algolia-search" credential provider, retrieves a cached
 * search client, and wraps children in <InstantSearch>.
 *
 * The search client is cached at module level (algoliaClientCache) so all
 * widgets sharing the same appId reuse a single instance.
 */
import { useMemo } from "react";
import { useWidgetProviders } from "@trops/dash-core";
import { InstantSearch } from "react-instantsearch-hooks-web";
import { getSearchClient } from "./algoliaClientCache";

export function AlgoliaInstantSearchWrapper({ indexName, children }) {
    const { hasProvider, getProvider } = useWidgetProviders();

    const provider = hasProvider("algolia-search")
        ? getProvider("algolia-search")
        : null;
    const appId = provider?.credentials?.appId;
    const apiKey = provider?.credentials?.apiKey;
    const providerIndex = provider?.credentials?.indexName;

    const resolvedIndex = indexName || providerIndex;

    const searchClient = useMemo(() => {
        if (!appId || !apiKey) return null;
        return getSearchClient(appId, apiKey);
    }, [appId, apiKey]);

    if (!provider) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-2">
                    <div className="text-blue-400 text-sm font-medium">
                        Algolia Search Provider Required
                    </div>
                    <div className="text-gray-500 text-xs">
                        Create a new "algolia-search" credential provider with
                        your Application ID, Search API Key, and Index Name.
                    </div>
                </div>
            </div>
        );
    }

    if (!searchClient) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-yellow-400 text-xs animate-pulse">
                    Initializing search client...
                </div>
            </div>
        );
    }

    if (!resolvedIndex) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-2">
                    <div className="text-yellow-400 text-sm font-medium">
                        Index Name Required
                    </div>
                    <div className="text-gray-500 text-xs">
                        Set an index name in the provider credentials.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <InstantSearch searchClient={searchClient} indexName={resolvedIndex}>
            {children}
        </InstantSearch>
    );
}
