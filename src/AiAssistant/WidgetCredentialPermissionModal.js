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
import { createPortal } from "react-dom";
import { groupByProvider } from "./widgetCredentialPermissionScanner";

export function WidgetCredentialPermissionModal({
    isOpen,
    packageName,
    calls,
    onConfirm,
    onCancel,
}) {
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-none"
            data-testid="widget-credential-permission-overlay"
        >
            <div
                className="pointer-events-auto w-full max-w-2xl mx-4 rounded-lg border border-gray-700/50 bg-gray-900 shadow-2xl flex flex-col"
                style={{ maxHeight: "85vh" }}
                data-testid="widget-credential-permission-modal"
            >
                <div className="px-5 py-4 border-b border-gray-800/60">
                    <h2 className="text-base font-semibold text-gray-100">
                        Review widget permissions
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        <span className="font-mono">{packageName}</span> will be
                        able to make the following credentialed calls. Grant
                        only what you trust this widget to do — denied calls
                        throw a permission error at runtime.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                    {Object.entries(grouped).map(([service, methods]) => (
                        <div key={service}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                    {service}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    {methods.length} method
                                    {methods.length === 1 ? "" : "s"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                {methods.map((m) => {
                                    const checked =
                                        (grants[service] || {})[m.method] ===
                                        true;
                                    return (
                                        <label
                                            key={m.method}
                                            className="flex items-center gap-3 px-3 py-2 rounded border border-gray-700/40 bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    toggle(service, m.method)
                                                }
                                                className="w-4 h-4"
                                                data-testid={`grant-${service}-${m.method}`}
                                            />
                                            <span className="font-mono text-gray-200 flex-1">
                                                {service}.{m.method}()
                                            </span>
                                            <span className="text-[10px] text-gray-500">
                                                line {m.line}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 py-3 border-t border-gray-800/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={grantAll}
                            className="text-xs px-2 py-1 rounded border border-gray-700/50 text-gray-300 hover:bg-gray-800/60"
                            data-testid="grant-all"
                        >
                            Grant all
                        </button>
                        <button
                            type="button"
                            onClick={grantNone}
                            className="text-xs px-2 py-1 rounded border border-gray-700/50 text-gray-300 hover:bg-gray-800/60"
                            data-testid="grant-none"
                        >
                            Grant none
                        </button>
                        <span className="text-[11px] text-gray-500 ml-2">
                            {totalGranted} of {totalCalls} granted
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                typeof onCancel === "function" && onCancel()
                            }
                            className="text-xs px-3 py-1.5 rounded border border-gray-700/50 text-gray-300 hover:bg-gray-800/60"
                            data-testid="cancel-install"
                        >
                            Cancel install
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                typeof onConfirm === "function" &&
                                onConfirm(grants)
                            }
                            className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                            data-testid="confirm-install"
                        >
                            Install with these permissions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}
