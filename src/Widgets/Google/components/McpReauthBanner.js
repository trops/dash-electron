/**
 * McpReauthBanner
 *
 * Shared re-authorization banner for Google MCP widgets.
 * Detects auth-expired errors and provides a one-click re-authorize flow.
 */
import { useState, useEffect, useContext } from "react";
import { AppContext } from "@trops/dash-core";

const AUTH_ERROR_PATTERNS = [
    "invalid_request",
    "invalid_grant",
    "Token has been expired",
    "invalid_client",
];

function isAuthError(msg) {
    if (!msg) return false;
    return AUTH_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export function McpReauthBanner({
    error,
    provider,
    catalogId,
    connect,
    disconnect,
    onReauthComplete,
}) {
    const app = useContext(AppContext);
    const [needsReauth, setNeedsReauth] = useState(false);
    const [reauthing, setReauthing] = useState(false);

    useEffect(() => {
        if (isAuthError(error)) {
            setNeedsReauth(true);
        }
    }, [error]);

    const handleReauth = async () => {
        const dashApi = app?.dashApi;
        if (!dashApi || !provider) return;

        setReauthing(true);
        try {
            const result = await new Promise((resolve, reject) => {
                dashApi.mcpGetCatalog(
                    (event, res) => resolve(res),
                    (event, err) => reject(err)
                );
            });

            const entry = result?.catalog?.find((s) => s.id === catalogId);
            const authCommand = entry?.authCommand;
            if (!authCommand) {
                setReauthing(false);
                return;
            }

            await new Promise((resolve, reject) => {
                dashApi.mcpRunAuth(
                    provider.mcpConfig,
                    provider.credentials,
                    authCommand,
                    (event, res) => resolve(res),
                    (event, err) => reject(err)
                );
            });

            await disconnect();
            setNeedsReauth(false);
            onReauthComplete?.();
            // Allow time for auth subprocess to flush tokens to disk
            await new Promise((r) => setTimeout(r, 500));
            await connect();
        } catch (err) {
            console.error("[McpReauthBanner] Re-auth failed:", err);
        } finally {
            setReauthing(false);
        }
    };

    if (!needsReauth) return null;

    return (
        <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs flex items-center justify-between gap-2">
            <span>Authorization expired. Re-authorize to continue.</span>
            <button
                onClick={handleReauth}
                disabled={reauthing}
                className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white whitespace-nowrap"
            >
                {reauthing ? "Authorizing..." : "Re-authorize"}
            </button>
        </div>
    );
}
