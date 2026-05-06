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
import { enqueueRequest, dequeueHead } from "./jitConsentQueue";
import {
    buildFsFilenameGrant,
    buildFsAnyGrant,
    buildNetHostGrant,
    buildNetSubdomainGrant,
    buildNetAnyGrant,
} from "./jitConsentGrantBuilders";

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
    // Queue of pending requests instead of a single one — pre-fix the
    // modal stored `useState(null)` and overwrote on every IPC event,
    // silently dropping earlier prompts. See jitConsentQueue.js.
    const [queue, setQueue] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Slice 5: opt-in to broader sibling-batch grant. Resets on every
    // queue-head change (handled below) so a previous "yes, batch it"
    // doesn't leak into the next request.
    const [applyToSiblings, setApplyToSiblings] = useState(false);
    const request = queue[0] || null;

    useEffect(() => {
        if (!window.mainApi?.permissions?.onRequired) return;
        const cleanup = window.mainApi.permissions.onRequired((payload) => {
            if (!payload?.requestId) return;
            setQueue((q) => enqueueRequest(q, payload));
            // isSubmitting is reset by the response/cancel handlers
            // when they dequeue — incoming events that aren't the
            // current head shouldn't disturb in-flight submission UI.
        });
        return cleanup;
    }, []);

    // Reset the sibling-batch checkbox whenever the head request id
    // changes (i.e. user advanced past the previous prompt).
    useEffect(() => {
        setApplyToSiblings(false);
    }, [request?.requestId]);

    if (!request) return null;
    if (
        request.domain !== "mcp" &&
        request.domain !== "fs" &&
        request.domain !== "network"
    )
        return null;

    const { requestId, widgetId, args, domain } = request;
    // Slice 5: package-scope sibling batch. Defaults preserve single-
    // widget behavior when the gate's resolveSiblings fell back.
    const packageId =
        typeof request.packageId === "string" ? request.packageId : null;
    const siblingWidgetIds = Array.isArray(request.siblingWidgetIds)
        ? request.siblingWidgetIds
        : [widgetId];
    const showSiblingCheckbox = !!packageId && siblingWidgetIds.length > 1;

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

    const grantFsFilename = (filename) =>
        buildFsFilenameGrant({
            action: fsAction,
            filename,
            isWrite: fsIsWrite,
        });

    const grantFsAny = () =>
        buildFsAnyGrant({ action: fsAction, isWrite: fsIsWrite });

    // --- network domain (Phase 3) --------------------------------
    const netAction = args?.action || request.action || "(unknown action)";
    const netUrl = args?.url || "";
    let netHost = "(unknown host)";
    try {
        if (netUrl) netHost = new URL(netUrl).hostname;
    } catch {
        netHost = netUrl || "(unparseable)";
    }

    // Subdomain wildcard pattern. Skip when the host is an IP, has
    // only one segment (e.g. "localhost"), or is already exactly the
    // base domain (a wildcard wouldn't broaden the grant). Pattern is
    // the last two dotted segments — e.g. "api.foo.example.com" →
    // "*.example.com".
    const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(netHost);
    const isIPv6 = /:/.test(netHost);
    const segments = netHost.split(".");
    const canWildcard = !isIPv4 && !isIPv6 && segments.length >= 3;
    const subdomainPattern = canWildcard
        ? "*." + segments.slice(-2).join(".")
        : null;

    const grantNetHost = (host) =>
        buildNetHostGrant({ action: netAction, host });

    const grantNetSubdomain = (pattern) =>
        buildNetSubdomainGrant({ action: netAction, pattern });

    const grantNetAny = () => buildNetAnyGrant({ action: netAction });

    const respond = (decision) => {
        if (!window.mainApi?.permissions?.respond) return;
        // Slice 5: thread the sibling-batch opt-in through every
        // approval. On deny, the gate ignores it (writes nothing). On
        // approve, the gate writes the same grant to every sibling
        // when this is true and resolved siblings count > 1.
        const finalDecision = {
            ...decision,
            applyToSiblings: decision?.approve === true && applyToSiblings,
        };
        window.mainApi.permissions.respond(requestId, finalDecision);
        setQueue((q) => dequeueHead(q));
        setIsSubmitting(false);
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

    const handleAllowNetSubdomain = () => {
        if (!subdomainPattern) return;
        setIsSubmitting(true);
        respond({
            approve: true,
            scope: "network+subdomain",
            granted: grantNetSubdomain(subdomainPattern),
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
        // We still pop the head so the next queued request can render.
        setQueue((q) => dequeueHead(q));
        setIsSubmitting(false);
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
                                {queue.length > 1
                                    ? ` (1 of ${queue.length})`
                                    : ""}
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
                        {showSiblingCheckbox && (
                            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none pb-1">
                                <input
                                    type="checkbox"
                                    checked={applyToSiblings}
                                    onChange={(e) =>
                                        setApplyToSiblings(e.target.checked)
                                    }
                                    disabled={isSubmitting}
                                    className="cursor-pointer"
                                />
                                <span>
                                    Apply to all{" "}
                                    <span className="font-mono">
                                        {siblingWidgetIds.length}
                                    </span>{" "}
                                    widgets currently installed from{" "}
                                    <span className="font-mono">
                                        {packageId}
                                    </span>
                                </span>
                            </label>
                        )}
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
                                {subdomainPattern && (
                                    <Button
                                        title={`Allow ${netAction} for ${subdomainPattern} (subdomains)`}
                                        onClick={handleAllowNetSubdomain}
                                        textSize="text-xs"
                                        padding="py-1.5 px-3"
                                        backgroundColor="bg-gray-700"
                                        textColor="text-gray-100"
                                        hoverBackgroundColor="hover:bg-gray-600"
                                        disabled={isSubmitting}
                                    />
                                )}
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
