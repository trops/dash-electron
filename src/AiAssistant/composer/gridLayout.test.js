/**
 * Unit tests for gridLayout.js — recursive grid composition data
 * layer. Pure functions, no React, no DOM.
 */

import {
    makeEmptyGrid,
    isContainer,
    isGridEmpty,
    addRow,
    removeRow,
    splitCell,
    removeCell,
    setCellComponent,
    setCellType,
    clearCellComponent,
    findCellLocation,
    walkLeafCells,
    moveCellWithinGrid,
} from "./gridLayout";

describe("makeEmptyGrid", () => {
    test("seeds a 1x1 root grid with one empty cell", () => {
        const g = makeEmptyGrid();
        expect(g.widgetName).toBe("ComposedWidget");
        expect(g.rootGridId).toBe("grid-root");
        const root = g.grids[g.rootGridId];
        expect(root.rows.length).toBe(1);
        expect(root.rows[0].cells.length).toBe(1);
        const cellId = root.rows[0].cells[0];
        expect(g.cells[cellId].kind).toBe("empty");
    });

    test("honors a custom widget name", () => {
        const g = makeEmptyGrid("MyDashboard");
        expect(g.widgetName).toBe("MyDashboard");
    });
});

describe("isContainer", () => {
    test("Panel and Card are containers", () => {
        expect(isContainer("Panel")).toBe(true);
        expect(isContainer("Card")).toBe(true);
    });
    test("Heading/SearchInput/DataList are leaves", () => {
        expect(isContainer("Heading")).toBe(false);
        expect(isContainer("SearchInput")).toBe(false);
        expect(isContainer("DataList")).toBe(false);
    });
    test("unknown components are not containers", () => {
        expect(isContainer("NotAComponent")).toBe(false);
    });
});

describe("addRow / removeRow", () => {
    test("addRow appends a row containing one empty cell", () => {
        const g0 = makeEmptyGrid();
        const g1 = addRow(g0, g0.rootGridId);
        const root = g1.grids[g1.rootGridId];
        expect(root.rows.length).toBe(2);
        const newCellId = root.rows[1].cells[0];
        expect(g1.cells[newCellId].kind).toBe("empty");
    });

    test("addRow is a no-op for an unknown grid", () => {
        const g0 = makeEmptyGrid();
        const g1 = addRow(g0, "grid-not-real");
        expect(g1).toBe(g0);
    });

    test("removeRow drops the row and its cells", () => {
        const g0 = makeEmptyGrid();
        const g1 = addRow(g0, g0.rootGridId);
        const newCellId = g1.grids[g1.rootGridId].rows[1].cells[0];
        const g2 = removeRow(g1, g1.rootGridId, 1);
        expect(g2.grids[g2.rootGridId].rows.length).toBe(1);
        expect(g2.cells[newCellId]).toBeUndefined();
    });

    test("removeRow refuses to leave a grid with zero rows", () => {
        const g0 = makeEmptyGrid();
        const g1 = removeRow(g0, g0.rootGridId, 0);
        expect(g1).toBe(g0);
    });

    test("removeRow cascades into container cells' inner grids", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const innerGridId = g1.cells[cellId].gridId;
        expect(g1.grids[innerGridId]).toBeDefined();
        const g2 = addRow(g1, g1.rootGridId);
        const g3 = removeRow(g2, g2.rootGridId, 0);
        // The Panel cell + its inner grid + its inner cells are gone.
        expect(g3.cells[cellId]).toBeUndefined();
        expect(g3.grids[innerGridId]).toBeUndefined();
    });
});

describe("splitCell", () => {
    test("inserts an empty sibling cell after the target", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = splitCell(g0, cellId);
        const row = g1.grids[g1.rootGridId].rows[0];
        expect(row.cells.length).toBe(2);
        expect(row.cells[0]).toBe(cellId);
        expect(g1.cells[row.cells[1]].kind).toBe("empty");
    });

    test("is a no-op for an unknown cell", () => {
        const g0 = makeEmptyGrid();
        const g1 = splitCell(g0, "cell-not-real");
        expect(g1).toBe(g0);
    });
});

