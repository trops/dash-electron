/**
 * @jest-environment jsdom
 *
 * Tests for the WidgetConsolePane: its toolbar, filter and empty states.
 * (Its per-error "Send error to AI" button went with the builder's chat —
 * consolidation Phase 3b.)
 */
jest.mock("./useBuilderTheme", () => require("./builderThemeStub"));
jest.mock("@trops/dash-react", () => require("./dashReactTestStub"));
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WidgetConsolePane } from "./WidgetConsolePane";

function evt(severity, message, extras = {}) {
    return {
        severity,
        source: "console",
        args: [message],
        timestamp: 1700000000000,
        stack: "",
        ...extras,
    };
}

describe("WidgetConsolePane — no AI (consolidation Phase 3b)", () => {
    test("an error row has no Send error to AI button", () => {
        render(<WidgetConsolePane events={[evt("error", "boom")]} />);
        expect(screen.getByText(/boom/)).toBeInTheDocument();
        expect(screen.queryByTestId("console-send-to-ai")).toBeNull();
    });
});

describe("WidgetConsolePane — toolbar and empty states", () => {
    test("with no events it says so", () => {
        render(<WidgetConsolePane events={[]} />);
        expect(screen.getByText("No logs yet")).toBeInTheDocument();
    });

    test("Errors only filters the rows", () => {
        render(
            <WidgetConsolePane
                events={[evt("error", "boom"), evt("log", "tick")]}
            />
        );
        expect(screen.getAllByTestId("console-row")).toHaveLength(2);
        fireEvent.click(screen.getByLabelText("Errors only"));
        expect(screen.getAllByTestId("console-row")).toHaveLength(1);
    });

    test("Errors only with no errors shows the empty state", () => {
        render(<WidgetConsolePane events={[evt("log", "tick")]} />);
        fireEvent.click(screen.getByLabelText("Errors only"));
        expect(screen.getByText("No errors")).toBeInTheDocument();
    });

    test("Clear calls onClear", () => {
        const onClear = jest.fn();
        render(<WidgetConsolePane events={[]} onClear={onClear} />);
        fireEvent.click(screen.getByTestId("console-clear"));
        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
