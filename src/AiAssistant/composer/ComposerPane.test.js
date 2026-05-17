/**
 * @jest-environment jsdom
 *
 * Smoke tests for ComposerPane (Compose-mode Stage 1).
 *
 * The emitter has its own deep coverage; here we only verify that
 * the pane:
 *   - renders palette buttons for every component in the schemas
 *   - inserts a clicked component into the tree
 *   - fires onEmit with a valid widget code shape after each edit
 *   - renames the widget (and re-emits) when the name field changes
 *   - removes a node when its × button is clicked
 *   - never lets the user remove the root Panel
 *
 * Layout assertions (collapsible categories etc.) are spot-checked
 * via category headers; styling and a11u details are not in scope.
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ComposerPane } from "./ComposerPane";
import { DASH_REACT_COMPONENT_SCHEMAS } from "../dashReactComponentSchemas";

describe("ComposerPane", () => {
    test("renders an add button for every palette-visible schema entry", () => {
        render(<ComposerPane />);
        for (const [name, schema] of Object.entries(
            DASH_REACT_COMPONENT_SCHEMAS
        )) {
            // Schemas marked hideFromPalette (MenuItem variants) exist
            // for import bookkeeping but aren't user-droppable, so no
            // palette button is rendered for them.
            if (schema.hideFromPalette) continue;
            expect(
                screen.getByTestId(`composer-add-${name}`)
            ).toBeInTheDocument();
        }
    });

    test("renders the root Panel in the composition tree without a remove button", () => {
        render(<ComposerPane />);
        expect(screen.getByTestId("composer-node-root")).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-remove-root")
        ).not.toBeInTheDocument();
    });

    test("clicking a palette button adds that component to the tree and re-emits", () => {
        const onEmit = jest.fn();
        render(<ComposerPane onEmit={onEmit} />);
        fireEvent.click(screen.getByTestId("composer-add-Heading"));

        // A new node should appear in the tree with a remove button.
        const removeButtons = screen.getAllByLabelText(/Remove Heading/);
        expect(removeButtons.length).toBeGreaterThan(0);

        expect(onEmit).toHaveBeenCalled();
        const lastCall = onEmit.mock.calls[onEmit.mock.calls.length - 1][0];
        expect(typeof lastCall.componentCode).toBe("string");
        expect(lastCall.componentCode).toContain("<Heading");
        expect(lastCall.componentCode).toMatch(/<Panel[^>]*>/);
        expect(typeof lastCall.configCode).toBe("string");
        expect(lastCall.configCode).toContain('component: "ComposedWidget"');
    });

    test("clicking remove on a child node strips it and re-emits", () => {
        const onEmit = jest.fn();
        render(<ComposerPane onEmit={onEmit} />);
        fireEvent.click(screen.getByTestId("composer-add-Button"));
        const removeBtn = screen.getByLabelText(/Remove Button/);
        const emitCallsBeforeRemove = onEmit.mock.calls.length;
        fireEvent.click(removeBtn);

        expect(
            screen.queryByLabelText(/Remove Button/)
        ).not.toBeInTheDocument();
        expect(onEmit.mock.calls.length).toBeGreaterThan(emitCallsBeforeRemove);
        const last = onEmit.mock.calls[onEmit.mock.calls.length - 1][0];
        expect(last.componentCode).not.toContain("<Button");
    });

    test("renaming the widget sanitizes non-identifier chars and re-emits", () => {
        const onEmit = jest.fn();
        render(<ComposerPane onEmit={onEmit} />);
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "My Widget!" } });
        expect(input.value).toBe("MyWidget");
        const last = onEmit.mock.calls[onEmit.mock.calls.length - 1][0];
        expect(last.componentCode).toContain(
            "export default function MyWidget()"
        );
    });

    test("blank widget name falls back to ComposedWidget", () => {
        const onEmit = jest.fn();
        render(<ComposerPane onEmit={onEmit} />);
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "" } });
        expect(input.value).toBe("ComposedWidget");
    });

    test("clicking a tree node opens the property inspector and hides the palette", () => {
        render(<ComposerPane />);
        // Add a Heading and click its tree row.
        fireEvent.click(screen.getByTestId("composer-add-Heading"));
        const treeNode = screen.getAllByTestId(/^composer-node-node-/)[0];
        fireEvent.click(treeNode);

        // Inspector visible, palette hidden.
        expect(
            screen.getByTestId(/^composer-inspector-node-/)
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-add-Table")
        ).not.toBeInTheDocument();
    });

    test("inspector close button restores the palette", () => {
        render(<ComposerPane />);
        fireEvent.click(screen.getByTestId("composer-add-Heading"));
        fireEvent.click(screen.getAllByTestId(/^composer-node-node-/)[0]);
        fireEvent.click(screen.getByTestId("composer-inspector-close"));
        expect(screen.getByTestId("composer-add-Table")).toBeInTheDocument();
    });

    test("editing a prop in the inspector re-emits with the new value", () => {
        const onEmit = jest.fn();
        render(<ComposerPane onEmit={onEmit} />);
        fireEvent.click(screen.getByTestId("composer-add-Heading"));
        fireEvent.click(screen.getAllByTestId(/^composer-node-node-/)[0]);
        const input = screen.getByTestId("composer-input-title");
        fireEvent.change(input, { target: { value: "Updated" } });
        const last = onEmit.mock.calls[onEmit.mock.calls.length - 1][0];
        expect(last.componentCode).toContain('title="Updated"');
    });

    test("removing the selected node also closes the inspector", () => {
        render(<ComposerPane />);
        fireEvent.click(screen.getByTestId("composer-add-Heading"));
        const treeNode = screen.getAllByTestId(/^composer-node-node-/)[0];
        fireEvent.click(treeNode);
        // Inspector is open. Remove the same node.
        const removeBtn = screen.getByLabelText(/Remove Heading/);
        fireEvent.click(removeBtn);
        // Inspector should be gone, palette back.
        expect(
            screen.queryByTestId(/^composer-inspector-node-/)
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("composer-add-Table")).toBeInTheDocument();
    });

    test("category headers can collapse the section", () => {
        render(<ComposerPane />);
        // Display is expanded by default — clicking the header
        // collapses it and hides the add buttons within.
        const header = screen.getByTestId("composer-category-display");
        expect(screen.getByTestId("composer-add-Heading")).toBeInTheDocument();
        act(() => {
            fireEvent.click(header);
        });
        expect(
            screen.queryByTestId("composer-add-Heading")
        ).not.toBeInTheDocument();
    });
});
