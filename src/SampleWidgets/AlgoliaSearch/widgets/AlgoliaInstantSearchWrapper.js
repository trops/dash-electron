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
import { Caption2, useStatusTokens } from "@trops/dash-react";
import { useWidgetProviders } from "@trops/dash-core";
import { InstantSearch } from "react-instantsearch-hooks-web";
import { getSearchClient } from "./algoliaClientCache";

export function AlgoliaInstantSearchWrapper({ indexName, children }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const status = useStatusTokens();

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
                    <div className={`text-sm font-medium ${status.info.icon}`}>
                        Algolia Search Provider Required
                    </div>
                    <Caption2 block>
                        Create a new "algolia-search" credential provider with
                        your Application ID, Search API Key, and Index Name.
                    </Caption2>
                </div>
            </div>
        );
    }

    if (!searchClient) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className={`text-xs animate-pulse ${status.warning.icon}`}>
                    Initializing search client...
                </div>
            </div>
        );
    }

    if (!resolvedIndex) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-2">
                    <div
                        className={`text-sm font-medium ${status.warning.icon}`}
                    >
                        Index Name Required
                    </div>
                    <Caption2 block>
                        Set an index name in the provider credentials.
                    </Caption2>
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
