/**
 * @jest-environment jsdom
 */
/**
 * ChatProviderGate — the start of the Build chat.
 *
 *   - Start: no prompt yet → "Describe the widget you want" and the message
 *     box; sending hands the text to `onPrompt` (screen 3a, layout rule 16).
 *   - Question (create-entry PRD CRE-005 AC2): with a prompt, the gate reads
 *     as a question — their message, "Which data should this widget use?",
 *     types guessed from it, "No external provider" and "Choose another…".
 *   - List: every type as a row with a readable name and whether it's set
 *     up, with a filter.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock(
    "@trops/dash-core",
    () => ({
        AppContext: require("react").createContext({}),
        resolveIcon: (icon) => icon || "puzzle-piece",
    }),
    { virtual: true }
);
jest.mock(
    "@trops/dash-react",
    () => {
        const btn = ({ title, onClick, children }) => (
            <button onClick={onClick}>{children || title}</button>
        );
        return {
            Button: btn,
            Button2: btn,
            Button3: btn,
            FontAwesomeIcon: () => null,
            ChatMessage: ({ children }) => <div>{children}</div>,
            ChatComposer: ({
                value,
                onChange,
                onSend,
                ariaLabel,
                placeholder,
                disabled,
            }) => (
                <div>
                    <textarea
                        aria-label={ariaLabel || placeholder}
                        value={value}
                        disabled={disabled}
                        onChange={(e) => onChange && onChange(e.target.value)}
                    />
                    <button
                        onClick={() => onSend && onSend(value)}
                        disabled={disabled}
                    >
                        Send
                    </button>
                </div>
            ),
            EmptyState: ({ title, description, children }) => (
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    {children}
                </div>
            ),
            ListRow: ({ title, meta, onClick }) => (
                <button onClick={onClick}>
                    <span>{title}</span>
                    {meta ? <span>{meta}</span> : null}
                </button>
            ),
            PanelHeader: ({ title, onBack, backLabel }) => (
                <div>
                    {onBack ? (
                        <button onClick={onBack}>{backLabel}</button>
                    ) : null}
                    <span>{title}</span>
                </div>
            ),
            SearchInput: ({ value, onChange, ariaLabel }) => (
                <input
                    aria-label={ariaLabel}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            ),
        };
    },
    { virtual: true }
);
jest.mock("./useBuilderTheme", () => ({
    useBuilderTheme: () => ({
        status: { warning: {} },
    }),
}));

import { AppContext } from "@trops/dash-core";
import { ChatProviderGate, typeLabel, setupLine } from "./ChatProviderGate";

const CATALOG = [
    { id: "gmail", name: "gmail" },
    { id: "github", name: "github" },
    { id: "slack", name: "slack" },
    { id: "google-calendar", name: "Google Calendar", icon: "calendar-alt" },
];
const PROVIDERS = {
    "My Gmail": { name: "My Gmail", type: "gmail", providerClass: "mcp" },
    "Algolia Prod": { name: "Algolia Prod", type: "algolia" },
};

function setup(props = {}) {
    const onChange = jest.fn();
    render(
        <AppContext.Provider value={{ providers: PROVIDERS }}>
            <ChatProviderGate
                onChange={onChange}
                builtInCatalog={CATALOG}
                {...props}
            />
        </AppContext.Provider>
    );
    return { onChange };
}

describe("ChatProviderGate — start (message box first)", () => {
    test("asks for a description, and sending hands it to onPrompt", () => {
        const onPrompt = jest.fn();
        setup({ onPrompt });
        expect(screen.getByTestId("provider-start")).toBeInTheDocument();
        expect(
            screen.getByText("Describe the widget you want")
        ).toBeInTheDocument();
        fireEvent.change(
            screen.getByRole("textbox", { name: "Describe the widget" }),
            { target: { value: "  Count my unread email  " } }
        );
        fireEvent.click(screen.getByRole("button", { name: "Send" }));
        expect(onPrompt).toHaveBeenCalledWith("Count my unread email");
    });

    test("Pick the data first… opens the list, with a way back", () => {
        setup({ onPrompt: jest.fn() });
        fireEvent.click(
            screen.getByRole("button", { name: "Pick the data first…" })
        );
        expect(screen.getByTestId("provider-list")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByTestId("provider-start")).toBeInTheDocument();
    });
});

describe("ChatProviderGate — question mode", () => {
    test("shows the prompt, the question and a guess from it", () => {
        setup({ prompt: "Count my unread email" });
        expect(screen.getByTestId("provider-question")).toBeInTheDocument();
        expect(screen.getByText("Count my unread email")).toBeInTheDocument();
        expect(
            screen.getByText("Which data should this widget use?")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "gmail" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /slack/ })).toBeNull();
        // The message box stays at the bottom, waiting for the pick.
        expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
    });

    test("picking an installed guess answers with its type", () => {
        const { onChange } = setup({ prompt: "Count my unread email" });
        fireEvent.click(screen.getByRole("button", { name: "gmail" }));
        expect(onChange).toHaveBeenCalledWith({
            type: "gmail",
            providerClass: "mcp",
        });
    });

    test("a guess that isn't set up says so and asks before going on", () => {
        const { onChange } = setup({ prompt: "My open GitHub PRs" });
        fireEvent.click(
            screen.getByRole("button", { name: "github · not set up" })
        );
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText("github isn't set up yet")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
        expect(onChange).toHaveBeenCalledWith({
            type: "github",
            providerClass: "mcp",
        });
    });

    test("not set up keeps the conversation and the message box", () => {
        setup({ prompt: "My open GitHub PRs" });
        fireEvent.click(
            screen.getByRole("button", { name: "github · not set up" })
        );
        expect(screen.getByTestId("provider-setup")).toBeInTheDocument();
        expect(screen.getByText("My open GitHub PRs")).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
        fireEvent.click(
            screen.getByRole("button", { name: "Pick something else" })
        );
        expect(screen.getByTestId("provider-question")).toBeInTheDocument();
    });

    test("Set up dispatches the open-settings event for the type", () => {
        const seen = jest.fn();
        window.addEventListener("dash:open-settings-create-provider", (e) =>
            seen(e.detail)
        );
        setup({ prompt: "My open GitHub PRs" });
        fireEvent.click(
            screen.getByRole("button", { name: "github · not set up" })
        );
        fireEvent.click(screen.getByRole("button", { name: "Set up github" }));
        expect(seen).toHaveBeenCalledWith({
            type: "github",
            providerClass: "mcp",
        });
    });

    test("a description typed here can be edited; Create's can't", () => {
        const onPrompt = jest.fn();
        setup({ prompt: "A clock", onPrompt, canEditPrompt: true });
        fireEvent.click(
            screen.getByRole("button", { name: "Edit description" })
        );
        expect(onPrompt).toHaveBeenCalledWith(null);
    });

    test("Create's prompt has no Edit description", () => {
        setup({ prompt: "A clock", onPrompt: jest.fn() });
        expect(
            screen.queryByRole("button", { name: "Edit description" })
        ).toBeNull();
    });

    test("No external provider answers with the none sentinel", () => {
        const { onChange } = setup({ prompt: "A clock for Tokyo" });
        fireEvent.click(
            screen.getByRole("button", { name: "No external provider" })
        );
        expect(onChange).toHaveBeenCalledWith({ sentinel: "none" });
    });

    test("Choose another… opens the full list, with a way back", () => {
        setup({ prompt: "A clock for Tokyo" });
        fireEvent.click(
            screen.getByRole("button", { name: "Choose another…" })
        );
        expect(screen.queryByTestId("provider-question")).toBeNull();
        expect(
            screen.getByText("Choose the data for this widget")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "Back to the question" })
        );
        expect(screen.getByTestId("provider-question")).toBeInTheDocument();
    });
});

describe("ChatProviderGate — the list", () => {
    test("without a prompt or onPrompt it's the list, with no way back", () => {
        setup();
        expect(screen.getByTestId("provider-list")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Back/ })).toBeNull();
    });

    test("rows read as names with whether they're set up — no class pills", () => {
        setup();
        expect(screen.getByText("Google Calendar")).toBeInTheDocument();
        // An installed type with no catalog entry gets a readable name.
        expect(screen.getByText("Algolia")).toBeInTheDocument();
        expect(screen.getAllByText("Set up · 1 account")).toHaveLength(2);
        expect(screen.queryByText("mcp")).toBeNull();
        expect(screen.queryByText("credential")).toBeNull();
    });

    test("the filter narrows the rows", () => {
        setup();
        fireEvent.change(
            screen.getByRole("textbox", { name: "Filter data sources" }),
            { target: { value: "cal" } }
        );
        expect(screen.getByText("Google Calendar")).toBeInTheDocument();
        expect(screen.queryByText("github")).toBeNull();
        fireEvent.change(
            screen.getByRole("textbox", { name: "Filter data sources" }),
            { target: { value: "zzz" } }
        );
        expect(screen.getByText("Nothing matches “zzz”.")).toBeInTheDocument();
        // "No external provider" is always there.
        expect(screen.getByText("No external provider")).toBeInTheDocument();
    });

    test("typeLabel and setupLine", () => {
        expect(typeLabel("google-calendar")).toBe("Google Calendar");
        expect(typeLabel("web_fetch")).toBe("Web Fetch");
        expect(setupLine(0)).toBe("Not set up yet");
        expect(setupLine(2)).toBe("Set up · 2 accounts");
    });
});
