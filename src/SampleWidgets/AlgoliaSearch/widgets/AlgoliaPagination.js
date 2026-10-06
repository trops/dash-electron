/**
 * AlgoliaPagination
 *
 * Page navigation widget using usePagination from react-instantsearch-hooks-web.
 * Shows Prev/Next buttons and page numbers. Hides when only one page exists.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { Button, Button2 } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { usePagination } from "react-instantsearch-hooks-web";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function PaginationDisplay({ padding }) {
    const parsedPadding =
        typeof padding === "string" ? parseInt(padding, 10) || 3 : padding || 3;

    const { currentRefinement, nbPages, refine } = usePagination({
        padding: parsedPadding,
    });

    if (nbPages <= 1) return null;

    const pages = [];
    const start = Math.max(0, currentRefinement - parsedPadding);
    const end = Math.min(nbPages - 1, currentRefinement + parsedPadding);
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-1 px-1">
            <Button2
                size="sm"
                onClick={() => refine(currentRefinement - 1)}
                disabled={currentRefinement === 0}
            >
                Prev
            </Button2>
            {pages.map((page) =>
                page === currentRefinement ? (
                    <Button key={page} size="sm" onClick={() => refine(page)}>
                        {page + 1}
                    </Button>
                ) : (
                    <Button2 key={page} size="sm" onClick={() => refine(page)}>
                        {page + 1}
                    </Button2>
                )
            )}
            <Button2
                size="sm"
                onClick={() => refine(currentRefinement + 1)}
                disabled={currentRefinement >= nbPages - 1}
            >
                Next
            </Button2>
        </div>
    );
}

export const AlgoliaPagination = ({ padding = 3, ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <AlgoliaInstantSearchWrapper>
                <QuerySync />
                <PaginationDisplay padding={padding} />
            </AlgoliaInstantSearchWrapper>
        </Widget>
    );
};
