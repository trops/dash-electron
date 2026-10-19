/**
 * @jest-environment jsdom
 *
 * The dock's Bots panel (bot-teams TEAM-015): a frame around dash-core's
 * BotContacts, fed by useBotContacts and the dashboards list; the rail's
 * approvals count stays live while the panel is closed.
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

test("expanded: renders the contacts with the dashboards", () => {
    renderPanel({ collapsed: false, openRequest: { botId: "b1" } });
    expect(screen.getByTestId("contacts")).toBeInTheDocument();
    expect(mockProps.contacts).toBe(mockContacts);
    expect(mockProps.workspaces).toBe(mockCtx.workspaces);
    expect(mockProps.openRequest).toEqual({ botId: "b1" });
    // A bot opens its page in the app's modal (dash-core NAV-016 AC5).
    expect(mockProps.onOpenBotsView).toBeUndefined();
    expect(mockProps.onOpenSettings).toBeUndefined();
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

test("works without the dock's context", () => {
    render(<BotActivityPanel collapsed={false} />);
    expect(mockProps.workspaces).toEqual([]);
});
