/**
 * PaletteView — full-pane component picker.
 *
 * Uses dash-react's `MenuItem` for each row so the hover /
 * selected / theme-token behavior is consistent with the rest of
 * the app. We skip the `Menu` wrapper (which is just `Panel` with
 * heavy default padding/border) because the composer sidebar
 * already has its own container chrome — wrapping again would
 * double-frame each section.
 *
 * Category headers and the modal header stay compact + lowercase
 * uppercase to match the rest of the composer pane (text-xs
 * uppercase tracking-wide). The cancel control is ButtonIcon.
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
import { MenuItem, ButtonIcon } from "@trops/dash-react";
import { getSchemasByCategory } from "../dashReactComponentSchemas";

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
    const grouped = useMemo(() => getSchemasByCategory(), []);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");

    const normalizedQuery = query.trim().toLowerCase();
    const visibleCategories = category === "all" ? CATEGORY_ORDER : [category];

    const filteredByCategory = useMemo(() => {
        const out = {};
        for (const cat of visibleCategories) {
            const entries = grouped[cat] || [];
            out[cat] = normalizedQuery
                ? entries.filter((name) =>
                      name.toLowerCase().includes(normalizedQuery)
                  )
                : entries;
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

    return (
        <div
            className="flex flex-col h-full min-h-0"
            data-testid="composer-palette-view"
        >
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs uppercase tracking-wide text-gray-400">
                    Pick a component
                </span>
                <ButtonIcon
                    icon="xmark"
                    onClick={onCancel}
                    ariaLabel="Cancel palette"
                    size="sm"
                    data-testid="composer-palette-cancel"
                />
            </div>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter components…"
                    autoFocus
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
                    data-testid="composer-palette-search"
                />
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="shrink-0 px-2 py-1 text-xs bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                    data-testid="composer-palette-category-filter"
                >
                    <option value="all">{CATEGORY_LABEL.all}</option>
                    {CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                            {CATEGORY_LABEL[cat] || cat}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                {totalMatches === 0 ? (
                    <div
                        className="px-3 py-6 text-center text-xs text-gray-500"
                        data-testid="composer-palette-no-matches"
                    >
                        No components match
                        {query ? ` "${query}"` : ""}
                        {category !== "all"
                            ? ` in ${CATEGORY_LABEL[category]}`
                            : ""}
                        .
                    </div>
                ) : (
                    visibleCategories.map((cat) => {
                        const entries = filteredByCategory[cat] || [];
                        if (entries.length === 0) return null;
                        return (
                            <div
                                key={cat}
                                className="mb-2"
                                data-testid={`composer-palette-category-${cat}`}
                            >
                                <div className="px-2 pb-1 text-xs uppercase tracking-wide text-gray-500">
                                    {cat}
                                </div>
                                <div className="flex flex-col">
                                    {entries.map((name) => (
                                        // dash-react's MenuItem doesn't
                                        // forward data-* attributes, so
                                        // the testid lives on a wrapper
                                        // div instead. Without this the
                                        // e2e specs can't address each
                                        // palette entry by name.
                                        <div
                                            key={name}
                                            data-testid={`composer-palette-pick-${name}`}
                                        >
                                            <MenuItem
                                                onClick={() => onPick(name)}
                                                className="cursor-pointer"
                                            >
                                                {name}
                                            </MenuItem>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
