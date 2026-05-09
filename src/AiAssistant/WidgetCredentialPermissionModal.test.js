/**
 * @jest-environment jsdom
 *
 * Tests for the install-time permission modal (slice 17d.2).
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WidgetCredentialPermissionModal } from "./WidgetCredentialPermissionModal";

const sampleCalls = [
    { service: "algolia", method: "listIndices", line: 12 },
    { service: "algolia", method: "deleteRule", line: 33 },
    { service: "slack", method: "postMessage", line: 50 },
];

describe("WidgetCredentialPermissionModal — render", () => {
    test("renders nothing when isOpen is false", () => {
        const { container } = render(
            <WidgetCredentialPermissionModal
                isOpen={false}
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        expect(container.querySelector("[data-testid]")).toBeNull();
    });

    test("renders the package name and call list when open", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/algoliarulesmanager"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        expect(
            screen.getByText("@ai-built/algoliarulesmanager")
        ).toBeInTheDocument();
        expect(screen.getByText("algolia.listIndices()")).toBeInTheDocument();
        expect(screen.getByText("algolia.deleteRule()")).toBeInTheDocument();
        expect(screen.getByText("slack.postMessage()")).toBeInTheDocument();
    });

    test("groups methods under their provider", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        // Each provider header appears.
        expect(screen.getByText("algolia")).toBeInTheDocument();
        expect(screen.getByText("slack")).toBeInTheDocument();
    });

    test("starts with every checkbox UNCHECKED — explicit consent only", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        for (const c of sampleCalls) {
            const cb = screen.getByTestId(`grant-${c.service}-${c.method}`);
            expect(cb).not.toBeChecked();
        }
    });
});

describe("WidgetCredentialPermissionModal — interaction", () => {
    test("toggling a checkbox updates the granted count", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        // Initially "0 of 3 granted".
        expect(screen.getByText("0 of 3 granted")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("grant-algolia-listIndices"));
        expect(screen.getByText("1 of 3 granted")).toBeInTheDocument();
    });

    test("Grant all checks every method", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("grant-all"));
        for (const c of sampleCalls) {
            expect(
                screen.getByTestId(`grant-${c.service}-${c.method}`)
            ).toBeChecked();
        }
    });

    test("Grant none unchecks every method", () => {
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("grant-all"));
        fireEvent.click(screen.getByTestId("grant-none"));
        for (const c of sampleCalls) {
            expect(
                screen.getByTestId(`grant-${c.service}-${c.method}`)
            ).not.toBeChecked();
        }
    });

    test("clicking Confirm fires onConfirm with the chosen grants", () => {
        const onConfirm = jest.fn();
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={onConfirm}
                onCancel={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("grant-algolia-listIndices"));
        fireEvent.click(screen.getByTestId("grant-slack-postMessage"));
        fireEvent.click(screen.getByTestId("confirm-install"));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const grants = onConfirm.mock.calls[0][0];
        expect(grants.algolia.listIndices).toBe(true);
        expect(grants.algolia.deleteRule).toBe(false);
        expect(grants.slack.postMessage).toBe(true);
    });

    test("clicking Cancel fires onCancel", () => {
        const onCancel = jest.fn();
        render(
            <WidgetCredentialPermissionModal
                isOpen
                packageName="@ai-built/x"
                calls={sampleCalls}
                onConfirm={() => {}}
                onCancel={onCancel}
            />
        );
        fireEvent.click(screen.getByTestId("cancel-install"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});
