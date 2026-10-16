/**
 * @jest-environment jsdom
 */
/**
 * UnsavedWorkPrompt — leaving the Widget Builder with unsaved work asks
 * Save as draft / Discard / Keep editing. Rendered over everything (a
 * portal) so the builder's own window and its code editor can't cover it.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
jest.mock("@trops/dash-react", () => require("./dashReactTestStub"));
jest.mock("./useBuilderTheme", () => ({
    useBuilderTheme: () => ({
        tk: () => "bg",
        border: "b",
        text: "t",
        muted: "m",
    }),
}));

import { UnsavedWorkPrompt } from "./UnsavedWorkPrompt";

describe("UnsavedWorkPrompt", () => {
    test("nothing shows when closed", () => {
        render(<UnsavedWorkPrompt open={false} onAnswer={() => {}} />);
        expect(screen.queryByTestId("builder-unsaved-prompt")).toBeNull();
    });

    test("open, it sits on the page body and each button answers", () => {
        const onAnswer = jest.fn();
        const { container } = render(
            <UnsavedWorkPrompt open onAnswer={onAnswer} />
        );
        const dialog = screen.getByRole("dialog", { name: "Unsaved changes" });
        // A portal: not inside the component's own tree.
        expect(container).not.toContainElement(dialog);
        expect(document.body).toContainElement(dialog);
        fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
        expect(onAnswer.mock.calls).toEqual([["save"], ["discard"], ["keep"]]);
    });

    test("Escape keeps editing", () => {
        const onAnswer = jest.fn();
        render(<UnsavedWorkPrompt open onAnswer={onAnswer} />);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onAnswer).toHaveBeenCalledWith("keep");
    });
});
