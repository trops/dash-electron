/**
 * @jest-environment jsdom
 */
/**
 * ChecksStatus — where the Widget Builder's checks stand, beside Install:
 * checking, the Checker reviewing, fixing, checked, or problems left (then
 * nothing can be installed — ask for changes or save a draft).
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
jest.mock("@trops/dash-react", () => require("./dashReactTestStub"));
import { ChecksStatus } from "./ChecksStatus";

const bt = { muted: "m", text: "t", border: "b", status: {} };

describe("ChecksStatus", () => {
    test("nothing before there's code", () => {
        const { container } = render(<ChecksStatus check={null} bt={bt} />);
        expect(container).toBeEmptyDOMElement();
    });

    test.each([
        [{ phase: "checking" }, /Checking the code/],
        [{ phase: "reviewing" }, /The Checker is reviewing it/],
        [
            { phase: "fixing", lines: ["a", "b"], fixes: 1 },
            /Fixing 2 problems · try 1 of 2/,
        ],
        [{ phase: "passed" }, /Checked/],
        [
            { phase: "passed", reviewSkipped: "the Checker is paused" },
            /Checked — the Checker's review was skipped: the Checker is paused/,
        ],
    ])("%o", (check, text) => {
        render(<ChecksStatus check={check} bt={bt} />);
        expect(screen.getByTestId("draft-check-status")).toHaveTextContent(
            text
        );
    });

    test("problems left: listed, with the Checker's answer behind a toggle, and no way to install", () => {
        render(
            <ChecksStatus
                check={{
                    phase: "failed",
                    lines: ["It doesn't build: Unexpected token"],
                    review: "The Checker said: VERDICT: FAILED",
                }}
                bt={bt}
            />
        );
        const status = screen.getByTestId("draft-check-status");
        expect(status).toHaveTextContent(/1 problem left/);
        expect(status).toHaveTextContent(/Unexpected token/);
        expect(status).toHaveTextContent(
            /Ask for changes in the chat, or save it as a draft/
        );
        expect(screen.queryByText(/The Checker said/)).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: "Show the Checker's answer" })
        );
        expect(screen.getByText(/The Checker said/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /anyway/i })).toBeNull();
    });

    test("while the AI is replying, that's what it says — whatever the last check was", () => {
        render(<ChecksStatus check={{ phase: "passed" }} waiting bt={bt} />);
        expect(screen.getByTestId("draft-check-status")).toHaveTextContent(
            /Waiting for the AI to finish/
        );
    });
});
