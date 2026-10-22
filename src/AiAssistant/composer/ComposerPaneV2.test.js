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
// default transformIgnorePatterns. The shared stub renders plain
// elements (inputs, buttons) that carry the same test ids.
jest.mock("@trops/dash-react", () => require("../dashReactTestStub"));

jest.mock("../useBuilderTheme", () => require("../builderThemeStub"));
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

// The grid's name after the latest change (the placeholder name isn't shown
// in the field, so the bump is read from what the pane reports).
const lastName = (onChange) => {
    const calls = onChange.mock.calls;
    return calls.length ? calls[calls.length - 1][0]?.widgetName : undefined;
};

describe("ComposerPaneV2 — widget name collision avoidance", () => {
    test("default name is unchanged when nothing is installed", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
    });

    test("bumps to ComposedWidget2 when ComposedWidget is taken", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "ComposedWidget" }])
        );
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget2");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
    });

    test("skips names already used by drafts", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "ComposedWidget" }])
        );
        window.mainApi.drafts = {
            list: jest.fn().mockResolvedValue([
                { id: "d1", componentName: "ComposedWidget2" },
                { id: "d2", name: "ComposedWidget3" },
            ]),
        };
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget4");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
    });

    test("doesn't count the draft being resumed against itself", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "ComposedWidget" }])
        );
        window.mainApi.drafts = {
            list: jest
                .fn()
                .mockResolvedValue([
                    { id: "mine", componentName: "ComposedWidget2" },
                ]),
        };
        const onChange = jest.fn();
        render(<ComposerPaneV2 currentDraftId="mine" onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget2");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
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
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget4");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
    });

    test("collision check is case-insensitive", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "composedwidget" }])
        );
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget2");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
    });

    test("widgetPackage (@ai-built/<slug>) counts toward the taken set", async () => {
        installMainApi(
            jest
                .fn()
                .mockResolvedValue([
                    { widgetPackage: "@ai-built/composedwidget" },
                ])
        );
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await waitFor(() => {
            expect(lastName(onChange)).toBe("ComposedWidget2");
        });
        // The field shows only a name the user chose (frame B).
        expect(screen.getByTestId("composer-widget-name").value).toBe("");
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

describe("ComposerPaneV2 — Phase D providerChoice plumbing", () => {
    // Reach in to read the ComposerProviderChoiceContext from a child
    // mounted inside the same tree the pane provides. Avoids relying
    // on the QuickStartPane interaction path (which would need a
    // wirableTypes mock + intent/provider clicks) — this directly
    // exercises the context-provider wiring.
    const {
        useComposerProviderChoice,
    } = require("./ComposerProviderChoiceContext");

    function CapturingChild({ onCapture }) {
        const value = useComposerProviderChoice();
        // Effect — not render — so the capture happens once per real
        // commit, not on every render attempt.
        React.useEffect(() => {
            onCapture(value);
        }, [value, onCapture]);
        return null;
    }

    test("default context value is null when nothing has been picked", () => {
        // No pre-populated draft, no QuickStartPane interaction yet —
        // the context's initial value should be null so a downstream
        // consumer reads "no provider chosen".
        installMainApi(jest.fn().mockResolvedValue([]));
        // Render the pane and a child that reads the context. Use
        // the pane's `providers` prop with one entry so QuickStartPane
        // can render without crashing, but we don't trigger any
        // pick — we're checking the initial state.
        const captured = [];
        // We need a child INSIDE the pane's subtree to read context.
        // The easiest place is the pane's children prop — but
        // ComposerPaneV2 doesn't accept children. We render a
        // sibling-style test: just check the data-attribute on the
        // pane root, which mirrors the context value exactly.
        render(<ComposerPaneV2 />);
        const root = screen.getByTestId("composer-pane-v2");
        // data-last-provider-choice is empty string when null
        // (per the JSX attribute coercion). React renders absent or
        // empty for falsy strings — both forms acceptable.
        const attr = root.getAttribute("data-last-provider-choice");
        expect(attr === null || attr === "").toBe(true);
        // Touch the unused locals so eslint stays quiet about them
        // in environments where the helper-component import is
        // dropped by tree-shaking.
        void captured;
        void CapturingChild;
    });

    test("data-last-provider-choice is empty before any apply", () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        render(<ComposerPaneV2 />);
        const root = screen.getByTestId("composer-pane-v2");
        const attr = root.getAttribute("data-last-provider-choice");
        expect(attr === null || attr === "").toBe(true);
    });

    test("the context provider wraps the pane (smoke check via data attribute)", () => {
        // The data-last-provider-choice attribute is the externally
        // observable mirror of the context's current value. If the
        // Provider wrapping ever regresses to no-op, this attribute
        // also disappears — both signals stay in lockstep.
        installMainApi(jest.fn().mockResolvedValue([]));
        render(<ComposerPaneV2 />);
        const root = screen.getByTestId("composer-pane-v2");
        // Attribute exists (even if empty) — proves the JSX node is
        // the one wrapped by the Provider.
        expect(root.hasAttribute("data-last-provider-choice")).toBe(true);
    });
});

describe("ComposerPaneV2 — edit-mode guard (don't overwrite editContext.componentCode)", () => {
    // Regression bug: clicking "Edit with AI" on an installed
    // widget opened the modal in Compose mode by default. The
    // modal's own pre-load useEffect populated detectedCode with
    // the loaded source, but ComposerPaneV2's mount-time emit then
    // fired with an empty grid + bumped widget name (e.g.
    // "ComposedWidget6"), overwriting detectedCode with the
    // empty-grid placeholder code. The user saw a fresh
    // placeholder where their actual widget code should have
    // been. These tests pin the two guards that prevent that.

    test("auto-name bump skipped when editContext.componentCode is set", async () => {
        const getConfigs = jest
            .fn()
            .mockResolvedValue([{ componentName: "ComposedWidget" }]);
        installMainApi(getConfigs);
        render(
            <ComposerPaneV2
                editContext={{
                    componentCode: "export default function Foo(){}",
                    originalComponentName: "MyExistingWidget",
                }}
            />
        );
        const input = screen.getByTestId("composer-widget-name");
        // Wait long enough that the effect would have run if it
        // were going to. The name is seeded from the existing widget
        // (scope stripped) so an edit never reverts to "ComposedWidget";
        // the point here is the auto-bump didn't fire and rename it.
        await new Promise((r) => setTimeout(r, 0));
        expect(input.value).toBe("MyExistingWidget");
        // The bump effect should have early-returned before calling
        // the IPC.
        expect(getConfigs).not.toHaveBeenCalled();
    });

    test("auto-emit on mount skipped when editContext.componentCode is set AND grid is empty", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onEmit = jest.fn();
        render(
            <ComposerPaneV2
                editContext={{
                    componentCode: "export default function Foo(){}",
                }}
                onEmit={onEmit}
            />
        );
        // The default mount fires the sync effect once. Without the
        // guard, onEmit would be called with the empty-grid
        // placeholder code — which is exactly what was overwriting
        // detectedCode. With the guard, onEmit is NOT called for
        // the empty-grid mount.
        await new Promise((r) => setTimeout(r, 0));
        expect(onEmit).not.toHaveBeenCalled();
    });

    test("auto-emit DOES fire when no editContext (the original behavior is preserved)", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onEmit = jest.fn();
        render(<ComposerPaneV2 onEmit={onEmit} />);
        // Fresh build session — the mount emit IS expected. Without
        // it, the host's detectedCode wouldn't get the empty-grid
        // placeholder for the Code/Configure tabs.
        await waitFor(() => {
            expect(onEmit).toHaveBeenCalled();
        });
    });

    test("onChange still fires even when onEmit is suppressed (host needs grid state for draft persistence)", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onChange = jest.fn();
        const onEmit = jest.fn();
        render(
            <ComposerPaneV2
                editContext={{
                    componentCode: "export default function Foo(){}",
                }}
                onChange={onChange}
                onEmit={onEmit}
            />
        );
        // onChange fires regardless — it carries the grid object,
        // which the host's draft autosave needs. Only the code
        // emission is suppressed.
        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
        });
        expect(onEmit).not.toHaveBeenCalled();
    });
});

