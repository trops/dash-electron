/**
 * @jest-environment jsdom
 *
 * QuickStartPane — the empty composer's onramps: the kinds of widget and
 * their starter layouts, "start from scratch", and "Rather describe it?
 * Ask the Dash team" (consolidation Phase 3b — the builder has no AI). We
 * test:
 *   - structural rendering (both steps + escape hatch)
 *   - clicking a sample card fires onApplyGrid with the template grid
 *   - the escape hatch routes through onRequestPalette with the
 *     supplied seed cell id
 *   - the hand-off to the Dash team, with and without a description
 */

jest.mock("../useBuilderTheme", () => require("../builderThemeStub"));
jest.mock("@trops/dash-react", () => require("../dashReactTestStub"));
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuickStartPane } from "./QuickStartPane";
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
        // No detail view or samples at step 1.
        expect(
            screen.queryByTestId("composer-quick-start-samples")
        ).not.toBeInTheDocument();
        // Escape hatch is visible from both steps.
        expect(
            screen.getByTestId("composer-quick-start-scratch")
        ).toBeInTheDocument();
        // Without a host to hand off to, no Dash team link.
        expect(
            screen.queryByTestId("composer-quick-start-ask-team")
        ).not.toBeInTheDocument();
    });

    test("Rather describe it? Ask the Dash team (step 1: a link, no text)", () => {
        const onAskDashTeam = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
                onAskDashTeam={onAskDashTeam}
            />
        );
        const link = screen.getByTestId("composer-quick-start-ask-team");
        expect(link).toHaveTextContent("Rather describe it? Ask the Dash team");
        fireEvent.click(link);
        expect(onAskDashTeam).toHaveBeenCalledWith("");
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

    test("renders only the samples matching the picked intent", () => {
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
        // No AI of its own.
        expect(
            screen.queryByTestId("composer-quick-start-ai-open")
        ).not.toBeInTheDocument();
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

    test("Rather describe it? hands the text to the Dash team", () => {
        const onAskDashTeam = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={() => {}}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
                onAskDashTeam={onAskDashTeam}
            />
        );
        advanceToIntent("search");
        fireEvent.change(
            screen.getByTestId("composer-quick-start-ask-team-input"),
            { target: { value: "  Look up an order by number " } }
        );
        fireEvent.click(screen.getByTestId("composer-quick-start-ask-team"));
        expect(onAskDashTeam).toHaveBeenCalledWith(
            "Look up an order by number"
        );
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

    test("Phase D — applying a sample from provider-intent forwards providerChoice as onApplyGrid's second arg", () => {
        // Plumbing-only contract: ComposerPaneV2 listens for the
        // second arg and stashes it via ComposerProviderChoiceContext.
        // The contract change is what lets a future auto-wire feature
        // detect "user picked Algolia in the wizard" without prop-
        // drilling through every handler.
        const onApplyGrid = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={onApplyGrid}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        // Walk: intent picker → provider picker → algolia → detail.
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-provider")
        );
        fireEvent.click(
            screen.getByTestId(
                "composer-quick-start-provider-algolia-credential"
            )
        );
        // The provider-flavored algolia-rules-list starter floats to
        // the top of the gallery via getSampleLayoutsForIntent's
        // providerChoice ranking; pick it.
        fireEvent.click(
            screen.getByTestId("composer-quick-start-sample-algolia-rules-list")
        );
        // Spy received (grid, providerChoice). providerChoice is the
        // wirable-type record (id: "algolia", kind: "credential").
        expect(onApplyGrid).toHaveBeenCalledTimes(1);
        const [grid, providerChoice] = onApplyGrid.mock.calls[0];
        expect(grid).toBeTruthy();
        expect(providerChoice).toMatchObject({
            id: "algolia",
            kind: "credential",
        });
    });

    test("Phase D — applying a sample from a non-provider intent passes null/undefined as providerChoice", () => {
        // Non-provider intents (search/view/act/else) leave
        // providerChoice null. The contract holds either way — second
        // arg is always present, just nullable.
        const onApplyGrid = jest.fn();
        render(
            <QuickStartPane
                onApplyGrid={onApplyGrid}
                onRequestPalette={() => {}}
                seedCellId="cell-1"
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-quick-start-intent-search")
        );
        // Pick the first search-tagged starter (algolia-rules-list
        // when no provider context, since it's first in SAMPLE_LAYOUTS
        // and tagged for search intent).
        const firstSample = screen.getAllByTestId(
            /^composer-quick-start-sample-/
        )[0];
        fireEvent.click(firstSample);
        expect(onApplyGrid).toHaveBeenCalledTimes(1);
        const [grid, providerChoice] = onApplyGrid.mock.calls[0];
        expect(grid).toBeTruthy();
        // No provider was picked → second arg is null (the
        // providerChoice state's initial value).
        expect(providerChoice).toBeNull();
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
