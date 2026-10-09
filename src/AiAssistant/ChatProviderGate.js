/**
 * ChatProviderGate
 *
 * Full-coverage overlay rendered inside the chat panel of
 * WidgetBuilderModal. Gates entry to the chat: until the user picks a
 * provider TYPE (or "no external provider"), they cannot interact
 * with the chat.
 *
 * Type-first architecture (post-refactor): the gate lists provider
 * TYPES drawn from three sources, deduped on (type, providerClass):
 *
 *   1. Built-in MCP catalog              → class = "mcp"
 *   2. Known-external MCP catalog        → class = "mcp"
 *   3. Installed providers' types        → class = whatever was saved
 *                                          (e.g. "credential" for
 *                                          algolia-style providers)
 *
 * Selection emits `{ type, providerClass }` — no instance name. The
 * runtime instance binding ("which Algolia Prod / Dev / Sandbox?") is
 * handled later by the existing preview-area `PreviewProviderPicker`
 * dropdown.
 *
 * "Add new" is intentionally NOT in this gate. The user adds new
 * provider INSTANCES of an existing type via the preview-area
 * dropdown's empty-state CTA (Settings → Providers deep-link). The
 * gate never offers creation of a new TYPE — types are catalog-defined.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "@trops/dash-core";
import { FontAwesomeIcon } from "@trops/dash-react";
import { useBuilderTheme } from "./useBuilderTheme";

const NONE_SENTINEL = { sentinel: "none" };

export const ChatProviderGate = ({
    onChange,
    builtInCatalog = [],
    knownExternalCatalog = [],
}) => {
    const appContext = useContext(AppContext);
    const bt = useBuilderTheme();
    const borderColor = bt.border;

    // Pull installed providers from AppContext. If empty (the AppWrapper
    // may not have populated yet), fall back to a one-shot mainApi
    // fetch — same pattern the prior gate used.
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

    const installedProviders =
        Object.keys(contextProviders).length > 0
            ? contextProviders
            : fallbackProviders;

    // Build the type list. Three sources, deduped on (type, class).
    // Built-in MCP and known-external both contribute type+class="mcp".
    // Installed providers contribute their own type+class (catches
    // credential-class types like algolia that aren't in either MCP
    // catalog).
    const typeOptions = useMemo(() => {
        const seen = new Map();

        const addEntry = (type, providerClass, label) => {
            if (!type || !providerClass) return;
            const key = `${type}|${providerClass}`;
            if (seen.has(key)) return;
            seen.set(key, { type, providerClass, label: label || type });
        };

        for (const entry of builtInCatalog || []) {
            if (!entry?.id) continue;
            addEntry(entry.id, "mcp", entry.name || entry.id);
        }
        for (const entry of knownExternalCatalog || []) {
            if (!entry?.id) continue;
            addEntry(entry.id, "mcp", entry.name || entry.id);
        }
        for (const p of Object.values(installedProviders || {})) {
            if (!p?.type) continue;
            addEntry(p.type, p.providerClass || "credential", p.type);
        }

        return Array.from(seen.values()).sort((a, b) =>
            a.type.localeCompare(b.type)
        );
    }, [builtInCatalog, knownExternalCatalog, installedProviders]);

    const hasTypes = typeOptions.length > 0;

    // Interim selection captured when the user clicks a type for which
    // they have zero installed instances. Showing a small confirmation
    // panel here surfaces the "no provider configured" problem BEFORE
    // the user goes through the full chat-and-build flow only to
    // discover the gap at preview time. Three exits:
    //   - Create new: dispatches dash:open-settings-create-provider
    //     (handled by Dash.js + DashboardStage listeners shipped in
    //      v0.0.513 / v0.1.452 — closes the builder, opens Settings
    //      → Providers in create mode with the type pre-selected).
    //   - Skip for now: calls onChange anyway. The widget config will
    //     declare the type; the preview-area dropdown's existing "+
    //     Add new" CTA is the path back if the user changes their mind.
    //   - Cancel: returns to the type list so they can pick differently.
    const [pendingType, setPendingType] = useState(null);

    const countInstancesOfType = (type, providerClass) => {
        let n = 0;
        for (const p of Object.values(installedProviders || {})) {
            if (!p || p.type !== type) continue;
            if ((p.providerClass || "credential") !== providerClass) continue;
            n += 1;
        }
        return n;
    };

    const handleTypeClick = (opt) => {
        const installedCount = countInstancesOfType(
            opt.type,
            opt.providerClass
        );
        if (installedCount === 0) {
            setPendingType(opt);
        } else {
            onChange({ type: opt.type, providerClass: opt.providerClass });
        }
    };

    const handleCreateNew = () => {
        if (!pendingType) return;
        try {
            window.dispatchEvent(
                new CustomEvent("dash:open-settings-create-provider", {
                    detail: {
                        type: pendingType.type,
                        providerClass: pendingType.providerClass,
                    },
                })
            );
        } catch (err) {
            console.warn(
                "[ChatProviderGate] Failed to dispatch open-settings-create-provider:",
                err
            );
        }
    };

    const handleSkipForNow = () => {
        if (!pendingType) return;
        onChange({
            type: pendingType.type,
            providerClass: pendingType.providerClass,
        });
    };

    const handleCancelPending = () => setPendingType(null);

    return (
        <div
            className={`absolute inset-0 z-10 overflow-y-auto ${bt.surface} backdrop-blur-sm flex flex-col`}
        >
            <div className="px-4 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon
                        icon="plug"
                        className={`h-4 w-4 ${bt.accent}`}
                    />
                    <h2 className={`text-sm font-semibold ${bt.text}`}>
                        Choose a provider type for this widget
                    </h2>
                </div>
                <p className={`text-xs ${bt.muted} leading-snug`}>
                    The AI will write code targeting the type you pick. After
                    selecting, you'll bind a specific provider instance in the
                    preview pane. Pick "No external provider" for self-contained
                    widgets (clock, counter, etc.).
                </p>
            </div>

            <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
                {pendingType && (
                    <div
                        className={`rounded-md border ${borderColor} ${bt.status.warning.bg} px-3 py-3 space-y-3`}
                    >
                        <div
                            className={`text-sm font-semibold ${bt.status.warning.text}`}
                        >
                            No {pendingType.type} providers configured yet
                        </div>
                        <p
                            className={`text-xs ${bt.status.warning.text} leading-snug`}
                        >
                            You haven't added any{" "}
                            <span className="font-mono">
                                {pendingType.type}
                            </span>{" "}
                            providers in Settings yet. You can create one now,
                            or skip and add an instance later via the preview
                            pane's "Add new" button.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className={`px-3 py-2 rounded text-xs ${bt.primaryFill} font-medium transition-colors text-left`}
                            >
                                Create new {pendingType.type} provider
                                <span className="ml-2 text-[10px] opacity-80">
                                    (closes builder, opens Settings)
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSkipForNow}
                                className={`px-3 py-2 rounded text-xs ${bt.status.warning.solidBg} ${bt.status.warning.text} transition-colors text-left`}
                            >
                                Skip for now
                                <span className="ml-2 text-[10px] opacity-80">
                                    (proceed; widget will declare the type but
                                    won't connect until you add an instance)
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelPending}
                                className={`px-3 py-2 rounded text-xs ${bt.muted} hover:opacity-100 ${bt.hoverSurface} transition-colors text-left`}
                            >
                                Cancel — pick a different type
                            </button>
                        </div>
                    </div>
                )}

                {!pendingType && hasTypes && (
                    <div>
                        <div
                            className={`text-[10px] uppercase tracking-wider ${bt.muted} mb-1.5`}
                        >
                            Provider types
                        </div>
                        <div
                            className={`rounded-md border ${borderColor} ${bt.surface}`}
                        >
                            {typeOptions.map((opt) => (
                                <button
                                    key={`${opt.type}|${opt.providerClass}`}
                                    type="button"
                                    onClick={() => handleTypeClick(opt)}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs ${bt.text} ${bt.hoverSurface} transition-colors`}
                                >
                                    <span className="truncate text-left">
                                        {opt.type}
                                    </span>
                                    <span className="ml-2 flex items-center gap-1 shrink-0">
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded ${bt.raised} ${bt.text}`}
                                        >
                                            {opt.providerClass}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!pendingType && (
                    <div>
                        <div
                            className={`text-[10px] uppercase tracking-wider ${bt.muted} mb-1.5`}
                        >
                            Or skip the provider
                        </div>
                        <button
                            type="button"
                            onClick={() => onChange(NONE_SENTINEL)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs ${bt.text} rounded-md border ${borderColor} ${bt.surface} ${bt.hoverSurface} transition-colors`}
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
                )}

                {!pendingType && !hasTypes && (
                    <div
                        className={`rounded-md border ${borderColor} ${bt.status.warning.bg} px-3 py-2 text-[11px] ${bt.status.warning.text} leading-snug`}
                    >
                        No provider types available. The MCP catalog may not
                        have loaded yet, or you may be running in an offline
                        environment. Pick "No external provider" above for a
                        self-contained widget, or close this modal and try again
                        once catalogs load.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatProviderGate;
