import React, { memo, useState, useContext } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
    ButtonIcon,
    DropComponent,
    DragComponent,
    ConfirmationModal,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { WidgetFactory } from "../../../Widget";
import { LayoutContainer } from "../../../Components/Layout";
import { AppContext } from "../../../Context/App/AppContext";

import {
    getContainerBorderColor,
    renderComponent,
    isWidgetResolvable,
} from "../../../utils/layout";
import { isContainer, isWorkspace } from "../../../utils/layout";
import {
    GRID_CELL_WIDGET_TYPE,
    SIDEBAR_WIDGET_TYPE,
} from "../../../utils/dragTypes";

import { MergeCellsModal } from "./Modal";

const DraggableCellBody = ({
    cellNumber,
    gridContainerId,
    children,
    padding,
}) => {
    const [{ isDragging }, drag] = useDrag(
        () => ({
            type: GRID_CELL_WIDGET_TYPE,
            item: { cellNumber, gridContainerId },
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [cellNumber, gridContainerId]
    );

    return (
        <div
            ref={drag}
            className={`flex-1 min-h-0 overflow-auto ${padding} ${
                isDragging ? "opacity-30" : ""
            }`}
            style={{ cursor: "grab" }}
        >
            {children}
        </div>
    );
};

const DroppableEmptyCell = ({
    cellNumber,
    gridContainerId,
    onMoveWidgetToCell,
    onDropWidgetFromSidebar,
    children,
}) => {
    const [{ isOver, canDrop }, drop] = useDrop(
        () => ({
            accept: [GRID_CELL_WIDGET_TYPE, SIDEBAR_WIDGET_TYPE],
            canDrop: (dragItem, monitor) => {
                const itemType = monitor.getItemType();
                if (itemType === SIDEBAR_WIDGET_TYPE) return true;
                return (
                    dragItem.cellNumber !== cellNumber &&
                    dragItem.gridContainerId === gridContainerId
                );
            },
            drop: (dragItem, monitor) => {
                const itemType = monitor.getItemType();
                if (itemType === SIDEBAR_WIDGET_TYPE) {
                    if (onDropWidgetFromSidebar)
                        onDropWidgetFromSidebar(
                            gridContainerId,
                            cellNumber,
                            dragItem.widgetKey
                        );
                } else {
                    if (onMoveWidgetToCell)
                        onMoveWidgetToCell(
                            gridContainerId,
                            dragItem.cellNumber,
                            cellNumber
                        );
                }
            },
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
            }),
        }),
        [
            cellNumber,
            gridContainerId,
            onMoveWidgetToCell,
            onDropWidgetFromSidebar,
        ]
    );

    return (
        <div
            ref={drop}
            className={`flex-1 min-h-0 relative flex flex-col ${
                isOver && canDrop
                    ? "ring-2 ring-green-500 ring-inset bg-green-900/20"
                    : ""
            }`}
        >
            {children}
            {isOver && canDrop && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-600/30 rounded pointer-events-none">
                    <span className="text-sm font-bold text-green-200">
                        Drop here
                    </span>
                </div>
            )}
        </div>
    );
};

