/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@trops/dash-core", () => ({
    runCostLabel: (run) => (run && run.model ? "Sonnet · 6.1k tokens" : ""),
}));

import { CheckerCard } from "./CheckerCard";

const bt = {
    muted: "m",
    text: "t",
    border: "b",
    raised: "r",
    hoverSurface: "h",
    primaryFill: "p",
    status: { success: { icon: "ok" }, error: { icon: "bad" } },
};

const done = (output) => ({
    phase: "done",
    run: { status: "completed", model: "claude-sonnet-4-6", output },
});

test("nothing before a check", () => {
    const { container } = render(<CheckerCard check={null} bt={bt} />);
    expect(container).toBeEmptyDOMElement();
});

test("checking shows what it says so far", () => {
    render(
        <CheckerCard
            check={{ phase: "checking", soFar: "PASS compiles" }}
            bt={bt}
        />
    );
    expect(screen.getByText("Checking the widget…")).toBeInTheDocument();
    expect(screen.getByText("PASS compiles")).toBeInTheDocument();
});

test("passed: the verdict and the run's model and tokens, no actions", () => {
    render(
        <CheckerCard check={done("PASS compiles\nVERDICT: PASSED")} bt={bt} />
    );
    expect(screen.getByTestId("checker-verdict")).toHaveTextContent("Passed");
    expect(screen.getByText("Sonnet · 6.1k tokens")).toBeInTheDocument();
    expect(screen.queryByText("Let Builder fix it")).toBeNull();
    // The report is collapsed until asked for.
    expect(screen.queryByTestId("checker-answer")).toBeNull();
    fireEvent.click(screen.getByText("Show what it checked"));
    expect(screen.getByTestId("checker-answer")).toHaveTextContent(
        "PASS compiles"
    );
});

test("failed: Let Builder fix it (1 of 2) and Keep it anyway", () => {
    const onFix = jest.fn();
    const onKeep = jest.fn();
    render(
        <CheckerCard
            check={done("FAIL code checks\nVERDICT: FAILED")}
            fixes={0}
            bt={bt}
            onFix={onFix}
            onKeep={onKeep}
        />
    );
    expect(screen.getByTestId("checker-verdict")).toHaveTextContent("Failed");
    expect(screen.getByText("fix 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Let Builder fix it"));
    expect(onFix).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep it anyway"));
    expect(onKeep).toHaveBeenCalled();
});

test("after two fixes it hands over to the user", () => {
    render(<CheckerCard check={done("VERDICT: FAILED")} fixes={2} bt={bt} />);
    expect(screen.queryByText("Let Builder fix it")).toBeNull();
    expect(screen.getByText(/Still failing after 2 fixes/)).toBeInTheDocument();
});

test("kept: no more actions", () => {
    render(<CheckerCard check={done("VERDICT: FAILED")} kept bt={bt} />);
    expect(screen.queryByText("Keep it anyway")).toBeNull();
});

test("a paused Checker says so", () => {
    render(
        <CheckerCard
            check={{ phase: "skipped", reason: "the Checker is paused" }}
            bt={bt}
        />
    );
    expect(
        screen.getByText(/Not checked — the Checker is paused/)
    ).toBeInTheDocument();
});
