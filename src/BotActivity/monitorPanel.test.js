/**
 * @jest-environment jsdom
 *
 * The dock's bot notifications (lead-workspace release 4): a frame around
 * dash-core's BotNotificationsPanel, kept mounted while closed so what needs
 * the user reaches the rail; the dock shows a dot, and opens the panel by
 * itself for something new — not for what was already there.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BotActivityPanel } from "./BotActivityPanel";
import { AssistantDock } from "../AssistantDock/AssistantDock";

jest.mock("@trops/dash-react", () => {
    const React = require("react");
    return {
        FontAwesomeIcon: () => null,
        ThemeContext: React.createContext({ currentTheme: {} }),
        useStatusTokens: () => ({ warning: { solidBg: "bg-amber" } }),
        ButtonIcon2: ({ ariaLabel, onClick, ariaPressed }) =>
            React.createElement(
                "button",
                {
                    "aria-label": ariaLabel,
                    "aria-pressed": ariaPressed,
                    onClick,
                },
                ariaLabel
            ),
    };
});

let mockProps = null;
jest.mock("@trops/dash-core", () => {
    const React = require("react");
    return {
        CreateDockPanel: () => null,
        BotNotificationsPanel: (props) => {
            mockProps = props;
            return props.collapsed
                ? null
                : React.createElement(
                      "button",
                      { "data-testid": "panel", onClick: props.onClose },
                      "panel"
                  );
        },
    };
});

beforeEach(() => {
    mockProps = null;
});

test("the frame hosts dash-core's panel; Close collapses it", () => {
    const onCollapsedChange = jest.fn();
    const onNeedsChange = jest.fn();
    render(
        <BotActivityPanel
            collapsed={false}
            onCollapsedChange={onCollapsedChange}
            onNeedsChange={onNeedsChange}
            openRequest={{ botId: "b1" }}
        />
    );
    expect(mockProps.onNeedsChange).toBe(onNeedsChange);
    expect(mockProps.openRequest).toEqual({ botId: "b1" });
    fireEvent.click(screen.getByTestId("panel"));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
});

test("closed, the panel stays mounted so the rail keeps hearing it", () => {
    render(<BotActivityPanel collapsed onNeedsChange={jest.fn()} />);
    expect(mockProps).not.toBeNull();
    expect(mockProps.collapsed).toBe(true);
    expect(screen.queryByTestId("panel")).toBeNull();
});

test("the dock: a dot while something needs you; the panel opens by itself only for something new (frame 27)", () => {
    const before = Date.now() - 60000;
    render(<AssistantDock />);
    expect(screen.queryByTestId("bot-notifications-dot")).toBeNull();
    // As the panel's lists load: nothing yet, then what was already there
    // — the dot, but no opening.
    act(() => mockProps.onNeedsChange({ count: 0, newestAt: 0 }));
    act(() => mockProps.onNeedsChange({ count: 1, newestAt: before }));
    act(() => mockProps.onNeedsChange({ count: 2, newestAt: before + 1 }));
    expect(screen.getByTestId("bot-notifications-dot")).toBeInTheDocument();
    expect(
        screen.getByRole("button", {
            name: "Bot notifications — 2 need you",
        })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("panel")).toBeNull();
    // Something new: it opens.
    const fresh = Date.now() + 1000;
    act(() => mockProps.onNeedsChange({ count: 3, newestAt: fresh }));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    // Closed again; the same items don't reopen it.
    fireEvent.click(screen.getByTestId("panel"));
    act(() => mockProps.onNeedsChange({ count: 3, newestAt: fresh }));
    expect(screen.queryByTestId("panel")).toBeNull();
    // All answered: no dot.
    act(() => mockProps.onNeedsChange({ count: 0, newestAt: 0 }));
    expect(screen.queryByTestId("bot-notifications-dot")).toBeNull();
});
