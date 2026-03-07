/**
 * AlgoliaSearchPage
 *
 * Composite search widget that wraps search box, filters, results, stats,
 * pagination, and sort inside a single <InstantSearch> instance.
 * This guarantees 1 Algolia API call per interaction — no event syncing needed.
 *
 * @package Algolia Search
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Panel, SubHeading3 } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";
import {
    useSearchBox,
    useHits,
    useStats,
    usePagination,
    useRefinementList,
    useSortBy,
    Configure,
} from "react-instantsearch-hooks-web";
import Mustache from "mustache";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";

/* ─── Sub-components (internal only) ──────────────────────────────── */

function SearchBar({ placeholder, publishEvent, externalQuery }) {
    const { query, refine } = useSearchBox();
    const [inputValue, setInputValue] = useState(query);

    useEffect(() => {
        if (externalQuery) {
            setInputValue(externalQuery.query);
            refine(externalQuery.query);
            publishEvent("queryChanged", { query: externalQuery.query });
        }
    }, [externalQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        refine(value);
        publishEvent("queryChanged", { query: value });
    };

    const handleClear = () => {
        setInputValue("");
        refine("");
        publishEvent("queryChanged", { query: "" });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") handleClear();
    };

    return (
        <div className="relative flex-1">
            <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-8"
            />
            {inputValue && (
                <button
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
                    aria-label="Clear search"
                >
                    &times;
                </button>
            )}
        </div>
    );
}

function SortDropdown({ parsedItems }) {
    const { currentRefinement, options, refine } = useSortBy({
        items: parsedItems,
    });

    return (
        <select
            value={currentRefinement}
            onChange={(e) => refine(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function FacetSection({ attribute, title, limit }) {
    const parsedLimit =
        typeof limit === "string" ? parseInt(limit, 10) || 10 : limit || 10;

    const { items, refine } = useRefinementList({
        attribute: attribute,
        limit: parsedLimit,
    });

    return (
        <div className="flex flex-col gap-1">
            {title && <SubHeading3 title={title} padding={false} />}
            {items.length === 0 ? (
                <div className="text-gray-500 text-xs italic px-1">
                    No facet values.
                </div>
            ) : (
                items.map((item) => (
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
                ))
            )}
        </div>
    );
}

function FilterSidebar({ facets }) {
    return (
        <div className="w-48 flex-shrink-0 flex flex-col gap-4 pr-4 border-r border-gray-700 overflow-y-auto">
            {facets.map((facet) => (
                <FacetSection
                    key={facet.attribute}
                    attribute={facet.attribute}
                    title={facet.title || facet.attribute}
                    limit={facet.limit}
                />
            ))}
        </div>
    );
}

function StatsBar() {
    const { nbHits, processingTimeMS } = useStats();

    return (
        <div className="flex items-center gap-1 text-xs text-gray-400 px-1 pb-2">
            <span className="text-gray-200 font-medium">
                {nbHits.toLocaleString()}
            </span>
            <span>result{nbHits !== 1 ? "s" : ""}</span>
            <span className="text-gray-600">found in</span>
            <span className="text-gray-300">{processingTimeMS}ms</span>
        </div>
    );
}

function DefaultHitCard({ hit }) {
    const displayTitle =
        hit.title || hit.name || hit.label || hit.objectID || "Untitled";
    const displaySubtitle =
        hit.description || hit.subtitle || hit.content?.substring(0, 120) || "";

    return (
        <div className="px-3 py-2 bg-white/5 rounded hover:bg-white/10 transition-colors">
            <div className="text-sm text-gray-200 font-medium">
                {displayTitle}
            </div>
            {displaySubtitle && (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {displaySubtitle}
                </div>
            )}
            <div className="text-[10px] text-gray-600 mt-1 font-mono">
                {hit.objectID}
            </div>
        </div>
    );
}

function applyTransform(hit, transformCode) {
    if (!transformCode || !transformCode.trim()) return hit;
    try {
        const fn = new Function(
            "hit",
            `"use strict";\n${transformCode}\nif (typeof transform === "function") return transform(hit);\nreturn hit;`
        );
        const result = fn({ ...hit });
        return result && typeof result === "object" ? result : hit;
    } catch (err) {
        console.warn("[AlgoliaSearch] Transform error:", err);
        return hit;
    }
}

function TemplateHitCard({ hit, template, transform }) {
    let html;
    try {
        const enrichedHit = applyTransform(hit, transform);
        html = Mustache.render(template, enrichedHit);
    } catch {
        return (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                Template render error
            </div>
        );
    }

    return (
        <div
            className="px-3 py-2 bg-white/5 rounded hover:bg-white/10 transition-colors text-sm text-gray-200"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function HitsGrid({ hitTemplate, hitTransform }) {
    const { hits } = useHits();

    if (hits.length === 0) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-gray-500 text-xs italic">
                    No results found.
                </div>
            </div>
        );
    }

    const useTemplate = hitTemplate && hitTemplate.trim().length > 0;

    return (
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            {hits.map((hit) => (
                <div key={hit.objectID}>
                    {useTemplate ? (
                        <TemplateHitCard
                            hit={hit}
                            template={hitTemplate}
                            transform={hitTransform}
                        />
                    ) : (
                        <DefaultHitCard hit={hit} />
                    )}
                </div>
            ))}
        </div>
    );
}

function PaginationBar({ padding }) {
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
        <div className="flex items-center justify-center gap-1 pt-2">
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

/* ─── Attribute publisher (invisible, renders null) ───────────────── */

const INTERNAL_FIELDS = new Set([
    "_highlightResult",
    "_snippetResult",
    "_rankingInfo",
    "__position",
    "__queryID",
]);

function AttributePublisher({ publishEvent }) {
    const { hits } = useHits();
    const publishedRef = useRef(new Set());

    useEffect(() => {
        if (!hits || hits.length === 0) return;

        const firstHit = hits[0];
        const attrs = Object.keys(firstHit)
            .filter((k) => !INTERNAL_FIELDS.has(k))
            .sort();

        // Only re-publish when the attribute set actually changes
        const key = attrs.join(",");
        if (publishedRef.current.has(key)) return;
        publishedRef.current = new Set([key]);

        // Build a clean sample hit (strip internal Algolia metadata)
        const sampleHit = {};
        for (const k of attrs) {
            sampleHit[k] = firstHit[k];
        }

        publishEvent("attributesAvailable", { attributes: attrs, sampleHit });
    }, [hits, publishEvent]);

    return null;
}

/* ─── Main composite widget ───────────────────────────────────────── */

function SearchPageContent({
    placeholder,
    hitsPerPage,
    hitTemplate,
    facetAttributes,
    sortItems,
    paginationPadding,
}) {
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [externalQuery, setExternalQuery] = useState(null);
    const [templateOverride, setTemplateOverride] = useState(null);
    const [transformOverride, setTransformOverride] = useState(null);

    listen(listeners, {
        onSearchQuerySelected: (data) => {
            const q = data?.message?.query ?? "";
            setExternalQuery({ query: q, id: Date.now() });
        },
        onTemplateChanged: (data) => {
            const t = data?.message?.template;
            setTemplateOverride(typeof t === "string" ? t : null);
            const tr = data?.message?.transform;
            setTransformOverride(typeof tr === "string" ? tr : null);
        },
    });

    const resolvedTemplate = templateOverride ?? hitTemplate;

    const parsedHitsPerPage =
        typeof hitsPerPage === "string"
            ? parseInt(hitsPerPage, 10) || 20
            : hitsPerPage || 20;

    const facets = useMemo(() => {
        if (!facetAttributes || !facetAttributes.trim()) return [];
        try {
            const parsed = JSON.parse(facetAttributes);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((f) => f && f.attribute);
        } catch {
            return [];
        }
    }, [facetAttributes]);

    const parsedSortItems = useMemo(() => {
        if (!sortItems || !sortItems.trim()) return null;
        try {
            const parsed = JSON.parse(sortItems);
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
    }, [sortItems]);

    return (
        <>
            <Configure hitsPerPage={parsedHitsPerPage} />
            <AttributePublisher publishEvent={publishEvent} />

            {/* Top bar: search + sort */}
            <div className="flex items-center gap-2 pb-3">
                <SearchBar
                    placeholder={placeholder}
                    publishEvent={publishEvent}
                    externalQuery={externalQuery}
                />
                {parsedSortItems && (
                    <SortDropdown parsedItems={parsedSortItems} />
                )}
            </div>

            {/* Body: sidebar + results */}
            <div className="flex gap-0 flex-1 min-h-0">
                {facets.length > 0 && <FilterSidebar facets={facets} />}
                <div className="flex-1 flex flex-col min-w-0 pl-4">
                    <StatsBar />
                    <HitsGrid
                        hitTemplate={resolvedTemplate}
                        hitTransform={transformOverride}
                    />
                    <PaginationBar padding={paginationPadding} />
                </div>
            </div>
        </>
    );
}

export const AlgoliaSearchPage = ({
    placeholder = "Search...",
    hitsPerPage = 20,
    hitTemplate = "",
    facetAttributes = "",
    sortItems = "",
    paginationPadding = 3,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <div className="flex flex-col h-full">
                    <AlgoliaInstantSearchWrapper>
                        <SearchPageContent
                            placeholder={placeholder}
                            hitsPerPage={hitsPerPage}
                            hitTemplate={hitTemplate}
                            facetAttributes={facetAttributes}
                            sortItems={sortItems}
                            paginationPadding={paginationPadding}
                        />
                    </AlgoliaInstantSearchWrapper>
                </div>
            </Panel>
        </Widget>
    );
};
