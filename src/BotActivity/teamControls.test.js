/**
 * Bot Activity panel — bot teams (bot-teams PRD TEAM-001 AC5):
 *  - "+ New bot" opens the shared bot editor on the dashboard you're on
 *  - "This dashboard / All" narrows the bots you can run
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
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
        SegmentedControl: ({ options, value, onChange, ariaLabel }) =>
            React.createElement(
                "div",
                { "aria-label": ariaLabel },
                options.map((o) =>
                    React.createElement(
                        "button",
                        {
                            key: o.value,
                            "aria-pressed": o.value === value,
                            onClick: () => onChange(o.value),
                        },
                        o.label
                    )
                )
            ),
    };
});

jest.mock("@trops/dash-core", () => {
    const React = require("react");
    const norm = (id) =>
        id === undefined || id === null || id === "" ? null : String(id);
    return {
        WorkspaceContext: React.createContext({ workspaceData: null }),
        sameWorkspace: (a, b) => norm(a) === norm(b),
        BotEditorModal: ({ isOpen, workspaceId }) =>
            isOpen
                ? React.createElement(
                      "div",
                      { "data-testid": "bot-editor" },
                      `editor for ${
                          workspaceId === null ? "unassigned" : workspaceId
                      }`
                  )
                : null,
        TeamLeadSection: ({ workspace }) =>
            React.createElement(
                "div",
                { "data-testid": "lead-section" },
                `lead section for ${workspace && workspace.id}`
            ),
    };
});

const { WorkspaceContext } = require("@trops/dash-core");

const botList = [
    { id: "b1", name: "Inbox Watch", workspaceId: "7" },
    { id: "b2", name: "Sales Bot", workspaceId: "9" },
    { id: "b3", name: "Loose Bot", workspaceId: null },
];

function mount(context) {
    window.mainApi = {
        bots: {
            list: jest.fn().mockResolvedValue(botList),
            listApprovals: jest.fn().mockResolvedValue([]),
            onStream: jest.fn().mockReturnValue("s1"),
            onApprovalPending: jest.fn().mockReturnValue("a1"),
            removeListener: jest.fn(),
        },
    };
    const panel = <BotActivityPanel collapsed={false} />;
    render(
        context ? (
            <WorkspaceContext.Provider value={context}>
                {panel}
            </WorkspaceContext.Provider>
        ) : (
            panel
        )
    );
}

afterEach(() => {
    delete window.mainApi;
});

const kitchenSink = { id: 7, name: "Kitchen Sink" };
const runOptions = () =>
    Array.from(screen.getByLabelText("Bot to run").options).map(
        (o) => o.textContent
    );

test("+ New bot opens the editor on the current dashboard's team", async () => {
    mount({ workspaceData: kitchenSink, workspaces: [kitchenSink] });
    fireEvent.click(await screen.findByText("New bot"));
    expect(screen.getByTestId("bot-editor")).toHaveTextContent("editor for 7");
});

test("All lists every bot; This dashboard lists only its team", async () => {
    mount({ workspaceData: kitchenSink, workspaces: [kitchenSink] });
    await screen.findByText("Inbox Watch");
    // Default is All — existing unassigned bots never "disappear".
    expect(runOptions()).toEqual([
        "Select a bot…",
        "Inbox Watch",
        "Sales Bot",
        "Loose Bot",
    ]);
    fireEvent.click(screen.getByText("This dashboard"));
    expect(runOptions()).toEqual(["Select a bot…", "Inbox Watch"]);
});

test("with no dashboard open: no filter, and new bots are unassigned", async () => {
    mount(null);
    await screen.findByText("Inbox Watch");
    expect(screen.queryByText("This dashboard")).toBeNull();
    fireEvent.click(screen.getByText("New bot"));
    expect(screen.getByTestId("bot-editor")).toHaveTextContent(
        "editor for unassigned"
    );
});

// Team lead (bot-teams TEAM-002/003) — Ask the lead from the panel.
test("shows the current dashboard's team lead section", async () => {
    mount({ workspaceData: kitchenSink, workspaces: [kitchenSink] });
    expect(await screen.findByTestId("lead-section")).toHaveTextContent(
        "lead section for 7"
    );
});

test("no lead section when no dashboard is open", async () => {
    mount(null);
    await screen.findByText("Inbox Watch");
    expect(screen.queryByTestId("lead-section")).toBeNull();
});
