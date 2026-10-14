/**
 * WidgetCredentialPermissionModal — install-time permission gate
 * (slice 17d.2).
 *
 * Shown right before a widget installs when its code calls
 * credentialed provider methods. Lists every method the widget
 * will call, lets the user grant or deny each one, and either
 * proceeds with install (with the chosen grants persisted) or
 * cancels.
 *
 * UX choices that follow the existing JitConsentModal pattern:
 *   - Rendered via createPortal to a fixed-position overlay so it
 *     stacks correctly above the widget builder Modal without
 *     fighting HeadlessUI's Dialog stacking. The widget builder
 *     modal beneath it is dimmed but still focus-trapped — that
 *     matches what JitConsentModal does today.
 *   - No automatic preselection. Every method starts UNCHECKED.
 *     "Grant all" is a one-click escape hatch for users who
 *     trust the widget. The default keeps users from absent-
 *     mindedly granting more than they intended.
 *   - Per-method explanation: each row shows the service +
 *     method name + the line number it appears on. The user can
 *     cross-reference against the Code tab if anything looks
 *     suspicious.
 */
import React, { useState, useMemo } from "react";
import { Button, Button2, Button3 } from "@trops/dash-react";
import { useBuilderTheme } from "./useBuilderTheme";
import { groupByProvider } from "./widgetCredentialPermissionScanner";

export function WidgetCredentialPermissionModal({
    isOpen,
    packageName,
    calls,
    onConfirm,
    onCancel,
}) {
    const bt = useBuilderTheme();
    const grouped = useMemo(() => groupByProvider(calls || []), [calls]);

    // Per-method grant state. Initial: every method UNCHECKED.
    // The user makes an explicit decision per method.
    const [grants, setGrants] = useState(() => {
        const seed = {};
        for (const [service, methods] of Object.entries(grouped)) {
            seed[service] = {};
            for (const m of methods) {
                seed[service][m.method] = false;
            }
        }
        return seed;
    });

    if (!isOpen) return null;

    const toggle = (service, method) => {
        setGrants((prev) => ({
            ...prev,
            [service]: {
                ...(prev[service] || {}),
                [method]: !((prev[service] || {})[method] === true),
            },
        }));
    };

    const grantAll = () => {
        const next = {};
        for (const [service, methods] of Object.entries(grouped)) {
            next[service] = {};
            for (const m of methods) {
                next[service][m.method] = true;
            }
        }
        setGrants(next);
    };

    const grantNone = () => {
        const next = {};
        for (const [service, methods] of Object.entries(grouped)) {
            next[service] = {};
            for (const m of methods) {
                next[service][m.method] = false;
            }
        }
        setGrants(next);
    };

    const totalCalls = Object.values(grouped).reduce(
        (n, list) => n + list.length,
        0
    );
    const totalGranted = Object.values(grants).reduce((n, svc) => {
        return n + Object.values(svc).filter((v) => v === true).length;
    }, 0);

    const overlay = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            // A dim in both modes (a theme surface would be a light wash in
            // light mode); inline so no palette class is needed.
            style={{ background: "rgba(0, 0, 0, 0.6)" }}
            data-testid="widget-credential-permission-overlay"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="widget-credential-permission-title"
                className={`dr-modal-surface pointer-events-auto w-full max-w-2xl mx-4 rounded-lg border shadow-2xl flex flex-col ${bt.tk(
                    "bg-primary-dark"
                )} ${bt.border} ${bt.text}`}
                style={{ maxHeight: "85vh" }}
                data-testid="widget-credential-permission-modal"
            >
                <div
                    className={`flex flex-col gap-1 p-4 border-b ${bt.border}`}
                >
                    <h2
                        id="widget-credential-permission-title"
                        className={`text-sm font-semibold ${bt.text}`}
                    >
                        Review widget permissions
                    </h2>
                    <p className={`text-sm ${bt.muted}`}>
                        <span className={`font-mono ${bt.text}`}>
                            {packageName}
                        </span>{" "}
                        will be able to make the following credentialed calls.
                        Grant only what you trust this widget to do — denied
                        calls throw a permission error at runtime.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    {Object.entries(grouped).map(([service, methods]) => (
                        <div key={service} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <h3
                                    className={`text-xs font-medium ${bt.text}`}
                                >
                                    {service}
                                </h3>
                                <span className={`text-xs ${bt.muted}`}>
                                    {methods.length} method
                                    {methods.length === 1 ? "" : "s"}
                                </span>
                            </div>
                            {/* One recessed group per provider — no bordered
                                boxes inside the bordered modal. */}
                            <div
                                className={`flex flex-col rounded-lg p-1 ${bt.surface}`}
                            >
                                {methods.map((m) => {
                                    const checked =
                                        (grants[service] || {})[m.method] ===
                                        true;
                                    return (
                                        <label
                                            key={m.method}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm ${bt.hoverSurface}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    toggle(service, m.method)
                                                }
                                                className={`h-4 w-4 rounded ${bt.border} ${bt.surface} ${bt.accent}`}
                                                data-testid={`grant-${service}-${m.method}`}
                                            />
                                            <span
                                                className={`font-mono flex-1 ${bt.text}`}
                                            >
                                                {service}.{m.method}()
                                            </span>
                                            <span
                                                className={`text-xs ${bt.muted}`}
                                            >
                                                line {m.line}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    className={`flex items-center justify-between gap-3 p-4 border-t ${bt.border}`}
                >
                    <div className="flex items-center gap-2">
                        <Button3
                            title="Grant all"
                            size="sm"
                            onClick={grantAll}
                            testId="grant-all"
                        />
                        <Button3
                            title="Grant none"
                            size="sm"
                            onClick={grantNone}
                            testId="grant-none"
                        />
                        <span className={`text-xs ${bt.muted}`}>
                            {totalGranted} of {totalCalls} granted
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button2
                            title="Cancel install"
                            size="sm"
                            onClick={() =>
                                typeof onCancel === "function" && onCancel()
                            }
                            testId="cancel-install"
                        />
                        <Button
                            title="Install with these permissions"
                            size="sm"
                            onClick={() =>
                                typeof onConfirm === "function" &&
                                onConfirm(grants)
                            }
                            testId="confirm-install"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    // Slice 19F: NOT portaled to document.body anymore. The widget
    // builder's parent <Modal> is built on @headlessui/react v1.4
    // Dialog, which detects "click outside" via DOM containment —
    // not React-tree containment. createPortal escapes the DOM, so
    // any click inside the portal'd modal looked "outside" the
    // Dialog and tripped its onClose, taking the whole widget
    // builder down with it. Rendering inline keeps the modal as a
    // DOM descendant of the Dialog — HeadlessUI sees clicks as
    // "inside" and leaves the parent Modal alone. Fixed-position
    // overlay still works fine; z-50 beats the dash-react Modal's
    // z-40 visually, and the inline render order means it paints
    // on top.
    return overlay;
}
