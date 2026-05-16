import React, { useMemo, useState } from "react";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { useMcpTools } from "../mcpToolsQuery";
import { scoreMethodList } from "./wireMatching";

/**
 * WirePicker — Compose-mode Stage 3 in-place picker.
 *
 * Renders inside a property-inspector row whenever a slot is in
 * wire mode and unconfigured (`{ provider: null, method: null }`).
 *
 * Two-step flow within the same compact space:
 *
 *   1. Provider step — list of the user's configured providers
 *      from app.providers, filtered to known classes (credential
 *      registered in providerApiRegistry, or class="mcp").
 *      Clicking a provider advances to step 2.
 *
 *   2. Method step — list of methods filtered by return-shape
 *      compatibility with the slot's expected schema type
 *      (Table.data → Array-returning methods only). MCP tools are
 *      enumerated asynchronously via useMcpTools.
 *      Clicking a method calls `onPick(wireSpec)` with:
 *        { provider, providerType, providerClass, method }
 *
 * A "← Back" link returns from method step to provider step. The
 * provider list itself has no Back — the slot-mode toggle does
 * that job.
 *
 * The picker does NOT close itself — the parent (PropertyInspector)
 * decides whether to swap to the WiredSlotSummary (filled) or stay
 * on the picker (cleared) based on the wire spec it sees afterwards.
 */
