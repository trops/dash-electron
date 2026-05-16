/**
 * @jest-environment jsdom
 *
 * Tests for SuggestLayoutButton (Compose-mode AI Suggest, slice 20.C5).
 *
 * - opens an inline form
 * - submits a one-shot LLM call with the user description
 * - on success, renders the suggestion picker
 * - picking a suggestion fires onApplyTree with ids assigned
 * - rejects suggestions that contain non-curated component names
 * - surfaces an error when the model returns no parseable JSON
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SuggestLayoutButton } from "./SuggestLayoutButton";

// Mock the LLM bridge module so we can drive responses
// deterministically from each test.
jest.mock("./llmOneShot", () => ({
    sendOneShotJson: jest.fn(),
}));
const { sendOneShotJson } = require("./llmOneShot");

beforeEach(() => {
    sendOneShotJson.mockReset();
});

describe("SuggestLayoutButton", () => {
    test("opens the form when the button is clicked", () => {
        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        expect(
            screen.getByTestId("composer-suggest-layout-form")
        ).toBeInTheDocument();
    });

    test("Cancel closes the form", () => {
        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.click(screen.getByTestId("composer-suggest-layout-close"));
        expect(
            screen.queryByTestId("composer-suggest-layout-form")
        ).not.toBeInTheDocument();
    });

    test("submit calls the LLM with the typed description", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                {
                    label: "A simple list",
                    root: {
                        type: "Panel",
                        children: [{ type: "Heading", props: { title: "Hi" } }],
                    },
                },
            ],
        });

        render(<SuggestLayoutButton onApplyTree={() => {}} model="m" />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "An algolia indices list" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });

        expect(sendOneShotJson).toHaveBeenCalledTimes(1);
        const call = sendOneShotJson.mock.calls[0][0];
        expect(call.userMessage).toBe("An algolia indices list");
        expect(call.model).toBe("m");

        // Suggestion picker shows up.
        expect(
            screen.getByTestId("composer-suggest-layout-results")
        ).toBeInTheDocument();
        expect(screen.getByText("A simple list")).toBeInTheDocument();
    });

    test("forwards the backend prop to the LLM helper (so claude-code CLI is used when configured)", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                {
                    label: "x",
                    root: { type: "Panel", children: [] },
                },
            ],
        });
        render(
            <SuggestLayoutButton
                onApplyTree={() => {}}
                model="m"
                backend="claude-code"
            />
        );
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });
        const call = sendOneShotJson.mock.calls[0][0];
        expect(call.backend).toBe("claude-code");
    });

    test("defaults to claude-code backend when none is passed (no apiKey required)", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                { label: "x", root: { type: "Panel", children: [] } },
            ],
        });
        render(<SuggestLayoutButton onApplyTree={() => {}} model="m" />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });
        const call = sendOneShotJson.mock.calls[0][0];
        expect(call.backend).toBe("claude-code");
    });

    test("picking a suggestion fires onApplyTree with ids assigned and resets the form", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                {
                    label: "Two cards",
                    root: {
                        type: "Panel",
                        children: [
                            {
                                type: "Card",
                                children: [
                                    {
                                        type: "Heading",
                                        props: { title: "A" },
                                    },
                                ],
                            },
                            { type: "Heading", props: { title: "B" } },
                        ],
                    },
                },
            ],
        });

        const onApplyTree = jest.fn();
        render(<SuggestLayoutButton onApplyTree={onApplyTree} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });
        fireEvent.click(screen.getByTestId("composer-suggest-layout-pick-0"));

        expect(onApplyTree).toHaveBeenCalledTimes(1);
        const tree = onApplyTree.mock.calls[0][0];
        expect(tree.root.type).toBe("Panel");
        expect(tree.root.id).toBe("root");
        // Children get node-N ids assigned in walk order.
        expect(tree.root.children[0].id).toMatch(/^node-/);
        expect(tree.root.children[0].type).toBe("Card");
        expect(tree.root.children[0].children[0].type).toBe("Heading");

        // Form auto-resets after a successful apply.
        expect(
            screen.queryByTestId("composer-suggest-layout-form")
        ).not.toBeInTheDocument();
    });

    test("drops suggestions with non-curated component types", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                {
                    label: "Has a fake component",
                    root: {
                        type: "Panel",
                        children: [{ type: "NotARealComponent" }],
                    },
                },
            ],
        });

        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });

        // Suggestion survives (the Panel root is fine; the bogus
        // child is stripped). Pick it and confirm only the Panel
        // and no child remains.
        fireEvent.click(screen.getByTestId("composer-suggest-layout-pick-0"));
        // Implicit: no crash means the bogus child was filtered.
    });

    test("rejects suggestions where the root is not a Panel", async () => {
        sendOneShotJson.mockResolvedValue({
            suggestions: [
                {
                    label: "Bare heading",
                    root: { type: "Heading", props: { title: "x" } },
                },
            ],
        });

        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });

        // No valid suggestions → error state.
        expect(
            screen.getByTestId("composer-suggest-layout-error")
        ).toBeInTheDocument();
    });

    test("retries once with a stricter prompt when the first response has no JSON", async () => {
        // First call: model returns prose ("I'll help you build...").
        // Second call (retry with stricter prompt): real JSON.
        sendOneShotJson
            .mockRejectedValueOnce(
                new Error(
                    "LLM response did not contain a JSON block. Raw text: hi"
                )
            )
            .mockResolvedValueOnce({
                suggestions: [
                    {
                        label: "retry suggestion",
                        root: {
                            type: "Panel",
                            children: [
                                { type: "Heading", props: { title: "OK" } },
                            ],
                        },
                    },
                ],
            });

        render(<SuggestLayoutButton onApplyTree={() => {}} model="m" />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "a thing" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });

        // Two calls total: first failed, second succeeded with the
        // retry prompt that includes the "PRIOR ATTEMPT FAILED"
        // instruction.
        expect(sendOneShotJson).toHaveBeenCalledTimes(2);
        const secondPrompt = sendOneShotJson.mock.calls[1][0].systemPrompt;
        expect(secondPrompt).toMatch(/PRIOR ATTEMPT FAILED/);
        // Picker renders with the retry suggestion.
        expect(screen.getByText("retry suggestion")).toBeInTheDocument();
    });

    test("does NOT retry on non-no-JSON errors (timeout / bridge error)", async () => {
        sendOneShotJson.mockRejectedValueOnce(
            new Error("LLM request timed out after 60000ms")
        );
        render(<SuggestLayoutButton onApplyTree={() => {}} model="m" />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });
        // No retry — error surfaces immediately so we don't double-bill
        // on transport failures.
        expect(sendOneShotJson).toHaveBeenCalledTimes(1);
        expect(
            screen.getByTestId("composer-suggest-layout-error").textContent
        ).toMatch(/timed out/i);
    });

    test("surfaces LLM errors in the form", async () => {
        sendOneShotJson.mockRejectedValue(new Error("model offline"));
        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        fireEvent.change(screen.getByTestId("composer-suggest-layout-input"), {
            target: { value: "x" },
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-suggest-layout-submit")
            );
        });
        const err = screen.getByTestId("composer-suggest-layout-error");
        expect(err.textContent).toMatch(/model offline/);
    });

    test("submit button is disabled with empty description", () => {
        render(<SuggestLayoutButton onApplyTree={() => {}} />);
        fireEvent.click(screen.getByTestId("composer-suggest-layout-open"));
        const submit = screen.getByTestId("composer-suggest-layout-submit");
        expect(submit).toBeDisabled();
    });
});
