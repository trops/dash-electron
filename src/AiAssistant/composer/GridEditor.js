/**
 * GridEditor — recursive grid composition editor.
 *
 * Renders the grid tree as nested boxes:
 *   - Each grid is a Tailwind grid container with one slot per cell.
 *   - Empty cells show a "+ Add" affordance that swaps to the
 *     palette inline when clicked.
 *   - Leaf cells show the component name + summary.
 *   - Container cells render their inner grid recursively (with a
 *     visible header so the user can select the container itself
 *     to edit its props).
 *   - Per-grid [+ Row] button at the bottom of each grid.
 *   - Per-cell [×] removal in the corner.
 *
 * Selection is fully controlled by the parent (ComposerPane v2):
 *   - `selectedCellId` — which cell currently has focus (right-side
 *     inspector mirrors this).
 *   - `paletteCellId` — when set, an inline palette renders into
 *     that cell; picking a component fills it. Separate from
 *     selection so the user can "fill empty cell" without losing
 *     their current inspector context.
 */

import React from "react";
import { getComponentSchema } from "../dashReactComponentSchemas";
import { isContainer } from "./gridLayout";

/**
 * Per-category color tokens. Renders containers + leaves with a
 * subtle hue so the user can scan a nested tree (Panel > Card >
 * SearchInput) without parsing labels — colors group same-kind
 * components visually. Hover/selection ratchet up the intensity
 * so the focused cell + its ancestors stand out.
 *
 * Kept narrow: we only color the LEFT BORDER and a tint on the
 * container header. The cell body stays neutral so component
 * labels and controls remain readable.
 */
const CATEGORY_COLOR = {
    layout: {
        border: "border-l-purple-500",
        headerBg: "bg-purple-900/30",
        labelText: "text-purple-200",
    },
    display: {
        border: "border-l-sky-500",
        headerBg: "bg-sky-900/30",
        labelText: "text-sky-200",
    },
    input: {
        border: "border-l-emerald-500",
        headerBg: "bg-emerald-900/30",
        labelText: "text-emerald-200",
    },
    action: {
        border: "border-l-amber-500",
        headerBg: "bg-amber-900/30",
        labelText: "text-amber-200",
    },
    feedback: {
        border: "border-l-pink-500",
        headerBg: "bg-pink-900/30",
        labelText: "text-pink-200",
    },
};
const FALLBACK_COLOR = {
    border: "border-l-gray-600",
    headerBg: "bg-gray-800",
    labelText: "text-gray-200",
};

function getCategoryColor(componentType) {
    const schema = getComponentSchema(componentType);
    if (!schema) return FALLBACK_COLOR;
    return CATEGORY_COLOR[schema.category] || FALLBACK_COLOR;
}

/**
 * GridEditor renders the grid tree. Empty cells fire
 * `onRequestPalette(cellId)` so the parent (ComposerPaneV2) can
 * swap the pane to a full-height PaletteView. We no longer render
 * the palette inline within the cell — the cell was too narrow to
 * scan and pushed the rest of the UI around.
 */
export function GridEditor({
    grid,
    selectedCellId,
    onSelectCell,
    onAddRow,
    onRemoveRow,
    onSplitCell,
    onRemoveCell,
    onRequestPalette,
}) {
    if (!grid || !grid.rootGridId) return null;
    return (
        <div data-testid="composer-grid-editor">
            <GridNode
                grid={grid}
                gridId={grid.rootGridId}
                selectedCellId={selectedCellId}
                onSelectCell={onSelectCell}
                onAddRow={onAddRow}
                onRemoveRow={onRemoveRow}
                onSplitCell={onSplitCell}
                onRemoveCell={onRemoveCell}
                onRequestPalette={onRequestPalette}
            />
        </div>
    );
}

