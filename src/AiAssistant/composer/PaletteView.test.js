/**
 * @jest-environment jsdom
 *
 * PaletteView search + category filter behavior.
 *
 * The palette has ~50 entries across five categories. Pins:
 *   - typing in the search box narrows the visible list to substring
 *     matches (case-insensitive)
 *   - the category dropdown collapses the view to a single section
 *   - the two filters combine (AND)
 *   - an empty result set shows the no-matches hint instead of
 *     leaving the user staring at a blank scroll area
 *   - the wrapper testid for each entry is still emitted so the
 *     existing e2e specs that click by name keep working
 */

jest.mock(
    "@trops/dash-react",
    () => ({
        MenuItem: ({ children, ...rest }) => (
            <button type="button" {...rest}>
                {children}
            </button>
        ),
        ButtonIcon: ({ ariaLabel, onClick }) => (
            <button type="button" aria-label={ariaLabel} onClick={onClick} />
        ),
    }),
    { virtual: false }
);

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { PaletteView } from "./PaletteView";

describe("PaletteView — search + category filter", () => {
    test("renders without a search query and shows entries across categories", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        // A representative entry from each category should be present
        // (using known schema names from dashReactComponentSchemas).
        expect(
            screen.getByTestId("composer-palette-pick-Panel")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-palette-pick-Heading")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-palette-pick-SearchInput")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-palette-pick-Button")
        ).toBeInTheDocument();
    });

    test("typing in the search box narrows the visible entries", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        fireEvent.change(screen.getByTestId("composer-palette-search"), {
            target: { value: "search" },
        });
        // SearchInput matches; Button shouldn't.
        expect(
            screen.getByTestId("composer-palette-pick-SearchInput")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-palette-pick-Button")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-palette-pick-Panel")
        ).not.toBeInTheDocument();
    });

    test("substring match is case-insensitive", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        fireEvent.change(screen.getByTestId("composer-palette-search"), {
            target: { value: "HEAD" },
        });
        expect(
            screen.getByTestId("composer-palette-pick-Heading")
        ).toBeInTheDocument();
    });

    test("category dropdown collapses to a single section", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        fireEvent.change(
            screen.getByTestId("composer-palette-category-filter"),
            { target: { value: "input" } }
        );
        expect(
            screen.getByTestId("composer-palette-pick-SearchInput")
        ).toBeInTheDocument();
        // Display + layout categories should drop out.
        expect(
            screen.queryByTestId("composer-palette-pick-Heading")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-palette-pick-Panel")
        ).not.toBeInTheDocument();
    });

    test("search + category filters combine (AND)", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        // "search" in the input category — should only match SearchInput.
        fireEvent.change(
            screen.getByTestId("composer-palette-category-filter"),
            { target: { value: "input" } }
        );
        fireEvent.change(screen.getByTestId("composer-palette-search"), {
            target: { value: "search" },
        });
        expect(
            screen.getByTestId("composer-palette-pick-SearchInput")
        ).toBeInTheDocument();
        // Heading is in display, even though it doesn't match "search"
        // anyway — sanity-check it's gone.
        expect(
            screen.queryByTestId("composer-palette-pick-Heading")
        ).not.toBeInTheDocument();
    });

    test("an empty result shows the no-matches hint instead of a blank pane", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        fireEvent.change(screen.getByTestId("composer-palette-search"), {
            target: { value: "zzznevermatches" },
        });
        expect(
            screen.getByTestId("composer-palette-no-matches")
        ).toBeInTheDocument();
        // No entries rendered at all.
        expect(
            screen.queryByTestId(/^composer-palette-pick-/)
        ).not.toBeInTheDocument();
    });

    test("entries within a category render alphabetically (numeric-aware)", () => {
        render(<PaletteView onPick={() => {}} onCancel={() => {}} />);
        // Pull all entries inside the "display" section (the largest
        // category with many numbered variants like Heading/Heading2/
        // Heading3), then assert their DOM order matches the same list
        // sorted alphabetically. Numeric-aware sort means Heading10
        // would land after Heading2, not before.
        const section = screen.getByTestId("composer-palette-category-display");
        const renderedNames = Array.from(
            section.querySelectorAll('[data-testid^="composer-palette-pick-"]')
        ).map((el) =>
            el
                .getAttribute("data-testid")
                .replace(/^composer-palette-pick-/, "")
        );
        const sorted = [...renderedNames].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );
        expect(renderedNames).toEqual(sorted);
        // Sanity: ordering must not be a single-element accident.
        expect(renderedNames.length).toBeGreaterThan(3);
    });

    test("clicking an entry fires onPick with the component name", () => {
        const onPick = jest.fn();
        render(<PaletteView onPick={onPick} onCancel={() => {}} />);
        // The testid lives on the wrapper div; the actual click
        // handler is on the (mocked) MenuItem button inside it.
        // Native click events don't propagate downward, so we have
        // to dispatch on the inner button.
        const wrapper = screen.getByTestId("composer-palette-pick-Heading");
        const button = wrapper.querySelector("button");
        fireEvent.click(button);
        expect(onPick).toHaveBeenCalledWith("Heading");
    });
});
