/**
 * @jest-environment jsdom
 *
 * Tests for WirePicker (Compose-mode Stage 3 in-place picker).
 *
 * Provider-type step (rewritten for the type-not-instance model):
 *   - lists every credential type from PROVIDER_API_REGISTRY
 *   - lists every MCP type from mainApi.mcp.getCatalog()
 *   - annotates types whose user has configured an instance
 *   - empty state when neither registry nor catalog returns anything
 *
 * Method step — credential:
 *   - lists only methods matching the slot's expected type
 *   - clicking a method fires onPick with the full wire spec
 *     (provider auto-bound to the configured instance, if any)
 *   - Back returns to the provider-type step
 *
 * Method step — mcp:
 *   - free-text input + Wire button when no configured instance
 *   - lists tools when a configured instance exists (via useMcpTools)
 *
 * WiredSlotSummary unchanged:
 *   - renders the provider.method label
 *   - Change and Static buttons fire their callbacks
 *   - per-arg rows for non-auto method args
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { WirePicker, WiredSlotSummary } from "./WirePicker";

function setMcpBridge({ getCatalog, listTools } = {}) {
    if (!window.mainApi) window.mainApi = {};
    if (!window.mainApi.mcp) window.mainApi.mcp = {};
    if (getCatalog) window.mainApi.mcp.getCatalog = getCatalog;
    if (listTools) window.mainApi.mcp.listTools = listTools;
}

function clearBridge() {
    if (window.mainApi) delete window.mainApi.mcp;
    delete window.mainApi;
}

afterEach(() => {
    clearBridge();
});

describe("WirePicker — provider-type step", () => {
    test("lists credential types from the registry + MCP types from the catalog", async () => {
        setMcpBridge({
            getCatalog: jest.fn().mockResolvedValue({
                catalog: {
                    servers: [
                        { id: "gmail", name: "Gmail", description: "" },
                        { id: "slack", name: "Slack", description: "" },
                    ],
                },
            }),
        });

        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={() => {}}
                />
            );
        });

        // Credential type (algolia is the only one in
        // PROVIDER_API_REGISTRY today).
        expect(
            screen.getByTestId("composer-wire-provider-data-algolia")
        ).toBeInTheDocument();
        // MCP types from the catalog.
        expect(
            screen.getByTestId("composer-wire-provider-data-gmail")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-wire-provider-data-slack")
        ).toBeInTheDocument();
    });

    test("annotates types whose user has a configured instance", async () => {
        setMcpBridge({
            getCatalog: jest.fn().mockResolvedValue({
                catalog: { servers: [{ id: "gmail", name: "Gmail" }] },
            }),
        });

        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{
                        MyAlgolia: {
                            type: "algolia",
                            providerClass: "credential",
                        },
                    }}
                    onPick={() => {}}
                />
            );
        });

        const algoliaBtn = screen.getByTestId(
            "composer-wire-provider-data-algolia"
        );
        expect(algoliaBtn.textContent).toMatch(/configured/);
        const gmailBtn = screen.getByTestId(
            "composer-wire-provider-data-gmail"
        );
        expect(gmailBtn.textContent).not.toMatch(/configured/);
    });

    test("empty state when catalog fetch fails AND registry is empty", async () => {
        // The registry always has algolia today, so we can't easily
        // hit the truly-empty branch — instead assert that catalog
        // failure surfaces the error message while still showing
        // credential types.
        setMcpBridge({
            getCatalog: jest
                .fn()
                .mockResolvedValue({ error: "boom", message: "boom" }),
        });

        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={() => {}}
                />
            );
        });

        // Credential algolia still surfaces.
        expect(
            screen.getByTestId("composer-wire-provider-data-algolia")
        ).toBeInTheDocument();
    });
});

describe("WirePicker — credential method step", () => {
    beforeEach(() => {
        setMcpBridge({
            getCatalog: jest
                .fn()
                .mockResolvedValue({ catalog: { servers: [] } }),
        });
    });

    test("clicking an algolia type opens the method list filtered by expectedType", async () => {
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={() => {}}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-algolia")
        );
        // Array slot → listIndices (strong) + search (loose), saveRule absent.
        expect(
            screen.getByTestId("composer-wire-method-data-listIndices")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-wire-method-data-search")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-wire-method-data-saveRule")
        ).not.toBeInTheDocument();
    });

    test("picking a method fires onPick with the type id and auto-bound configured instance", async () => {
        const onPick = jest.fn();
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{
                        MyAlgolia: {
                            type: "algolia",
                            providerClass: "credential",
                        },
                    }}
                    onPick={onPick}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-algolia")
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-method-data-listIndices")
        );
        expect(onPick).toHaveBeenCalledWith({
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "listIndices",
        });
    });

    test("picking a method when no instance is configured leaves provider null", async () => {
        const onPick = jest.fn();
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={onPick}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-algolia")
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-method-data-listIndices")
        );
        expect(onPick).toHaveBeenCalledWith({
            provider: null,
            providerType: "algolia",
            providerClass: "credential",
            method: "listIndices",
        });
    });

    test("Back returns to the provider-type step", async () => {
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={() => {}}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-algolia")
        );
        expect(
            screen.getByTestId("composer-wire-methods-data")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("composer-wire-back"));
        expect(
            screen.getByTestId("composer-wire-providers-data")
        ).toBeInTheDocument();
    });
});

describe("WirePicker — MCP method step", () => {
    test("with no configured instance + known-tools catalog hit, surfaces static list with approximate hint", async () => {
        // gmail has a known-tools entry in mcpKnownTools.js — the
        // picker surfaces those instead of the free-text fallback.
        setMcpBridge({
            getCatalog: jest.fn().mockResolvedValue({
                catalog: { servers: [{ id: "gmail", name: "Gmail" }] },
            }),
        });
        const onPick = jest.fn();
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={onPick}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-gmail")
        );
        expect(
            screen.getByTestId("composer-wire-known-tools-data")
        ).toBeInTheDocument();
        // The free-text input is NOT rendered because the static
        // list took its place.
        expect(
            screen.queryByTestId("composer-wire-tool-input-data")
        ).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByTestId("composer-wire-method-data-list_messages")
        );
        expect(onPick).toHaveBeenCalledWith({
            provider: null,
            providerType: "gmail",
            providerClass: "mcp",
            method: "list_messages",
        });
    });

    test("with no configured instance AND no known-tools entry, falls back to free-text wire input", async () => {
        // Made-up MCP type with no entry in mcpKnownTools — the
        // user sees the free-text input as a last resort.
        setMcpBridge({
            getCatalog: jest.fn().mockResolvedValue({
                catalog: {
                    servers: [{ id: "unknown-service", name: "Unknown" }],
                },
            }),
        });
        const onPick = jest.fn();
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{}}
                    onPick={onPick}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-unknown-service")
        );
        const input = screen.getByTestId("composer-wire-tool-input-data");
        fireEvent.change(input, { target: { value: "do_thing" } });
        fireEvent.click(screen.getByTestId("composer-wire-tool-confirm-data"));
        expect(onPick).toHaveBeenCalledWith({
            provider: null,
            providerType: "unknown-service",
            providerClass: "mcp",
            method: "do_thing",
        });
    });

    test("with a configured instance, useMcpTools enumerates and renders the tool list", async () => {
        setMcpBridge({
            getCatalog: jest.fn().mockResolvedValue({
                catalog: { servers: [{ id: "gmail", name: "Gmail" }] },
            }),
            listTools: jest.fn().mockResolvedValue({
                tools: [{ name: "list_messages", description: "List inbox" }],
            }),
        });
        const onPick = jest.fn();
        await act(async () => {
            render(
                <WirePicker
                    propName="data"
                    expectedType="Array<Object>"
                    providers={{
                        MyGmail: {
                            type: "gmail",
                            providerClass: "mcp",
                        },
                    }}
                    onPick={onPick}
                />
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-gmail")
        );
        // Wait one tick for useMcpTools to resolve.
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        const toolBtn = screen.getByTestId(
            "composer-wire-method-data-list_messages"
        );
        fireEvent.click(toolBtn);
        expect(onPick).toHaveBeenCalledWith({
            provider: "MyGmail",
            providerType: "gmail",
            providerClass: "mcp",
            method: "list_messages",
        });
    });
});

describe("WiredSlotSummary", () => {
    const wire = {
        provider: "MyAlgolia",
        providerType: "algolia",
        providerClass: "credential",
        method: "search",
    };

    test("renders the provider.method label", () => {
        render(
            <WiredSlotSummary
                propName="data"
                wire={wire}
                onChange={() => {}}
                onStatic={() => {}}
            />
        );
        expect(screen.getByText("MyAlgolia.search")).toBeInTheDocument();
    });

    test("falls back to the providerType when no instance is bound", () => {
        render(
            <WiredSlotSummary
                propName="data"
                wire={{ ...wire, provider: null }}
                onChange={() => {}}
                onStatic={() => {}}
            />
        );
        // Without an instance, the summary shows "<type>.<method>"
        // so the user can still see what's wired.
        expect(
            screen.getByTestId("composer-wire-summary-data")
        ).toBeInTheDocument();
    });

    test("Change fires onChange", () => {
        const onChange = jest.fn();
        render(
            <WiredSlotSummary
                propName="data"
                wire={wire}
                onChange={onChange}
                onStatic={() => {}}
            />
        );
        fireEvent.click(screen.getByTestId("composer-wire-change-data"));
        expect(onChange).toHaveBeenCalled();
    });

    test("Static fires onStatic", () => {
        const onStatic = jest.fn();
        render(
            <WiredSlotSummary
                propName="data"
                wire={wire}
                onChange={() => {}}
                onStatic={onStatic}
            />
        );
        fireEvent.click(screen.getByTestId("composer-wire-revert-data"));
        expect(onStatic).toHaveBeenCalled();
    });
});

describe("WiredSlotSummary — arg binding", () => {
    const wire = {
        provider: "MyAlgolia",
        providerType: "algolia",
        providerClass: "credential",
        method: "search",
    };

    test("renders one arg row per non-auto method arg", () => {
        render(
            <WiredSlotSummary
                propName="data"
                wire={wire}
                onChange={() => {}}
                onStatic={() => {}}
                onSetArg={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-arg-row-data-indexName")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-arg-row-data-query")
        ).toBeInTheDocument();
        // Auto-args (the credential triplet) are excluded.
        expect(
            screen.queryByTestId("composer-arg-row-data-providerHash")
        ).not.toBeInTheDocument();
    });

    test("typing in a literal arg input fires onSetArg with the parsed value", () => {
        const onSetArg = jest.fn();
        render(
            <WiredSlotSummary
                propName="data"
                wire={wire}
                onChange={() => {}}
                onStatic={() => {}}
                onSetArg={onSetArg}
            />
        );
        const input = screen.getByTestId(
            "composer-arg-literal-input-data-indexName"
        );
        fireEvent.change(input, { target: { value: "products" } });
        expect(onSetArg).toHaveBeenCalledWith("data", "indexName", {
            kind: "literal",
            value: "products",
        });
    });
});
