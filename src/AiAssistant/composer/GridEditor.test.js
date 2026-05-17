/**
 * @jest-environment jsdom
 *
 * GridEditor drag-and-drop integration tests.
 *
 * jsdom doesn't ship a working HTML5 DataTransfer, so we hand-roll a
 * minimal stub on each synthetic event. The real drag/drop pipeline
 * has bitten us repeatedly with subtle issues (event bubbling moving
 * cells then bouncing them back; dragInfo state stale on first
 * dragover; pointer-events on the indicator div eating the drop) —
 * keep these tests close to the actual event sequence the browser
 * fires so regressions surface here before reaching the UI.
 */

import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { GridEditor } from "./GridEditor";
import {
    makeEmptyGrid,
    addRow,
    setCellComponent,
    splitCell,
} from "./gridLayout";

function makeDataTransfer() {
    // Backing store shared between setData and getData calls so the
    // drop handler can read what dragstart wrote.
    const store = {};
    const types = [];
    return {
        setData: (type, value) => {
            store[type] = String(value);
            if (!types.includes(type)) types.push(type);
        },
        getData: (type) => store[type] || "",
        get types() {
            return types;
        },
        effectAllowed: "all",
        dropEffect: "none",
    };
}

function fireDragSequence(sourceEl, targetEl, edge /* "top" | "bottom" */) {
    const dt = makeDataTransfer();
    // 1. dragstart on source
    fireEvent.dragStart(sourceEl, { dataTransfer: dt });
    // 2. dragover on target — compute clientY based on the requested
    //    edge using a stubbed bounding-rect so closestEdge picks the
    //    intended half. jsdom returns zeros for getBoundingClientRect
    //    so we patch it on the element under test.
    const targetRect = {
        top: 100,
        bottom: 200,
        left: 0,
        right: 100,
        width: 100,
        height: 100,
    };
    targetEl.getBoundingClientRect = () => targetRect;
    const clientY = edge === "top" ? 110 : 190;
    const clientX = 50;
    fireEvent.dragOver(targetEl, {
        dataTransfer: dt,
        clientX,
        clientY,
    });
    // 3. drop on target
    fireEvent.drop(targetEl, {
        dataTransfer: dt,
        clientX,
        clientY,
    });
    // 4. dragend on source
    fireEvent.dragEnd(sourceEl, { dataTransfer: dt });
}

function setup(grid, onMoveCell = jest.fn()) {
    const props = {
        grid,
        selectedCellId: null,
        onSelectCell: jest.fn(),
        onAddRow: jest.fn(),
        onRemoveRow: jest.fn(),
        onSplitCell: jest.fn(),
        onRemoveCell: jest.fn(),
        onRequestPalette: jest.fn(),
        onMoveCell,
    };
    return { ...render(<GridEditor {...props} />), onMoveCell };
}

describe("GridEditor drag/drop", () => {
    test("dragging a leaf cell below a sibling in the SAME grid calls onMoveCell with the correct target", () => {
        // Two top-level cells stacked vertically (root grid two rows).
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const a = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, a, "Heading", { title: "A" });
        g = addRow(g, root);
        const b = g.grids[root].rows[1].cells[0];
        g = setCellComponent(g, b, "SearchInput");

        const { onMoveCell } = setup(g);
        const source = screen.getByTestId(`composer-cell-${a}`);
        const target = screen.getByTestId(`composer-cell-${b}`);

        fireDragSequence(source, target, "bottom");

        // Expected: target is row 1 in the root grid, "bottom" maps to
        // rowIdx: 2, newRow: true, gridId: root.
        expect(onMoveCell).toHaveBeenCalledTimes(1);
        expect(onMoveCell).toHaveBeenCalledWith(a, {
            gridId: root,
            rowIdx: 2,
            newRow: true,
        });
    });

    test("dragging within a NESTED container (Heading inside Panel below Card) — drop fires once, no bounce to the Panel wrapper", () => {
        // This is the exact scenario the user reported never working:
        //   Panel { Heading, Card2 }
        // Drag Heading below Card2 → expects ONE move call targeting
        // the Panel's inner grid. Without stopPropagation the drop
        // also fires on the Panel wrapper, which would re-issue a
        // root-grid move and bounce the cell out.
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const panelCell = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, panelCell, "Panel");
        const panelGrid = g.cells[panelCell].gridId;
        const headingCell = g.grids[panelGrid].rows[0].cells[0];
        g = setCellComponent(g, headingCell, "Heading", { title: "H" });
        g = addRow(g, panelGrid);
        const cardCell = g.grids[panelGrid].rows[1].cells[0];
        g = setCellComponent(g, cardCell, "Card2");

        const { onMoveCell } = setup(g);
        const source = screen.getByTestId(`composer-cell-${headingCell}`);
        const target = screen.getByTestId(`composer-cell-${cardCell}`);

        fireDragSequence(source, target, "bottom");

        expect(onMoveCell).toHaveBeenCalledTimes(1);
        expect(onMoveCell).toHaveBeenCalledWith(headingCell, {
            gridId: panelGrid,
            rowIdx: 2,
            newRow: true,
        });
    });

    test("dropping a cell on itself does NOT call onMoveCell", () => {
        let g = makeEmptyGrid();
        const root = g.rootGridId;
        const a = g.grids[root].rows[0].cells[0];
        g = setCellComponent(g, a, "Heading");

        const { onMoveCell } = setup(g);
        const cell = screen.getByTestId(`composer-cell-${a}`);

        fireDragSequence(cell, cell, "bottom");

        expect(onMoveCell).not.toHaveBeenCalled();
    });
});
