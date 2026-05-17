/**
 * Unit tests for gridLayout.js — recursive grid composition data
 * layer. Pure functions, no React, no DOM.
 */

import {
    makeEmptyGrid,
    isContainer,
    addRow,
    removeRow,
    splitCell,
    removeCell,
    setCellComponent,
    clearCellComponent,
    findCellLocation,
    walkLeafCells,
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
    test("Panel/Card/Container are containers", () => {
        expect(isContainer("Panel")).toBe(true);
        expect(isContainer("Card")).toBe(true);
        expect(isContainer("Container")).toBe(true);
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
