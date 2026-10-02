/**
 * Bot Activity panel = the Bot monitor (bot-teams TEAM-011 B3): the panel is
 * a frame around dash-core's BotMonitor, fed by useBotMonitor and the dock's
 * hand-off actions. The run form, live feed and lead chat moved to the
 * Bots view.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BotActivityPanel } from "./BotActivityPanel";

jest.mock("@trops/dash-react", () => {
    const React = require("react");
    return {
        FontAwesomeIcon: () => null,
        ThemeContext: React.createContext({ currentTheme: {} }),
    };
});

const mockMonitor = {
    loading: false,
    approvals: [{ id: "a1" }, { id: "a2" }],
    running: [],
    recent: [],
};
const mockCtx = {
    workspaceData: { id: 7, name: "Kitchen Sink" },
    workspaces: [{ id: 7, name: "Kitchen Sink" }],
    openBotsView: jest.fn(),
    openBotSettings: jest.fn(),
};
let mockMonitorProps = null;

jest.mock("@trops/dash-core", () => {
    const React = require("react");
    return {
        WorkspaceContext: React.createContext(null),
        useBotMonitor: () => mockMonitor,
        BotMonitor: (props) => {
            mockMonitorProps = props;
            return React.createElement("div", { "data-testid": "monitor" });
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
    mockMonitorProps = null;
});

test("expanded: renders the monitor with the dashboards and hand-off actions", () => {
    renderPanel({ collapsed: false });
    expect(screen.getByTestId("monitor")).toBeInTheDocument();
    expect(mockMonitorProps.monitor).toBe(mockMonitor);
    expect(mockMonitorProps.workspaces).toBe(mockCtx.workspaces);
    expect(mockMonitorProps.onOpenBotsView).toBe(mockCtx.openBotsView);
    expect(mockMonitorProps.onOpenSettings).toBe(mockCtx.openBotSettings);
});

test("no run form or lead chat any more", () => {
    renderPanel({ collapsed: false });
    expect(screen.queryByText(/Run a bot/)).toBeNull();
    expect(screen.queryByLabelText("Bot to run")).toBeNull();
    expect(screen.queryByText(/Ask the lead/)).toBeNull();
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
    expect(mockMonitorProps.onOpenBotsView).toBeNull();
    expect(mockMonitorProps.onOpenSettings).toBeNull();
});
