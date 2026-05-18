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
import {
    SAMPLE_LAYOUTS,
    INTENTS,
    getSampleLayoutsForIntent,
} from "./composerSampleLayouts";
import { isGridEmpty } from "./gridLayout";

describe("QuickStartPane — step 1 (intent picker)", () => {
    test("renders an intent tile per INTENTS entry + the escape hatch; no detail view yet", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        expect(
            screen.getByTestId("composer-quick-start-intents")
        ).toBeInTheDocument();
        for (const it of INTENTS) {
            expect(
                screen.getByTestId(`composer-quick-start-intent-${it.id}`)
            ).toBeInTheDocument();
        }
        // No detail view, no samples, no AI form when at step 1.
        expect(
            screen.queryByTestId("composer-quick-start-samples")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-quick-start-ai")
        ).not.toBeInTheDocument();
        // Escape hatch is visible from both steps.
        expect(
            screen.getByTestId("composer-quick-start-scratch")
        ).toBeInTheDocument();
    });

    test("clicking an intent advances to the matching detail view", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-search")
        );
        expect(
            screen.getByTestId("composer-quick-start-detail-search")
        ).toBeInTheDocument();
    });
});

describe("QuickStartPane — step 2 (intent detail)", () => {
    function advanceToIntent(intentId) {
        fireEvent.click(
            screen.getByTestId(`composer-quick-start-intent-${intentId}`)
        );
    }

    test("renders only the samples matching the picked intent + the AI form", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        advanceToIntent("search");
        const expected = getSampleLayoutsForIntent("search");
        for (const layout of expected) {
            expect(
                screen.getByTestId(`composer-quick-start-sample-${layout.id}`)
            ).toBeInTheDocument();
        }
        // A sample that doesn't match the search intent is hidden.
        // stat-tile is intents: ["view"] only — should not appear
        // when the user picked Search.
        const viewOnlySample = SAMPLE_LAYOUTS.find((l) => l.id === "stat-tile");
        expect(viewOnlySample).toBeTruthy();
        expect(
            screen.queryByTestId(
                `composer-quick-start-sample-${viewOnlySample.id}`
            )
        ).not.toBeInTheDocument();
        // AI form opener is present.
        expect(
            screen.getByTestId("composer-quick-start-ai-open")
        ).toBeInTheDocument();
    });

    test("clicking a sample card fires onApplyGrid with that sample's grid", () => {
        const onApplyGrid = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={onApplyGrid}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        advanceToIntent("search");
        const sample = getSampleLayoutsForIntent("search")[0];
        fireEvent.click(
            screen.getByTestId(`composer-quick-start-sample-${sample.id}`)
        );
        expect(onApplyGrid).toHaveBeenCalledTimes(1);
        expect(isGridEmpty(onApplyGrid.mock.calls[0][0])).toBe(false);
    });

    test("Change link returns to the intent picker", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        advanceToIntent("view");
        fireEvent.click(screen.getByTestId("composer-quick-start-back"));
        expect(
            screen.getByTestId("composer-quick-start-intents")
        ).toBeInTheDocument();
    });

    test("opening the AI form reveals the textarea and submit button", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        advanceToIntent("search");
        fireEvent.click(screen.getByTestId("composer-quick-start-ai-open"));
        expect(
            screen.getByTestId("composer-quick-start-ai-input")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-quick-start-ai-submit")
        ).toBeDisabled();
    });
});

describe("QuickStartPane — provider intent", () => {
    test("picking the provider intent shows the provider list, not the sample/AI detail", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-provider")
        );
        expect(
            screen.getByTestId("composer-quick-start-providers")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-quick-start-detail-provider")
        ).not.toBeInTheDocument();
        // The provider catalog enumerates wirable types
        // asynchronously, but credential types (algolia) come from
        // PROVIDER_API_REGISTRY synchronously and render on first
        // commit — confirm at least one provider button exists so the
        // user can actually click through.
        expect(
            screen.getByTestId(
                "composer-quick-start-provider-algolia-credential"
            )
        ).toBeInTheDocument();
    });

    test("picking a provider advances to detail view with provider name in header", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-provider")
        );
        fireEvent.click(
            screen.getByTestId(
                "composer-quick-start-provider-algolia-credential"
            )
        );
        expect(
            screen.getByTestId("composer-quick-start-detail-provider")
        ).toBeInTheDocument();
        // Header shows the provider name (Algolia) not the generic
        // "Provider widget" label.
        expect(
            screen.getByTestId("composer-quick-start-detail-provider")
        ).toHaveTextContent(/Algolia/);
    });

    test("Change link from provider-detail goes back to the provider picker, not all the way to intent picker", () => {
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-provider")
        );
        fireEvent.click(
            screen.getByTestId(
                "composer-quick-start-provider-algolia-credential"
            )
        );
        fireEvent.click(screen.getByTestId("composer-quick-start-back"));
        // Back to provider picker (one step), NOT all the way to
        // intent picker.
        expect(
            screen.getByTestId("composer-quick-start-providers")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-quick-start-intents")
        ).not.toBeInTheDocument();
    });
});

describe("QuickStartPane — escape hatch", () => {
    test("clicking 'start blank' opens the palette on the seed cell from step 1", () => {
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

    test("scratch button is disabled when no seed cell is available", () => {
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
