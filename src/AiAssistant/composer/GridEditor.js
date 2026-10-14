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
import { Button3, ButtonIcon3 } from "@trops/dash-react";
import { getComponentSchema } from "../dashReactComponentSchemas";
import {
    findCellLocation,
    isContainer,
    cellFillsRow,
    rowHasFillingCell,
} from "./gridLayout";
import { useBuilderTheme } from "../useBuilderTheme";

/**
 * Per-category color tokens. Renders containers + leaves with a
 * subtle hue so the user can scan a nested tree (Panel > Card >
 * SearchInput) without parsing labels — colors group same-kind
 * components visually. Hover/selection ratchet up the intensity
 * so the focused cell + its ancestors stand out.
 *
 * Kept narrow: we only color a LEFT STRIPE and a tint on the
 * container header. The cell body stays neutral so component
 * labels and controls remain readable. Every hue is a theme or
 * status token, so the stripe follows light and dark themes.
 */
const categoryColors = (bt) => ({
    layout: {
        stripe: bt.tk("bg-secondary-medium"),
        headerBg: "",
        labelText: `${bt.accent}`,
    },
    display: {
        stripe: bt.status.info.solidBg,
        headerBg: `${bt.status.info.bg}`,
        labelText: `${bt.status.info.text}`,
    },
    input: {
        stripe: bt.status.success.solidBg,
        headerBg: `${bt.status.success.bg}`,
        labelText: `${bt.status.success.text}`,
    },
    action: {
        stripe: bt.status.warning.solidBg,
        headerBg: `${bt.status.warning.bg}`,
        labelText: `${bt.status.warning.text}`,
    },
    feedback: {
        stripe: bt.status.error.solidBg,
        headerBg: `${bt.status.error.bg}`,
        labelText: `${bt.status.error.text}`,
    },
});
const fallbackColor = (bt) => ({
    stripe: bt.raised,
    headerBg: `${bt.surface}`,
    labelText: `${bt.text}`,
});

// The category hue as a thin stripe on the cell's left edge.
function CategoryStripe({ color }) {
    return (
        <span
            aria-hidden="true"
            className={`absolute left-0 inset-y-0 w-1 rounded-l ${color.stripe}`}
        />
    );
}