describe("removeCell", () => {
    test("drops a cell and its inner grid (container)", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const innerGridId = g1.cells[cellId].gridId;
        const g2 = removeCell(g1, cellId);
        expect(g2.cells[cellId]).toBeUndefined();
        expect(g2.grids[innerGridId]).toBeUndefined();
        // Row remains, now empty of cells.
        expect(g2.grids[g2.rootGridId].rows[0].cells.length).toBe(0);
    });

    test("drops a leaf cell without affecting siblings", () => {
        const g0 = makeEmptyGrid();
        const g1 = splitCell(g0, g0.grids[g0.rootGridId].rows[0].cells[0]);
        const [a, b] = g1.grids[g1.rootGridId].rows[0].cells;
        const g2 = setCellComponent(g1, a, "Heading");
        const g3 = removeCell(g2, a);
        expect(g3.cells[a]).toBeUndefined();
        expect(g3.cells[b]).toBeDefined();
    });
});

describe("setCellComponent", () => {
    test("sets a leaf component", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading", { title: "Hi" });
        expect(g1.cells[cellId]).toMatchObject({
            kind: "leaf",
            type: "Heading",
            props: { title: "Hi" },
        });
    });

    test("sets a container component and spawns an inner grid", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const cell = g1.cells[cellId];
        expect(cell.kind).toBe("container");
        expect(cell.type).toBe("Panel");
        expect(cell.gridId).toBeDefined();
        const inner = g1.grids[cell.gridId];
        expect(inner.rows.length).toBe(1);
        expect(inner.rows[0].cells.length).toBe(1);
    });

    test("swapping a container for a leaf tears down the old inner grid", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const innerGridId = g1.cells[cellId].gridId;
        const g2 = setCellComponent(g1, cellId, "Heading");
        expect(g2.cells[cellId].kind).toBe("leaf");
        expect(g2.grids[innerGridId]).toBeUndefined();
    });

    test("ignores unknown cell ids", () => {
        const g0 = makeEmptyGrid();
        const g1 = setCellComponent(g0, "cell-not-real", "Heading");
        expect(g1).toBe(g0);
    });
});

describe("clearCellComponent", () => {
    test("resets a leaf cell to empty", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading");
        const g2 = clearCellComponent(g1, cellId);
        expect(g2.cells[cellId].kind).toBe("empty");
    });

    test("resets a container cell and tears down its inner grid", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const innerGridId = g1.cells[cellId].gridId;
        const g2 = clearCellComponent(g1, cellId);
        expect(g2.cells[cellId].kind).toBe("empty");
        expect(g2.grids[innerGridId]).toBeUndefined();
    });

    test("already-empty is a no-op", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = clearCellComponent(g0, cellId);
        expect(g1).toBe(g0);
    });
});

describe("findCellLocation", () => {
    test("locates a cell in the root grid", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const loc = findCellLocation(g0, cellId);
        expect(loc).toEqual({
            gridId: g0.rootGridId,
            rowIdx: 0,
            cellIdx: 0,
        });
    });

    test("locates a cell nested inside a container's inner grid", () => {
        const g0 = makeEmptyGrid();
        const outerCellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, outerCellId, "Panel");
        const innerGridId = g1.cells[outerCellId].gridId;
        const innerCellId = g1.grids[innerGridId].rows[0].cells[0];
        const loc = findCellLocation(g1, innerCellId);
        expect(loc).toEqual({
            gridId: innerGridId,
            rowIdx: 0,
            cellIdx: 0,
        });
    });

    test("returns null for an unknown id", () => {
        const g0 = makeEmptyGrid();
        expect(findCellLocation(g0, "cell-not-real")).toBeNull();
    });
});

describe("walkLeafCells", () => {
    test("visits every leaf in depth-first order", () => {
        const g0 = makeEmptyGrid();
        const outerCellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        // outer Panel containing a Heading
        const g1 = setCellComponent(g0, outerCellId, "Panel");
        const innerGridId = g1.cells[outerCellId].gridId;
        const innerCellId = g1.grids[innerGridId].rows[0].cells[0];
        const g2 = setCellComponent(g1, innerCellId, "Heading", {
            title: "Hi",
        });
        // root sibling cell with a SearchInput
        const g3 = addRow(g2, g2.rootGridId);
        const siblingCellId = g3.grids[g3.rootGridId].rows[1].cells[0];
        const g4 = setCellComponent(g3, siblingCellId, "SearchInput");

        const types = [];
        walkLeafCells(g4, (cell) => types.push(cell.type));
        expect(types).toEqual(["Heading", "SearchInput"]);
    });

    test("skips empty and container cells", () => {
        const g0 = makeEmptyGrid();
        // root has one empty cell — nothing to visit.
        const collected = [];
        walkLeafCells(g0, (c) => collected.push(c));
        expect(collected.length).toBe(0);
    });
});

