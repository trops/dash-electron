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

    test("when wired, the static editor is replaced with the Stage 3 placeholder", () => {
        const wiredNode = makeNode({
            type: "Table",
            wires: { data: { provider: null, method: null } },
        });
        render(
            <PropertyInspector
                node={wiredNode}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-wire-placeholder-data")
        ).toBeInTheDocument();
        // The static editor (a JSON textarea for Table.data) is gone.
        expect(
            screen.queryByTestId("composer-input-data")
        ).not.toBeInTheDocument();
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
        const input = screen.getByTestId("composer-input-checked");
        expect(input.type).toBe("checkbox");
        fireEvent.click(input);
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "checked", true);
    });

    test("Array prop renders a JSON textarea that parses on blur", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Table" })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        const textarea = screen.getByTestId("composer-input-data");
        expect(textarea.tagName).toBe("TEXTAREA");
        fireEvent.change(textarea, { target: { value: '[{"x":1}]' } });
        // Change alone is buffered — apply only on blur.
        expect(onChangeProp).not.toHaveBeenCalled();
        fireEvent.blur(textarea);
        expect(onChangeProp).toHaveBeenCalledWith("node-1", "data", [{ x: 1 }]);
    });

    test("invalid JSON in the textarea surfaces an error and does not call onChangeProp", () => {
        const onChangeProp = jest.fn();
        render(
            <PropertyInspector
                node={makeNode({ type: "Table" })}
                onChangeProp={onChangeProp}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        const textarea = screen.getByTestId("composer-input-data");
        fireEvent.change(textarea, { target: { value: "not json" } });
        fireEvent.blur(textarea);
        expect(onChangeProp).not.toHaveBeenCalled();
        // The inline error message is below the textarea.
        expect(screen.getByText(/JSON parse error/i)).toBeInTheDocument();
    });

    test("function prop renders a non-interactive informational note", () => {
        render(
            <PropertyInspector
                node={makeNode({ type: "Slider" })}
                onChangeProp={() => {}}
                onSetSlotMode={() => {}}
                onClose={() => {}}
            />
        );
        // Slider.onChange is a function — no input control rendered.
        expect(
            screen.queryByTestId("composer-input-onChange")
        ).not.toBeInTheDocument();
        expect(screen.getByText(/callback/i)).toBeInTheDocument();
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
