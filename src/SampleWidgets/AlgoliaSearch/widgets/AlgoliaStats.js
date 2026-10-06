/**
 * AlgoliaStats
 *
 * Displays search result count and query processing time using useStats
 * from react-instantsearch-hooks-web.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { useContext } from "react";
import { Caption2, ThemeContext } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { useStats } from "react-instantsearch-hooks-web";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function StatsDisplay() {
    const { nbHits, processingTimeMS } = useStats();
    const { currentTheme } = useContext(ThemeContext);
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex items-center gap-1 text-xs px-1">
            <span className={`font-medium ${bodyText}`}>
                {nbHits.toLocaleString()}
            </span>
            <Caption2>result{nbHits !== 1 ? "s" : ""}</Caption2>
            <Caption2 className="opacity-75">found in</Caption2>
            <span className={bodyText}>{processingTimeMS}ms</span>
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
