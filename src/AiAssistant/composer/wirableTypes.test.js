/**
 * @jest-environment jsdom
 *
 * Tests for useWirableTypes (Compose-mode wire picker source).
 *
 *   - emits credential types from PROVIDER_API_REGISTRY synchronously
 *     (status = loading initially with credentials populated, no
 *     wait for the async catalog)
 *   - appends MCP types from mainApi.mcp.getCatalog() once resolved
 *   - annotates each type with hasConfiguredInstance based on the
 *     providers map
 *   - error path: surfaces the MCP catalog failure but still keeps
 *     credential types visible
 *   - missing MCP bridge: still returns credential types, error
 *     populated
 */

import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import React from "react";
import { useWirableTypes } from "./wirableTypes";

function Probe({ providers, onState }) {
    const state = useWirableTypes(providers);
    React.useEffect(() => {
        onState(state);
    }, [state, onState]);
    return null;
}

function setMcpBridge(getCatalog) {
    if (!window.mainApi) window.mainApi = {};
    if (!window.mainApi.mcp) window.mainApi.mcp = {};
    window.mainApi.mcp.getCatalog = getCatalog;
}

afterEach(() => {
    if (window.mainApi) delete window.mainApi.mcp;
    delete window.mainApi;
});

describe("useWirableTypes", () => {
    test("yields credential types immediately, MCP types after catalog resolves", async () => {
        // Use a never-settling promise to capture the loading-with-
        // credentials state, then resolve manually so we also see
        // the final ok state.
        let resolveCatalog;
        const pending = new Promise((r) => {
            resolveCatalog = r;
        });
        setMcpBridge(jest.fn().mockReturnValue(pending));

        const states = [];
        await act(async () => {
            render(<Probe providers={{}} onState={(s) => states.push(s)} />);
        });
        // Loading state has credentials but not MCP types.
        const loading = states[states.length - 1];
        expect(loading.status).toBe("loading");
        expect(loading.types.map((t) => t.id)).toContain("algolia");
        expect(loading.types.map((t) => t.id)).not.toContain("gmail");

        await act(async () => {
            resolveCatalog({
                catalog: { servers: [{ id: "gmail", name: "Gmail" }] },
            });
        });
        // After resolution: both surfaces present.
        const final = states[states.length - 1];
        expect(final.status).toBe("ok");
        const ids = final.types.map((t) => t.id);
        expect(ids).toContain("algolia");
        expect(ids).toContain("gmail");
    });

    test("annotates configured instances on the matching type", async () => {
        setMcpBridge(jest.fn().mockResolvedValue({ catalog: { servers: [] } }));
        const states = [];
        await act(async () => {
            render(
                <Probe
                    providers={{
                        MyAlgolia: {
                            type: "algolia",
                            providerClass: "credential",
                        },
                    }}
                    onState={(s) => states.push(s)}
                />
            );
        });
        const final = states[states.length - 1];
        const algolia = final.types.find((t) => t.id === "algolia");
        expect(algolia.hasConfiguredInstance).toBe(true);
        expect(algolia.configuredInstances).toContain("MyAlgolia");
    });

    test("missing MCP bridge: credentials still surface, error populated", async () => {
        // No setMcpBridge call → bridge truly missing.
        const states = [];
        await act(async () => {
            render(<Probe providers={{}} onState={(s) => states.push(s)} />);
        });
        const final = states[states.length - 1];
        expect(final.types.map((t) => t.id)).toContain("algolia");
        expect(final.status).toBe("error");
        expect(final.error).toMatch(/MCP catalog bridge unavailable/);
    });
});
