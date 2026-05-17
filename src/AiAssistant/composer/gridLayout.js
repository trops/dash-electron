/**
 * Composer grid layout — recursive grid-of-cells data model.
 *
 * Replaces the tree-of-children model (composerEmitter.js) with a
 * structure that lets the user build the spatial layout first, then
 * drop a component into each cell, then power it with wires. Cells
 * containing container components (Panel/Card/Container — anything
 * with a `children` prop in the schema) own their own inner grids,
 * so nesting works at arbitrary depth.
 *
 * Shape:
 *
 *   {
 *     widgetName: "...",
 *     rootGridId: "grid-root",
 *     grids: {
 *       "grid-root": { id, rows: [{ cells: [cellId, cellId] }, ...] },
 *       "grid-1":    { id, rows: [...] },                  // inside a container cell
 *     },
 *     cells: {
 *       "cell-1": { kind: "empty" },
 *       "cell-2": { kind: "leaf", type: "SearchInput", props: {}, wires: {} },
 *       "cell-3": { kind: "container", type: "Panel", props: {}, gridId: "grid-1" },
 *     },
 *   }
 *
 * The flat grids/cells maps let any consumer (UI, emitter, wire
 * source enumeration) look up by id in O(1) without walking. Recursion
 * lives only in the grid-row edges (grid.rows[].cells[] → cellId) and
 * in container cells (cell.gridId → another grid).
 *
 * Container vs leaf is derived from the SCHEMA, not stored on the
 * cell. If `schema.props.children` exists, the cell is a container
 * and owns an inner grid; otherwise it's a leaf. Single source of
 * truth — the schema already distinguishes these.
 *
 * Every mutator is pure: returns a NEW grid object with cloned paths
 * to whatever changed. Untouched grids/cells are reference-equal to
 * the input so React memoization keeps working.
 *
 * Wires/pipes/field-maps live on leaf cells and reference other
 * cells by id — identical to today's tree model. The hook scaffold
 * emitter walks Object.values(cells) instead of recursing the tree,
 * but the per-wire logic is unchanged.
 */

import { getComponentSchema } from "../dashReactComponentSchemas";

/**
 * Build a fresh grid containing a single empty row with one empty
 * cell. Use this as the initial state when the user opens the
 * composer for a new widget.
 */
export function makeEmptyGrid(widgetName = "ComposedWidget") {
    const rootGridId = "grid-root";
    const cellId = "cell-1";
    return {
        widgetName,
        rootGridId,
        grids: {
            [rootGridId]: {
                id: rootGridId,
                rows: [{ cells: [cellId] }],
            },
        },
        cells: {
            [cellId]: { id: cellId, kind: "empty" },
        },
        // Monotonic counters for id generation. Kept on the grid
        // object so we can persist + restore them with the rest of
        // the composition; otherwise the in-process counter would
        // reset on draft resume and risk id collisions.
        _nextGridId: 1,
        _nextCellId: 2,
    };
}

/**
 * Returns true if the given component name is a container (owns
 * an inner grid for its children). Derived from the schema's
 * `children` prop declaration.
 */
export function isContainer(componentName) {
    const schema = getComponentSchema(componentName);
    return Boolean(schema && schema.props && schema.props.children);
}

function nextCellId(grid) {
    const n = grid._nextCellId || 1;
    return { id: `cell-${n}`, next: n + 1 };
}

/**
 * Append a row to the named grid. The new row contains a single
 * empty cell so the user has somewhere to drop a component
 * without an extra split-cell step.
 */
export function addRow(grid, gridId) {
    if (!grid || !grid.grids[gridId]) return grid;
    const cellAlloc = nextCellId(grid);
    const newCellId = cellAlloc.id;
    const targetGrid = grid.grids[gridId];
    return {
        ...grid,
        grids: {
            ...grid.grids,
            [gridId]: {
                ...targetGrid,
                rows: [...targetGrid.rows, { cells: [newCellId] }],
            },
        },
        cells: {
            ...grid.cells,
            [newCellId]: { id: newCellId, kind: "empty" },
        },
        _nextCellId: cellAlloc.next,
    };
}

/**
 * Remove the row at the given index from the named grid. Also
 * removes the cells the row referenced (and any inner grids they
 * owned, recursively). No-op when the row would leave the grid
 * empty — every grid needs at least one row for the editor's
 * "click an empty cell to add" affordance to be reachable.
 */