function GridNode({
    grid,
    gridId,
    selectedCellId,
    onSelectCell,
    onAddRow,
    onRemoveRow,
    onSplitCell,
    onRemoveCell,
    onRequestPalette,
}) {
    const targetGrid = grid.grids[gridId];
    if (!targetGrid) return null;
    return (
        <div
            className="border border-gray-700 rounded p-1 space-y-1"
            data-testid={`composer-grid-${gridId}`}
        >
            {targetGrid.rows.map((row, rowIdx) => (
                <div
                    key={rowIdx}
                    className="flex flex-row gap-1 items-stretch"
                    data-testid={`composer-grid-${gridId}-row-${rowIdx}`}
                >
                    <div className="flex-1 grid gap-1" style={cellsStyle(row)}>
                        {row.cells.map((cellId) => (
                            <CellNode
                                key={cellId}
                                grid={grid}
                                cell={grid.cells[cellId]}
                                isSelected={selectedCellId === cellId}
                                onSelectCell={onSelectCell}
                                onSplitCell={onSplitCell}
                                onRemoveCell={onRemoveCell}
                                onRequestPalette={onRequestPalette}
                                onAddRow={onAddRow}
                                onRemoveRow={onRemoveRow}
                                selectedCellId={selectedCellId}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemoveRow(gridId, rowIdx)}
                        disabled={targetGrid.rows.length <= 1}
                        className="text-xs text-gray-500 hover:text-red-300 disabled:opacity-30 px-1"
                        title="Remove row"
                        data-testid={`composer-grid-${gridId}-remove-row-${rowIdx}`}
                    >
                        ×
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onAddRow(gridId)}
                className="w-full text-xs text-indigo-400 hover:text-indigo-200 border border-dashed border-gray-700 rounded py-0.5"
                data-testid={`composer-grid-${gridId}-add-row`}
            >
                + Row
            </button>
        </div>
    );
}

function cellsStyle(row) {
    return {
        gridTemplateColumns: `repeat(${Math.max(
            row.cells.length,
            1
        )}, minmax(0, 1fr))`,
    };
}

function CellNode({
    grid,
    cell,
    isSelected,
    onSelectCell,
    onSplitCell,
    onRemoveCell,
    onRequestPalette,
    onAddRow,
    onRemoveRow,
    selectedCellId,
}) {
    if (!cell) return null;
    // Resolve the effective kind against the CURRENT schema.
    // Handles the migration case where a component's container-ness
    // flipped after the cell was created (e.g. Paragraph used to
    // accept children → was treated as container; now its schema
    // declares only `text` → must render as a leaf). Without this
    // the orphaned inner grid keeps rendering and the user can't
    // edit the component's actual props.
    const effectiveKind =
        cell.kind === "container" && cell.type && !isContainer(cell.type)
            ? "leaf"
            : cell.kind;
    const selectionClass = isSelected ? "border-indigo-500" : "border-gray-700";
    if (effectiveKind === "empty") {
        return (
            <div
                className={`flex items-stretch gap-1 border border-dashed ${selectionClass} rounded`}
                data-testid={`composer-cell-${cell.id}`}
            >
                <button
                    type="button"
                    onClick={() => onRequestPalette(cell.id)}
                    className="flex-1 py-3 text-xs text-gray-500 hover:text-indigo-300"
                    data-testid={`composer-cell-${cell.id}-add`}
                >
                    + Add component
                </button>
                <button
                    type="button"
                    onClick={() => onSplitCell(cell.id)}
                    className="px-2 text-xs text-gray-500 hover:text-indigo-300 border-l border-gray-700"
                    title="Add column to the right"
                    data-testid={`composer-cell-${cell.id}-split`}
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={() => onRemoveCell(cell.id)}
                    className="px-2 text-xs text-gray-500 hover:text-red-300 border-l border-gray-700"
                    title="Remove cell"
                    data-testid={`composer-cell-${cell.id}-remove`}
                >
                    ×
                </button>
            </div>
        );
    }
    if (effectiveKind === "leaf") {
        const color = getCategoryColor(cell.type);
        return (
            <div
                className={`border border-l-4 ${color.border} ${selectionClass} rounded p-1.5 bg-gray-900 hover:bg-gray-800`}
                data-testid={`composer-cell-${cell.id}`}
            >
                <div className="flex items-center justify-between gap-1">
                    <button
                        type="button"
                        onClick={() => onSelectCell(cell.id)}
                        className={`text-xs ${color.labelText} font-mono truncate hover:text-white text-left flex-1`}
                        data-testid={`composer-cell-${cell.id}-select`}
                    >
                        {cell.type}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSplitCell(cell.id)}
                        className="text-xs text-gray-500 hover:text-indigo-300 px-1"
                        title="Add column to the right"
                        data-testid={`composer-cell-${cell.id}-split`}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={() => onRemoveCell(cell.id)}
                        className="text-xs text-gray-500 hover:text-red-300 px-1"
                        title="Remove cell"
                        data-testid={`composer-cell-${cell.id}-remove`}
                    >
                        ×
                    </button>
                </div>
            </div>
        );
    }
    if (effectiveKind === "container" && cell.gridId) {
        const color = getCategoryColor(cell.type);
        return (
            <div
                className={`border border-l-4 ${color.border} ${selectionClass} rounded bg-gray-900`}
                data-testid={`composer-cell-${cell.id}`}
            >
                <div
                    className={`flex items-center justify-between gap-1 px-1.5 py-1 border-b border-gray-700 ${color.headerBg}`}
                >
                    <button
                        type="button"
                        onClick={() => onSelectCell(cell.id)}
                        className={`text-xs ${color.labelText} font-mono truncate hover:text-white text-left flex-1`}
                        data-testid={`composer-cell-${cell.id}-select`}
                    >
                        {cell.type}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSplitCell(cell.id)}
                        className="text-xs text-gray-500 hover:text-indigo-300 px-1"
                        title="Add column to the right"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={() => onRemoveCell(cell.id)}
                        className="text-xs text-gray-500 hover:text-red-300 px-1"
                        title="Remove container (and everything inside)"
                    >
                        ×
                    </button>
                </div>
                <div className="p-1.5">
                    <GridNode
                        grid={grid}
                        gridId={cell.gridId}
                        selectedCellId={selectedCellId}
                        onSelectCell={onSelectCell}
                        onAddRow={onAddRow}
                        onRemoveRow={onRemoveRow}
                        onSplitCell={onSplitCell}
                        onRemoveCell={onRemoveCell}
                        onRequestPalette={onRequestPalette}
                    />
                </div>
            </div>
        );
    }
    return null;
}
