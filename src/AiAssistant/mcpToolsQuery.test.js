/**
 * @jest-environment jsdom
 *
 * Tests for mcpToolsQuery.
 *
 * Exercises fetchMcpTools (the imperative path) across:
 *   - missing serverName
 *   - missing bridge (no window.mainApi)
 *   - bridge returns { tools: [...] } (happy path)
 *   - bridge returns { error, message } (failed call)
 *   - bridge throws (transport rejection)
 *
 * And useMcpTools (the React hook) across:
 *   - idle when serverName is empty
 *   - loading → ok lifecycle on a fresh mount
 *   - cancellation when serverName changes mid-flight (stale result
 *     does not overwrite the new one)
 *
 * We mock window.mainApi.mcp.listTools directly per-test. The bridge
 * lives in preload.js and is exposed on window in the real app; in
 * jsdom we just assign.
 */
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { fetchMcpTools, useMcpTools } from "./mcpToolsQuery";

function setBridge(listTools) {
    if (!window.mainApi) window.mainApi = {};
    if (!window.mainApi.mcp) window.mainApi.mcp = {};
    window.mainApi.mcp.listTools = listTools;
}

function clearBridge() {
    if (window.mainApi && window.mainApi.mcp) {
        delete window.mainApi.mcp;
    }
    delete window.mainApi;
}

describe("fetchMcpTools", () => {
    afterEach(() => {
        clearBridge();
    });

    test("returns error when serverName is empty", async () => {
        const result = await fetchMcpTools("");
        expect(result.status).toBe("error");
        expect(result.tools).toEqual([]);
        expect(result.error).toMatch(/serverName/);
    });

    test("returns error when serverName is not a string", async () => {
        const result = await fetchMcpTools(null);
        expect(result.status).toBe("error");
        expect(result.tools).toEqual([]);
    });

    test("returns error when MCP bridge is unavailable", async () => {
        clearBridge();
        const result = await fetchMcpTools("filesystem");
        expect(result.status).toBe("error");
        expect(result.error).toMatch(/bridge unavailable/);
    });

    test("returns ok with normalized tools array on success", async () => {
        const tools = [
            { name: "read_file", description: "..." },
            { name: "write_file", description: "..." },
        ];
        setBridge(jest.fn().mockResolvedValue({ tools }));
        const result = await fetchMcpTools("filesystem", "ws-1");
        expect(result.status).toBe("ok");
        expect(result.tools).toEqual(tools);
        expect(result.error).toBeNull();
        expect(window.mainApi.mcp.listTools).toHaveBeenCalledWith(
            "filesystem",
            "ws-1"
        );
    });

    test("returns ok with empty array when bridge omits tools", async () => {
        setBridge(jest.fn().mockResolvedValue({}));
        const result = await fetchMcpTools("filesystem");
        expect(result.status).toBe("ok");
        expect(result.tools).toEqual([]);
    });

    test("returns error when bridge responds with { error, message }", async () => {
        setBridge(
            jest.fn().mockResolvedValue({
                error: "server-not-running",
                message: "Server 'filesystem' is not running",
            })
        );
        const result = await fetchMcpTools("filesystem");
        expect(result.status).toBe("error");
        expect(result.error).toBe("Server 'filesystem' is not running");
    });

    test("returns error when bridge rejects", async () => {
        setBridge(jest.fn().mockRejectedValue(new Error("ipc blew up")));
        const result = await fetchMcpTools("filesystem");
        expect(result.status).toBe("error");
        expect(result.error).toBe("ipc blew up");
    });
});

function HookProbe({ serverName, workspaceId }) {
    const state = useMcpTools(serverName, workspaceId);
    return (
        <div>
            <span data-testid="status">{state.status}</span>
            <span data-testid="count">{state.tools.length}</span>
            <span data-testid="error">{state.error || ""}</span>
        </div>
    );
}

describe("useMcpTools", () => {
    afterEach(() => {
        clearBridge();
    });

    test("idle when serverName is empty", () => {
        render(<HookProbe serverName="" workspaceId={null} />);
        expect(screen.getByTestId("status").textContent).toBe("idle");
        expect(screen.getByTestId("count").textContent).toBe("0");
    });

    test("loading → ok lifecycle on mount", async () => {
        let resolve;
        const pending = new Promise((r) => {
            resolve = r;
        });
        setBridge(jest.fn().mockReturnValue(pending));

        render(<HookProbe serverName="filesystem" workspaceId={null} />);
        expect(screen.getByTestId("status").textContent).toBe("loading");

        await act(async () => {
            resolve({ tools: [{ name: "read_file" }] });
        });

        expect(screen.getByTestId("status").textContent).toBe("ok");
        expect(screen.getByTestId("count").textContent).toBe("1");
    });

    test("drops stale response when serverName changes mid-flight", async () => {
        const resolvers = {};
        setBridge(
            jest.fn((serverName) => {
                return new Promise((resolve) => {
                    resolvers[serverName] = resolve;
                });
            })
        );

        const { rerender } = render(
            <HookProbe serverName="server-a" workspaceId={null} />
        );
        expect(screen.getByTestId("status").textContent).toBe("loading");

        rerender(<HookProbe serverName="server-b" workspaceId={null} />);
        expect(screen.getByTestId("status").textContent).toBe("loading");

        await act(async () => {
            // Stale response from server-a — should be dropped.
            resolvers["server-a"]({ tools: [{ name: "stale" }] });
        });
        expect(screen.getByTestId("status").textContent).toBe("loading");

        await act(async () => {
            resolvers["server-b"]({ tools: [{ name: "fresh" }] });
        });
        expect(screen.getByTestId("status").textContent).toBe("ok");
        expect(screen.getByTestId("count").textContent).toBe("1");
    });
});