export function removeRow(grid, gridId, rowIdx) {
    if (!grid || !grid.grids[gridId]) return grid;
    const targetGrid = grid.grids[gridId];
    if (!targetGrid.rows[rowIdx]) return grid;
    if (targetGrid.rows.length <= 1) return grid;
    const removedCellIds = targetGrid.rows[rowIdx].cells;
    const nextRows = targetGrid.rows.filter((_, i) => i !== rowIdx);
    let nextGrids = {
        ...grid.grids,
        [gridId]: { ...targetGrid, rows: nextRows },
    };
    let nextCells = { ...grid.cells };
    for (const cellId of removedCellIds) {
        ({ grids: nextGrids, cells: nextCells } = removeCellAndDescendants(
            nextGrids,
            nextCells,
            cellId
        ));
    }
    return { ...grid, grids: nextGrids, cells: nextCells };
}

/**
 * Add a new empty cell as a sibling of the given cell in its row.
 * Use this for "split this row to add a column."
 */
export function splitCell(grid, cellId) {
    if (!grid || !grid.cells[cellId]) return grid;
    const location = findCellLocation(grid, cellId);
    if (!location) return grid;
    const { gridId, rowIdx, cellIdx } = location;
    const targetGrid = grid.grids[gridId];
    const targetRow = targetGrid.rows[rowIdx];
    const cellAlloc = nextCellId(grid);
    const newCellId = cellAlloc.id;
    const nextCells = [
        ...targetRow.cells.slice(0, cellIdx + 1),
        newCellId,
        ...targetRow.cells.slice(cellIdx + 1),
    ];
    const nextRows = targetGrid.rows.map((r, i) =>
        i === rowIdx ? { ...r, cells: nextCells } : r
    );
    return {
        ...grid,
        grids: {
            ...grid.grids,
            [gridId]: { ...targetGrid, rows: nextRows },
        },
        cells: {
            ...grid.cells,
            [newCellId]: { id: newCellId, kind: "empty" },
        },
        _nextCellId: cellAlloc.next,
    };
}

/**
 * Remove a cell entirely (and any inner grids it owned). The
 * row is left intact even if it has zero cells — the grid editor
 * can render an empty-row affordance. Caller may follow up with
 * removeRow if the row should disappear too.
 */
export function removeCell(grid, cellId) {
    if (!grid || !grid.cells[cellId]) return grid;
    const location = findCellLocation(grid, cellId);
    if (!location) return grid;
    const { gridId, rowIdx, cellIdx } = location;
    const targetGrid = grid.grids[gridId];
    const targetRow = targetGrid.rows[rowIdx];
    const nextRowCells = targetRow.cells.filter((_, i) => i !== cellIdx);
    const nextRows = targetGrid.rows.map((r, i) =>
        i === rowIdx ? { ...r, cells: nextRowCells } : r
    );
    let nextGrids = {
        ...grid.grids,
        [gridId]: { ...targetGrid, rows: nextRows },
    };
    let nextCells = { ...grid.cells };
    ({ grids: nextGrids, cells: nextCells } = removeCellAndDescendants(
        nextGrids,
        nextCells,
        cellId
    ));
    return { ...grid, grids: nextGrids, cells: nextCells };
}

/**
 * Drop a component into a cell. If the schema describes a
 * container (`children` prop present), automatically spawns an
 * inner grid with one empty cell so the user can start nesting
 * immediately. If the cell already held a container, its old
 * inner grid + descendants are removed.
 *
 * `props` is optional initial user-set prop values.
 */