export function WirePicker({ propName, expectedType, providers, onPick }) {
    const [pickedProvider, setPickedProvider] = useState(null);

    // Filter providers to ones we can actually wire methods for.
    // credential providers must have a corresponding entry in
    // PROVIDER_API_REGISTRY; mcp providers always qualify (tools
    // are runtime-enumerated).
    const candidates = useMemo(() => {
        const out = [];
        for (const [name, p] of Object.entries(providers || {})) {
            if (!p) continue;
            const providerClass = p.providerClass || "credential";
            if (
                providerClass === "credential" &&
                PROVIDER_API_REGISTRY[p.type]
            ) {
                out.push({
                    name,
                    type: p.type,
                    providerClass,
                });
            } else if (providerClass === "mcp") {
                out.push({
                    name,
                    type: p.type,
                    providerClass,
                    // The MCP listTools bridge takes a serverName;
                    // dash-core uses the provider name itself by
                    // convention when no explicit serverName is set.
                    serverName: p.serverName || name,
                });
            }
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }, [providers]);

    if (!pickedProvider) {
        return (
            <ProviderStep
                propName={propName}
                candidates={candidates}
                onPick={setPickedProvider}
            />
        );
    }

    return (
        <MethodStep
            propName={propName}
            expectedType={expectedType}
            provider={pickedProvider}
            onBack={() => setPickedProvider(null)}
            onPick={(method) =>
                onPick({
                    provider: pickedProvider.name,
                    providerType: pickedProvider.type,
                    providerClass: pickedProvider.providerClass,
                    method,
                })
            }
        />
    );
}

function ProviderStep({ propName, candidates, onPick }) {
    if (candidates.length === 0) {
        return (
            <div
                className="text-[11px] px-2 py-1.5 rounded border border-dashed border-gray-700 bg-gray-900/50 text-gray-500"
                data-testid={`composer-wire-empty-${propName}`}
            >
                No wirable providers configured. Add a credential or MCP
                provider in Settings → Providers.
            </div>
        );
    }
    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1"
            data-testid={`composer-wire-providers-${propName}`}
        >
            <div className="text-[10px] uppercase tracking-wide text-gray-500 px-1 mb-1">
                Pick a provider
            </div>
            <div className="flex flex-col">
                {candidates.map((p) => (
                    <button
                        key={p.name}
                        type="button"
                        onClick={() => onPick(p)}
                        className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200 flex items-center justify-between"
                        data-testid={`composer-wire-provider-${propName}-${p.name}`}
                    >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-gray-500 ml-2">
                            {p.type} ({p.providerClass})
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function MethodStep({ propName, expectedType, provider, onBack, onPick }) {
    if (provider.providerClass === "mcp") {
        return (
            <McpMethodStep
                propName={propName}
                provider={provider}
                onBack={onBack}
                onPick={onPick}
            />
        );
    }
    return (
        <CredentialMethodStep
            propName={propName}
            expectedType={expectedType}
            provider={provider}
            onBack={onBack}
            onPick={onPick}
        />
    );
}

function CredentialMethodStep({
    propName,
    expectedType,
    provider,
    onBack,
    onPick,
}) {
    const ranked = useMemo(() => {
        const registry = PROVIDER_API_REGISTRY[provider.type] || {};
        return scoreMethodList(Object.entries(registry), expectedType);
    }, [provider.type, expectedType]);

    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Methods on ${provider.name}`}
                expectedType={expectedType}
                onBack={onBack}
            />
            {ranked.length === 0 ? (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    No methods on this provider return a shape compatible with{" "}
                    <code className="text-gray-400">{expectedType}</code>.
                </div>
            ) : (
                <div className="flex flex-col">
                    {ranked.map(({ name, spec, score }) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onPick(name)}
                            className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                            data-testid={`composer-wire-method-${propName}-${name}`}
                            title={spec.desc || ""}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-mono">{name}</span>
                                <span className="text-[10px] text-gray-500 ml-2">
                                    {spec.returns &&
                                        spec.returns.type &&
                                        truncate(spec.returns.type, 32)}
                                    {score === 1 && (
                                        <span className="ml-1 text-yellow-500/70">
                                            ~
                                        </span>
                                    )}
                                </span>
                            </div>
                            {spec.desc && (
                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                    {spec.desc}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function McpMethodStep({ propName, provider, onBack, onPick }) {
    const { status, tools, error } = useMcpTools(provider.serverName, null);
    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Tools on ${provider.name}`}
                expectedType="(MCP)"
                onBack={onBack}
            />
            {status === "loading" && (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    Loading tools from {provider.serverName}…
                </div>
            )}
            {status === "error" && (
                <div className="text-[11px] text-red-400 px-2 py-1">
                    {error || "Failed to load tools"}
                </div>
            )}
            {status === "ok" && tools.length === 0 && (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    No tools exposed by this server.
                </div>
            )}
            {status === "ok" && tools.length > 0 && (
                <div className="flex flex-col">
                    {tools.map((tool) => (
                        <button
                            key={tool.name}
                            type="button"
                            onClick={() => onPick(tool.name)}
                            className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                            data-testid={`composer-wire-method-${propName}-${tool.name}`}
                            title={tool.description || ""}
                        >
                            <span className="font-mono">{tool.name}</span>
                            {tool.description && (
                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                    {tool.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function PickerHeader({ title, expectedType, onBack }) {
    return (
        <div className="flex items-center justify-between px-1 mb-1">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
                {title}{" "}
                {expectedType && (
                    <span className="text-gray-600">
                        → <code>{expectedType}</code>
                    </span>
                )}
            </div>
            <button
                type="button"
                onClick={onBack}
                className="text-[10px] text-indigo-400 hover:text-indigo-200"
                data-testid="composer-wire-back"
            >
                ← Back
            </button>
        </div>
    );
}

function truncate(s, max) {
    if (typeof s !== "string") return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Read-only display of a configured wire spec. Rendered by the
 * property inspector once the picker has set a method. Shows the
 * provider + method and offers Change (clear method but stay in
 * wire mode → picker reappears) and Static (flip the slot back to
 * a literal value).
 */
export function WiredSlotSummary({ propName, wire, onChange, onStatic }) {
    return (
        <div
            className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded border border-indigo-700/40 bg-indigo-900/20 text-indigo-200"
            data-testid={`composer-wire-summary-${propName}`}
        >
            <div className="min-w-0">
                <span className="text-gray-400">Wired to: </span>
                <span className="font-mono">
                    {wire.provider}.{wire.method}
                </span>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
                <button
                    type="button"
                    onClick={onChange}
                    className="text-[10px] text-indigo-300 hover:text-indigo-100 underline"
                    data-testid={`composer-wire-change-${propName}`}
                >
                    Change
                </button>
                <button
                    type="button"
                    onClick={onStatic}
                    className="text-[10px] text-gray-400 hover:text-gray-200 underline"
                    data-testid={`composer-wire-revert-${propName}`}
                >
                    Static
                </button>
            </div>
        </div>
    );
}
