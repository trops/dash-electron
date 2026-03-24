/**
 * AlgoliaStats
 *
 * Displays search result count and query processing time using useStats
 * from react-instantsearch-hooks-web.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { Widget } from "@trops/dash-core";
import { useStats } from "react-instantsearch-hooks-web";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function StatsDisplay() {
    const { nbHits, processingTimeMS } = useStats();

    return (
        <div className="flex items-center gap-1 text-xs text-gray-400 px-1">
            <span className="text-gray-200 font-medium">
                {nbHits.toLocaleString()}
            </span>
            <span>result{nbHits !== 1 ? "s" : ""}</span>
            <span className="text-gray-600">found in</span>
            <span className="text-gray-300">{processingTimeMS}ms</span>
        </div>
    );
}

export const AlgoliaStats = ({ ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <AlgoliaInstantSearchWrapper>
                <QuerySync />
                <StatsDisplay />
            </AlgoliaInstantSearchWrapper>
        </Widget>
    );
};