export function setCellComponent(grid, cellId, componentName, props = {}) {
    if (!grid || !grid.cells[cellId]) return grid;
    const existing = grid.cells[cellId];
    let nextGrids = grid.grids;
    let nextCells = grid.cells;
    // Tear down any inner grid the cell used to own (covers
    // container→leaf swaps and container→container-of-different-type
    // swaps where we want a fresh inner grid).
    if (existing.kind === "container" && existing.gridId) {
        ({ grids: nextGrids, cells: nextCells } = removeGridAndDescendants(
            nextGrids,
            nextCells,
            existing.gridId
        ));
    }
    const container = isContainer(componentName);
    let _nextGridId = grid._nextGridId;
    let _nextCellId = grid._nextCellId;
    let nextCell;
    if (container) {
        const gridAlloc = {
            id: `grid-${_nextGridId || 1}`,
            next: (_nextGridId || 1) + 1,
        };
        _nextGridId = gridAlloc.next;
        const cellAlloc = {
            id: `cell-${_nextCellId || 1}`,
            next: (_nextCellId || 1) + 1,
        };
        _nextCellId = cellAlloc.next;
        nextGrids = {
            ...nextGrids,
            [gridAlloc.id]: {
                id: gridAlloc.id,
                rows: [{ cells: [cellAlloc.id] }],
            },
        };
        nextCells = {
            ...nextCells,
            [cellAlloc.id]: { id: cellAlloc.id, kind: "empty" },
        };
        nextCell = {
            id: cellId,
            kind: "container",
            type: componentName,
            props: { ...props },
            gridId: gridAlloc.id,
        };
    } else {
        nextCell = {
            id: cellId,
            kind: "leaf",
            type: componentName,
            props: { ...props },
            wires: {},
        };
    }
    return {
        ...grid,
        grids: nextGrids,
        cells: { ...nextCells, [cellId]: nextCell },
        _nextGridId,
        _nextCellId,
    };
}

/**
 * Swap a cell's component type while keeping its props/wires intact.
 * Use this for variant-style edits (Heading → Heading2 → Heading3).
 *
 * Pre-conditions enforced by the caller (PropertyInspector's variant
 * picker):
 *   - newType shares the same prop signature as the existing type
 *     (variants of dash-react components do). Otherwise existing
 *     props/wires may reference fields the new schema doesn't know
 *     about — they'd persist on the cell but render as ignored.
 *   - newType has the same container/leaf nature; we don't migrate
 *     container ↔ leaf shape here (leaves don't have a gridId).
 *
 * Returns the input grid unchanged for unknown cellId, missing
 * newType, container/leaf mismatch, or no-op (same type).
 */
export function setCellType(grid, cellId, newType) {
    if (!grid || !grid.cells[cellId]) return grid;
    if (typeof newType !== "string" || newType.length === 0) return grid;
    const cell = grid.cells[cellId];
    if (cell.kind === "empty") return grid;
    if (cell.type === newType) return grid;
    // Refuse to flip a leaf into a container or vice versa — those
    // have different cell shapes (container needs a gridId). The
    // variant-swap path doesn't go through here for those cases.
    const wasContainer = cell.kind === "container";
    const willBeContainer = isContainer(newType);
    if (wasContainer !== willBeContainer) return grid;
    return {
        ...grid,
        cells: {
            ...grid.cells,
            [cellId]: { ...cell, type: newType },
        },
    };
}

/**
 * Empty a cell (drop its component, drop any inner grid it owned).
 * The cell itself remains so its row position is preserved.
 */
export function clearCellComponent(grid, cellId) {
    if (!grid || !grid.cells[cellId]) return grid;
    const existing = grid.cells[cellId];
    if (existing.kind === "empty") return grid;
    let nextGrids = grid.grids;
    let nextCells = grid.cells;
    if (existing.kind === "container" && existing.gridId) {
        ({ grids: nextGrids, cells: nextCells } = removeGridAndDescendants(
            nextGrids,
            nextCells,
            existing.gridId
        ));
    }
    return {
        ...grid,
        grids: nextGrids,
        cells: { ...nextCells, [cellId]: { id: cellId, kind: "empty" } },
    };
}

/**
 * Move a cell to a new position. Supports same-grid reorder and
 * cross-grid moves (drag from root into a Panel's body, etc.).
 *
 * `target` shape:
 *   { gridId?, rowIdx, cellIdx?, newRow: boolean }
 *
 * - `gridId`         — destination grid id. Defaults to the source's
 *                      grid (same-grid reorder).
 * - `newRow: true`   → create a new row at `rowIdx` containing only
 *                      the moved cell.
 * - `newRow: false`  → splice the moved cell into the destination
 *                      row's `cells` at `cellIdx`.
 *
 * Source-row cleanup: if the source row becomes empty after removal,
 * it's dropped (cross-grid) or merged-out (same-grid). Source grid
 * keeps a placeholder empty row if it would otherwise have zero rows.
 *
 * Cycle prevention: a container cell can't be moved into one of its
 * own descendant grids — that would create an infinite render loop.
 * Caught silently (returns grid unchanged).
 *
 * Pure: returns a new grid; no mutation. Returns the input grid
 * unchanged on any invalid input (unknown cellId, missing target,
 * out-of-range indices, descendant cycle).
 */