export const LayoutGridContainer = memo(
    ({
        item,
        workspace,
        preview = false,
        id,
        parent,
        scrollable,
        space,
        grow,
        order,
        children = null,
        onClickAdd,
        onClickQuickAdd,
        onClickRemove,
        onChangeDirection,
        onChangeOrder,
        onClickExpand,
        onClickShrink,
        onOpenConfig,
        onOpenEvents,
        onProviderSelect = null,
        onCreateProvider = null,
        width,
        height = "h-full",
        direction,
        onDropItem,
        onDragItem,
        editMode,
        uuid,
        layout,
        component,
        isDraggable,
        // Grid operation handlers
        onSplitCell = null,
        onMergeCells = null,
        onAddGridRow = null,
        onDeleteGridRow = null,
        onAddGridColumn = null,
        onDeleteGridColumn = null,
        onChangeRowHeight = null,
        onMoveWidgetToCell = null,
        onDropWidgetFromSidebar = null,
    }) => {
        // Get providers from AppContext (not DashboardContext, which has a structural
        // issue where providers from AppWrapper don't flow through DashboardWrapper)
        const appCtx = useContext(AppContext);
        const providersObj = appCtx?.providers || {};

        // Convert providers object to array format expected by WidgetCardHeader
        // Providers from context are stored as: { "provider-name": { name, type, credentials, ... }, ... }
        const availableProviders =
            providersObj && typeof providersObj === "object"
                ? Object.entries(providersObj).map(([id, provider]) => ({
                      id,
                      ...provider,
                  }))
                : [];

        // Grid Detection: Check if this item has grid layout configuration
        const hasGrid = item?.grid && item.grid.rows && item.grid.cols;
        const useGridLayout =
            hasGrid && (item.type === "grid" || item.grid !== null);

        // Gutter layout constants (match main grid's p-4 and gap-5)
        const GUTTER_WIDTH = 36; // px — width of the left row gutter
        const GUTTER_HEIGHT = 32; // px — height of the top column gutter
        const GRID_PAD = 16; // px — matches p-4 (1rem)
        const GRID_GAP = 20; // px — matches gap-5 (1.25rem)

        // Compute fixed row heights for scrollable mode
        function getRowTemplate(grid) {
            const unit = grid.rowUnit || 300;
            const heights = grid.rowHeights || {};
            const tracks = [];
            for (let r = 1; r <= grid.rows; r++) {
                const mult = heights[String(r)] || 1;
                tracks.push(`${unit * mult}px`);
            }
            return tracks.join(" ");
        }

        // Get the current multiplier for a row
        function getRowMultiplier(row) {
            if (!hasGrid) return 1;
            return item.grid.rowHeights?.[String(row)] || 1;
        }

        // Cycle multiplier: 1 → 2 → 3 → 1
        function handleCycleRowHeight(row) {
            const current = getRowMultiplier(row);
            const next = current >= 3 ? 1 : current + 1;
            if (onChangeRowHeight) {
                onChangeRowHeight(id, row, next);
            }
        }

        // Modal state for grid operations
        const [mergeModalOpen, setMergeModalOpen] = useState(false);
        const [selectedCellsForMerge, setSelectedCellsForMerge] = useState([]);
        const [contextMenuCell, setContextMenuCell] = useState(null);
        const [contextMenuPosition, setContextMenuPosition] = useState({
            x: 0,
            y: 0,
        });

        // Grid operation handlers
        function handleInstantSplit(cellNumber, direction) {
            if (onSplitCell) {
                onSplitCell({
                    cellNumber,
                    direction, // "horizontal" or "vertical"
                    count: 2,
                    gridContainer: item,
                });
            }
        }

        // Given a hidden cell's position, find the visible cell whose span covers it
        function findSpanOwner(grid, row, col) {
            for (let r = row; r >= 1; r--) {
                for (let c = col; c >= 1; c--) {
                    const cell = grid[`${r}.${c}`];
                    if (cell && cell.span) {
                        const spanRows = cell.span.row || 1;
                        const spanCols = cell.span.col || 1;
                        if (
                            r + spanRows - 1 >= row &&
                            c + spanCols - 1 >= col
                        ) {
                            return `${r}.${c}`;
                        }
                    }
                }
            }
            return null;
        }

        // Compute which cells can be added to the current selection
        // while maintaining a contiguous rectangle
        function getSelectableCells() {
            if (selectedCellsForMerge.length === 0 || !hasGrid) return null; // null = all selectable

            // Build bounding box accounting for cell spans
            let minRow = Infinity,
                maxRow = -Infinity;
            let minCol = Infinity,
                maxCol = -Infinity;
            selectedCellsForMerge.forEach((cn) => {
                const [r, c] = cn.split(".").map(Number);
                const cellDef = item.grid[cn];
                const spanRow = cellDef?.span?.row || 1;
                const spanCol = cellDef?.span?.col || 1;
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r + spanRow - 1);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c + spanCol - 1);
            });

            const { rows, cols } = item.grid;
            const selectable = new Set();

            // Expand up: entire row above bounding box
            if (minRow > 1)
                for (let c = minCol; c <= maxCol; c++)
                    selectable.add(`${minRow - 1}.${c}`);
            // Expand down
            if (maxRow < rows)
                for (let c = minCol; c <= maxCol; c++)
                    selectable.add(`${maxRow + 1}.${c}`);
            // Expand left
            if (minCol > 1)
                for (let r = minRow; r <= maxRow; r++)
                    selectable.add(`${r}.${minCol - 1}`);
            // Expand right
            if (maxCol < cols)
                for (let r = minRow; r <= maxRow; r++)
                    selectable.add(`${r}.${maxCol + 1}`);

            // Exclude already-selected, then resolve hidden cells to their span owners
            selectedCellsForMerge.forEach((cn) => selectable.delete(cn));
            const resolved = new Set();
            for (const cn of selectable) {
                if (item.grid[cn]?.hide) {
                    const [r, c] = cn.split(".").map(Number);
                    const owner = findSpanOwner(item.grid, r, c);
                    if (owner && !selectedCellsForMerge.includes(owner)) {
                        resolved.add(owner);
                    }
                } else {
                    resolved.add(cn);
                }
            }
            return resolved;
        }

        function handleToggleCellSelection(cellNumber) {
            setSelectedCellsForMerge((prev) => {
                if (prev.includes(cellNumber)) {
                    return []; // Deselecting any cell clears entire selection
                }
                const allCells = [...prev, cellNumber];
                // Build bounding box accounting for cell spans
                let minRow = Infinity,
                    maxRow = -Infinity;
                let minCol = Infinity,
                    maxCol = -Infinity;
                allCells.forEach((cn) => {
                    const [r, c] = cn.split(".").map(Number);
                    const cellDef = item.grid[cn];
                    const spanRow = cellDef?.span?.row || 1;
                    const spanCol = cellDef?.span?.col || 1;
                    minRow = Math.min(minRow, r);
                    maxRow = Math.max(maxRow, r + spanRow - 1);
                    minCol = Math.min(minCol, c);
                    maxCol = Math.max(maxCol, c + spanCol - 1);
                });
                // Fill bounding box, resolving hidden cells to span owners
                const result = [];
                const added = new Set();
                for (let r = minRow; r <= maxRow; r++)
                    for (let c = minCol; c <= maxCol; c++) {
                        const key = `${r}.${c}`;
                        if (item.grid[key]?.hide) {
                            const owner = findSpanOwner(item.grid, r, c);
                            if (owner && !added.has(owner)) {
                                result.push(owner);
                                added.add(owner);
                            }
                        } else if (!added.has(key)) {
                            result.push(key);
                            added.add(key);
                        }
                    }
                return result;
            });
        }

        function handleOpenMergeModal(cellNumbers) {
            setSelectedCellsForMerge(cellNumbers);
            setMergeModalOpen(true);
        }

        function handleMergeCellsConfirm(mergeData) {
            if (onMergeCells) {
                onMergeCells(mergeData);
            }
            setMergeModalOpen(false);
            setSelectedCellsForMerge([]);
        }

        // Compute real conflicting components for merge modal
        function getConflictingComponents(cellNumbers) {
            if (!item?.grid) return [];
            return cellNumbers
                .filter((cn) => item.grid[cn]?.component)
                .map((cn) => item.grid[cn].component);
        }

        function handleCellRightClick(e, cellNumber) {
            e.preventDefault();
            e.stopPropagation();
            setContextMenuCell(cellNumber);
            setContextMenuPosition({ x: e.clientX, y: e.clientY });
        }

        function handleCloseContextMenu() {
            setContextMenuCell(null);
        }

        function handleAddRow(afterRow) {
            if (onAddGridRow) {
                onAddGridRow(id, afterRow);
            }
        }

        function handleDeleteRow(rowNumber) {
            if (onDeleteGridRow) {
                onDeleteGridRow(id, rowNumber);
            }
        }

        function handleAddColumn(afterCol) {
            if (onAddGridColumn) {
                onAddGridColumn(id, afterCol);
            }
        }

        function handleDeleteColumn(colNumber) {
            if (onDeleteGridColumn) {
                onDeleteGridColumn(id, colNumber);
            }
        }

        // Check if a row has any visible (non-hidden) cells starting in it
        function rowHasVisibleCells(row) {
            if (!hasGrid) return true;
            const { cols } = item.grid;
            for (let col = 1; col <= cols; col++) {
                const cellDef = item.grid[`${row}.${col}`];
                if (!cellDef || !cellDef.hide) return true;
            }
            return false;
        }

        // Get the gutter span for this column label. Only spans into
        // consecutive hidden columns (where no row has a visible cell).
        // Cell spans are visualized by the cells themselves and should
        // not affect the gutter label positioning.
        function getColGutterSpan(col) {
            if (!hasGrid) return 1;
            const { cols } = item.grid;
            let hiddenAfter = 0;
            for (let c = col + 1; c <= cols; c++) {
                if (!colHasVisibleCells(c)) hiddenAfter++;
                else break;
            }
            return 1 + hiddenAfter;
        }

        // Get the gutter span for this row label. Only spans into
        // consecutive hidden rows (where no column has a visible cell).
        function getRowGutterSpan(row) {
            if (!hasGrid) return 1;
            const { rows } = item.grid;
            let hiddenAfter = 0;
            for (let r = row + 1; r <= rows; r++) {
                if (!rowHasVisibleCells(r)) hiddenAfter++;
                else break;
            }
            return 1 + hiddenAfter;
        }

        // Check if a column has any visible (non-hidden) cells starting in it
        function colHasVisibleCells(col) {
            if (!hasGrid) return true;
            const { rows } = item.grid;
            for (let row = 1; row <= rows; row++) {
                const cellDef = item.grid[`${row}.${col}`];
                if (!cellDef || !cellDef.hide) return true;
            }
            return false;
        }

        // Render left gutter with row controls (always-visible, CSS Grid aligned)
        function renderRowGutter() {
            if (!hasGrid || preview) return null;

            const { rows } = item.grid;
            const rowItems = [];

            const visibleRowCount = Array.from(
                { length: rows },
                (_, i) => i + 1
            ).filter(rowHasVisibleCells).length;

            for (let row = 1; row <= rows; row++) {
                const hasVisible = rowHasVisibleCells(row);
                const rowSpan = hasVisible ? getRowGutterSpan(row) : 1;
                rowItems.push(
                    <div
                        key={`row-gutter-${row}`}
                        className="flex w-full items-center justify-center group"
                        style={
                            rowSpan > 1
                                ? { gridRow: `${row} / span ${rowSpan}` }
                                : undefined
                        }
                    >
                        {hasVisible && (
                            <div className="flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                                <button
                                    className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                    onClick={() => handleAddRow(row - 1)}
                                    title={`Add row above row ${row}`}
                                >
                                    <FontAwesomeIcon icon="plus" />
                                </button>
                                <span className="text-[11px] text-gray-400 group-hover:text-gray-200 select-none font-mono font-medium">
                                    R{row}
                                </span>
                                {scrollable && (
                                    <button
                                        className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-500 opacity-40 hover:opacity-100 hover:text-blue-400 hover:bg-blue-400/10 transition-all font-mono font-bold select-none"
                                        onClick={() =>
                                            handleCycleRowHeight(row)
                                        }
                                        title={`Row height: ${getRowMultiplier(
                                            row
                                        )}x (click to cycle)`}
                                    >
                                        {getRowMultiplier(row)}x
                                    </button>
                                )}
                                <button
                                    className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                    onClick={() => handleAddRow(row)}
                                    title={`Add row below row ${row}`}
                                >
                                    <FontAwesomeIcon icon="plus" />
                                </button>
                                {visibleRowCount > 1 && (
                                    <button
                                        className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                        onClick={() => handleDeleteRow(row)}
                                        title={`Delete row ${row}`}
                                    >
                                        <FontAwesomeIcon icon="trash" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div
                    className="flex flex-col flex-shrink-0 pl-1.5"
                    style={{ width: GUTTER_WIDTH }}
                >
                    {/* Top spacer */}
                    <div style={{ height: GRID_PAD }} />
                    {/* CSS Grid matching main grid's row template */}
                    <div
                        className={`grid ${scrollable ? "" : "flex-1"}`}
                        style={{
                            gridTemplateRows: scrollable
                                ? getRowTemplate(item.grid)
                                : `repeat(${rows}, 1fr)`,
                            gap: GRID_GAP,
                        }}
                    >
                        {rowItems}
                    </div>
                    {/* Bottom spacer */}
                    <div style={{ height: GRID_PAD }} />
                </div>
            );
        }

        // Render top gutter with column controls (always-visible, CSS Grid aligned)
        function renderColumnGutter() {
            if (!hasGrid || preview) return null;

            const { cols } = item.grid;
            const colItems = [];

            const visibleColCount = Array.from(
                { length: cols },
                (_, i) => i + 1
            ).filter(colHasVisibleCells).length;

            for (let col = 1; col <= cols; col++) {
                const hasVisible = colHasVisibleCells(col);
                const colSpan = hasVisible ? getColGutterSpan(col) : 1;
                colItems.push(
                    <div
                        key={`col-gutter-${col}`}
                        className="flex h-full items-center justify-center group"
                        style={
                            colSpan > 1
                                ? { gridColumn: `${col} / span ${colSpan}` }
                                : undefined
                        }
                    >
                        {hasVisible && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                                <button
                                    className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                    onClick={() => handleAddColumn(col - 1)}
                                    title={`Add column before column ${col}`}
                                >
                                    <FontAwesomeIcon icon="plus" />
                                </button>
                                <span className="text-[11px] text-gray-400 group-hover:text-gray-200 select-none font-mono font-medium">
                                    C{col}
                                </span>
                                <button
                                    className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                    onClick={() => handleAddColumn(col)}
                                    title={`Add column after column ${col}`}
                                >
                                    <FontAwesomeIcon icon="plus" />
                                </button>
                                {visibleColCount > 1 && (
                                    <button
                                        className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-600 opacity-40 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                        onClick={() => handleDeleteColumn(col)}
                                        title={`Delete column ${col}`}
                                    >
                                        <FontAwesomeIcon icon="trash" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div
                    className="flex flex-row flex-shrink-0"
                    style={{
                        height: GUTTER_HEIGHT,
                        marginLeft: GUTTER_WIDTH,
                    }}
                >
                    {/* Left spacer */}
                    <div style={{ width: GRID_PAD }} />
                    {/* CSS Grid matching main grid's column template */}
                    <div
                        className="grid flex-1"
                        style={{
                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                            gap: GRID_GAP,
                        }}
                    >
                        {colItems}
                    </div>
                    {/* Right spacer */}
                    <div style={{ width: GRID_PAD }} />
                </div>
            );
        }

        // Render individual grid cells
        function renderGridCells() {
            if (!hasGrid) return null;

            const cells = [];
            const { rows, cols } = item.grid;
            const selectableSet = getSelectableCells();

            for (let row = 1; row <= rows; row++) {
                for (let col = 1; col <= cols; col++) {
                    const cellNumber = `${row}.${col}`;
                    const cellDef = item.grid[cellNumber] || {
                        component: null,
                        hide: false,
                    };

                    // Skip hidden cells
                    if (cellDef.hide) continue;

                    // Build explicit grid position + span styles for every cell
                    const spanStyle = {
                        gridColumn: col,
                        gridRow: row,
                    };
                    if (cellDef.span) {
                        if (typeof cellDef.span === "object") {
                            if (cellDef.span.col > 1)
                                spanStyle.gridColumn = `${col} / span ${cellDef.span.col}`;
                            if (cellDef.span.row > 1)
                                spanStyle.gridRow = `${row} / span ${cellDef.span.row}`;
                        } else if (typeof cellDef.span === "string") {
                            const match =
                                cellDef.span.match(/(col|row)-span-(\d+)/);
                            if (match) {
                                const [, dir, count] = match;
                                if (dir === "col")
                                    spanStyle.gridColumn = `${col} / span ${count}`;
                                if (dir === "row")
                                    spanStyle.gridRow = `${row} / span ${count}`;
                            }
                        }
                    }

                    const isCellSelected =
                        selectedCellsForMerge.includes(cellNumber);

                    cells.push(
                        <div
                            key={cellNumber}
                            className={`flex w-full h-full min-h-0 min-w-0 overflow-hidden relative ${
                                isCellSelected
                                    ? "ring-2 ring-blue-500 ring-inset rounded"
                                    : ""
                            }`}
                            data-cell={cellNumber}
                            style={spanStyle}
                        >
                            {preview
                                ? cellDef.component
                                    ? renderCellComponent(
                                          cellDef.component,
                                          cellNumber,
                                          selectableSet
                                      )
                                    : renderPreviewEmptyCell(cellNumber)
                                : renderEditCell(
                                      cellNumber,
                                      cellDef,
                                      selectableSet
                                  )}
                        </div>
                    );
                }
            }

            return cells;
        }

        // Render component inside a grid cell (preview mode only)
        function renderCellComponent(componentId, cellNumber, selectableSet) {
            if (!layout || !workspace) {
                console.error(
                    "[LayoutGridContainer] Missing layout or workspace"
                );
                return null;
            }

            const cellComponent = layout.find((c) => c.id === componentId);

            if (!cellComponent) {
                console.error(
                    "[LayoutGridContainer] Component not found:",
                    componentId
                );
                return null;
            }

            return renderComponent(
                cellComponent.component,
                cellComponent.id,
                cellComponent,
                null
            );
        }

        // Render empty cell in preview mode
        function renderPreviewEmptyCell(cellNumber) {
            return (
                <div className="w-full h-full border-2 border-dashed border-gray-800 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-600">{cellNumber}</span>
                </div>
            );
        }

        // Render empty cell body content (used inside WidgetCard.Body in edit mode)
        function renderEmptyCellContent(cellNumber) {
            return (
                <div
                    className="w-full h-full min-h-16 flex flex-col items-center justify-center hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => handleClickAdd(cellNumber)}
                    onContextMenu={(e) => handleCellRightClick(e, cellNumber)}
                >
                    <ButtonIcon
                        icon="plus"
                        textColor="text-gray-600"
                        hoverTextColor="hover:text-blue-400"
                        backgroundColor="bg-transparent"
                    />
                    <span className="text-xs text-gray-600 mt-1">
                        Add widget
                    </span>
                </div>
            );
        }

        // Unified edit mode cell renderer — wraps ALL cells in WidgetCard
        function renderEditCell(cellNumber, cellDef, selectableSet) {
            const { WidgetCard } = require("./Enhanced/WidgetCard");

            const isCellSelected = selectedCellsForMerge.includes(cellNumber);
            const isCellSelectable =
                selectableSet === null || selectableSet.has(cellNumber);

            // Find component if cell is occupied
            let cellComponent = null;
            let renderedWidget = null;

            if (cellDef.component && layout) {
                cellComponent = layout.find((c) => c.id === cellDef.component);
                if (cellComponent) {
                    renderedWidget = renderComponent(
                        cellComponent.component,
                        cellComponent.id,
                        cellComponent,
                        null
                    );
                }
            }

            return (
                <WidgetCard preview={false}>
                    <WidgetCard.Header
                        item={cellComponent}
                        cellNumber={cellNumber}
                        providers={
                            cellComponent ? availableProviders || [] : []
                        }
                        selectedProviders={
                            cellComponent?.selectedProviders || {}
                        }
                        isSelected={isCellSelected}
                        isSelectable={isCellSelectable}
                        onToggleSelect={() =>
                            handleToggleCellSelection(cellNumber)
                        }
                        onSplitHorizontal={() =>
                            handleInstantSplit(cellNumber, "horizontal")
                        }
                        onSplitVertical={() =>
                            handleInstantSplit(cellNumber, "vertical")
                        }
                        onProviderChange={
                            cellComponent
                                ? (providerType, providerId, isCreateNew) => {
                                      if (isCreateNew) {
                                          if (onCreateProvider) {
                                              onCreateProvider(
                                                  cellComponent.id,
                                                  providerType,
                                                  true
                                              );
                                          }
                                      } else {
                                          if (onProviderSelect) {
                                              onProviderSelect(
                                                  cellComponent.id,
                                                  providerType,
                                                  providerId
                                              );
                                          }
                                      }
                                  }
                                : undefined
                        }
                        onConfigure={
                            cellComponent
                                ? () => {
                                      if (onOpenConfig)
                                          onOpenConfig(cellComponent);
                                  }
                                : undefined
                        }
                        onDelete={
                            cellComponent
                                ? () => {
                                      if (onClickRemove)
                                          onClickRemove(cellComponent.id);
                                  }
                                : undefined
                        }
                    />
                    {cellComponent &&
                    isWidgetResolvable(cellComponent.component) ? (
                        <DraggableCellBody
                            cellNumber={cellNumber}
                            gridContainerId={id}
                            padding="p-3"
                        >
                            {renderedWidget}
                        </DraggableCellBody>
                    ) : (
                        <DroppableEmptyCell
                            cellNumber={cellNumber}
                            gridContainerId={id}
                            onMoveWidgetToCell={onMoveWidgetToCell}
                            onDropWidgetFromSidebar={onDropWidgetFromSidebar}
                        >
                            <WidgetCard.Body padding="p-0">
                                {cellComponent
                                    ? renderedWidget
                                    : renderEmptyCellContent(cellNumber)}
                            </WidgetCard.Body>
                        </DroppableEmptyCell>
                    )}
                    {cellComponent && (
                        <WidgetCard.Footer
                            item={cellComponent}
                            onConfigure={(item, section) =>
                                onOpenConfig && onOpenConfig(item, section)
                            }
                        />
                    )}
                </WidgetCard>
            );
        }

        function handleClickAdd(cellNumber = null) {
            // Pass item and optionally cell number for grid layouts
            if (cellNumber && onClickAdd) {
                onClickAdd(item, cellNumber);
            } else if (onClickAdd) {
                onClickAdd(item);
            }
        }

        function handleDropItem(item) {
            if (onDropItem) {
                onDropItem(item);
            }
        }

        function handleDragItem(item) {}

        function getBorderStyle() {
            try {
                return WidgetFactory.workspace(item["component"]) === "layout"
                    ? "border-dashed"
                    : "border-4";
            } catch (e) {
                return "";
            }
        }

        function renderComponentContainer(children) {
            if (!item) return null;

            // Extract widget-specific provider selections from workspace
            // selectedProviders structure: { "widget-id-123": { "algolia": "Provider Name", ... }, ... }
            const widgetSpecificSelections =
                workspace?.selectedProviders?.[id] || {};

            // Add provider-related props from workspace
            const itemWithProviders = {
                ...item,
                selectedProviders: widgetSpecificSelections,
                onProviderSelect: onProviderSelect,
            };

            return renderComponent(
                itemWithProviders["component"],
                id,
                itemWithProviders,
                children
            );
        }

        function getAllWorkspaceNames() {
            if (workspace !== null) {
                const names = workspace.layout.map((layout) => {
                    return "workspace" in layout ? layout.workspace : null;
                });
                return names
                    .filter(
                        (value, index, array) => array.indexOf(value) === index
                    )
                    .filter((i) => i !== null);
            }
            return null;
        }

        function dropType(item) {
            // if item is a Workspace, and NOT a container, can only drop into a Container (layout)
            if (isWorkspace(item) === true) {
                return ["layout", item["parentWorkspaceName"]];
            }
            // if a container, we can place this into ANY other container or workspace
            if (isContainer(item) === true) {
                return getAllWorkspaceNames();
            }
            return ["layout", item["parentWorkspaceName"]];
        }

        function dragType(item) {
            if (isWorkspace(item) === true) {
                return item["parentWorkspaceName"];
            }
            if (isContainer(item)) {
                return "layout";
            }
            return item["parentWorkspaceName"];
        }

        return preview === false && useGridLayout ? (
            // Grid layout mode — no outer DragComponent/DropComponent (cell-level drag/drop instead)
            <LayoutContainer
                id={`grid-container-parent-${id}`}
                direction={"col"}
                width={"w-full"}
                height={"h-full"}
                scrollable={false}
                className={`rounded overflow-x-clip border-2 rounded ${getContainerBorderColor(
                    item
                )} ${getBorderStyle()} min-h-24 z-10`}
                space={false}
            >
                <div className="flex flex-col flex-1 min-h-0 pt-2">
                    {/* Merge confirmation modal */}
                    <ConfirmationModal
                        isOpen={selectedCellsForMerge.length >= 2}
                        setIsOpen={() => setSelectedCellsForMerge([])}
                        title="Merge Cells"
                        message={`Merge ${selectedCellsForMerge.length} selected cells into one? This action cannot be undone.`}
                        confirmLabel="Merge"
                        variant="default"
                        onConfirm={() => {
                            const conflicts = getConflictingComponents(
                                selectedCellsForMerge
                            );
                            if (conflicts.length > 1) {
                                handleOpenMergeModal(selectedCellsForMerge);
                            } else {
                                handleMergeCellsConfirm({
                                    cellNumbers: selectedCellsForMerge,
                                    gridContainer: item,
                                    keepComponent:
                                        conflicts.length === 1
                                            ? conflicts[0]
                                            : null,
                                });
                            }
                        }}
                        onCancel={() => setSelectedCellsForMerge([])}
                    />

                    {/* Top column gutter */}
                    {renderColumnGutter()}

                    {/* Row gutter + main grid side by side */}
                    <div
                        className={`flex flex-row flex-1 min-h-0 ${
                            scrollable ? "overflow-y-auto items-start" : ""
                        }`}
                    >
                        {renderRowGutter()}
                        <div
                            id={`grid-container-${id}`}
                            className={`grid flex-1 ${
                                scrollable ? "" : height
                            } min-h-24 p-4 gap-5`}
                            style={{
                                gridTemplateRows: scrollable
                                    ? getRowTemplate(item.grid)
                                    : `repeat(${item.grid.rows}, 1fr)`,
                                gridTemplateColumns: `repeat(${item.grid.cols}, 1fr)`,
                                overflow: "hidden",
                            }}
                        >
                            {renderGridCells()}
                        </div>
                    </div>
                </div>

                {/* Grid operation modals */}
                <MergeCellsModal
                    open={mergeModalOpen}
                    setIsOpen={setMergeModalOpen}
                    cellNumbers={selectedCellsForMerge}
                    gridContainer={item}
                    conflictingComponents={getConflictingComponents(
                        selectedCellsForMerge
                    )}
                    onConfirm={handleMergeCellsConfirm}
                />

                {/* Context menu for cell operations */}
                {contextMenuCell && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={handleCloseContextMenu}
                        />
                        <div
                            className="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-48"
                            style={{
                                left: `${contextMenuPosition.x}px`,
                                top: `${contextMenuPosition.y}px`,
                            }}
                        >
                            <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center"
                                onClick={() => {
                                    handleInstantSplit(
                                        contextMenuCell,
                                        "horizontal"
                                    );
                                    handleCloseContextMenu();
                                }}
                            >
                                <FontAwesomeIcon
                                    icon="arrows-left-right"
                                    className="mr-2"
                                />
                                Split Horizontal
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center"
                                onClick={() => {
                                    handleInstantSplit(
                                        contextMenuCell,
                                        "vertical"
                                    );
                                    handleCloseContextMenu();
                                }}
                            >
                                <FontAwesomeIcon
                                    icon="arrows-up-down"
                                    className="mr-2"
                                />
                                Split Vertical
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center"
                                onClick={() => {
                                    handleClickAdd();
                                    handleCloseContextMenu();
                                }}
                            >
                                <FontAwesomeIcon icon="plus" className="mr-2" />
                                Add Widget
                            </button>
                        </div>
                    </>
                )}
            </LayoutContainer>
        ) : preview === false ? (
            // Flexbox layout mode — keep outer DragComponent/DropComponent
            <DropComponent
                item={item}
                id={id}
                type={dropType(item)}
                onDropItem={handleDropItem}
                width={item.width}
                height={item.height}
            >
                <DragComponent
                    id={id}
                    type={dragType(item)}
                    onDropItem={handleDropItem}
                    onDragItem={handleDragItem}
                    width={"w-full"}
                    height={"h-full"}
                >
                    <LayoutContainer
                        id={`grid-container-parent-${id}`}
                        direction={"col"}
                        width={"w-full"}
                        height={"h-full"}
                        scrollable={false}
                        className={`rounded overflow-x-clip border-2 rounded ${getContainerBorderColor(
                            item
                        )} ${getBorderStyle()} min-h-24 z-10`}
                        space={false}
                    >
                        <LayoutContainer
                            id={`grid-container-${id}`}
                            direction={direction}
                            scrollable={scrollable}
                            width={"w-full"}
                            height={`${height} min-h-24`}
                            space={false}
                            grow={grow}
                            className={`p-3 ${
                                direction === "row"
                                    ? "my-4 space-x-4"
                                    : "space-y-4"
                            } ${
                                item.hasChildren === true
                                    ? "justify-between"
                                    : ""
                            }`}
                        >
                            {children !== null && children}
                        </LayoutContainer>
                    </LayoutContainer>
                </DragComponent>
            </DropComponent>
        ) : useGridLayout ? (
            <div
                id={`grid-container-${id}`}
                className={`grid w-full ${
                    scrollable ? "" : height
                } min-h-24 p-3 ${item.grid.gap || "gap-2"}`}
                style={{
                    gridTemplateRows: scrollable
                        ? getRowTemplate(item.grid)
                        : `repeat(${item.grid.rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${item.grid.cols}, 1fr)`,
                    overflow: scrollable ? "auto" : "hidden",
                }}
            >
                {renderGridCells()}
            </div>
        ) : (
            renderComponentContainer(children)
        );
    }
);
