/**
 * @jest-environment jsdom
 */
/**
 * ChatProviderGate question mode (create-entry PRD CRE-005 AC2, phase 2c-1).
 *
 * With the user's prompt from the Create screen, the gate reads as a
 * question: their prompt, "Which data should this widget use?", types
 * guessed from the prompt, "No external provider" and "Choose another…".
 * Without a prompt it's the full type list, as before.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock(
    "@trops/dash-core",
    () => ({ AppContext: require("react").createContext({}) }),
    { virtual: true }
);
jest.mock(
    "@trops/dash-react",
    () => ({
        Button3: ({ title, onClick }) => (
            <button onClick={onClick}>{title}</button>
        ),
        FontAwesomeIcon: () => null,
    }),
    { virtual: true }
);
jest.mock("./useBuilderTheme", () => ({
    useBuilderTheme: () => ({
        status: { warning: {} },
    }),
}));

import { AppContext } from "@trops/dash-core";
import { ChatProviderGate } from "./ChatProviderGate";

const CATALOG = [
    { id: "gmail", name: "gmail" },
    { id: "github", name: "github" },
    { id: "slack", name: "slack" },
];
const PROVIDERS = {
    "My Gmail": { name: "My Gmail", type: "gmail", providerClass: "mcp" },
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
        expect(
            screen.getByText("No github providers configured yet")
        ).toBeInTheDocument();
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
            screen.getByText("Choose a provider type for this widget")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "← Back to the question" })
        );
        expect(screen.getByTestId("provider-question")).toBeInTheDocument();
    });

    test("without a prompt it's the full list, as before", () => {
        setup();
        expect(screen.queryByTestId("provider-question")).toBeNull();
        expect(
            screen.getByText("Choose a provider type for this widget")
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /Back to the question/ })
        ).toBeNull();
    });
});
