/**
 * ChatInput — auto-resize must not collapse the textarea.
 *
 * Regression: when the widget mounts on a page tab that isn't visible yet,
 * the textarea's scrollHeight is 0, and the auto-resize effect wrote an
 * inline `height: 0px` that stuck after the page became visible — the input
 * rendered as a thin sliver. jsdom always reports scrollHeight 0, which
 * reproduces the hidden-mount case exactly.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "./ChatInput";

// dash-react's dist pulls in ESM-only deps jest can't load; stub the
// buttons ChatInput uses as plain <button>s. (jest.mock is hoisted above
// the imports at runtime.)
jest.mock("@trops/dash-react", () => {
    const React = require("react");
    const Btn = ({ onClick, disabled, children }) =>
        React.createElement("button", { onClick, disabled }, children);
    return { Button: Btn, Button2: Btn };
});

describe("ChatInput auto-resize", () => {
    test("does not pin height to 0px when mounted while not measurable", () => {
        render(<ChatInput onSend={() => {}} isLoading={false} />);
        const textarea = screen.getByPlaceholderText("Type a message...");
        expect(textarea.style.height).not.toBe("0px");
    });

    test("still does not collapse after typing while not measurable", () => {
        render(<ChatInput onSend={() => {}} isLoading={false} />);
        const textarea = screen.getByPlaceholderText("Type a message...");
        fireEvent.change(textarea, { target: { value: "hello" } });
        expect(textarea.style.height).not.toBe("0px");
    });

    test("sizes to content once measurable (capped at 120px)", () => {
        render(<ChatInput onSend={() => {}} isLoading={false} />);
        const textarea = screen.getByPlaceholderText("Type a message...");
        Object.defineProperty(textarea, "scrollHeight", {
            configurable: true,
            get: () => 300,
        });
        fireEvent.change(textarea, { target: { value: "a\nb\nc" } });
        expect(textarea.style.height).toBe("120px");
    });
});
