/**
 * AlgoliaRefinementList
 *
 * Facet filter widget using useRefinementList from react-instantsearch-hooks-web.
 * Displays checkbox items with hit counts for filtering search results.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { Panel, SubHeading3 } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { useRefinementList } from "react-instantsearch-hooks-web";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function RefinementListDisplay({ attribute, limit, title }) {
    const parsedLimit =
        typeof limit === "string" ? parseInt(limit, 10) || 10 : limit || 10;

    const { items, refine } = useRefinementList({
        attribute: attribute || "_missing_attribute_",
        limit: parsedLimit,
    });

    if (!attribute) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-2">
                    <div className="text-yellow-400 text-sm font-medium">
                        Attribute Required
                    </div>
                    <div className="text-gray-500 text-xs">
                        Set the facet attribute in this widget's settings (e.g.
                        "brand", "category").
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 h-full overflow-y-auto">
            {title && <SubHeading3 title={title} padding={false} />}
            {items.length === 0 ? (
                <div className="text-gray-500 text-xs italic px-1">
                    No facet values available.
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {items.map((item) => (
                        <label
                            key={item.label}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={item.isRefined}
                                onChange={() => refine(item.value)}
                                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-sm text-gray-200 flex-1 truncate">
                                {item.label}
                            </span>
                            <span className="text-xs text-gray-500 tabular-nums">
                                {item.count.toLocaleString()}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export const AlgoliaRefinementList = ({
    attribute = "",
    limit = 10,
    title = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaInstantSearchWrapper>
                    <QuerySync />
                    <RefinementListDisplay
                        attribute={attribute}
                        limit={limit}
                        title={title}
                    />
                </AlgoliaInstantSearchWrapper>
            </Panel>
        </Widget>
    );
};
