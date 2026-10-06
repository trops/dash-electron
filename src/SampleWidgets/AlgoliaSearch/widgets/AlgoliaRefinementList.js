/**
 * AlgoliaRefinementList
 *
 * Facet filter widget using useRefinementList from react-instantsearch-hooks-web.
 * Displays checkbox items with hit counts for filtering search results.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { useContext } from "react";
import {
    Panel,
    SubHeading3,
    Caption2,
    Checkbox,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    if (!attribute) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-2">
                    <div
                        className={`text-sm font-medium ${status.warning.icon}`}
                    >
                        Attribute Required
                    </div>
                    <Caption2 block>
                        Set the facet attribute in this widget's settings (e.g.
                        "brand", "category").
                    </Caption2>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 h-full overflow-y-auto">
            {title && <SubHeading3 title={title} padding={false} />}
            {items.length === 0 ? (
                <Caption2 block className="italic px-1">
                    No facet values available.
                </Caption2>
            ) : (
                <div className="flex flex-col gap-1">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                                currentTheme?.["hover-bg-primary-dark"] || ""
                            }`}
                        >
                            <Checkbox
                                checked={item.isRefined}
                                onChange={() => refine(item.value)}
                                label={item.label}
                                className="flex-1 min-w-0 cursor-pointer"
                            />
                            <Caption2 className="tabular-nums">
                                {item.count.toLocaleString()}
                            </Caption2>
                        </div>
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
