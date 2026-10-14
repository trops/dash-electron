/**
 * @jest-environment jsdom
 *
 * The dock's Bots panel (bot-teams TEAM-015): a frame around dash-core's
 * BotContacts, fed by useBotContacts and the dock's hand-off actions; the
 * rail's approvals count stays live while the panel is closed.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { BotActivityPanel } from "./BotActivityPanel";

jest.mock("@trops/dash-react", () => {
    const React = require("react");
    return {
        FontAwesomeIcon: () => null,
        ThemeContext: React.createContext({ currentTheme: {} }),
    };
});

const mockContacts = {
    loading: false,
    bots: [],
    approvals: [{ id: "a1" }, { id: "a2" }],
    running: [],
    lastRuns: {},
    paused: new Set(),
};
const mockCtx = {
    workspaceData: { id: 7, name: "Kitchen Sink" },
    workspaces: [{ id: 7, name: "Kitchen Sink" }],
    openBotsView: jest.fn(),
    openBotSettings: jest.fn(),
};
let mockProps = null;

jest.mock("@trops/dash-core", () => {
    const React = require("react");
    return {
        WorkspaceContext: React.createContext(null),
        useBotContacts: () => mockContacts,
        BotContacts: (props) => {
            mockProps = props;
            return React.createElement(
                "button",
                { "data-testid": "contacts", onClick: props.onCollapse },
                "contacts"
            );
        },
    };
});

const { WorkspaceContext } = require("@trops/dash-core");

function renderPanel(props) {
    return render(
        <WorkspaceContext.Provider value={mockCtx}>
            <BotActivityPanel {...props} />
        </WorkspaceContext.Provider>
    );
}

beforeEach(() => {
    mockProps = null;
});

test("expanded: renders the contacts with the dashboards and hand-off actions", () => {
    renderPanel({ collapsed: false });
    expect(screen.getByTestId("contacts")).toBeInTheDocument();
    expect(mockProps.contacts).toBe(mockContacts);
    expect(mockProps.workspaces).toBe(mockCtx.workspaces);
    expect(mockProps.onOpenBotsView).toBe(mockCtx.openBotsView);
    expect(mockProps.onOpenSettings).toBe(mockCtx.openBotSettings);
});

test("Collapse from the panel closes it", () => {
    const onCollapsedChange = jest.fn();
    renderPanel({ collapsed: false, onCollapsedChange });
    fireEvent.click(screen.getByTestId("contacts"));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
});

test("collapsed: renders nothing but keeps the badge count live", () => {
    const onApprovalsCount = jest.fn();
    const { container } = renderPanel({
        collapsed: true,
        onApprovalsCount,
    });
    expect(container).toBeEmptyDOMElement();
    expect(onApprovalsCount).toHaveBeenCalledWith(2);
});

test("works without the dock's context (no hand-off actions)", () => {
    render(<BotActivityPanel collapsed={false} />);
    expect(mockProps.onOpenBotsView).toBeNull();
    expect(mockProps.onOpenSettings).toBeNull();
});