describe("pure / non-mutating", () => {
    test("addRow does not mutate inputs", () => {
        const g0 = makeEmptyGrid();
        const before = JSON.stringify(g0);
        addRow(g0, g0.rootGridId);
        expect(JSON.stringify(g0)).toBe(before);
    });

    test("setCellComponent does not mutate inputs", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const before = JSON.stringify(g0);
        setCellComponent(g0, cellId, "Heading");
        expect(JSON.stringify(g0)).toBe(before);
    });
});

describe("moveCellWithinGrid", () => {
    // Two-row grid with one cell each: row0=Heading, row1=SearchInput.
    // The user-described scenario for drag/drop reordering.
    function makeTwoRowGrid() {
        let g = makeEmptyGrid();
        const rootId = g.rootGridId;
        const cell0 = g.grids[rootId].rows[0].cells[0];
        g = setCellComponent(g, cell0, "Heading", { title: "Top" });
        g = addRow(g, rootId);
        const cell1 = g.grids[rootId].rows[1].cells[0];
        g = setCellComponent(g, cell1, "SearchInput");
        return { g, cell0, cell1 };
    }

    test("dropping row 1's cell above row 0 swaps the rows (newRow:true)", () => {
        const { g, cell0, cell1 } = makeTwoRowGrid();
        const next = moveCellWithinGrid(g, cell1, {
            rowIdx: 0,
            newRow: true,
        });
        const rows = next.grids[next.rootGridId].rows;
        expect(rows.length).toBe(2);
        expect(rows[0].cells).toEqual([cell1]);
        expect(rows[1].cells).toEqual([cell0]);
    });

    test("dropping row 0's cell below row 1 (newRow:true at idx=2) puts row 0 underneath", () => {
        const { g, cell0, cell1 } = makeTwoRowGrid();
        // GridEditor maps "drop on bottom edge of row 1" to
        // rowIdx: tgtLoc.rowIdx + 1 (= 2). The handler trusts the
        // mutator to drop the now-empty source row and re-index.
        const next = moveCellWithinGrid(g, cell0, {
            rowIdx: 2,
            newRow: true,
        });
        const rows = next.grids[next.rootGridId].rows;
        expect(rows.length).toBe(2);
        expect(rows[0].cells).toEqual([cell1]);
        expect(rows[1].cells).toEqual([cell0]);
    });

    test("dropping a cell into another row's columns (newRow:false) merges rows", () => {
        // Two single-cell rows → drag row1's cell into row0's left,
        // leaving row0 with [SearchInput, Heading] and row1 dropped
        // (became empty).
        const { g, cell0, cell1 } = makeTwoRowGrid();
        const next = moveCellWithinGrid(g, cell1, {
            rowIdx: 0,
            cellIdx: 0,
            newRow: false,
        });
        const rows = next.grids[next.rootGridId].rows;
        expect(rows.length).toBe(1);
        expect(rows[0].cells).toEqual([cell1, cell0]);
    });

    test("same-row reorder (newRow:false) accounts for source-removal shift", () => {
        // Two cells in one row: [A, B]. Drag A to the right of B
        // (rowIdx=0, cellIdx=2) → result [B, A].
        let g = makeEmptyGrid();
        const rootId = g.rootGridId;
        const a = g.grids[rootId].rows[0].cells[0];
        g = setCellComponent(g, a, "Heading");
        g = splitCell(g, a);
        const row = g.grids[rootId].rows[0].cells;
        const b = row.find((c) => c !== a);
        g = setCellComponent(g, b, "SearchInput");
        const next = moveCellWithinGrid(g, a, {
            rowIdx: 0,
            cellIdx: 2,
            newRow: false,
        });
        expect(next.grids[next.rootGridId].rows[0].cells).toEqual([b, a]);
    });

    test("dropping a cell onto its own current position is a no-op", () => {
        const { g, cell0 } = makeTwoRowGrid();
        // Drag row 0's cell to position 0 of row 0 — same place.
        const next = moveCellWithinGrid(g, cell0, {
            rowIdx: 0,
            cellIdx: 0,
            newRow: false,
        });
        expect(next.grids[next.rootGridId].rows[0].cells).toEqual([cell0]);
    });

    test("returns input unchanged for unknown cellId or invalid target", () => {
        const { g } = makeTwoRowGrid();
        expect(moveCellWithinGrid(g, "no-such-cell", { rowIdx: 0 })).toBe(g);
        expect(moveCellWithinGrid(g, "cell-1", { rowIdx: 99 })).toBe(g);
        expect(moveCellWithinGrid(g, "cell-1", null)).toBe(g);
    });

    test("is non-mutating", () => {
        const { g, cell1 } = makeTwoRowGrid();
        const before = JSON.stringify(g);
        moveCellWithinGrid(g, cell1, { rowIdx: 0, newRow: true });
        expect(JSON.stringify(g)).toBe(before);
    });

    test("cross-grid move: drag root cell into a Panel's inner grid", () => {
        // Layout: grid-root = [Heading, Panel{grid-1: [SearchInput]}]
        // Drag Heading into the Panel above SearchInput → grid-root
        // becomes just [Panel], and grid-1 becomes [Heading,
        // SearchInput].
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const c0 = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, c0, "Heading", { title: "Top" });
        g = addRow(g, root);
        const c1 = g.grids[root].rows[1].cells[0];
        g = setCellComponent(g, c1, "Panel");
        const panelGrid = g.cells[c1].gridId;
        const c2 = g.grids[panelGrid].rows[0].cells[0];
        g = setCellComponent(g, c2, "SearchInput");

        const next = moveCellWithinGrid(g, c0, {
            gridId: panelGrid,
            rowIdx: 0,
            newRow: true,
        });
        // Heading is now inside the Panel.
        expect(next.grids[panelGrid].rows.length).toBe(2);
        expect(next.grids[panelGrid].rows[0].cells).toEqual([c0]);
        expect(next.grids[panelGrid].rows[1].cells).toEqual([c2]);
        // Root grid now only holds the Panel (source row was dropped
        // and the residual empty was seeded only if everything left).
        const rootRows = next.grids[root].rows;
        // Heading's old row is gone; Panel's row remains.
        const remainingTopLevelCells = rootRows.flatMap((r) => r.cells);
        expect(remainingTopLevelCells).toEqual([c1]);
    });

    test("cross-grid: emptying the source grid leaves a placeholder empty row", () => {
        // Drag the only top-level cell into a nested Panel, leaving
        // grid-root with zero non-empty rows → mutator seeds a fresh
        // empty cell so the user can still add stuff at the root.
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const c0 = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, c0, "Heading");
        // Add a Panel via splitting then setting (so grid-root has
        // [Heading, Panel{empty}]).
        g = splitCell(g, c0);
        const c1 = g.grids[root].rows[0].cells.find((c) => c !== c0);
        g = setCellComponent(g, c1, "Panel");
        const panelGrid = g.cells[c1].gridId;
        // Move the Heading INTO the Panel — root row becomes [Panel]
        // only (still non-empty), no placeholder needed.
        let next = moveCellWithinGrid(g, c0, {
            gridId: panelGrid,
            rowIdx: 0,
            newRow: true,
        });
        expect(next.grids[root].rows[0].cells).toEqual([c1]);
        // Now drag the Panel itself into… wait, can't put it inside
        // itself (cycle). Instead drag it into another nested
        // container in a clean fixture. Simpler: just verify the
        // placeholder-seed code path with a single-cell root grid.
        let g2 = makeEmptyGrid();
        const r2 = g2.rootGridId;
        const a = g2.grids[r2].rows[0].cells[0];
        g2 = setCellComponent(g2, a, "Card");
        const cardGrid = g2.cells[a].gridId;
        const b = g2.grids[cardGrid].rows[0].cells[0];
        // Drag the empty cell inside the Card to nowhere useful —
        // but to force the source-empty path we need a leaf in root
        // moving out. Add a sibling leaf to the Card's grid, then
        // move the Card OUT… ah, Card is the only root cell. Move
        // empty cell `b` into root grid: source grid (cardGrid)
        // becomes empty → placeholder seeded.
        const next2 = moveCellWithinGrid(g2, b, {
            gridId: r2,
            rowIdx: 1,
            newRow: true,
        });
        // Card grid (source) should have a fresh placeholder row.
        const cardRows = next2.grids[cardGrid].rows;
        expect(cardRows.length).toBe(1);
        expect(cardRows[0].cells.length).toBe(1);
        const placeholderId = cardRows[0].cells[0];
        expect(next2.cells[placeholderId].kind).toBe("empty");
    });

    test("cycle prevention: dragging a Panel into its own inner grid is a no-op", () => {
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const c0 = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, c0, "Panel");
        const panelGrid = g.cells[c0].gridId;
        // Try to move the Panel INTO its own body.
        const next = moveCellWithinGrid(g, c0, {
            gridId: panelGrid,
            rowIdx: 0,
            newRow: true,
        });
        // Unchanged: same grid reference.
        expect(next).toBe(g);
    });
});

