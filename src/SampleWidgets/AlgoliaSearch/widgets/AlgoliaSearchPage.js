/**
 * AlgoliaSearchPage
 *
 * Composite search widget that wraps search box, filters, results, stats,
 * pagination, and sort inside a single <InstantSearch> instance.
 * This guarantees 1 Algolia API call per interaction — no event syncing needed.
 *
 * @package Algolia Search
 */
import { useState, useMemo, useEffect, useRef, useContext } from "react";
import {
    Panel,
    SubHeading3,
    Button,
    Button2,
    AlertBanner,
    Caption2,
    Checkbox,
    InputText,
    SelectInput,
    ThemeContext,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
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
        <div className="relative flex-1 min-w-0">
            <InputText
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                padding="pl-3 pr-8 py-2"
                inputClassName="text-sm rounded-md"
            />
            {inputValue && (
                <button
                    onClick={handleClear}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm opacity-70 hover:opacity-100 ${
                        currentTheme?.["text-primary-medium"] || ""
                    }`}
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

function FacetSection({ attribute, title, limit }) {
    const parsedLimit =
        typeof limit === "string" ? parseInt(limit, 10) || 10 : limit || 10;

    const { items, refine } = useRefinementList({
        attribute: attribute,
        limit: parsedLimit,
    });
    const { currentTheme } = useContext(ThemeContext);
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";

    return (
        <div className="flex flex-col gap-1">
            {title && <SubHeading3 title={title} padding={false} />}
            {items.length === 0 ? (
                <Caption2 block className="italic px-1">
                    No facet values.
                </Caption2>
            ) : (
                items.map((item) => (
                    <div
                        key={item.label}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${rowHover}`}
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
                ))
            )}
        </div>
    );
}

function FilterSidebar({ facets }) {
    const { currentTheme } = useContext(ThemeContext);
    return (
        <div
            className={`w-48 flex-shrink-0 flex flex-col gap-4 pr-4 border-r overflow-y-auto ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
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
    const { currentTheme } = useContext(ThemeContext);
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex items-center gap-1 text-xs px-1 pb-2">
            <span className={`font-medium ${bodyText}`}>
                {nbHits.toLocaleString()}
            </span>
            <Caption2>result{nbHits !== 1 ? "s" : ""}</Caption2>
            <Caption2 className="opacity-75">found in</Caption2>
            <span className={bodyText}>{processingTimeMS}ms</span>
        </div>
    );
}

function DefaultHitCard({ hit }) {
    const displayTitle =
        hit.title || hit.name || hit.label || hit.objectID || "Untitled";
    const displaySubtitle =
        hit.description || hit.subtitle || hit.content?.substring(0, 120) || "";
    const { currentTheme } = useContext(ThemeContext);

    return (
        <div
            className={`px-3 py-2 rounded transition-colors ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["hover-bg-primary-dark"] || ""}`}
        >
            <div
                className={`text-sm font-medium ${
                    currentTheme?.["text-primary-medium"] || ""
                }`}
            >
                {displayTitle}
            </div>
            {displaySubtitle && (
                <Caption2 block className="mt-0.5 line-clamp-2">
                    {displaySubtitle}
                </Caption2>
            )}
            <Caption2 block className="mt-1 font-mono opacity-75">
                {hit.objectID}
            </Caption2>
        </div>
    );
}

function applyTransform(hit, transformCode) {
    if (!transformCode || !transformCode.trim()) return hit;
    try {
        // eslint-disable-next-line no-new-func
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
    const { currentTheme } = useContext(ThemeContext);
    let html;
    try {
        const enrichedHit = applyTransform(hit, transform);
        html = Mustache.render(template, enrichedHit);
    } catch {
        return (
            <AlertBanner
                variant="error"
                size="compact"
                message="Template render error"
            />
        );
    }

    return (
        <div
            className={`px-3 py-2 rounded transition-colors text-sm ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["hover-bg-primary-dark"] || ""} ${
                currentTheme?.["text-primary-medium"] || ""
            }`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function HitsGrid({ hitTemplate, hitTransform }) {
    const { hits } = useHits();

    if (hits.length === 0) {
        return (
            <div className="flex items-center justify-center py-8">
                <Caption2 block className="italic">
                    No results found.
                </Caption2>
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
            <div className="flex flex-wrap items-center gap-2 pb-3">
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
