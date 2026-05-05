/**
 * JitConsentModal
 *
 * Just-in-time consent prompt. Subscribes to `widget:permission-required`
 * (emitted by dash-core's jitConsent module when an MCP call hits the
 * gate without a matching grant) and presents the user with concrete
 * granularity options for the requested call.
 *
 * Implementation note — portal + fixed positioning. Earlier versions
 * wrapped this in `<Modal>` from @trops/dash-react. That works in
 * isolation but composes badly with another Modal already open
 * (Settings panel, install consent modal): HeadlessUI Dialog stacks
 * the second one inside the first's flex container, landing it
 * visibly off-center, and outside-click events leak through to the
 * underlying Settings modal and close it. Rendering as a portaled
 * fixed-position overlay with explicit `pointer-events-auto` on the
 * card and `pointer-events-none` on the centering wrapper keeps the
 * modal viewport-centered, isolates its event handling, and stacks
 * above any other Modal via z-50.
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, FontAwesomeIcon } from "@trops/dash-react";

const PATH_ARG_KEYS = ["path", "uri", "filepath", "file", "directory"];

function findPathArg(args) {
    if (!args || typeof args !== "object") return null;
    for (const key of PATH_ARG_KEYS) {
        const v = args[key];
        if (typeof v === "string" && v) return { key, value: v };
    }
    return null;
}

function parentDirOf(p) {
    if (typeof p !== "string" || !p) return null;
    const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    if (idx <= 0) return null;
    return p.slice(0, idx);
}

const WRITE_VERB =
    /(^|_)(write|create|edit|delete|remove|append|move|rename|chmod|chown|mkdir)/i;

export const JitConsentModal = () => {
    const [request, setRequest] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!window.mainApi?.permissions?.onRequired) return;
        const cleanup = window.mainApi.permissions.onRequired((payload) => {
            if (!payload?.requestId) return;
            setRequest(payload);
            setIsSubmitting(false);
        });
        return cleanup;
    }, []);

    if (!request) return null;
    if (
        request.domain !== "mcp" &&
        request.domain !== "fs" &&
        request.domain !== "network"
    )
        return null;

    const { requestId, widgetId, args, domain } = request;

    // --- MCP domain (Slice 1+2 — original) -----------------------
    const serverName = args?.serverName || "(unknown server)";
    const toolName = args?.toolName || "(unknown tool)";
    const innerArgs = args?.args || {};
    const pathArg = findPathArg(innerArgs);
    const isWriteVerb = WRITE_VERB.test(toolName);

    const grantToolOnly = () => ({
        grantOrigin: "live",
        servers: {
            [serverName]: {
                tools: [toolName],
                readPaths: [],
                writePaths: [],
            },
        },
    });

    const grantToolWithPath = (p) => ({
        grantOrigin: "live",
        servers: {
            [serverName]: {
                tools: [toolName],
                readPaths: !isWriteVerb ? [p] : [],
                writePaths: isWriteVerb ? [p] : [],
            },
        },
    });

    // --- fs domain (Phase 2) -------------------------------------
    const FS_WRITE_ACTIONS = new Set([
        "saveToFile",
        "saveData",
        "convertJsonToCsvFile",
        "parseXMLStream",
        "parseCSVStream",
        "readDataFromURL",
        "transformFile",
    ]);
    const fsAction = args?.action || request.action || "(unknown action)";
    const fsFilename = args?.filename || "(unknown file)";
    const fsIsWrite = FS_WRITE_ACTIONS.has(fsAction);

    const grantFsFilename = (filename) => ({
        grantOrigin: "live",
        domains: {
            fs: {
                readPaths: !fsIsWrite ? [filename] : [],
                writePaths: fsIsWrite ? [filename] : [],
            },
        },
    });

    const grantFsAny = () => ({
        grantOrigin: "live",
        domains: {
            fs: {
                readPaths: !fsIsWrite ? ["*"] : [],
                writePaths: fsIsWrite ? ["*"] : [],
            },
        },
    });

    // --- network domain (Phase 3) --------------------------------
    const netAction = args?.action || request.action || "(unknown action)";
    const netUrl = args?.url || "";
    let netHost = "(unknown host)";
    try {
        if (netUrl) netHost = new URL(netUrl).hostname;
    } catch {
        netHost = netUrl || "(unparseable)";
    }

    const grantNetHost = (host) => ({
        grantOrigin: "live",
        domains: { network: { hosts: [host] } },
    });

    const grantNetAny = () => ({
        grantOrigin: "live",
        domains: { network: { hosts: ["*"] } },
    });

    const respond = (decision) => {
        if (!window.mainApi?.permissions?.respond) return;
        window.mainApi.permissions.respond(requestId, decision);
        setRequest(null);
    };

    const handleAllowToolOnly = () => {
        setIsSubmitting(true);
        respond({ approve: true, scope: "tool", granted: grantToolOnly() });
    };

    const handleAllowToolWithPath = (p) => {
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "tool+path",
            granted: grantToolWithPath(p),
        });
    };

    const handleAllowFsFilename = () => {
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "fs+filename",
            granted: grantFsFilename(fsFilename),
        });
    };

    const handleAllowFsAny = () => {
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "fs+any",
            granted: grantFsAny(),
        });
    };

    const handleAllowNetHost = () => {
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "network+host",
            granted: grantNetHost(netHost),
        });
    };

    const handleAllowNetAny = () => {
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "network+any",
            granted: grantNetAny(),
        });
    };

    const handleDeny = () => {
        setIsSubmitting(true);
        respond({ approve: false });
    };

    const handleCancel = () => {
        // No response sent — main process will time out and reject.
        setRequest(null);
    };

    const parentPath = pathArg ? parentDirOf(pathArg.value) : null;

    const overlay = (
        <>
            {/* Backdrop — click outside cancels. */}
            <div
                className="fixed inset-0 bg-black bg-opacity-70 z-50"
                onClick={handleCancel}
            />
            {/* Centering wrapper — pointer-events-none so backdrop clicks
                pass through; the inner card re-enables pointer events. */}
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
                <div
                    className="flex flex-col w-full max-w-xl border-2 border-purple-500 rounded bg-gray-900 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
                        <FontAwesomeIcon
                            icon="bolt"
                            className="h-4 w-4 text-purple-400"
                        />
                        <div>
                            <div className="text-base font-semibold text-gray-100">
                                Permission requested
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                {domain === "mcp" && (
                                    <>
                                        <span className="font-mono">
                                            {widgetId}
                                        </span>{" "}
                                        wants to call{" "}
                                        <span className="font-mono">
                                            {toolName}
                                        </span>{" "}
                                        on{" "}
                                        <span className="font-mono">
                                            {serverName}
                                        </span>
                                        .
                                    </>
                                )}
                                {domain === "fs" && (
                                    <>
                                        <span className="font-mono">
                                            {widgetId}
                                        </span>{" "}
                                        wants to{" "}
                                        <span className="font-mono">
                                            {fsAction}
                                        </span>{" "}
                                        on{" "}
                                        <span className="font-mono">
                                            {fsFilename}
                                        </span>
                                        .
                                    </>
                                )}
                                {domain === "network" && (
                                    <>
                                        <span className="font-mono">
                                            {widgetId}
                                        </span>{" "}
                                        wants to{" "}
                                        <span className="font-mono">
                                            {netAction}
                                        </span>{" "}
                                        on{" "}
                                        <span className="font-mono">
                                            {netHost}
                                        </span>
                                        .
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 px-5 py-4 max-h-96 overflow-y-auto">
                        <div className="text-xs uppercase tracking-wider text-gray-400">
                            Request details
                        </div>
                        <div className="rounded bg-gray-950 border border-gray-700 p-3 text-xs font-mono text-gray-200 break-all">
                            {domain === "mcp" && (
                                <>
                                    <div>
                                        <span className="text-gray-500">
                                            tool:
                                        </span>{" "}
                                        {toolName}
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            server:
                                        </span>{" "}
                                        {serverName}
                                    </div>
                                    {pathArg && (
                                        <div>
                                            <span className="text-gray-500">
                                                {pathArg.key}:
                                            </span>{" "}
                                            {pathArg.value}
                                        </div>
                                    )}
                                </>
                            )}
                            {domain === "fs" && (
                                <>
                                    <div>
                                        <span className="text-gray-500">
                                            domain:
                                        </span>{" "}
                                        filesystem
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            action:
                                        </span>{" "}
                                        {fsAction} (
                                        {fsIsWrite ? "write" : "read"})
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            filename:
                                        </span>{" "}
                                        {fsFilename}
                                    </div>
                                </>
                            )}
                            {domain === "network" && (
                                <>
                                    <div>
                                        <span className="text-gray-500">
                                            domain:
                                        </span>{" "}
                                        network
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            action:
                                        </span>{" "}
                                        {netAction}
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            url:
                                        </span>{" "}
                                        {netUrl}
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            host:
                                        </span>{" "}
                                        {netHost}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="text-xs text-gray-400">
                            Choose how broadly to grant this. The grant is saved
                            and applies to future calls until you revoke it in
                            Settings → Privacy & Security.
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 px-5 py-3 border-t border-gray-700">
                        {domain === "mcp" && pathArg && (
                            <Button
                                title={`Allow ${toolName} for ${pathArg.value}`}
                                onClick={() =>
                                    handleAllowToolWithPath(pathArg.value)
                                }
                                textSize="text-xs"
                                padding="py-1.5 px-3"
                                backgroundColor="bg-purple-600"
                                textColor="text-white"
                                hoverBackgroundColor="hover:bg-purple-500"
                                disabled={isSubmitting}
                            />
                        )}
                        {domain === "mcp" &&
                            pathArg &&
                            parentPath &&
                            parentPath !== pathArg.value && (
                                <Button
                                    title={`Allow ${toolName} for ${parentPath}/* (broader)`}
                                    onClick={() =>
                                        handleAllowToolWithPath(parentPath)
                                    }
                                    textSize="text-xs"
                                    padding="py-1.5 px-3"
                                    backgroundColor="bg-gray-700"
                                    textColor="text-gray-100"
                                    hoverBackgroundColor="hover:bg-gray-600"
                                    disabled={isSubmitting}
                                />
                            )}
                        {domain === "mcp" && (
                            <Button
                                title={
                                    pathArg
                                        ? `Allow ${toolName} (no path scope — risky)`
                                        : `Allow ${toolName}`
                                }
                                onClick={handleAllowToolOnly}
                                textSize="text-xs"
                                padding="py-1.5 px-3"
                                backgroundColor="bg-gray-800"
                                textColor="text-gray-200"
                                hoverBackgroundColor="hover:bg-gray-700"
                                disabled={isSubmitting}
                            />
                        )}
                        {domain === "fs" && (
                            <>
                                <Button
                                    title={`Allow ${fsAction} for ${fsFilename}`}
                                    onClick={handleAllowFsFilename}
                                    textSize="text-xs"
                                    padding="py-1.5 px-3"
                                    backgroundColor="bg-purple-600"
                                    textColor="text-white"
                                    hoverBackgroundColor="hover:bg-purple-500"
                                    disabled={isSubmitting}
                                />
                                <Button
                                    title={`Allow ${fsAction} for any filename (broader — risky)`}
                                    onClick={handleAllowFsAny}
                                    textSize="text-xs"
                                    padding="py-1.5 px-3"
                                    backgroundColor="bg-gray-800"
                                    textColor="text-gray-200"
                                    hoverBackgroundColor="hover:bg-gray-700"
                                    disabled={isSubmitting}
                                />
                            </>
                        )}
                        {domain === "network" && (
                            <>
                                <Button
                                    title={`Allow ${netAction} for ${netHost}`}
                                    onClick={handleAllowNetHost}
                                    textSize="text-xs"
                                    padding="py-1.5 px-3"
                                    backgroundColor="bg-purple-600"
                                    textColor="text-white"
                                    hoverBackgroundColor="hover:bg-purple-500"
                                    disabled={isSubmitting}
                                />
                                <Button
                                    title={`Allow ${netAction} for any host (broader — risky)`}
                                    onClick={handleAllowNetAny}
                                    textSize="text-xs"
                                    padding="py-1.5 px-3"
                                    backgroundColor="bg-gray-800"
                                    textColor="text-gray-200"
                                    hoverBackgroundColor="hover:bg-gray-700"
                                    disabled={isSubmitting}
                                />
                            </>
                        )}
                        <Button
                            title="Deny"
                            onClick={handleDeny}
                            textSize="text-xs"
                            padding="py-1.5 px-3"
                            backgroundColor="bg-red-700"
                            textColor="text-white"
                            hoverBackgroundColor="hover:bg-red-600"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(overlay, document.body);
};

export default JitConsentModal;