export function moveCellWithinGrid(grid, cellId, target) {
    if (!grid || !grid.grids) return grid;
    const loc = findCellLocation(grid, cellId);
    if (!loc) return grid;
    if (!target || typeof target.rowIdx !== "number") return grid;
    const { gridId: srcGridId, rowIdx: srcRow, cellIdx: srcCell } = loc;
    const tgtGridId = target.gridId || srcGridId;
    if (!grid.grids[tgtGridId]) return grid;
    // Cycle prevention: dragging Panel-X into its own (or a deeper
    // descendant) inner grid would let the cell reference itself
    // through the gridId chain and recurse forever in the editor /
    // emitter.
    if (
        cellId &&
        grid.cells[cellId] &&
        grid.cells[cellId].kind === "container" &&
        isDescendantGridOfCell(grid, cellId, tgtGridId)
    ) {
        return grid;
    }
    const newRow = target.newRow === true;
    const sameGrid = srcGridId === tgtGridId;
    const srcGrid = grid.grids[srcGridId];
    // 1. Remove source cell from its source row.
    let srcRows = srcGrid.rows.map((r, i) => ({
        cells:
            i === srcRow
                ? r.cells.filter((_, idx) => idx !== srcCell)
                : [...r.cells],
    }));
    // 2. Target rows: alias to srcRows for same-grid, otherwise clone
    //    the destination grid's rows so they're independently mutable.
    let tgtRows = sameGrid
        ? srcRows
        : grid.grids[tgtGridId].rows.map((r) => ({ cells: [...r.cells] }));
    let targetRow = target.rowIdx;
    let targetCell = typeof target.cellIdx === "number" ? target.cellIdx : 0;
    // 3. Cleanup empty source row (same-grid only; cross-grid is
    //    handled after the insert because srcRows and tgtRows are
    //    distinct arrays in that branch).
    if (sameGrid) {
        const sourceRowNowEmpty = srcRows[srcRow].cells.length === 0;
        if (sourceRowNowEmpty && !(srcRow === targetRow && !newRow)) {
            srcRows = srcRows.filter((_, i) => i !== srcRow);
            tgtRows = srcRows;
            if (srcRow < targetRow) targetRow -= 1;
        }
    }
    // 4. Same-row reorder shift: removing source ahead of target
    //    shifts the target index left by one. Applies only for
    //    same-grid + same-row + splice-into-existing-row.
    if (sameGrid && !newRow && srcRow === targetRow && targetCell > srcCell) {
        targetCell -= 1;
    }
    // 5. Apply the insert.
    if (newRow) {
        if (targetRow < 0 || targetRow > tgtRows.length) return grid;
        tgtRows.splice(targetRow, 0, { cells: [cellId] });
    } else {
        if (targetRow < 0 || targetRow >= tgtRows.length) return grid;
        if (targetCell < 0 || targetCell > tgtRows[targetRow].cells.length) {
            return grid;
        }
        tgtRows[targetRow].cells.splice(targetCell, 0, cellId);
    }
    // 6. Cross-grid: drop empty source rows; if source grid would
    //    end up with zero rows, seed a placeholder empty cell so the
    //    "+ Add component" / "+ Row" affordances stay reachable.
    if (!sameGrid) {
        srcRows = srcRows.filter((r) => r.cells.length > 0);
        if (srcRows.length === 0) {
            const ph = nextCellId(grid);
            return {
                ...grid,
                grids: {
                    ...grid.grids,
                    [srcGridId]: { ...srcGrid, rows: [{ cells: [ph.id] }] },
                    [tgtGridId]: { ...grid.grids[tgtGridId], rows: tgtRows },
                },
                cells: {
                    ...grid.cells,
                    [ph.id]: { id: ph.id, kind: "empty" },
                },
                _nextCellId: ph.next,
            };
        }
    }
    if (tgtRows.length === 0) return grid;
    if (sameGrid) {
        return {
            ...grid,
            grids: {
                ...grid.grids,
                [srcGridId]: { ...srcGrid, rows: tgtRows },
            },
        };
    }
    return {
        ...grid,
        grids: {
            ...grid.grids,
            [srcGridId]: { ...srcGrid, rows: srcRows },
            [tgtGridId]: { ...grid.grids[tgtGridId], rows: tgtRows },
        },
    };
}

