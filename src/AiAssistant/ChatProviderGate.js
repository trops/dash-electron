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
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";

const NONE_SENTINEL = { sentinel: "none" };

export const ChatProviderGate = ({
    onChange,
    builtInCatalog = [],
    knownExternalCatalog = [],
}) => {
    const appContext = useContext(AppContext);
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

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
                        Choose a provider type for this widget
                    </h2>
                </div>
                <p className="text-xs text-gray-400 leading-snug">
                    The AI will write code targeting the type you pick. After
                    selecting, you'll bind a specific provider instance in the
                    preview pane. Pick "No external provider" for self-contained
                    widgets (clock, counter, etc.).
                </p>
            </div>

            <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
                {hasTypes && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
                            Provider types
                        </div>
                        <div
                            className={`rounded-md border ${borderColor} bg-gray-800/40 divide-y divide-gray-700/40`}
                        >
                            {typeOptions.map((opt) => (
                                <button
                                    key={`${opt.type}|${opt.providerClass}`}
                                    type="button"
                                    onClick={() =>
                                        onChange({
                                            type: opt.type,
                                            providerClass: opt.providerClass,
                                        })
                                    }
                                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    <span className="truncate text-left">
                                        {opt.type}
                                    </span>
                                    <span className="ml-2 flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-200">
                                            {opt.providerClass}
                                        </span>
                                    </span>
                                </button>
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

                {!hasTypes && (
                    <div
                        className={`rounded-md border ${borderColor} bg-amber-900/15 px-3 py-2 text-[11px] text-amber-200 leading-snug`}
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
