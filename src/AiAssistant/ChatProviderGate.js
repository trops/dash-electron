/**
 * ChatProviderGate
 *
 * The start of the Build chat in WidgetBuilderModal. Until the user picks a
 * provider TYPE (or "No external provider") the AI chat isn't mounted, so
 * the AI's instructions name the right type from its first reply.
 *
 * Three views, all laid out like the chat they lead into (design guide,
 * layout rule 16 — the message box sits at the bottom):
 *
 *   - Start (no prompt yet, `onPrompt` given): an empty state, "Describe
 *     the widget you want", and the message box. Sending calls
 *     `onPrompt(text)`; the host passes it back as `prompt`, which turns
 *     the gate into the question below. "Pick the data first…" opens the
 *     list instead.
 *   - Question (`prompt`, create-entry PRD CRE-005 AC2): the user's message,
 *     then "Which data should this widget use?" with a few likely types
 *     guessed from it, "No external provider" and "Choose another…".
 *   - List: every type as a row (icon, readable name, whether it's set up),
 *     with a filter.
 *
 * Type-first architecture: the list draws types from three sources,
 * deduped on (type, providerClass):
 *
 *   1. Built-in MCP catalog              → class = "mcp"
 *   2. Known-external MCP catalog        → class = "mcp"
 *   3. Installed providers' types        → class = whatever was saved
 *                                          (e.g. "credential" for
 *                                          algolia-style providers)
 *
 * Selection emits `{ type, providerClass }` — no instance name. Which
 * account ("Algolia Prod / Dev") is picked later in the preview's
 * `PreviewProviderPicker`.
 *
 * Picking a type with no account set up asks first: set one up now (opens
 * Settings → Providers), skip for now, or pick something else.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext, resolveIcon } from "@trops/dash-core";
import {
    Button,
    Button2,
    Button3,
    ChatComposer,
    ChatMessage,
    EmptyState,
    FontAwesomeIcon,
    ListRow,
    PanelHeader,
    SearchInput,
} from "@trops/dash-react";
import { useBuilderTheme } from "./useBuilderTheme";
import { suggestProviderTypes } from "./providerSuggestions";

const NONE_SENTINEL = { sentinel: "none" };

/** "google-calendar" → "Google Calendar" (for types without a catalog name). */
export function typeLabel(type) {
    return String(type || "")
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

/** The row's second line: whether the user has an account for the type. */
export function setupLine(count) {
    if (count === 0) return "Not set up yet";
    return `Set up · ${count} account${count === 1 ? "" : "s"}`;
}

const rowIcon = (icon) => {
    const resolved = resolveIcon ? resolveIcon(icon) : icon;
    return !resolved || resolved === "puzzle-piece" ? "plug" : resolved;
};

export const ChatProviderGate = ({
    onChange,
    builtInCatalog = [],
    knownExternalCatalog = [],
    // The user's description (from the Create screen, or typed here) →
    // question mode.
    prompt = null,
    // Called with the text sent from the start view's message box, or
    // with null to go back and edit it.
    onPrompt = null,
    // The prompt was typed here (not from Create), so it can be edited.
    canEditPrompt = false,
}) => {
    const appContext = useContext(AppContext);
    const bt = useBuilderTheme();

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
    const typeOptions = useMemo(() => {
        const seen = new Map();

        const addEntry = (type, providerClass, label, icon) => {
            if (!type || !providerClass) return;
            const key = `${type}|${providerClass}`;
            if (seen.has(key)) return;
            seen.set(key, {
                type,
                providerClass,
                label: label || typeLabel(type),
                icon: icon || null,
            });
        };

        for (const entry of builtInCatalog || []) {
            if (!entry?.id) continue;
            addEntry(entry.id, "mcp", entry.name, entry.icon);
        }
        for (const entry of knownExternalCatalog || []) {
            if (!entry?.id) continue;
            addEntry(entry.id, "mcp", entry.name, entry.icon);
        }
        for (const p of Object.values(installedProviders || {})) {
            if (!p?.type) continue;
            addEntry(p.type, p.providerClass || "credential", null, null);
        }

        return Array.from(seen.values()).sort((a, b) =>
            a.label.localeCompare(b.label)
        );
    }, [builtInCatalog, knownExternalCatalog, installedProviders]);

    const hasTypes = typeOptions.length > 0;

    // The list shows when asked for, or when there's no way to start from a
    // message (no prompt and no onPrompt).
    const [showAll, setShowAll] = useState(!prompt && !onPrompt);
    const [filter, setFilter] = useState("");
    const [draft, setDraft] = useState("");
    const suggestions = useMemo(
        () =>
            prompt
                ? suggestProviderTypes(prompt, typeOptions, {
                      installedTypes: new Set(
                          Object.values(installedProviders || {})
                              .map((p) => p && p.type)
                              .filter(Boolean)
                      ),
                  })
                : [],
        [prompt, typeOptions, installedProviders]
    );

    // A type picked that has no account yet — asks before going on.
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
        if (countInstancesOfType(opt.type, opt.providerClass) === 0) {
            setPendingType(opt);
        } else {
            onChange({ type: opt.type, providerClass: opt.providerClass });
        }
    };

    // Closes the builder and opens Settings → Providers in create mode with
    // the type chosen (Dash.js + DashboardStage listeners).
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

    // The widget declares the type; the preview's "Add new" connects an
    // account later.
    const handleSkipForNow = () => {
        if (!pendingType) return;
        onChange({
            type: pendingType.type,
            providerClass: pendingType.providerClass,
        });
    };

    const frame = "flex flex-col flex-1 min-h-0";
    const scroller = "flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 p-4";
    // The message box stays at the bottom while the gate waits for a pick
    // (layout rule 16); the chat starts once the data is picked.
    const waitingComposer = (
        <ChatComposer
            value=""
            disabled
            placeholder="Pick which data to use above"
            ariaLabel="Message"
            hint="The chat starts once the data is picked."
        />
    );
    const yourMessage = prompt ? (
        <div className="flex flex-col items-end gap-1">
            <ChatMessage role="you">{prompt}</ChatMessage>
            {canEditPrompt && onPrompt ? (
                <Button3
                    size="sm"
                    title="Edit description"
                    onClick={() => {
                        setPendingType(null);
                        setDraft(prompt);
                        onPrompt(null);
                    }}
                />
            ) : null}
        </div>
    ) : null;

    if (pendingType) {
        const name = pendingType.label || typeLabel(pendingType.type);
        return (
            <div className={frame} data-testid="provider-setup">
                <div className={scroller}>
                    {yourMessage}
                    <div
                        role="alert"
                        className={`flex flex-col gap-3 rounded-lg border p-4 ${bt.status.warning.bg} ${bt.status.warning.border}`}
                    >
                        <div
                            className={`text-sm font-semibold ${bt.status.warning.text}`}
                        >
                            {name} isn't set up yet
                        </div>
                        <p
                            className={`text-sm leading-snug ${bt.status.warning.text}`}
                        >
                            The widget can be written for {name} now, but it
                            shows no data until you connect an account. Set one
                            up now (this closes the builder and opens Settings),
                            or skip and connect one later from the preview.
                        </p>
                        <div className="flex flex-row flex-wrap gap-2">
                            <Button
                                title={`Set up ${name}`}
                                size="sm"
                                onClick={handleCreateNew}
                            />
                            <Button2
                                title="Skip for now"
                                size="sm"
                                onClick={handleSkipForNow}
                            />
                            <Button2
                                title="Pick something else"
                                size="sm"
                                onClick={() => setPendingType(null)}
                            />
                        </div>
                    </div>
                </div>
                {waitingComposer}
            </div>
        );
    }

    if (!showAll && prompt) {
        return (
            <div className={frame} data-testid="provider-question">
                <div className={scroller}>
                    {yourMessage}
                    <ChatMessage role="reply" label="Widget Builder">
                        <div className="flex flex-col gap-3">
                            <div className={`text-sm font-semibold ${bt.text}`}>
                                Which data should this widget use?
                            </div>
                            <p className={`text-sm leading-snug ${bt.muted}`}>
                                I'll write the widget for the kind of data you
                                pick. You choose which account in the preview.
                            </p>
                            <div className="flex flex-row flex-wrap gap-2">
                                {suggestions.map((opt) => {
                                    const notSetUp =
                                        countInstancesOfType(
                                            opt.type,
                                            opt.providerClass
                                        ) === 0;
                                    return (
                                        <Button2
                                            key={`${opt.type}|${opt.providerClass}`}
                                            size="sm"
                                            onClick={() => handleTypeClick(opt)}
                                            title={
                                                notSetUp
                                                    ? `${opt.label} · not set up`
                                                    : opt.label
                                            }
                                        />
                                    );
                                })}
                                <Button2
                                    size="sm"
                                    onClick={() => onChange(NONE_SENTINEL)}
                                    title="No external provider"
                                />
                                <Button2
                                    size="sm"
                                    onClick={() => setShowAll(true)}
                                    title="Choose another…"
                                />
                            </div>
                        </div>
                    </ChatMessage>
                </div>
                {waitingComposer}
            </div>
        );
    }

    if (!showAll) {
        const send = (text) => {
            const value = String(text || "").trim();
            if (!value) return;
            setDraft("");
            onPrompt(value);
        };
        return (
            <div className={frame} data-testid="provider-start">
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center p-4">
                    <EmptyState
                        icon={
                            <FontAwesomeIcon
                                icon="wand-magic-sparkles"
                                className="h-6 w-6"
                            />
                        }
                        title="Describe the widget you want"
                        description="Say what it should show. The builder asks which data to use, then writes it."
                    >
                        <Button2
                            size="sm"
                            title="Pick the data first…"
                            onClick={() => setShowAll(true)}
                        />
                    </EmptyState>
                </div>
                <ChatComposer
                    value={draft}
                    onChange={(v) => setDraft(v)}
                    onSend={send}
                    placeholder="e.g. My open GitHub pull requests"
                    ariaLabel="Describe the widget"
                />
            </div>
        );
    }

    const q = filter.trim().toLowerCase();
    const shown = q
        ? typeOptions.filter(
              (o) =>
                  o.label.toLowerCase().includes(q) ||
                  o.type.toLowerCase().includes(q)
          )
        : typeOptions;
    const canGoBack = !!prompt || !!onPrompt;

    return (
        <div className={frame} data-testid="provider-list">
            <PanelHeader
                title="Choose the data for this widget"
                glyph="plug"
                onBack={canGoBack ? () => setShowAll(false) : null}
                backLabel={prompt ? "Back to the question" : "Back"}
            />
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
                <p className={`text-sm leading-snug ${bt.muted}`}>
                    The AI writes the widget for the kind of data you pick. You
                    choose which account in the preview.
                </p>
                {hasTypes ? (
                    <>
                        <SearchInput
                            value={filter}
                            onChange={(v) => setFilter(v)}
                            placeholder="Filter…"
                            ariaLabel="Filter data sources"
                        />
                        <div className="flex flex-col gap-0.5">
                            {shown.map((opt) => (
                                <ListRow
                                    key={`${opt.type}|${opt.providerClass}`}
                                    icon={rowIcon(opt.icon)}
                                    title={opt.label}
                                    meta={setupLine(
                                        countInstancesOfType(
                                            opt.type,
                                            opt.providerClass
                                        )
                                    )}
                                    onClick={() => handleTypeClick(opt)}
                                />
                            ))}
                            {shown.length === 0 ? (
                                <p className={`text-sm px-2 py-2 ${bt.muted}`}>
                                    Nothing matches “{filter.trim()}”.
                                </p>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <div
                        role="alert"
                        className={`rounded-lg border p-4 text-sm leading-snug ${bt.status.warning.bg} ${bt.status.warning.border} ${bt.text}`}
                    >
                        No data sources are available yet — the catalog may
                        still be loading, or you may be offline. Pick “No
                        external provider” below for a self-contained widget, or
                        close the builder and try again.
                    </div>
                )}
                <div
                    className={`flex flex-col gap-0.5 pt-3 border-t ${bt.border}`}
                >
                    <ListRow
                        icon="circle-minus"
                        title="No external provider"
                        meta="Clocks, counters, static displays"
                        onClick={() => onChange(NONE_SENTINEL)}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatProviderGate;
