/**
 * AlgoliaPagination
 *
 * Page navigation widget using usePagination from react-instantsearch-hooks-web.
 * Shows Prev/Next buttons and page numbers. Hides when only one page exists.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
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
        <div className="flex items-center justify-center gap-1 px-1">
            <button
                onClick={() => refine(currentRefinement - 1)}
                disabled={currentRefinement === 0}
                className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
            >
                Prev
            </button>
            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => refine(page)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                        page === currentRefinement
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    }`}
                >
                    {page + 1}
                </button>
            ))}
            <button
                onClick={() => refine(currentRefinement + 1)}
                disabled={currentRefinement >= nbPages - 1}
                className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
            >
                Next
            </button>
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
