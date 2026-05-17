/**
 * @jest-environment jsdom
 *
 * QuickStartPane — renders three onramps (AI form, sample-layouts
 * gallery, "start from scratch") for the empty composer. We test:
 *   - structural rendering (both halves + escape hatch)
 *   - clicking a sample card fires onApplyGrid with the template grid
 *   - the escape hatch routes through onRequestPalette with the
 *     supplied seed cell id
 *   - the tree → grid converter produces a non-empty grid
 */

import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuickStartPane, treeToGrid } from "./QuickStartPane";
import { SAMPLE_LAYOUTS } from "./composerSampleLayouts";
import { isGridEmpty } from "./gridLayout";

describe("QuickStartPane — rendering", () => {
    test("renders the AI opener, sample gallery, and start-from-scratch escape hatch", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        expect(screen.getByTestId("composer-quick-start")).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-quick-start-ai-open")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-quick-start-samples")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-quick-start-scratch")
        ).toBeInTheDocument();
    });

    test("renders one card per sample layout", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        for (const layout of SAMPLE_LAYOUTS) {
            expect(
                screen.getByTestId(`composer-quick-start-sample-${layout.id}`)
            ).toBeInTheDocument();
        }
    });
});

describe("QuickStartPane — actions", () => {
    test("clicking a sample card fires onApplyGrid with that sample's grid", () => {
        const onApplyGrid = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={onApplyGrid}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        const sample = SAMPLE_LAYOUTS[0];
        fireEvent.click(
            screen.getByTestId(`composer-quick-start-sample-${sample.id}`)
        );
        expect(onApplyGrid).toHaveBeenCalledTimes(1);
        const arg = onApplyGrid.mock.calls[0][0];
        expect(isGridEmpty(arg)).toBe(false);
    });

    test("clicking 'start from scratch' opens the palette on the seed cell", () => {
        const onRequestPalette = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={onRequestPalette}
                seedCellId="cell-99"
            />
        );
        fireEvent.click(screen.getByTestId("composer-quick-start-scratch"));
        expect(onRequestPalette).toHaveBeenCalledWith("cell-99");
    });

    test("scratch button is disabled when no seed cell is available (safety)", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId={null}
            />
        );
        expect(
            screen.getByTestId("composer-quick-start-scratch")
        ).toBeDisabled();
    });

    test("opening the AI form reveals the textarea and submit button", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(screen.getByTestId("composer-quick-start-ai-open"));
        expect(
            screen.getByTestId("composer-quick-start-ai-input")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-quick-start-ai-submit")
        ).toBeDisabled();
    });
});

describe("treeToGrid", () => {
    test("converts a Panel-with-children tree into a non-empty grid", () => {
        const tree = {
            widgetName: "MyWidget",
            root: {
                type: "Panel",
                props: {},
                children: [
                    { type: "Heading", props: { title: "Hi" }, children: [] },
                    { type: "DataList", props: {}, children: [] },
                ],
            },
        };
        const g = treeToGrid(tree);
        expect(g.widgetName).toBe("MyWidget");
        expect(isGridEmpty(g)).toBe(false);
        // Each child of the root Panel landed in its own row.
        const panelCellId = g.grids[g.rootGridId].rows[0].cells[0];
        const panelGridId = g.cells[panelCellId].gridId;
        expect(g.grids[panelGridId].rows.length).toBe(2);
    });

    test("returns null for unusable input", () => {
        expect(treeToGrid(null)).toBeNull();
        expect(treeToGrid({})).toBeNull();
    });
});
