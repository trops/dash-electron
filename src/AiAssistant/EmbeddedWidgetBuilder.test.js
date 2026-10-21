/**
 * @jest-environment jsdom
 */
/**
 * The Widget Builder inside Create (create-entry PRD CRE-005 AC1, 2c-3):
 * remounts are held off while it's open, and an install is finished exactly once however the session
 * ends — Done inside the builder, Create's ← Back, or Create closing.
 */
import React from "react";
import { render, act } from "@testing-library/react";

let mockLastProps = null;
jest.mock("./WidgetBuilderModal", () => ({
    WidgetBuilderModal: (props) => {
        mockLastProps = props;
        return null;
    },
}));
jest.mock("./finalizeWidgetBuilderSession", () => {
    const actual = jest.requireActual("./finalizeWidgetBuilderSession");
    return { ...actual, finalizeWidgetBuilderSession: jest.fn() };
});

import { makeEmbeddedWidgetBuilder } from "./EmbeddedWidgetBuilder";
import {
    finalizeWidgetBuilderSession,
    resetWidgetBuilderSessionState,
    widgetBuilderBlocksRemount,
} from "./finalizeWidgetBuilderSession";

const registerBundle = jest.fn();
const EmbeddedWidgetBuilder = makeEmbeddedWidgetBuilder(registerBundle);

beforeEach(() => {
    mockLastProps = null;
    finalizeWidgetBuilderSession.mockClear();
    resetWidgetBuilderSessionState();
    window.mainApi = {};
});
afterEach(() => {
    delete window.mainApi;
});

const install = () =>
    act(() => {
        mockLastProps.onInstalled("ai-built.clock.Clock", "@ai-built/clock");
    });

describe("EmbeddedWidgetBuilder", () => {
    test("renders the builder embedded, no cell and no prompt (it has no AI)", () => {
        render(<EmbeddedWidgetBuilder />);
        expect(mockLastProps).toMatchObject({
            embedded: true,
            isOpen: true,
            resumeDraftId: null,
            cellContext: null,
            editContext: null,
        });
        expect(mockLastProps).not.toHaveProperty("initialPrompt");
    });

    test("a draft picked to continue is passed on", () => {
        render(<EmbeddedWidgetBuilder resumeDraftId="d1" />);
        expect(mockLastProps.resumeDraftId).toBe("d1");
    });

    test("holds off dashboard remounts while open", () => {
        const { unmount } = render(<EmbeddedWidgetBuilder />);
        expect(widgetBuilderBlocksRemount()).toBe(true);
        unmount();
        // Still blocked for a moment after it finishes.
        expect(widgetBuilderBlocksRemount()).toBe(true);
    });

    test("Done after an install finishes it once and closes Create", () => {
        const onClose = jest.fn();
        const { unmount } = render(<EmbeddedWidgetBuilder onClose={onClose} />);
        install();
        act(() => mockLastProps.setIsOpen(false));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledTimes(1);
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledWith({
            installed: {
                componentName: "ai-built.clock.Clock",
                scopedName: "@ai-built/clock",
            },
            cellContext: null,
            editContext: null,
            registerBundle,
        });
        // Create closing unmounts it — no second finish.
        unmount();
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledTimes(1);
    });

    test("Back or Create closing after an install still finishes it", () => {
        const { unmount } = render(<EmbeddedWidgetBuilder />);
        install();
        unmount();
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledTimes(1);
    });

    test("leaving without an install finishes nothing", () => {
        const onClose = jest.fn();
        const { unmount } = render(<EmbeddedWidgetBuilder onClose={onClose} />);
        act(() => mockLastProps.setIsOpen(false));
        unmount();
        expect(onClose).toHaveBeenCalled();
        expect(finalizeWidgetBuilderSession).not.toHaveBeenCalled();
    });

    test("under StrictMode (effects run twice) an install is still finished", () => {
        const onClose = jest.fn();
        render(
            <React.StrictMode>
                <EmbeddedWidgetBuilder onClose={onClose} />
            </React.StrictMode>
        );
        install();
        act(() => mockLastProps.setIsOpen(false));
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledTimes(1);
    });

    test("Create new provider closes Create (Settings opens on its own)", () => {
        const onClose = jest.fn();
        render(<EmbeddedWidgetBuilder onClose={onClose} />);
        install();
        act(() => {
            window.dispatchEvent(
                new CustomEvent("dash:open-settings-create-provider", {
                    detail: { type: "gmail" },
                })
            );
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(finalizeWidgetBuilderSession).toHaveBeenCalledTimes(1);
    });

    test("Create's leave guard reaches the builder (unsaved work asks before Back / Close)", () => {
        const setLeaveGuard = jest.fn();
        render(<EmbeddedWidgetBuilder setLeaveGuard={setLeaveGuard} />);
        expect(mockLastProps.setLeaveGuard).toBe(setLeaveGuard);
    });
});
