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
 */

import React from "react";
import { MenuItem, ButtonIcon } from "@trops/dash-react";
import { getSchemasByCategory } from "../dashReactComponentSchemas";

const CATEGORY_ORDER = ["layout", "display", "input", "action", "feedback"];

export function PaletteView({ onPick, onCancel }) {
    const grouped = getSchemasByCategory();
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
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                {CATEGORY_ORDER.map((cat) => {
                    const entries = grouped[cat] || [];
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
                })}
            </div>
        </div>
    );
}
