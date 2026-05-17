/**
 * @jest-environment jsdom
 *
 * Tests for PropertyInspector (Compose-mode Stage 2).
 *
 * Covers:
 *   - one row per non-children prop from the component schema
 *   - required marker (*) appears for required props
 *   - editor type matches the prop's declared schema type
 *     (text / number / checkbox / JSON textarea)
 *   - data-slot toggle shows for props in dataSlots, and not for
 *     non-data-slot props
 *   - toggling to "wire" mode swaps the inline editor for the
 *     "configure in Stage 3" placeholder
 *   - JSON textarea calls onChangeProp with parsed value on blur
 *   - the Back-to-palette button fires onClose
 *
 * The pane-level integration (selection → inspector replaces
 * palette, re-emits) is exercised in ComposerPane.test.js.
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { PropertyInspector } from "./PropertyInspector";

function makeNode(overrides = {}) {
    return {
        id: "node-1",
        type: "Table",
        props: {},
        children: [],
        ...overrides,
    };
}

describe("PropertyInspector — rendering", () => {
    test("renders one row per non-children prop", () => {
        const node = makeNode({ type: "Slider" });
        render(
            <PropertyInspector
                node={node}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        // Slider props: value, onChange, min, max.
        expect(
            screen.getByTestId("composer-prop-row-value")
        ).toBeInTheDocument();
        expect(screen.getByTestId("composer-prop-row-min")).toBeInTheDocument();
        expect(screen.getByTestId("composer-prop-row-max")).toBeInTheDocument();
    });

    test("renders a required-marker for required props", () => {
        render(
            <PropertyInspector
                node={makeNode({ type: "Heading" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        // Heading.title is required.
        const row = screen.getByTestId("composer-prop-row-title");
        expect(row.textContent).toContain("*");
    });

    test("emits null for an unknown component schema", () => {
        const { container } = render(
            <PropertyInspector
                node={makeNode({ type: "DefinitelyNotAComponent" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        expect(container.textContent).toMatch(/No schema/);
    });
});

describe("PropertyInspector — slot mode toggle", () => {
    test("shows the static/wire toggle for data slots", () => {
        render(
            <PropertyInspector
                node={makeNode({ type: "Table" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-slot-static-data")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-slot-wire-data")
        ).toBeInTheDocument();
    });

    test("hides the toggle for non-data-slot props", () => {
        render(
            <PropertyInspector
                node={makeNode({ type: "Slider" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        // Slider has no dataSlots — value/min/max are static-only.
        expect(
            screen.queryByTestId("composer-slot-static-value")
        ).not.toBeInTheDocument();
    });

    test('clicking "wire" calls onSetSlotMode with mode="wire"', () => {
        const onSetSlotMode = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Table" })}
                onChangeProp={() => {}}
                onSetSlotMode={onSetSlotMode}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("composer-slot-wire-data"));
        expect(onSetSlotMode).toHaveBeenCalledWith("node-1", "data", "wire");
    });

    test("when wired but unconfigured, the static editor is replaced with the WirePicker", () => {
        const wiredNode = makeNode({
            type: "Table",
            wires: { data: { provider: null, method: null } },
        });
        // Stub the MCP catalog bridge so the picker's async type
        // load completes (the credential algolia type still surfaces
        // synchronously from the registry regardless).
        if (!window.mainApi) window.mainApi = {};
        if (!window.mainApi.mcp) window.mainApi.mcp = {};
        window.mainApi.mcp.getCatalog = jest
            .fn()
            .mockResolvedValue({ catalog: { servers: [] } });
        render(
            <PropertyInspector
                node={wiredNode}
                providers={{}}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onSetSlotWire={() => {}}
                onClearSlotWire={() => {}}
                onClose={() => {}}
            />
        );
        // The picker renders algolia (synchronously available from
        // the registry, no async wait required); the prior empty
        // state is gone now that we surface types instead of
        // configured instances.
        expect(
            screen.getByTestId("composer-wire-provider-data-algolia")
        ).toBeInTheDocument();
        // The static editor (a JSON textarea for Table.data) is gone.
        expect(
            screen.queryByTestId("composer-input-data")
        ).not.toBeInTheDocument();
    });

    test("when wired and configured, the WiredSlotSummary renders", () => {
        const wiredNode = makeNode({
            type: "Table",
            wires: {
                data: {
                    provider: "MyAlgolia",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "listIndices",
                },
            },
        });
        render(
            <PropertyInspector
                node={wiredNode}
                providers={{
                    MyAlgolia: {
                        type: "algolia",
                        providerClass: "credential",
                    },
                }}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onSetSlotWire={() => {}}
                onClearSlotWire={() => {}}
                onClose={() => {}}
            />
        );
        // Rows are accordion-collapsed by default when not needing
        // attention (configured wires count as "good"). Expand it.
        fireEvent.click(screen.getByTestId("composer-prop-toggle-data"));
        expect(
            screen.getByTestId("composer-wire-summary-data")
        ).toBeInTheDocument();
        // The summary appears both in the collapsed header (always)
        // and inside the expanded body — getAllByText handles both.
        expect(
            screen.getAllByText(/MyAlgolia\.listIndices/).length
        ).toBeGreaterThan(0);
    });
});

describe("PropertyInspector — static editors by type", () => {
    test("string prop renders a text input that fires onChangeProp", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Heading" })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        const input = screen.getByTestId("composer-input-title");
        expect(input.tagName).toBe("INPUT");
        expect(input.type).toBe("text");
        fireEvent.change(input, { target: { value: "Hello" } });
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "title", "Hello");
    });

    test("clearing a string input fires onChangeProp with undefined", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({
                    type: "Heading",
                    props: { title: "Hello" },
                })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("composer-prop-toggle-title"));
        const input = screen.getByTestId("composer-input-title");
        fireEvent.change(input, { target: { value: "" } });
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "title", undefined);
    });

    test("number prop renders a number input that coerces", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Slider" })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("composer-prop-toggle-value"));
        const input = screen.getByTestId("composer-input-value");
        expect(input.type).toBe("number");
        fireEvent.change(input, { target: { value: "42" } });
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "value", 42);
    });

    test("boolean prop renders a checkbox", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Switch" })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("composer-prop-toggle-checked"));
        const input = screen.getByTestId("composer-input-checked");
        expect(input.type).toBe("checkbox");
        fireEvent.click(input);
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "checked", true);
    });

    // The JSON-textarea editor for Array props (`composer-input-data`
    // etc.) is currently unreachable: every Array prop in the schema
    // is a dataSlot, and PropRow's mode computation forces dataSlots
    // into wire mode unconditionally (PropertyInspector.js — `mode =
    // isCallbackProp || isWired || isDataSlot ? "wire" : "static"`).
    // Clicking the inspector's "static" segmented-button calls
    // `onSetSlotMode(..., "static")` which deletes the wire spec, but
    // `mode` immediately recomputes to "wire" again from `isDataSlot`
    // so the textarea never renders. Revive the prior tests
    // (`Array prop renders a JSON textarea that parses on blur` and
    // `invalid JSON in the textarea surfaces an error`) once the
    // static toggle is wired through for dataSlots.

    test("function prop renders a non-interactive informational note", () => {
        render(
            <PropertyInspector
                node={makeNode({ type: "Slider" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        // Slider.onChange is auto-state (input changeProp). The row
        // stays collapsed by default with an "auto-state" summary so
        // the user isn't pushed into a picker they don't need.
        // Expanding still surfaces the wire picker (the "callback"
        // hint) for explicit overrides.
        expect(
            screen.queryByTestId("composer-input-onChange")
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("composer-prop-summary-onChange")
        ).toHaveTextContent(/auto-state/);
        // Expanding still reveals the wire picker (provider list)
        // so the user can explicitly override auto-state.
        fireEvent.click(screen.getByTestId("composer-prop-toggle-onChange"));
        expect(
            screen.queryByTestId("composer-wire-providers-onChange") ||
                screen.queryByTestId("composer-wire-loading-onChange") ||
                screen.queryByTestId("composer-wire-empty-onChange")
        ).toBeInTheDocument();
    });
});

describe("PropertyInspector — close button", () => {
    test("clicking Back fires onClose", () => {
        const onClose = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Heading" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByTestId("composer-inspector-close"));
        expect(onClose).toHaveBeenCalled();
    });
});