describe("isGridEmpty", () => {
    test("true for a freshly-made grid (one empty cell)", () => {
        expect(isGridEmpty(makeEmptyGrid())).toBe(true);
    });

    test("true even after adding empty rows that the user hasn't filled", () => {
        let g = makeEmptyGrid();
        g = addRow(g, g.rootGridId);
        g = addRow(g, g.rootGridId);
        expect(isGridEmpty(g)).toBe(true);
    });

    test("false after placing any component in a cell", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Heading", { title: "Hi" });
        expect(isGridEmpty(g)).toBe(false);
    });

    test("false after placing a container (creates a nested grid)", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Panel");
        expect(isGridEmpty(g)).toBe(false);
    });

    test("false for malformed input (null/missing fields)", () => {
        expect(isGridEmpty(null)).toBe(false);
        expect(isGridEmpty({})).toBe(false);
        expect(isGridEmpty({ rootGridId: "x", grids: {} })).toBe(false);
    });
});

describe("setCellType", () => {
    test("swaps a leaf's component type while preserving props and wires", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Heading", { title: "Hello" });
        // Attach a wire on the leaf so we can verify it carries over.
        g = {
            ...g,
            cells: {
                ...g.cells,
                [cellId]: {
                    ...g.cells[cellId],
                    wires: { title: { provider: null, method: null } },
                },
            },
        };
        const next = setCellType(g, cellId, "Heading2");
        expect(next.cells[cellId].type).toBe("Heading2");
        expect(next.cells[cellId].props).toEqual({ title: "Hello" });
        expect(next.cells[cellId].wires).toEqual({
            title: { provider: null, method: null },
        });
    });

    test("swaps a container's variant while preserving its inner grid id", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Panel");
        const innerGrid = g.cells[cellId].gridId;
        const next = setCellType(g, cellId, "Panel2");
        expect(next.cells[cellId].type).toBe("Panel2");
        expect(next.cells[cellId].gridId).toBe(innerGrid);
    });

    test("refuses to swap container ↔ leaf (would orphan the inner grid)", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Panel");
        // Heading is a leaf — refuse.
        expect(setCellType(g, cellId, "Heading")).toBe(g);
    });

    test("no-ops on unknown cellId, missing newType, or same type", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Heading");
        expect(setCellType(g, "no-such-cell", "Heading2")).toBe(g);
        expect(setCellType(g, cellId, "")).toBe(g);
        expect(setCellType(g, cellId, "Heading")).toBe(g);
    });

    test("is non-mutating", () => {
        let g = makeEmptyGrid();
        const cellId = g.grids[g.rootGridId].rows[0].cells[0];
        g = setCellComponent(g, cellId, "Heading", { title: "x" });
        const before = JSON.stringify(g);
        setCellType(g, cellId, "Heading2");
        expect(JSON.stringify(g)).toBe(before);
    });
});