describe("ComposerPaneV2 — the name commits on Enter or leaving the field (Phase 4d)", () => {
    test("typing the name does NOT emit; leaving the field commits once", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onEmit = jest.fn();
        render(<ComposerPaneV2 onEmit={onEmit} />);
        const input = screen.getByTestId("composer-widget-name");
        // A new widget's field starts empty and asks for a name (frame B).
        expect(input.value).toBe("");
        await waitFor(() => expect(onEmit).toHaveBeenCalled());
        const afterMount = onEmit.mock.calls.length;

        // Typing only updates the local input — no emit (so no draft save
        // / folder write per keystroke).
        fireEvent.change(input, { target: { value: "MyCoolWidget" } });
        fireEvent.change(input, { target: { value: "MyCoolWidgetX" } });
        expect(onEmit.mock.calls.length).toBe(afterMount);

        // While it differs, a hint says how it's saved; no Save button.
        expect(
            screen.getByTestId("composer-widget-name-hint")
        ).toHaveTextContent("Saved when you press Enter or click away.");
        expect(
            screen.queryByTestId("composer-widget-name-save")
        ).not.toBeInTheDocument();

        // Leaving the field commits the name → exactly one more emit.
        fireEvent.blur(input);
        await waitFor(() =>
            expect(onEmit.mock.calls.length).toBe(afterMount + 1)
        );
        expect(input.value).toBe("MyCoolWidgetX");
        expect(
            screen.queryByTestId("composer-widget-name-hint")
        ).not.toBeInTheDocument();
    });

    test("Enter commits too; leaving an untouched empty field says nothing", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onEmit = jest.fn();
        render(<ComposerPaneV2 onEmit={onEmit} />);
        const input = screen.getByTestId("composer-widget-name");
        await waitFor(() => expect(onEmit).toHaveBeenCalled());
        fireEvent.blur(input);
        expect(
            screen.queryByTestId("composer-widget-name-error")
        ).not.toBeInTheDocument();
        const afterMount = onEmit.mock.calls.length;
        fireEvent.change(input, { target: { value: "OrderLookup" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() =>
            expect(onEmit.mock.calls.length).toBe(afterMount + 1)
        );
    });

    test("a name already taken shows why and isn't committed", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([{ componentName: "Taken" }])
        );
        const onEmit = jest.fn();
        render(<ComposerPaneV2 onEmit={onEmit} />);
        const input = screen.getByTestId("composer-widget-name");
        // A new widget's field starts empty and asks for a name (frame B).
        expect(input.value).toBe("");
        await waitFor(() => expect(onEmit).toHaveBeenCalled());
        const afterMount = onEmit.mock.calls.length;

        fireEvent.change(input, { target: { value: "Taken" } });
        fireEvent.blur(input);

        // Error shown, name NOT committed (no extra emit).
        await waitFor(() =>
            expect(
                screen.getByTestId("composer-widget-name-error")
            ).toBeInTheDocument()
        );
        expect(onEmit.mock.calls.length).toBe(afterMount);
    });

    test("edit mode locks the name — read-only, no Save button", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        render(
            <ComposerPaneV2
                editContext={{
                    componentCode: "export default function Foo(){}",
                }}
            />
        );
        const input = screen.getByTestId("composer-widget-name");
        expect(input).toBeDisabled();
        expect(
            screen.queryByTestId("composer-widget-name-save")
        ).not.toBeInTheDocument();
    });
});

