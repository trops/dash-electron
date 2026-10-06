/**
 * AlgoliaSortBy
 *
 * Sort dropdown widget using useSortBy from react-instantsearch-hooks-web.
 * User configures sort items as a JSON string of {value, label} objects.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { useMemo } from "react";
import { Panel, AlertBanner, SelectInput } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { useSortBy } from "react-instantsearch-hooks-web";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function SortBySelect({ parsedItems }) {
    const { currentRefinement, options, refine } = useSortBy({
        items: parsedItems,
    });

    return (
        <SelectInput
            value={currentRefinement}
            onChange={(value) => refine(value)}
            options={options.map((option) => ({
                value: option.value,
                label: option.label,
            }))}
            placeholder="Sort by"
            inputClassName="text-sm"
        />
    );
}

function SortByContent({ items }) {
    const parsedItems = useMemo(() => {
        if (!items || !items.trim()) return null;
        try {
            const parsed = JSON.parse(items);
            if (
                !Array.isArray(parsed) ||
                parsed.length === 0 ||
                !parsed.every((item) => item.value && item.label)
            ) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }, [items]);

    if (!parsedItems) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <AlertBanner
                    variant="warning"
                    size="compact"
                    title="Sort Items Required"
                    message={`Configure sort items as a JSON array in this widget's settings. Each item needs "value" (index name) and "label" (display text).`}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <SortBySelect parsedItems={parsedItems} />
        </div>
    );
}

export const AlgoliaSortBy = ({ items = "", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaInstantSearchWrapper>
                    <QuerySync />
                    <SortByContent items={items} />
                </AlgoliaInstantSearchWrapper>
            </Panel>
        </Widget>
    );
};
