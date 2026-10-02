/**
 * Bot Activity approval card — Allow once / Always allow / Deny.
 *
 * "Always allow" remembers the approval for this bot + provider + tool, so it
 * is offered only for PROVIDER tool requests (they carry a serverName).
 * Built-in agent tools (Bash, Write, …) have no provider and always ask.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BotActivityPanel } from "./BotActivityPanel";

jest.mock("@trops/dash-react", () => {
    const React = require("react");
    const Btn = ({ title, onClick, children, ariaLabel }) =>
        React.createElement(
            "button",
            { onClick, "aria-label": ariaLabel },
            children !== undefined ? children : title
        );
    return {
        Button: Btn,
        Button2: Btn,
        Button3: Btn,
        EmptyState: () => null,
        FontAwesomeIcon: () => null,
        SegmentedControl: () => null,
    };
});

// The panel's team controls come from dash-core (not under test here).
jest.mock("@trops/dash-core", () => {
    const React = require("react");
    return {
        WorkspaceContext: React.createContext({ workspaceData: null }),
        sameWorkspace: () => true,
        BotEditorModal: () => null,
    };
});

function mountWith(approvals) {
    const approve = jest.fn().mockResolvedValue({ ok: true });
    window.mainApi = {
        bots: {
            list: jest.fn().mockResolvedValue([]),
            listApprovals: jest.fn().mockResolvedValue(approvals),
            onStream: jest.fn().mockReturnValue("s1"),
            onApprovalPending: jest.fn().mockReturnValue("a1"),
            removeListener: jest.fn(),
            approve,
        },
    };
    render(<BotActivityPanel collapsed={false} />);
    return { approve };
}

afterEach(() => {
    delete window.mainApi;
});

const providerApproval = {
    id: "ap_1",
    request: {
        botId: "bot_1",
        serverName: "Gmail New",
        toolName: "search_emails",
        input: { q: "newer_than:1h" },
    },
};
const builtinApproval = {
    id: "ap_2",
    request: { botId: "bot_1", toolName: "Bash", input: { command: "ls" } },
};

test("provider tool request offers Allow once, Always allow and Deny", async () => {
    mountWith([providerApproval]);
    expect(await screen.findByText("Allow once")).toBeInTheDocument();
    expect(screen.getByText("Always allow")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
});

test("Always allow approves with remember:true", async () => {
    const { approve } = mountWith([providerApproval]);
    fireEvent.click(await screen.findByText("Always allow"));
    await waitFor(() =>
        expect(approve).toHaveBeenCalledWith("ap_1", {
            allow: true,
            remember: true,
        })
    );
});

test("Allow once approves without remembering", async () => {
    const { approve } = mountWith([providerApproval]);
    fireEvent.click(await screen.findByText("Allow once"));
    await waitFor(() =>
        expect(approve).toHaveBeenCalledWith("ap_1", { allow: true })
    );
});

test("Deny denies", async () => {
    const { approve } = mountWith([providerApproval]);
    fireEvent.click(await screen.findByText("Deny"));
    await waitFor(() =>
        expect(approve).toHaveBeenCalledWith("ap_1", { allow: false })
    );
});

test("built-in agent tools can't be remembered (no Always allow)", async () => {
    mountWith([builtinApproval]);
    expect(await screen.findByText("Allow once")).toBeInTheDocument();
    expect(screen.queryByText("Always allow")).toBeNull();
});
