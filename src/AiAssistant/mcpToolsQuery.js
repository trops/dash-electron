/**
 * MCP tools query — composer-facing wrapper around
 * `window.mainApi.mcp.listTools(serverName, workspaceId)`.
 *
 * The Compose-mode wire stage (slice 20.C3) needs to populate the
 * methods dropdown for MCP-class providers. The underlying bridge is
 * already exposed by dash-core's defaultMainApi; this module adapts
 * its `{ tools } | { error, message }` response into a normalized
 * `{ status, tools, error }` shape the UI can switch on without
 * branching on undefined/missing-bridge cases at every callsite.
 *
 * Why a thin wrapper and a hook in the same file: the composer's
 * picker is async (servers may not have been started, listTools can
 * fail mid-flight), and reusing the same normalization for a hook
 * version (loading state + cancellation) avoids drift between the
 * imperative and declarative call paths.
 */

import { useEffect, useState } from "react";

const EMPTY_TOOLS = Object.freeze([]);

/**
 * Imperative call. Returns one of:
 *   { status: "ok",    tools: Array<Tool>, error: null }
 *   { status: "error", tools: [],           error: string }
 *
 * Never throws — the composer would otherwise need a try/catch
 * around every picker open. `tools` is always an array, so callers
 * can `.map()` unconditionally.
 */
export async function fetchMcpTools(serverName, workspaceId = null) {
    if (typeof serverName !== "string" || serverName.length === 0) {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error: "serverName is required",
        };
    }
    const api =
        typeof window !== "undefined" && window.mainApi && window.mainApi.mcp;
    if (!api || typeof api.listTools !== "function") {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error: "MCP bridge unavailable (window.mainApi.mcp.listTools missing)",
        };
    }
    try {
        const result = await api.listTools(serverName, workspaceId);
        if (result && result.error) {
            return {
                status: "error",
                tools: EMPTY_TOOLS,
                error:
                    typeof result.message === "string"
                        ? result.message
                        : String(result.error),
            };
        }
        const tools = Array.isArray(result && result.tools)
            ? result.tools
            : EMPTY_TOOLS;
        return { status: "ok", tools, error: null };
    } catch (err) {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error:
                (err && (err.message || err.toString())) ||
                "Unknown MCP listTools failure",
        };
    }
}

/**
 * Declarative hook. Returns one of:
 *   { status: "idle",    tools: [], error: null }   // serverName not yet set
 *   { status: "loading", tools: [], error: null }   // request in flight
 *   { status: "ok",      tools: [...], error: null }
 *   { status: "error",   tools: [], error: string }
 *
 * Re-runs when `serverName` or `workspaceId` changes. Cancellation
 * is via a `cancelled` flag — the in-flight promise is not
 * abortable through the IPC bridge, so a stale response from a
 * previous serverName is dropped rather than aborted.
 */
export function useMcpTools(serverName, workspaceId = null) {
    const [state, setState] = useState({
        status: "idle",
        tools: EMPTY_TOOLS,
        error: null,
    });

    useEffect(() => {
        if (typeof serverName !== "string" || serverName.length === 0) {
            setState({ status: "idle", tools: EMPTY_TOOLS, error: null });
            return undefined;
        }
        let cancelled = false;
        setState({ status: "loading", tools: EMPTY_TOOLS, error: null });
        fetchMcpTools(serverName, workspaceId).then((result) => {
            if (!cancelled) setState(result);
        });
        return () => {
            cancelled = true;
        };
    }, [serverName, workspaceId]);

    return state;
}
