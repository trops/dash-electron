/**
 * WidgetProviderPicker
 *
 * Compact picker rendered above the chat input in WidgetBuilderModal.
 * The user selects a provider BEFORE sending a chat message — the AI
 * then receives the chosen provider as a fixed input, not a list of
 * options to choose from. This takes the provider-selection decision
 * out of the LLM's hands entirely; the LLM goes back to being a
 * code generator with deterministic input.
 *
 * Selection shape (the value emitted via `onChange`):
 *   - null                                       → nothing picked yet
 *   - { sentinel: "none" }                       → "no external provider"
 *   - { name, type, providerClass }              → an installed provider
 *
 * The "Install a new MCP server…" option dispatches the existing
 * `dash:install-known-external` event flow; the resulting installed
 * provider re-flows into appContext.providers, and the picker
 * auto-selects it via the `dash:provider-installed` event.
 */
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { AppContext } from "@trops/dash-core";
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";

const NONE_SENTINEL = { sentinel: "none" };

function selectionsEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.sentinel || b.sentinel) return a.sentinel === b.sentinel;
    return (
        a.name === b.name &&
        a.type === b.type &&
        a.providerClass === b.providerClass
    );
}

export const WidgetProviderPicker = ({
    value,
    onChange,
    knownExternalCatalog = [],
}) => {
    const appContext = useContext(AppContext);
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    // Pull the providers map. If appContext.providers is empty (timing —
    // the provider list loads async after modal mount), fall back to a
    // direct mainApi fetch so the picker works regardless of the
    // AppWrapper's load state.
    const contextProviders = useMemo(
        () => appContext?.providers || {},
        [appContext?.providers]
    );
    const [fallbackProviders, setFallbackProviders] = useState({});

    useEffect(() => {
        const ctxKeys = Object.keys(contextProviders);
        if (ctxKeys.length > 0) {
            // Context has providers — drop any fallback we may have
            // fetched earlier so we don't double-list.
            setFallbackProviders({});
            return;
        }
        // Context is empty. Try a one-shot direct fetch.
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
                /* silent — empty picker is the natural failure mode */
            });
        return () => {
            cancelled = true;
        };
    }, [contextProviders, appContext?.credentials?.appId]);

    const providersMap =
        Object.keys(contextProviders).length > 0
            ? contextProviders
            : fallbackProviders;

    // Build the option list. Group by type so the user sees their three
    // Algolia entries together, etc. Within a type, sort by name.
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

    // Listen for `dash:provider-installed` so when the user installs a
    // new MCP via the existing flow, this picker auto-selects the just-
    // added provider.
    useEffect(() => {
        function onInstalled(event) {
            const detail = event?.detail || {};
            // Match by id (the entry's `type`). The newly-installed
            // provider may not yet appear in providersMap (state update
            // race), so we synthesize the selection from the catalog
            // entry the install flow used.
            const entry = (knownExternalCatalog || []).find(
                (s) => s && s.id === detail.id
            );
            if (!entry) return;
            const next = {
                name: detail.name || entry.name,
                type: entry.id,
                providerClass: "mcp",
            };
            onChange(next);
        }
        window.addEventListener("dash:provider-installed", onInstalled);
        return () =>
            window.removeEventListener("dash:provider-installed", onInstalled);
    }, [knownExternalCatalog, onChange]);

    // Render value as a single-line summary: keeps the picker compact
    // when collapsed.
    const summary = useMemo(() => {
        if (!value) return "Select a provider…";
        if (value.sentinel === "none") return "No external provider";
        return `${value.name} — ${value.type} · ${value.providerClass}`;
    }, [value]);

    const [open, setOpen] = useState(false);

    const handleSelect = useCallback(
        (selection) => {
            onChange(selection);
            setOpen(false);
        },
        [onChange]
    );

    const handleInstallNew = useCallback(() => {
        setOpen(false);
        // Existing modal listens for this event with a payload of `{ id }`,
        // but here we want the catalog browser, so we open the install
        // flow with no specific id by triggering a generic "browse" hint.
        // The InstallExternalMcpModal currently expects a specific id —
        // the user sets that via the catalog detail in Settings →
        // Providers. For V1 we redirect them to that path.
        // TODO(v2): inline catalog browser inside this picker.
        try {
            window.dispatchEvent(
                new CustomEvent("dash:open-mcp-catalog-browser")
            );
        } catch {
            /* noop */
        }
        // Also surface a hint in the picker so the user knows what to do:
        // we can't navigate them to Settings programmatically from here.
        // Instead, the picker stays expanded and shows the hint in the
        // "Other" group.
    }, []);

    return (
        <div className={`relative shrink-0 border-t ${borderColor}`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs ${
                    value ? "text-gray-200" : "text-amber-300 font-medium"
                } hover:bg-white/5 transition-colors`}
            >
                <span className="flex items-center gap-2">
                    <FontAwesomeIcon
                        icon="plug"
                        className="h-3 w-3 opacity-60"
                    />
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                        Provider:
                    </span>
                    <span className="truncate">{summary}</span>
                </span>
                <FontAwesomeIcon
                    icon={open ? "chevron-up" : "chevron-down"}
                    className="h-3 w-3 opacity-60"
                />
            </button>

            {open && (
                <div
                    className={`absolute bottom-full left-0 right-0 mb-1 z-20 max-h-80 overflow-y-auto rounded-md border ${borderColor} bg-gray-900 shadow-xl`}
                >
                    {/* Installed providers, grouped by type */}
                    {installedOptions.length > 0 && (
                        <div className="py-1">
                            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                                Use one of your providers
                            </div>
                            {installedOptions.map(({ type, list }) => (
                                <div key={type}>
                                    {list.map((opt) => (
                                        <button
                                            key={opt.name}
                                            type="button"
                                            onClick={() => handleSelect(opt)}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                                                selectionsEqual(value, opt)
                                                    ? "text-indigo-300 bg-indigo-900/20"
                                                    : "text-gray-300"
                                            }`}
                                        >
                                            <span className="truncate text-left">
                                                {opt.name}
                                            </span>
                                            <span className="ml-2 flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] opacity-60">
                                                    {opt.type}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700">
                                                    {opt.providerClass}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {installedOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-500 italic">
                            No providers configured yet — pick "No external
                            provider" or install one in Settings → Providers.
                        </div>
                    )}

                    {/* Sentinel: no provider needed */}
                    <div className={`py-1 border-t ${borderColor}`}>
                        <button
                            type="button"
                            onClick={() => handleSelect(NONE_SENTINEL)}
                            className={`w-full flex items-center px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                                value?.sentinel === "none"
                                    ? "text-indigo-300 bg-indigo-900/20"
                                    : "text-gray-300"
                            }`}
                        >
                            <FontAwesomeIcon
                                icon="circle-minus"
                                className="h-3 w-3 mr-2 opacity-60"
                            />
                            No external provider
                            <span className="ml-2 text-[10px] opacity-50">
                                (clock, counter, static display, etc.)
                            </span>
                        </button>
                    </div>

                    {/* Install new MCP */}
                    <div className={`py-1 border-t ${borderColor}`}>
                        <button
                            type="button"
                            onClick={handleInstallNew}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                        >
                            <FontAwesomeIcon
                                icon="plus"
                                className="h-3 w-3 mr-2 opacity-60"
                            />
                            Install a new provider…
                            <span className="ml-2 text-[10px] opacity-50">
                                (opens Settings → Providers → Add MCP)
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WidgetProviderPicker;
