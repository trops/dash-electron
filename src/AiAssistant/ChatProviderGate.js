/**
 * ChatProviderGate
 *
 * Full-coverage overlay rendered inside the chat panel of
 * WidgetBuilderModal. Gates entry to the chat: until the user picks a
 * provider (or "no external provider"), they cannot interact with the
 * chat. This replaces the prior bottom-of-chat dropdown picker, whose
 * placement-inside-an-active-modal made the modal-stacking bug
 * possible and left the user uncertain whether the picker was wired.
 *
 * Selection shape (emitted via `onChange`):
 *   - { sentinel: "none" }                       → "no external provider"
 *   - { name, type, providerClass }              → an installed provider
 *
 * Phase A scope: installed providers + the "no external provider"
 * sentinel only. Install-new is intentionally NOT here — Phase B will
 * close this modal and open Settings → Providers via a deep-link.
 *
 * The auto-select listener for `dash:provider-installed` is kept so
 * that if a provider is installed via any other path while the gate
 * is showing, the gate proactively picks it.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "@trops/dash-core";
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";

const NONE_SENTINEL = { sentinel: "none" };

export const ChatProviderGate = ({ onChange }) => {
    const appContext = useContext(AppContext);
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    // Pull installed providers from AppContext. If empty (the AppWrapper
    // may not have populated yet), fall back to a one-shot mainApi
    // fetch — same pattern the prior picker used.
    const contextProviders = useMemo(
        () => appContext?.providers || {},
        [appContext?.providers]
    );
    const [fallbackProviders, setFallbackProviders] = useState({});

    useEffect(() => {
        const ctxKeys = Object.keys(contextProviders);
        if (ctxKeys.length > 0) {
            setFallbackProviders({});
            return;
        }
        let cancelled = false;
        const appId =
            appContext?.credentials?.appId ||
            process.env.REACT_APP_IDENTIFIER ||
            "@trops/dash-electron";
        if (!window.mainApi?.providers?.listProviders) return;
        window.mainApi.providers
            .listProviders(appId)
            .then((result) => {
                if (cancelled) return;
                const list = result?.providers || [];
                const obj = {};
                for (const p of list) {
                    if (p && p.name) obj[p.name] = p;
                }
                setFallbackProviders(obj);
            })
            .catch(() => {
                /* silent — empty gate state is the natural failure mode */
            });
        return () => {
            cancelled = true;
        };
    }, [contextProviders, appContext?.credentials?.appId]);

    const providersMap =
        Object.keys(contextProviders).length > 0
            ? contextProviders
            : fallbackProviders;

    // Group installed providers by type, alphabetized within each
    // group. Same shape as the prior picker so swapping one for the
    // other is mechanically simple.
    const installedOptions = useMemo(() => {
        const entries = Object.values(providersMap).filter(
            (p) => p && typeof p === "object" && p.type && p.name
        );
        const byType = new Map();
        for (const p of entries) {
            if (!byType.has(p.type)) byType.set(p.type, []);
            byType.get(p.type).push({
                name: p.name,
                type: p.type,
                providerClass: p.providerClass || "credential",
            });
        }
        const groups = [];
        for (const [type, list] of byType.entries()) {
            list.sort((a, b) => a.name.localeCompare(b.name));
            groups.push({ type, list });
        }
        groups.sort((a, b) => a.type.localeCompare(b.type));
        return groups;
    }, [providersMap]);

    // Auto-select on `dash:provider-installed`. If a provider is
    // installed through any other flow while the gate is open, pick
    // it without making the user click again.
    useEffect(() => {
        function onInstalled(event) {
            const detail = event?.detail || {};
            if (!detail?.name || !detail?.id) return;
            const next = {
                name: detail.name,
                type: detail.id,
                providerClass: detail.providerClass || "mcp",
            };
            onChange(next);
        }
        window.addEventListener("dash:provider-installed", onInstalled);
        return () =>
            window.removeEventListener("dash:provider-installed", onInstalled);
    }, [onChange]);

    const hasInstalled = installedOptions.length > 0;

    return (
        <div
            className={`absolute inset-0 z-10 overflow-y-auto bg-gray-900/95 backdrop-blur-sm flex flex-col`}
        >
            <div className="px-4 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon
                        icon="plug"
                        className="h-4 w-4 text-indigo-300"
                    />
                    <h2 className="text-sm font-semibold text-gray-100">
                        Choose a provider for this widget
                    </h2>
                </div>
                <p className="text-xs text-gray-400 leading-snug">
                    The AI will write code that consumes the provider you pick
                    here. Pick "No external provider" for self-contained widgets
                    (clock, counter, etc.).
                </p>
            </div>

            <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
                {hasInstalled && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
                            Use one of your providers
                        </div>
                        <div
                            className={`rounded-md border ${borderColor} bg-gray-800/40 divide-y divide-gray-700/40`}
                        >
                            {installedOptions.map(({ type, list }) => (
                                <div key={type}>
                                    {list.map((opt) => (
                                        <button
                                            key={opt.name}
                                            type="button"
                                            onClick={() => onChange(opt)}
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="truncate text-left">
                                                {opt.name}
                                            </span>
                                            <span className="ml-2 flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] opacity-60">
                                                    {opt.type}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-200">
                                                    {opt.providerClass}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
                        Or skip the provider
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange(NONE_SENTINEL)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 rounded-md border ${borderColor} bg-gray-800/40 hover:bg-white/5 transition-colors`}
                    >
                        <span className="flex items-center">
                            <FontAwesomeIcon
                                icon="circle-minus"
                                className="h-3 w-3 mr-2 opacity-60"
                            />
                            No external provider
                            <span className="ml-2 text-[10px] opacity-50">
                                (clock, counter, static display, etc.)
                            </span>
                        </span>
                    </button>
                </div>

                {!hasInstalled && (
                    <div
                        className={`rounded-md border ${borderColor} bg-amber-900/15 px-3 py-2 text-[11px] text-amber-200 leading-snug`}
                    >
                        No providers configured. Pick "No external provider"
                        above for a self-contained widget, or close this modal
                        and add one in Settings → Providers, then reopen the
                        builder.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatProviderGate;
