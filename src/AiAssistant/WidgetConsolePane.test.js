/**
 * @jest-environment jsdom
 *
 * Tests for the WidgetConsolePane's Send-to-AI affordance (slice 19G.2).
 *
 * The pane already handles severity coloring + filter via existing
 * paths; this file specifically pins the per-error "Send error to AI"
 * button: it must appear for severity=error rows, NOT for warn/info/log
 * rows, and clicking it must call onSendErrorToAI with the originating
 * event payload.
 */
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

describe("WidgetConsolePane — Send-to-AI per error", () => {
    test("renders a Send-to-AI button on error rows when handler is provided", () => {
        render(
            <WidgetConsolePane
                events={[evt("error", "boom")]}
                onSendErrorToAI={() => {}}
            />
        );
        expect(screen.getByTestId("console-send-to-ai")).toBeInTheDocument();
    });

    test("does NOT render the button on warn / info / log / debug rows", () => {
        render(
            <WidgetConsolePane
                events={[
                    evt("warn", "deprecated"),
                    evt("info", "boot"),
                    evt("log", "tick"),
                    evt("debug", "trace"),
                ]}
                onSendErrorToAI={() => {}}
            />
        );
        expect(
            screen.queryByTestId("console-send-to-ai")
        ).not.toBeInTheDocument();
    });

    test("does NOT render the button when onSendErrorToAI is not provided", () => {
        // Defensive: if a future caller mounts the pane without the
        // handler (e.g. read-only context), the button shouldn't fire
        // a no-op.
        render(<WidgetConsolePane events={[evt("error", "boom")]} />);
        expect(
            screen.queryByTestId("console-send-to-ai")
        ).not.toBeInTheDocument();
    });

    test("clicking the button calls onSendErrorToAI with the full event", () => {
        const handler = jest.fn();
        const errorEvt = evt("error", "boom", {
            source: "window.error",
            stack: "Error: boom\n    at widgets/Foo.js:42:10",
        });
        render(
            <WidgetConsolePane events={[errorEvt]} onSendErrorToAI={handler} />
        );
        fireEvent.click(screen.getByTestId("console-send-to-ai"));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(errorEvt);
    });

    test("multiple errors render multiple buttons (one per row)", () => {
        render(
            <WidgetConsolePane
                events={[
                    evt("error", "first"),
                    evt("warn", "in between"),
                    evt("error", "second"),
                ]}
                onSendErrorToAI={() => {}}
            />
        );
        expect(screen.getAllByTestId("console-send-to-ai")).toHaveLength(2);
    });
});
