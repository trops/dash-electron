/**
 * @jest-environment jsdom
 */
/**
 * ChecksStatus — where the Widget Builder's checks stand, beside Install:
 * checking, the Checker reviewing, checked, or problems left (then
 * nothing can be installed — fix them in the Code tab or save a draft).
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
            /Fix it in the Code tab, or save it as a draft/
        );
        expect(screen.queryByText(/The Checker said/)).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: "Show the Checker's answer" })
        );
        expect(screen.getByText(/The Checker said/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /anyway/i })).toBeNull();
    });

    // Install gate (consolidation Phase 1a): a check that couldn't run
    // isn't a pass — it can be run again.
    test("a check that couldn't run offers Check again", () => {
        const onRetry = jest.fn();
        render(
            <ChecksStatus
                check={{
                    phase: "failed",
                    lines: ["The Checker couldn't run (no answer)."],
                    canRetry: true,
                }}
                bt={bt}
                onRetry={onRetry}
            />
        );
        expect(screen.getByTestId("draft-check-status")).toHaveTextContent(
            /Not ready to install/
        );
        fireEvent.click(screen.getByRole("button", { name: "Check again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test("problems in the code don't offer Check again — they need changes", () => {
        render(
            <ChecksStatus
                check={{ phase: "failed", lines: ["x"] }}
                bt={bt}
                onRetry={() => {}}
            />
        );
        expect(
            screen.queryByRole("button", { name: "Check again" })
        ).toBeNull();
    });
});
