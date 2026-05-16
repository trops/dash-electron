/**
 * @jest-environment jsdom
 *
 * Tests for WirePicker (Compose-mode Stage 3 in-place picker).
 *
 * Provider step:
 *   - lists every wirable provider (credential w/ registry entry,
 *     mcp regardless)
 *   - skips credential providers with no registry entry
 *   - empty state when none configured
 *
 * Method step — credential:
 *   - lists only methods matching the slot's expected type
 *     (filtered via scoreMethodList)
 *   - clicking a method fires onPick with the full wire spec
 *   - Back returns to the provider step
 *
 * Method step — mcp:
 *   - shows loading state while tools are fetched
 *   - lists tools once loaded
 *   - error state on bridge failure
 *
 * WiredSlotSummary:
 *   - renders the provider.method label
 *   - Change and Static buttons fire their callbacks
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { WirePicker, WiredSlotSummary } from "./WirePicker";

function setMcpBridge(impl) {
    if (!window.mainApi) window.mainApi = {};
    if (!window.mainApi.mcp) window.mainApi.mcp = {};
    window.mainApi.mcp.listTools = impl;
}

function clearMcpBridge() {
    if (window.mainApi) delete window.mainApi.mcp;
    delete window.mainApi;
}

describe("WirePicker — provider step", () => {
    test("lists every credential provider with a registry entry + every mcp provider", () => {
        const providers = {
            MyAlgolia: { type: "algolia", providerClass: "credential" },
            UnknownCredential: {
                type: "not-a-real-type",
                providerClass: "credential",
            },
            MyFilesystem: { type: "filesystem", providerClass: "mcp" },
        };
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-wire-provider-data-MyAlgolia")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-wire-provider-data-MyFilesystem")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId(
                "composer-wire-provider-data-UnknownCredential"
            )
        ).not.toBeInTheDocument();
    });

    test("empty state when no providers are configured", () => {
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={{}}
                onPick={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-wire-empty-data")
        ).toBeInTheDocument();
    });
});

describe("WirePicker — credential method step", () => {
    const providers = {
        MyAlgolia: { type: "algolia", providerClass: "credential" },
    };

    test("filters methods to Array-returning candidates for an Array slot", () => {
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={() => {}}
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-MyAlgolia")
        );
        // listIndices returns Array → present.
        // search returns {hits: Array<...>} → present (loose match).
        // saveRule returns {taskID, objectID} → absent.
        expect(
            screen.getByTestId("composer-wire-method-data-listIndices")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-wire-method-data-search")
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-wire-method-data-saveRule")
        ).not.toBeInTheDocument();
        // setSettings (void) should never appear.
        expect(
            screen.queryByTestId("composer-wire-method-data-setSettings")
        ).not.toBeInTheDocument();
    });

    test("clicking a method fires onPick with a full wire spec", () => {
        const onPick = jest.fn();
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={onPick}
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-MyAlgolia")
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

    test("Back returns to provider step", () => {
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={() => {}}
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-MyAlgolia")
        );
        expect(
            screen.getByTestId("composer-wire-methods-data")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("composer-wire-back"));
        expect(
            screen.getByTestId("composer-wire-providers-data")
        ).toBeInTheDocument();
    });

    test("empty state when no methods match the slot type", () => {
        // Setting expectedType to a scalar that nothing in the
        // algolia registry returns.
        render(
            <WirePicker
                propName="x"
                expectedType="boolean"
                providers={providers}
                onPick={() => {}}
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-x-MyAlgolia")
        );
        expect(
            screen.getByText(/No methods on this provider/i)
        ).toBeInTheDocument();
    });
});

describe("WirePicker — MCP method step", () => {
    const providers = {
        MyFilesystem: {
            type: "filesystem",
            providerClass: "mcp",
            serverName: "filesystem",
        },
    };

    afterEach(() => {
        clearMcpBridge();
    });

    test("shows loading and then renders the tool list", async () => {
        let resolve;
        const pending = new Promise((r) => {
            resolve = r;
        });
        setMcpBridge(jest.fn().mockReturnValue(pending));

        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={() => {}}
            />
        );
        fireEvent.click(
            screen.getByTestId("composer-wire-provider-data-MyFilesystem")
        );
        expect(screen.getByText(/Loading tools/)).toBeInTheDocument();

        await act(async () => {
            resolve({
                tools: [
                    { name: "read_file", description: "Read a file" },
                    { name: "write_file", description: "Write a file" },
                ],
            });
        });

        expect(
            screen.getByTestId("composer-wire-method-data-read_file")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-wire-method-data-write_file")
        ).toBeInTheDocument();
    });

    test("error state surfaces the bridge error", async () => {
        setMcpBridge(
            jest.fn().mockResolvedValue({
                error: "server-not-running",
                message: "Server filesystem is not running",
            })
        );
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={() => {}}
            />
        );
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-wire-provider-data-MyFilesystem")
            );
        });
        expect(
            screen.getByText(/Server filesystem is not running/)
        ).toBeInTheDocument();
    });

    test("picking an MCP tool fires onPick with providerClass='mcp'", async () => {
        setMcpBridge(
            jest.fn().mockResolvedValue({ tools: [{ name: "read_file" }] })
        );
        const onPick = jest.fn();
        render(
            <WirePicker
                propName="data"
                expectedType="Array<Object>"
                providers={providers}
                onPick={onPick}
            />
        );
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("composer-wire-provider-data-MyFilesystem")
            );
        });
        fireEvent.click(
            screen.getByTestId("composer-wire-method-data-read_file")
        );
        expect(onPick).toHaveBeenCalledWith({
            provider: "MyFilesystem",
            providerType: "filesystem",
            providerClass: "mcp",
            method: "read_file",
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

describe("WiredSlotSummary — arg binding (C4)", () => {
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
        // algolia.search args minus the credential triplet:
        // indexName, query, options.
        expect(
            screen.getByTestId("composer-arg-row-data-indexName")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-arg-row-data-query")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("composer-arg-row-data-options")
        ).toBeInTheDocument();
        // Auto args are NOT surfaced.
        expect(
            screen.queryByTestId("composer-arg-row-data-providerHash")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-arg-row-data-dashboardAppId")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("composer-arg-row-data-providerName")
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

    test("switching an arg to userConfig fires onSetArg with the kind change", () => {
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
        fireEvent.click(
            screen.getByTestId("composer-arg-kind-userConfig-data-query")
        );
        expect(onSetArg).toHaveBeenCalledWith("data", "query", {
            kind: "userConfig",
            field: "query",
        });
    });

    test("userConfig field name input fires onSetArg with the typed name", () => {
        const onSetArg = jest.fn();
        const wireWithUserConfig = {
            ...wire,
            args: {
                query: { kind: "userConfig", field: "query" },
            },
        };
        render(
            <WiredSlotSummary
                propName="data"
                wire={wireWithUserConfig}
                onChange={() => {}}
                onStatic={() => {}}
                onSetArg={onSetArg}
            />
        );
        const input = screen.getByTestId(
            "composer-arg-userconfig-input-data-query"
        );
        fireEvent.change(input, { target: { value: "searchTerm" } });
        expect(onSetArg).toHaveBeenCalledWith("data", "query", {
            kind: "userConfig",
            field: "searchTerm",
        });
    });

    test("MCP wires only surface args the user has already bound (no schema)", () => {
        const mcpWire = {
            provider: "MyFs",
            providerType: "filesystem",
            providerClass: "mcp",
            method: "read_file",
            args: {
                path: { kind: "literal", value: "/tmp/x" },
            },
        };
        render(
            <WiredSlotSummary
                propName="data"
                wire={mcpWire}
                onChange={() => {}}
                onStatic={() => {}}
                onSetArg={() => {}}
            />
        );
        expect(
            screen.getByTestId("composer-arg-row-data-path")
        ).toBeInTheDocument();
    });
});