/**
 * Walk down from `cellId` (which must be a container) and return
 * true if `targetGridId` is reachable. Used to reject moves that
 * would create an inner-grid cycle (drag a Panel into its own body).
 */
function isDescendantGridOfCell(grid, cellId, targetGridId) {
    const cell = grid.cells[cellId];
    if (!cell || cell.kind !== "container" || !cell.gridId) return false;
    const visited = new Set();
    const stack = [cell.gridId];
    while (stack.length > 0) {
        const gid = stack.pop();
        if (!gid || visited.has(gid)) continue;
        visited.add(gid);
        if (gid === targetGridId) return true;
        const g = grid.grids[gid];
        if (!g) continue;
        for (const row of g.rows) {
            for (const cId of row.cells) {
                const c = grid.cells[cId];
                if (c && c.kind === "container" && c.gridId) {
                    stack.push(c.gridId);
                }
            }
        }
    }
    return false;
}

/**
 * Locate a cell within the grid map. Returns
 *   { gridId, rowIdx, cellIdx } or null if the cell isn't placed
 * anywhere (orphaned cells shouldn't exist in well-formed state,
 * but the lookup is defensive).
 */
export function findCellLocation(grid, cellId) {
    if (!grid || !grid.grids) return null;
    for (const gid of Object.keys(grid.grids)) {
        const g = grid.grids[gid];
        for (let r = 0; r < g.rows.length; r++) {
            const cells = g.rows[r].cells;
            const idx = cells.indexOf(cellId);
            if (idx !== -1) {
                return { gridId: gid, rowIdx: r, cellIdx: idx };
            }
        }
    }
    return null;
}

/**
 * Walk every leaf cell in the composition and call `visit(cell)`.
 * Order is grid-walk (root grid first, depth-first into containers).
 * Used by the hook scaffold emitter to enumerate wires.
 */
export function walkLeafCells(grid, visit) {
    if (!grid || !grid.grids || !grid.rootGridId) return;
    const visited = new Set();
    const walkGrid = (gridId) => {
        if (visited.has(gridId)) return;
        visited.add(gridId);
        const g = grid.grids[gridId];
        if (!g) return;
        for (const row of g.rows) {
            for (const cellId of row.cells) {
                const cell = grid.cells[cellId];
                if (!cell) continue;
                if (cell.kind === "leaf") visit(cell);
                if (cell.kind === "container" && cell.gridId) {
                    walkGrid(cell.gridId);
                }
            }
        }
    };
    walkGrid(grid.rootGridId);
}

// ── Internal: cascade deletes ────────────────────────────────────

function removeCellAndDescendants(grids, cells, cellId) {
    const cell = cells[cellId];
    if (!cell) return { grids, cells };
    let nextCells = { ...cells };
    delete nextCells[cellId];
    let nextGrids = grids;
    if (cell.kind === "container" && cell.gridId) {
        const updated = removeGridAndDescendants(
            nextGrids,
            nextCells,
            cell.gridId
        );
        nextGrids = updated.grids;
        nextCells = updated.cells;
    }
    return { grids: nextGrids, cells: nextCells };
}

function removeGridAndDescendants(grids, cells, gridId) {
    const g = grids[gridId];
    if (!g) return { grids, cells };
    let nextGrids = { ...grids };
    delete nextGrids[gridId];
    let nextCells = cells;
    for (const row of g.rows) {
        for (const cellId of row.cells) {
            const cell = nextCells[cellId];
            if (!cell) continue;
            // Inline the descendant deletion to keep the helper pair
            // free of mutual recursion via a captured variable.
            const updated = removeCellAndDescendants(
                nextGrids,
                nextCells,
                cellId
            );
            nextGrids = updated.grids;
            nextCells = updated.cells;
        }
    }
    return { grids: nextGrids, cells: nextCells };
}
