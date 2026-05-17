/**
 * @jest-environment jsdom
 *
 * Pins ComposerPaneV2's on-mount widget-name collision-avoidance.
 *
 * The V1 ComposerPane had this; V2 lost it during the fork, which
 * let a fresh widget default to "ComposedWidget" even when an
 * @ai-built/composedwidget was already installed — the install
 * pipeline keys on componentName, so a name collision silently
 * overwrote the previously-installed widget's code.
 *
 * The fix re-introduces the bump effect: on mount, ask the main
 * process which widgets are installed and bump the default to
 * "ComposedWidget2" / "...3" / etc. until unique. The bump respects
 * two guards:
 *   - `initialGrid` was passed (resuming a draft) — keep its name
 *   - user typed in the name input — don't fight their choice
 */

// @trops/dash-react ships ESM in dist/, which Jest can't parse via the
// default transformIgnorePatterns. The dash-react primitives used by
// PaletteView (MenuItem, ButtonIcon) only need to render *something*
// for this test — the assertions are on the widget-name input which
// lives in ComposerPaneV2 itself, not in the palette. A pair of
// pass-through stubs is enough.
jest.mock(
    "@trops/dash-react",
    () => ({
        MenuItem: ({ children, ...rest }) => (
            <button type="button" {...rest}>
                {children}
            </button>
        ),
        ButtonIcon: ({ ariaLabel, onClick }) => (
            <button type="button" aria-label={ariaLabel} onClick={onClick} />
        ),
    }),
    { virtual: false }
);

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ComposerPaneV2 } from "./ComposerPaneV2";

function installMainApi(getComponentConfigs) {
    window.mainApi = {
        widgets: {
            getComponentConfigs,
        },
    };
}

afterEach(() => {
    delete window.mainApi;
});

describe("ComposerPaneV2 — widget name collision avoidance", () => {
    test("default name is unchanged when nothing is installed", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        // Wait one tick so the on-mount async effect resolves.
        await waitFor(() => {
            expect(input.value).toBe("ComposedWidget");
        });
    });

    test("bumps to ComposedWidget2 when ComposedWidget is taken", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "ComposedWidget" }])
        );
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        await waitFor(() => {
            expect(input.value).toBe("ComposedWidget2");
        });
    });

    test("bumps past every taken suffix", async () => {
        installMainApi(
            jest
                .fn()
                .mockResolvedValue([
                    { componentName: "ComposedWidget" },
                    { componentName: "ComposedWidget2" },
                    { componentName: "ComposedWidget3" },
                ])
        );
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        await waitFor(() => {
            expect(input.value).toBe("ComposedWidget4");
        });
    });

    test("collision check is case-insensitive", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "composedwidget" }])
        );
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        await waitFor(() => {
            expect(input.value).toBe("ComposedWidget2");
        });
    });

    test("widgetPackage (@ai-built/<slug>) counts toward the taken set", async () => {
        installMainApi(
            jest
                .fn()
                .mockResolvedValue([
                    { widgetPackage: "@ai-built/composedwidget" },
                ])
        );
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        await waitFor(() => {
            expect(input.value).toBe("ComposedWidget2");
        });
    });

    test("user-typed name is not overwritten by the late-arriving bump", async () => {
        // Pending promise — the effect runs but the configs never
        // resolve before we type. When they resolve afterward, the
        // userRenamedRef gate should prevent the bump from clobbering
        // the typed value.
        let resolveConfigs;
        const pending = new Promise((r) => {
            resolveConfigs = r;
        });
        installMainApi(jest.fn().mockReturnValue(pending));
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "MyOwnName" } });
        expect(input.value).toBe("MyOwnName");
        resolveConfigs([{ componentName: "ComposedWidget" }]);
        // Give the effect a tick to complete; assert no bump.
        await new Promise((r) => setTimeout(r, 0));
        expect(input.value).toBe("MyOwnName");
    });

    test("initialGrid (draft resume) skips the bump entirely", async () => {
        const getConfigs = jest
            .fn()
            .mockResolvedValue([{ componentName: "ComposedWidget" }]);
        installMainApi(getConfigs);
        const draft = {
            widgetName: "MyDraftWidget",
            rootGridId: "grid-root",
            grids: {
                "grid-root": {
                    id: "grid-root",
                    rows: [{ cells: ["cell-1"] }],
                },
            },
            cells: { "cell-1": { id: "cell-1", kind: "empty" } },
            _nextCellId: 2,
        };
        render(<ComposerPaneV2 initialGrid={draft} />);
        const input = screen.getByTestId("composer-widget-name");
        // Wait long enough that the effect would have run if it were
        // going to. The input should still hold the draft's name.
        await new Promise((r) => setTimeout(r, 0));
        expect(input.value).toBe("MyDraftWidget");
        // Effect should have early-returned before calling the API.
        expect(getConfigs).not.toHaveBeenCalled();
    });

    test("widget name flows through to onChange after the bump", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "ComposedWidget" }])
        );
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            const last = onChange.mock.calls.find(
                ([g]) => g?.widgetName === "ComposedWidget2"
            );
            expect(last).toBeDefined();
        });
    });
});