describe("ComposerPaneV2 — review fixes (Phase 4d)", () => {
    test("the host hears while a typed name isn't committed", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        const onNamePendingChange = jest.fn();
        render(<ComposerPaneV2 onNamePendingChange={onNamePendingChange} />);
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "OrderLookup" } });
        await waitFor(() =>
            expect(onNamePendingChange).toHaveBeenLastCalledWith(true)
        );
        fireEvent.blur(input);
        await waitFor(() =>
            expect(onNamePendingChange).toHaveBeenLastCalledWith(false)
        );
    });

    test("Enter then a quick blur commits once", async () => {
        const getConfigs = jest.fn().mockResolvedValue([]);
        installMainApi(getConfigs);
        render(<ComposerPaneV2 />);
        await waitFor(() => expect(getConfigs).toHaveBeenCalled());
        const before = getConfigs.mock.calls.length;
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "OrderLookup" } });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.blur(input);
        await waitFor(() =>
            expect(
                screen.queryByTestId("composer-widget-name-hint")
            ).not.toBeInTheDocument()
        );
        expect(getConfigs.mock.calls.length).toBe(before + 1);
    });

    test("cleared and left: the name it has comes back", async () => {
        installMainApi(jest.fn().mockResolvedValue([]));
        render(<ComposerPaneV2 />);
        const input = screen.getByTestId("composer-widget-name");
        fireEvent.change(input, { target: { value: "OrderLookup" } });
        fireEvent.blur(input);
        await waitFor(() => expect(input.value).toBe("OrderLookup"));
        await waitFor(() =>
            expect(
                screen.queryByTestId("composer-widget-name-hint")
            ).not.toBeInTheDocument()
        );
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        expect(input.value).toBe("OrderLookup");
    });
});

describe("ComposerPaneV2 — the name field (consolidation Phase 3b)", () => {
    test("shows only a name the user chose — a placeholder name reads as empty", async () => {
        const { shownName } = require("./ComposerPaneV2");
        expect(shownName("ComposedWidget")).toBe("");
        expect(shownName("ComposedWidget12")).toBe("");
        expect(shownName("OrderLookup")).toBe("OrderLookup");
        expect(shownName("ComposedWidgetPro")).toBe("ComposedWidgetPro");
        expect(shownName(undefined)).toBe("");
    });
});

describe("ComposerPaneV2 — drafts (draft cleanup)", () => {
    test("components registered from draft folders don't count as taken", async () => {
        installMainApi(
            jest.fn().mockResolvedValue([
                {
                    componentName: "ComposedWidget",
                    widgetPackage: "@ai-built/draft-1782438308083-2ohecu",
                },
                {
                    componentName: "ComposedWidget2",
                    widgetPackage: "@ai-built/draft-1782438308083-2ohecu",
                },
            ])
        );
        const onChange = jest.fn();
        render(<ComposerPaneV2 onChange={onChange} />);
        await new Promise((r) => setTimeout(r, 20));
        expect(lastName(onChange)).toBe("ComposedWidget");
    });

    test("the empty placeholder is emitted marked empty", async () => {
        const onEmit = jest.fn();
        render(<ComposerPaneV2 onEmit={onEmit} />);
        await waitFor(() => expect(onEmit).toHaveBeenCalled());
        expect(onEmit.mock.calls[0][0].empty).toBe(true);
    });
});
