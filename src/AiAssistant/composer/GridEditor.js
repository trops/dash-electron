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

import React, { useState } from "react";
import { getComponentSchema } from "../dashReactComponentSchemas";
import { findCellLocation, isContainer } from "./gridLayout";

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
    onMoveCell,
}) {
    // Track which cell is being dragged + the active drop indicator.
    // Lifted to GridEditor (not per-cell) so the indicator can move
    // smoothly between cells without each leaving-cell having to
    // race-condition its own clear. Also lets us hide the indicator
    // immediately on drop or dragend.
    //
    // dragInfo: { cellId } | null  — set on dragstart, cleared on dragend/drop.
    // dropInfo: { targetCellId, edge } | null
    //   edge: "top" | "bottom" | "left" | "right" — closest cell edge
    //   to the cursor. Drives the insertion-bar render in CellNode.
    const [dragInfo, setDragInfo] = useState(null);
    const [dropInfo, setDropInfo] = useState(null);
    if (!grid || !grid.rootGridId) return null;

    const handleDragStart = (cellId) => setDragInfo({ cellId });
    const handleDragEnd = () => {
        setDragInfo(null);
        setDropInfo(null);
    };
    const handleDrop = (sourceId, targetCellId, edge) => {
        // dragInfo state is UI-only; the authoritative sourceId
        // comes from dataTransfer (passed in here).
        setDragInfo(null);
        setDropInfo(null);
        if (!onMoveCell || !sourceId) return;
        if (sourceId === targetCellId) return;
        const tgtLoc = findCellLocation(grid, targetCellId);
        if (!tgtLoc) return;
        // Translate (target cell, edge) → mutator target. Both same-
        // and cross-grid drops route through the same path; the
        // mutator (moveCellWithinGrid) discriminates via target.gridId.
        const target =
            edge === "top"
                ? { gridId: tgtLoc.gridId, rowIdx: tgtLoc.rowIdx, newRow: true }
                : {
                      gridId: tgtLoc.gridId,
                      rowIdx: tgtLoc.rowIdx + 1,
                      newRow: true,
                  };
        onMoveCell(sourceId, target);
    };

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
                dragInfo={dragInfo}
                dropInfo={dropInfo}
                onDragStartCell={handleDragStart}
                onDragEndCell={handleDragEnd}
                onDragOverCell={setDropInfo}
                onDragLeaveCell={() => setDropInfo(null)}
                onDropCell={handleDrop}
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
    dragInfo,
    dropInfo,
    onDragStartCell,
    onDragEndCell,
    onDragOverCell,
    onDragLeaveCell,
    onDropCell,
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
                                dragInfo={dragInfo}
                                dropInfo={dropInfo}
                                onDragStartCell={onDragStartCell}
                                onDragEndCell={onDragEndCell}
                                onDragOverCell={onDragOverCell}
                                onDragLeaveCell={onDragLeaveCell}
                                onDropCell={onDropCell}
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

/**
 * V1 drag/drop only reorders ROWS — we split the cell by vertical
 * midpoint and return "top" or "bottom". The four-edge split (with
 * left/right for same-row sibling reorder) flickered constantly for
 * wide cells because 1px of vertical movement flipped the
 * shortest-distance edge between top and bottom. Sticking to a
 * single axis with a clean midpoint comparison makes the indicator
 * stable. Same-row horizontal reorder is a follow-up via dedicated
 * arrow buttons.
 */
function closestEdge(rect, _clientX, clientY) {
    const midY = rect.top + rect.height / 2;
    return clientY < midY ? "top" : "bottom";
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
    dragInfo,
    dropInfo,
    onDragStartCell,
    onDragEndCell,
    onDragOverCell,
    onDragLeaveCell,
    onDropCell,
}) {
    if (!cell) return null;
    // Drag handlers — shared across leaf/container/empty render
    // branches so the user can drag any cell (and drop onto any
    // cell). Empty cells are valid drop targets but not drag sources
    // — dragging an empty placeholder would have no visible effect.
    const isDraggable = cell.kind === "leaf" || cell.kind === "container";
    const isBeingDragged = dragInfo && dragInfo.cellId === cell.id;
    const activeEdge =
        dropInfo && dropInfo.targetCellId === cell.id ? dropInfo.edge : null;
    // MIME-style key marking dataTransfer payload as "ours" — keeps
    // drag/drop from accidentally accepting external drags (files,
    // text selections). Native dataTransfer is the source of truth
    // for the source cellId, NOT React state — the browser cancels
    // the drop entirely if dragover's preventDefault is gated on a
    // possibly-stale dragInfo prop, even when state is set correctly.
    const COMPOSER_DRAG_MIME = "application/x-composer-cell-id";
    const dragProps = {
        draggable: isDraggable,
        onDragStart: isDraggable
            ? (e) => {
                  // stopPropagation is critical here: when dragging a
                  // cell inside a Panel/Card, dragstart bubbles up to
                  // the container's own dragStart handler, which then
                  // overwrites the dataTransfer payload with the
                  // CONTAINER's cellId. The drop then tries to move
                  // the Panel into its own inner grid, the cycle
                  // check silently rejects it, and the user sees no
                  // movement — the symptom that masked this bug.
                  e.stopPropagation();
                  e.dataTransfer.setData(COMPOSER_DRAG_MIME, cell.id);
                  // text/plain is a fallback some browsers require
                  // to consider the drag "valid"; some don't fire
                  // dragover at all without it.
                  e.dataTransfer.setData("text/plain", cell.id);
                  e.dataTransfer.effectAllowed = "move";
                  onDragStartCell && onDragStartCell(cell.id);
              }
            : undefined,
        onDragEnd: isDraggable
            ? () => {
                  onDragEndCell && onDragEndCell();
              }
            : undefined,
        onDragOver: (e) => {
            // dataTransfer.types is readable during dragover (the
            // payload itself isn't — that's a browser security
            // restriction). Use it to discriminate composer drags
            // from external ones.
            const types = e.dataTransfer.types;
            const isOurs =
                types &&
                (typeof types.includes === "function"
                    ? types.includes(COMPOSER_DRAG_MIME)
                    : Array.prototype.indexOf.call(
                          types,
                          COMPOSER_DRAG_MIME
                      ) !== -1);
            if (!isOurs) return;
            // Must preventDefault to allow drop. Always do this for
            // our own drags so the browser knows this cell is a
            // valid drop target, even when the dragInfo state prop
            // hasn't propagated to this render yet.
            e.preventDefault();
            // stopPropagation so ancestor cell wrappers (Panel,
            // Card) don't also claim this dragover. Without it the
            // outermost ancestor wins the indicator AND ultimately
            // the drop, which would move the cell out of its
            // intended container.
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            // UI-only: skip the indicator when hovering source-self.
            if (dragInfo && dragInfo.cellId === cell.id) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const edge = closestEdge(rect, e.clientX, e.clientY);
            if (
                !dropInfo ||
                dropInfo.targetCellId !== cell.id ||
                dropInfo.edge !== edge
            ) {
                onDragOverCell &&
                    onDragOverCell({ targetCellId: cell.id, edge });
            }
        },
        onDragLeave: (e) => {
            // Only clear if we're leaving the cell's outer box —
            // bubbled dragleaves from children would otherwise drop
            // the indicator unnecessarily.
            const r = e.currentTarget.getBoundingClientRect();
            if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
            ) {
                onDragLeaveCell && onDragLeaveCell();
            }
        },
        onDrop: (e) => {
            const sourceId =
                e.dataTransfer.getData(COMPOSER_DRAG_MIME) ||
                e.dataTransfer.getData("text/plain");
            if (!sourceId) return;
            e.preventDefault();
            // stopPropagation prevents the same drop from also
            // firing on the ancestor cell wrapper (Panel/Card),
            // which would invoke onMoveCell a second time with the
            // ancestor as target — bouncing the cell back out of
            // its intended location.
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const edge = closestEdge(rect, e.clientX, e.clientY);
            onDropCell && onDropCell(sourceId, cell.id, edge);
        },
    };
    // Insertion-bar overlay: a thin colored bar pinned to the active
    // edge. `pointer-events-none` keeps the bar from intercepting the
    // dragover events that drive its own positioning.
    const dropIndicator = activeEdge ? (
        <div
            data-testid={`composer-cell-${cell.id}-drop-${activeEdge}`}
            className={`absolute pointer-events-none bg-indigo-500 left-0 right-0 h-1 ${
                activeEdge === "top" ? "top-0" : "bottom-0"
            }`}
        />
    ) : null;
    const draggingOpacity = isBeingDragged ? "opacity-50" : "";
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
                {...dragProps}
                className={`relative flex items-stretch gap-1 border border-dashed ${selectionClass} rounded ${draggingOpacity}`}
                data-testid={`composer-cell-${cell.id}`}
            >
                {dropIndicator}
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
                {...dragProps}
                className={`relative border border-l-4 ${color.border} ${selectionClass} rounded p-1.5 bg-gray-900 hover:bg-gray-800 ${draggingOpacity}`}
                data-testid={`composer-cell-${cell.id}`}
            >
                {dropIndicator}
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
                {...dragProps}
                className={`relative border border-l-4 ${color.border} ${selectionClass} rounded bg-gray-900 ${draggingOpacity}`}
                data-testid={`composer-cell-${cell.id}`}
            >
                {dropIndicator}
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
                        dragInfo={dragInfo}
                        dropInfo={dropInfo}
                        onDragStartCell={onDragStartCell}
                        onDragEndCell={onDragEndCell}
                        onDragOverCell={onDragOverCell}
                        onDragLeaveCell={onDragLeaveCell}
                        onDropCell={onDropCell}
                    />
                </div>
            </div>
        );
    }
    return null;
}
