/**
 * PaletteView — full-pane component picker.
 *
 * Each entry is a dash-react `ListRow`, so hover / theme-token
 * behavior matches every other list in the app. No extra frame
 * around the list — the composer pane is the container.
 *
 * The pane title and the category names are real headings
 * (sentence case, text-sm semibold). The cancel control is
 * ButtonIcon3.
 *
 * Search + category filter (added 2026-05-17): the schema set has
 * grown to ~50 entries, so the user needs to type-narrow.
 *   - Search matches a case-insensitive substring of the component
 *     name (the displayed label).
 *   - Category dropdown defaults to "all" — preserves the original
 *     grouped layout. Picking a single category collapses the view
 *     to just that section.
 *   - Categories with zero matches after filtering hide entirely so
 *     the list stays tight; an empty-state hint replaces them when
 *     nothing matches at all.
 */

import React, { useMemo, useState } from "react";
import {
    ButtonIcon3,
    ChoiceMenu,
    EmptyState,
    ListRow,
    SearchInput,
} from "@trops/dash-react";
import { getSchemasByCategory } from "../dashReactComponentSchemas";
import { useBuilderTheme } from "../useBuilderTheme";

const CATEGORY_ORDER = ["layout", "display", "input", "action", "feedback"];
const CATEGORY_LABEL = {
    all: "All categories",
    layout: "Layout",
    display: "Display",
    input: "Input",
    action: "Action",
    feedback: "Feedback",
};

export function PaletteView({ onPick, onCancel }) {
    const bt = useBuilderTheme();
    const grouped = useMemo(() => getSchemasByCategory(), []);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");

    const normalizedQuery = query.trim().toLowerCase();
    const visibleCategories = category === "all" ? CATEGORY_ORDER : [category];

    const filteredByCategory = useMemo(() => {
        const out = {};
        for (const cat of visibleCategories) {
            const entries = grouped[cat] || [];
            const matching = normalizedQuery
                ? entries.filter((name) =>
                      name.toLowerCase().includes(normalizedQuery)
                  )
                : entries;
            // Alphabetize within each category. localeCompare so
            // "Heading10" sorts after "Heading2" the way a user
            // expects (default sort would put "Heading10" before).
            out[cat] = [...matching].sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            );
        }
        return out;
        // visibleCategories is derived from `category`, no need to
        // list it as a separate dep.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouped, normalizedQuery, category]);

    const totalMatches = visibleCategories.reduce(
        (n, cat) => n + (filteredByCategory[cat] || []).length,
        0
    );

    const categoryOptions = [
        { value: "all", label: CATEGORY_LABEL.all },
        ...CATEGORY_ORDER.map((cat) => ({
            value: cat,
            label: CATEGORY_LABEL[cat] || cat,
        })),
    ];

    return (
        <div
            className="flex flex-col h-full min-h-0"
            data-testid="composer-palette-view"
        >
            <div
                className={`shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b ${bt.border}`}
            >
                <h3 className={`text-sm font-semibold ${bt.text}`}>
                    Pick a component
                </h3>
                <ButtonIcon3
                    icon="xmark"
                    onClick={onCancel}
                    ariaLabel="Cancel palette"
                    size="sm"
                    testId="composer-palette-cancel"
                />
            </div>
            <div
                className={`shrink-0 flex items-center gap-2 px-4 py-3 border-b ${bt.border}`}
            >
                <SearchInput
                    value={query}
                    onChange={(v) => setQuery(v)}
                    placeholder="Filter components…"
                    ariaLabel="Filter components"
                    autoFocus
                    className="flex-1 min-w-0"
                    data-testid="composer-palette-search"
                />
                {/* ChoiceMenu doesn't forward test ids, so the id sits
                    on a wrapper. */}
                <div
                    className="shrink-0"
                    data-testid="composer-palette-category-filter"
                >
                    <ChoiceMenu
                        label="Category"
                        value={category}
                        options={categoryOptions}
                        onChange={(v) => setCategory(v)}
                        showLabel={false}
                        align="right"
                    />
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                {totalMatches === 0 ? (
                    <EmptyState
                        testId="composer-palette-no-matches"
                        title="No components match"
                        description={`Nothing matches${
                            query ? ` "${query}"` : ""
                        }${
                            category !== "all"
                                ? ` in ${CATEGORY_LABEL[category]}`
                                : ""
                        }. Try another word or category.`}
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        {visibleCategories.map((cat) => {
                            const entries = filteredByCategory[cat] || [];
                            if (entries.length === 0) return null;
                            return (
                                <section
                                    key={cat}
                                    className="flex flex-col gap-2"
                                    data-testid={`composer-palette-category-${cat}`}
                                >
                                    <h3
                                        className={`px-2 text-sm font-semibold ${bt.text}`}
                                    >
                                        {CATEGORY_LABEL[cat] || cat}
                                    </h3>
                                    <div className="flex flex-col">
                                        {entries.map((name) => (
                                            // ListRow puts the test id on
                                            // its wrapper; the e2e specs
                                            // click each entry by name.
                                            <ListRow
                                                key={name}
                                                title={name}
                                                mono
                                                onClick={() => onPick(name)}
                                                testId={`composer-palette-pick-${name}`}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