function getCategoryColor(componentType, bt) {
    const schema = getComponentSchema(componentType);
    if (!schema) return fallbackColor(bt);
    return categoryColors(bt)[schema.category] || fallbackColor(bt);
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
        <div
            data-testid="composer-grid-editor"
            className="h-full w-full flex flex-col min-h-0 min-w-0"
        >
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
    // No frame of its own: the root grid sits in the pane's canvas
    // well, and a nested grid sits inside its container cell — a
    // border here would box a box.
    return (
        <div
            className="flex flex-col gap-2 h-full w-full min-h-0 min-w-0"
            data-testid={`composer-grid-${gridId}`}
        >
            {targetGrid.rows.map((row, rowIdx) => {
                // Rows containing a fill-component (Panel/Card/Table/
                // DataList/...) claim the remaining vertical space —
                // same predicate the emitter uses, so the editor's
                // proportions match what the user will see in the
                // rendered widget. Heading-only rows stay at content
                // height.
                const fill = rowHasFillingCell(grid, row);
                const rowClass = fill
                    ? "flex flex-row gap-2 items-stretch flex-1 min-h-0"
                    : "flex flex-row gap-2 items-stretch";
                return (
                    <div
                        key={rowIdx}
                        className={rowClass}
                        data-testid={`composer-grid-${gridId}-row-${rowIdx}`}
                    >
                        <div
                            className="flex-1 grid gap-2"
                            style={cellsStyle(row)}
                        >
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
                        <span className="dr-row-actions self-center shrink-0">
                            <ButtonIcon3
                                icon="xmark"
                                onClick={() => onRemoveRow(gridId, rowIdx)}
                                disabled={targetGrid.rows.length <= 1}
                                ariaLabel="Remove row"
                                size="sm"
                                testId={`composer-grid-${gridId}-remove-row-${rowIdx}`}
                            />
                        </span>
                    </div>
                );
            })}
            <Button3
                title="+ Add row"
                onClick={() => onAddRow(gridId)}
                size="sm"
                block
                className="shrink-0"
                testId={`composer-grid-${gridId}-add-row`}
            />
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
    const bt = useBuilderTheme();
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
            className={`absolute pointer-events-none ${
                bt.primaryFill
            } left-0 right-0 h-1 ${
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
    const selectionClass = isSelected ? `${bt.accentBorder}` : `${bt.border}`;
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
                    className={`flex-1 py-4 text-sm rounded ${bt.muted} ${bt.hoverSurface}`}
                    data-testid={`composer-cell-${cell.id}-add`}
                >
                    + Add component
                </button>
                <CellActions
                    cellId={cell.id}
                    onSplitCell={onSplitCell}
                    onRemoveCell={onRemoveCell}
                    removeLabel="Remove cell"
                />
            </div>
        );
    }
    if (effectiveKind === "leaf") {
        const color = getCategoryColor(cell.type, bt);
        // Fill cells (Table, DataList, …) take the row's full height
        // so the editor mirrors what the runtime widget does. Natural
        // leaves (Heading, Button, …) sit at content height.
        const fills = cellFillsRow(grid, cell);
        const fillClass = fills ? " h-full min-h-0" : "";
        return (
            <div
                {...dragProps}
                className={`relative border ${selectionClass} rounded pl-4 pr-3 py-3 composer-cell ${bt.surface} ${draggingOpacity}${fillClass}`}
                data-testid={`composer-cell-${cell.id}`}
            >
                <CategoryStripe color={color} />
                {dropIndicator}
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onSelectCell(cell.id)}
                        className={`text-sm ${color.labelText} font-mono truncate text-left flex-1`}
                        data-testid={`composer-cell-${cell.id}-select`}
                    >
                        {cell.type}
                    </button>
                    <CellActions
                        cellId={cell.id}
                        onSplitCell={onSplitCell}
                        onRemoveCell={onRemoveCell}
                        removeLabel="Remove cell"
                    />
                </div>
            </div>
        );
    }
    if (effectiveKind === "container" && cell.gridId) {
        const color = getCategoryColor(cell.type, bt);
        // Containers always fill — the editor shows the inner grid
        // expanding to the parent's height so the user sees the same
        // proportions the runtime will render.
        return (
            <div
                {...dragProps}
                className={`relative border ${selectionClass} rounded composer-cell ${bt.surface} ${draggingOpacity} h-full min-h-0 flex flex-col`}
                data-testid={`composer-cell-${cell.id}`}
            >
                <CategoryStripe color={color} />
                {dropIndicator}
                <div
                    className={`shrink-0 flex items-center justify-between gap-2 pl-4 pr-3 py-2 border-b ${bt.border} ${color.headerBg}`}
                >
                    <button
                        type="button"
                        onClick={() => onSelectCell(cell.id)}
                        className={`text-sm ${color.labelText} font-mono truncate text-left flex-1`}
                        data-testid={`composer-cell-${cell.id}-select`}
                    >
                        {cell.type}
                    </button>
                    <CellActions
                        cellId={cell.id}
                        onSplitCell={onSplitCell}
                        onRemoveCell={onRemoveCell}
                        removeLabel="Remove container (and everything inside)"
                    />
                </div>
                <div className="pl-4 pr-3 py-3 flex-1 min-h-0 flex flex-col">
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

// Per-cell actions: add a column to the right, remove the cell.
function CellActions({ cellId, onSplitCell, onRemoveCell, removeLabel }) {
    return (
        <div className="dr-row-actions flex items-center gap-1 shrink-0 self-center">
            <ButtonIcon3
                icon="plus"
                onClick={() => onSplitCell(cellId)}
                ariaLabel="Add column to the right"
                size="sm"
                testId={`composer-cell-${cellId}-split`}
            />
            <ButtonIcon3
                icon="xmark"
                onClick={() => onRemoveCell(cellId)}
                ariaLabel={removeLabel}
                size="sm"
                testId={`composer-cell-${cellId}-remove`}
            />
        </div>
    );
}
