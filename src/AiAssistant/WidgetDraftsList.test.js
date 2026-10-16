/**
 * @jest-environment jsdom
 *
 * Drafts list summary — the first thing the USER asked for. The builder's
 * automatic greeting ("Hi, I'd like to build a new widget.") is sent as a
 * hidden user message, so it must be skipped.
 */
jest.mock("@trops/dash-react", () => require("./dashReactTestStub"));
jest.mock("./useBuilderTheme", () => require("./builderThemeStub"));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WidgetDraftsList, firstUserMessageExcerpt } from "./WidgetDraftsList";

describe("WidgetDraftsList", () => {
    const draft = {
        id: "d1",
        name: "Clock",
        updatedAt: Date.now(),
        packageDir: "/tmp/d1",
        chatHistory: [{ role: "user", content: "A clock" }],
    };
    let api;
    beforeEach(() => {
        api = {
            list: jest.fn().mockResolvedValue([draft]),
            delete: jest.fn().mockResolvedValue(true),
        };
        window.mainApi = { drafts: api };
    });
    afterEach(() => {
        delete window.mainApi;
    });

    it("shows an empty state when there are no drafts", async () => {
        api.list.mockResolvedValue([]);
        render(<WidgetDraftsList onStartNew={() => {}} />);
        expect(await screen.findByText("No drafts yet")).toBeInTheDocument();
    });

    it("lists drafts with Resume, and Build new widget starts one", async () => {
        const onResume = jest.fn();
        const onStartNew = jest.fn();
        render(
            <WidgetDraftsList onResume={onResume} onStartNew={onStartNew} />
        );
        expect(await screen.findByTestId("drafts-row")).toHaveTextContent(
            "Clock"
        );
        fireEvent.click(screen.getByTestId("drafts-resume"));
        expect(onResume).toHaveBeenCalledWith(draft);
        fireEvent.click(screen.getByTestId("drafts-start-new"));
        expect(onStartNew).toHaveBeenCalled();
    });

    it("asks before deleting a draft", async () => {
        render(<WidgetDraftsList onStartNew={() => {}} />);
        fireEvent.click(await screen.findByTestId("drafts-delete"));
        expect(screen.getByText("Delete?")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("drafts-delete-confirm"));
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith("d1"));
        // The list reloads after the delete.
        await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    });

    it("disables Open in editor until the draft has files", async () => {
        api.list.mockResolvedValue([{ ...draft, packageDir: null }]);
        render(<WidgetDraftsList onStartNew={() => {}} />);
        expect(await screen.findByTestId("drafts-open-editor")).toBeDisabled();
    });

    // Install gate (consolidation Phase 1a): a draft is installed from the
    // Widget Builder, after its checks — Resume, then Install there.
    it("has no Install — Resume is the way to install a draft", async () => {
        render(<WidgetDraftsList onStartNew={() => {}} />);
        expect(await screen.findByTestId("drafts-resume")).toBeInTheDocument();
        expect(screen.queryByTestId("drafts-install")).toBeNull();
    });
});

describe("firstUserMessageExcerpt", () => {
    it("skips the hidden greeting", () => {
        expect(
            firstUserMessageExcerpt([
                {
                    role: "user",
                    content: "Hi, I'd like to build a new widget.",
                    hidden: true,
                },
                { role: "assistant", content: "What should it show?" },
                { role: "user", content: "A clock and a counter" },
            ])
        ).toBe("A clock and a counter");
    });

    it("is empty when the user hasn't asked anything yet", () => {
        expect(
            firstUserMessageExcerpt([
                { role: "user", content: "Hi", hidden: true },
                { role: "assistant", content: "Hello" },
            ])
        ).toBe("");
    });

    it("shortens long requests", () => {
        const long = "x".repeat(200);
        const out = firstUserMessageExcerpt([{ role: "user", content: long }]);
        expect(out.length).toBe(108);
        expect(out.endsWith("…")).toBe(true);
    });
});
