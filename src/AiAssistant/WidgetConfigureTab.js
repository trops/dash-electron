/**
 * WidgetConfigureTab
 *
 * User-friendly form for editing the .dash.js widget configuration.
 * Provides sections for widget info, providers, events, handlers, and userConfig fields.
 */
import React, { useState, useEffect, useCallback, useContext } from "react";
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";

const PROVIDER_TYPES = [
    "algolia",
    "slack",
    "github",
    "gong",
    "google-calendar",
    "google-drive",
    "gmail",
    "notion",
    "filesystem",
    "anthropic",
    "other",
];

const FIELD_TYPES = [
    "text",
    "number",
    "boolean",
    "select",
    "textarea",
    "color",
    "password",
];

// Parse a .dash.js config string into a structured object
function parseConfigCode(configCode) {
    if (!configCode) return null;
    try {
        // Remove "export default" and trailing semicolon to get the object literal
        let cleaned = configCode
            .replace(/^export\s+default\s+/, "")
            .replace(/;\s*$/, "")
            .trim();
        // Use Function to evaluate (safer than eval, sandboxed to this context)
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${cleaned})`);
        return fn();
    } catch {
        return null;
    }
}

// Serialize structured config data back to a .dash.js string
function serializeConfig(componentName, data) {
    const config = {
        component: componentName,
        name: data.name || componentName,
        type: "widget",
        canHaveChildren: false,
        workspace: data.workspace || "ai-built",
    };

    if (data.author) config.author = data.author;

    if (data.providers && data.providers.length > 0) {
        config.providers = data.providers;
    }

    if (data.events && data.events.length > 0) {
        config.events = data.events;
    }

    if (data.eventHandlers && data.eventHandlers.length > 0) {
        config.eventHandlers = data.eventHandlers;
    }

    if (data.userConfig && Object.keys(data.userConfig).length > 0) {
        config.userConfig = data.userConfig;
    }

    if (data.styles) {
        config.styles = data.styles;
    }

    return `export default ${JSON.stringify(config, null, 4)};`;
}

// Section header with optional add button
function SectionHeader({ title, icon, onAdd, borderColor }) {
    return (
        <div
            className={`flex items-center justify-between py-2 px-1 border-b ${
                borderColor || "border-gray-700"
            }`}
        >
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                <FontAwesomeIcon
                    icon={icon}
                    className="h-3 w-3 text-gray-500"
                />
                {title}
            </div>
            {onAdd && (
                <button
                    onClick={onAdd}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/10 transition-colors"
                >
                    <FontAwesomeIcon icon="plus" className="h-2 w-2" />
                    Add
                </button>
            )}
        </div>
    );
}

// Removable item wrapper
function RemovableItem({ children, onRemove, borderColor }) {
    return (
        <div
            className={`relative border ${
                borderColor || "border-gray-700/50"
            } rounded-lg p-3 mt-2 group`}
        >
            <button
                onClick={onRemove}
                className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
                <FontAwesomeIcon icon="times" className="h-3 w-3" />
            </button>
            {children}
        </div>
    );
}

// Small form field
function Field({ label, children, className = "" }) {
    return (
        <div className={`mb-2 ${className}`}>
            <label className="block text-[10px] text-gray-500 mb-0.5 uppercase tracking-wider">
                {label}
            </label>
            {children}
        </div>
    );
}

// Compact text input matching dark theme
function SmallInput({ value, onChange, placeholder, type = "text" }) {
    return (
        <input
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700/50 rounded text-gray-200 placeholder-gray-600 focus:border-indigo-500/50 focus:outline-none"
        />
    );
}

// Compact select
function SmallSelect({ value, onChange, options }) {
    return (
        <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
        >
            {options.map((opt) => (
                <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                </option>
            ))}
        </select>
    );
}

// Compact toggle
function SmallToggle({ checked, onChange, label }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={checked || false}
                onChange={(e) => onChange(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 h-3 w-3"
            />
            <span className="text-[10px] text-gray-400">{label}</span>
        </label>
    );
}

export const WidgetConfigureTab = ({
    configCode,
    componentName,
    onSave,
    borderColor,
    parsedConfig,
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const bc =
        borderColor ||
        currentTheme?.["border-primary-dark"] ||
        "border-gray-700";

    // Form state
    const [form, setForm] = useState({
        name: "",
        workspace: "ai-built",
        author: "AI Assistant",
        providers: [],
        events: [],
        eventHandlers: [],
        userConfig: {},
    });
    const [dirty, setDirty] = useState(false);

    // Populate form state from the most accurate source available:
    //   1. `parsedConfig` — the resolved config object the modal got
    //      from `evaluateBundle` + `extractWidgetConfigs`. Same source
    //      the actual widget renderer uses; handles imports, identifier
    //      refs, computed property names — everything valid JS.
    //   2. `parseConfigCode(configCode)` — naive string-eval fallback.
    //      Works for simple shapes without imports / identifier refs.
    //      Kept for legacy callers and the case where the bundle
    //      hasn't compiled yet.
    useEffect(() => {
        const parsed = parsedConfig || parseConfigCode(configCode);
        if (parsed) {
            setForm({
                name: parsed.name || parsed.displayName || componentName || "",
                workspace: parsed.workspace || "ai-built",
                author: parsed.author || "AI Assistant",
                providers: parsed.providers || [],
                events: parsed.events || [],
                eventHandlers: parsed.eventHandlers || [],
                userConfig: parsed.userConfig || {},
                styles: parsed.styles || null,
            });
            setDirty(false);
        }
    }, [parsedConfig, configCode, componentName]);

    // Update a top-level field
    const updateField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setDirty(true);
    }, []);

    // Provider helpers
    const addProvider = () => {
        updateField("providers", [
            ...form.providers,
            {
                type: "",
                providerClass: "credential",
                required: true,
                credentialSchema: {},
            },
        ]);
    };
    const removeProvider = (idx) => {
        updateField(
            "providers",
            form.providers.filter((_, i) => i !== idx)
        );
    };
    const updateProvider = (idx, field, value) => {
        const updated = [...form.providers];
        updated[idx] = { ...updated[idx], [field]: value };
        setForm((prev) => ({ ...prev, providers: updated }));
        setDirty(true);
    };

    // Event helpers
    const addEvent = () => updateField("events", [...form.events, ""]);
    const removeEvent = (idx) =>
        updateField(
            "events",
            form.events.filter((_, i) => i !== idx)
        );
    const updateEvent = (idx, value) => {
        const updated = [...form.events];
        updated[idx] = value;
        updateField("events", updated);
    };

    // Event handler helpers
    const addHandler = () =>
        updateField("eventHandlers", [...form.eventHandlers, ""]);
    const removeHandler = (idx) =>
        updateField(
            "eventHandlers",
            form.eventHandlers.filter((_, i) => i !== idx)
        );
    const updateHandler = (idx, value) => {
        const updated = [...form.eventHandlers];
        updated[idx] = value;
        updateField("eventHandlers", updated);
    };

    // UserConfig helpers
    const addUserConfigField = () => {
        const key = `field${Object.keys(form.userConfig).length + 1}`;
        updateField("userConfig", {
            ...form.userConfig,
            [key]: {
                type: "text",
                defaultValue: "",
                displayName: "",
                required: false,
            },
        });
    };
    const removeUserConfigField = (key) => {
        const updated = { ...form.userConfig };
        delete updated[key];
        updateField("userConfig", updated);
    };
    const updateUserConfigField = (key, field, value) => {
        setForm((prev) => ({
            ...prev,
            userConfig: {
                ...prev.userConfig,
                [key]: { ...prev.userConfig[key], [field]: value },
            },
        }));
        setDirty(true);
    };
    const renameUserConfigKey = (oldKey, newKey) => {
        if (newKey === oldKey || !newKey) return;
        const entries = Object.entries(form.userConfig);
        const updated = {};
        for (const [k, v] of entries) {
            updated[k === oldKey ? newKey : k] = v;
        }
        updateField("userConfig", updated);
    };

    // Save handler
    const handleSave = () => {
        const serialized = serializeConfig(componentName, form);
        onSave(serialized);
        setDirty(false);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
                {/* Widget Info */}
                <div>
                    <SectionHeader
                        title="Widget Info"
                        icon="info-circle"
                        borderColor={bc}
                    />
                    <div className="mt-2 space-y-2">
                        <Field label="Display Name">
                            <SmallInput
                                value={form.name}
                                onChange={(v) => updateField("name", v)}
                                placeholder="My Widget"
                            />
                        </Field>
                        <div className="flex gap-2">
                            <Field label="Workspace" className="flex-1">
                                <SmallInput
                                    value={form.workspace}
                                    onChange={(v) =>
                                        updateField("workspace", v)
                                    }
                                    placeholder="ai-built"
                                />
                            </Field>
                            <Field label="Author" className="flex-1">
                                <SmallInput
                                    value={form.author}
                                    onChange={(v) => updateField("author", v)}
                                    placeholder="AI Assistant"
                                />
                            </Field>
                        </div>
                    </div>
                </div>

                {/* Providers */}
                <div>
                    <SectionHeader
                        title="Providers"
                        icon="plug"
                        onAdd={addProvider}
                        borderColor={bc}
                    />
                    {form.providers.length === 0 && (
                        <p className="text-[10px] text-gray-600 mt-2 italic">
                            No providers configured. Add one if your widget
                            connects to an external service.
                        </p>
                    )}
                    {form.providers.map((provider, idx) => (
                        <RemovableItem
                            key={idx}
                            onRemove={() => removeProvider(idx)}
                            borderColor={bc}
                        >
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Field label="Type" className="flex-1">
                                        <SmallSelect
                                            value={
                                                PROVIDER_TYPES.includes(
                                                    provider.type
                                                )
                                                    ? provider.type
                                                    : "other"
                                            }
                                            onChange={(v) =>
                                                updateProvider(
                                                    idx,
                                                    "type",
                                                    v === "other" ? "" : v
                                                )
                                            }
                                            options={PROVIDER_TYPES}
                                        />
                                    </Field>
                                    <Field label="Class" className="flex-1">
                                        <SmallSelect
                                            value={provider.providerClass}
                                            onChange={(v) =>
                                                updateProvider(
                                                    idx,
                                                    "providerClass",
                                                    v
                                                )
                                            }
                                            options={[
                                                "credential",
                                                "mcp",
                                                "websocket",
                                            ]}
                                        />
                                    </Field>
                                </div>
                                {!PROVIDER_TYPES.includes(provider.type) && (
                                    <Field label="Custom Type">
                                        <SmallInput
                                            value={provider.type}
                                            onChange={(v) =>
                                                updateProvider(idx, "type", v)
                                            }
                                            placeholder="my-service"
                                        />
                                    </Field>
                                )}
                                <SmallToggle
                                    checked={provider.required}
                                    onChange={(v) =>
                                        updateProvider(idx, "required", v)
                                    }
                                    label="Required"
                                />
                            </div>
                        </RemovableItem>
                    ))}
                </div>

                {/* Events Published */}
                <div>
                    <SectionHeader
                        title="Events (Published)"
                        icon="broadcast-tower"
                        onAdd={addEvent}
                        borderColor={bc}
                    />
                    {form.events.length === 0 && (
                        <p className="text-[10px] text-gray-600 mt-2 italic">
                            No events. Add events your widget publishes for
                            other widgets to listen to.
                        </p>
                    )}
                    <div className="mt-1 space-y-1">
                        {form.events.map((evt, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <SmallInput
                                    value={evt}
                                    onChange={(v) => updateEvent(idx, v)}
                                    placeholder="event-name"
                                />
                                <button
                                    onClick={() => removeEvent(idx)}
                                    className="text-gray-600 hover:text-red-400 shrink-0"
                                >
                                    <FontAwesomeIcon
                                        icon="times"
                                        className="h-2.5 w-2.5"
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Event Handlers */}
                <div>
                    <SectionHeader
                        title="Event Handlers (Subscribed)"
                        icon="headphones"
                        onAdd={addHandler}
                        borderColor={bc}
                    />
                    {form.eventHandlers.length === 0 && (
                        <p className="text-[10px] text-gray-600 mt-2 italic">
                            No handlers. Add handlers to listen for events from
                            other widgets.
                        </p>
                    )}
                    <div className="mt-1 space-y-1">
                        {form.eventHandlers.map((handler, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <SmallInput
                                    value={handler}
                                    onChange={(v) => updateHandler(idx, v)}
                                    placeholder="onEventName"
                                />
                                <button
                                    onClick={() => removeHandler(idx)}
                                    className="text-gray-600 hover:text-red-400 shrink-0"
                                >
                                    <FontAwesomeIcon
                                        icon="times"
                                        className="h-2.5 w-2.5"
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Config Fields */}
                <div>
                    <SectionHeader
                        title="User Config Fields"
                        icon="sliders-h"
                        onAdd={addUserConfigField}
                        borderColor={bc}
                    />
                    {Object.keys(form.userConfig).length === 0 && (
                        <p className="text-[10px] text-gray-600 mt-2 italic">
                            No config fields. Add fields that users can
                            customize when placing this widget.
                        </p>
                    )}
                    {Object.entries(form.userConfig).map(
                        ([key, fieldConfig]) => (
                            <RemovableItem
                                key={key}
                                onRemove={() => removeUserConfigField(key)}
                                borderColor={bc}
                            >
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Field
                                            label="Field Key"
                                            className="flex-1"
                                        >
                                            <SmallInput
                                                value={key}
                                                onChange={(v) =>
                                                    renameUserConfigKey(key, v)
                                                }
                                                placeholder="fieldName"
                                            />
                                        </Field>
                                        <Field label="Type" className="flex-1">
                                            <SmallSelect
                                                value={fieldConfig.type}
                                                onChange={(v) =>
                                                    updateUserConfigField(
                                                        key,
                                                        "type",
                                                        v
                                                    )
                                                }
                                                options={FIELD_TYPES}
                                            />
                                        </Field>
                                    </div>
                                    <div className="flex gap-2">
                                        <Field
                                            label="Display Name"
                                            className="flex-1"
                                        >
                                            <SmallInput
                                                value={fieldConfig.displayName}
                                                onChange={(v) =>
                                                    updateUserConfigField(
                                                        key,
                                                        "displayName",
                                                        v
                                                    )
                                                }
                                                placeholder="Field Label"
                                            />
                                        </Field>
                                        <Field
                                            label="Default Value"
                                            className="flex-1"
                                        >
                                            <SmallInput
                                                value={fieldConfig.defaultValue}
                                                onChange={(v) =>
                                                    updateUserConfigField(
                                                        key,
                                                        "defaultValue",
                                                        v
                                                    )
                                                }
                                                placeholder=""
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Instructions">
                                        <SmallInput
                                            value={fieldConfig.instructions}
                                            onChange={(v) =>
                                                updateUserConfigField(
                                                    key,
                                                    "instructions",
                                                    v
                                                )
                                            }
                                            placeholder="Help text for the user"
                                        />
                                    </Field>
                                    <SmallToggle
                                        checked={fieldConfig.required}
                                        onChange={(v) =>
                                            updateUserConfigField(
                                                key,
                                                "required",
                                                v
                                            )
                                        }
                                        label="Required"
                                    />
                                    {fieldConfig.type === "select" && (
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                                    Options
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const opts =
                                                            fieldConfig.options ||
                                                            [];
                                                        updateUserConfigField(
                                                            key,
                                                            "options",
                                                            [
                                                                ...opts,
                                                                {
                                                                    label: "",
                                                                    value: "",
                                                                },
                                                            ]
                                                        );
                                                    }}
                                                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                            {(fieldConfig.options || []).map(
                                                (opt, optIdx) => (
                                                    <div
                                                        key={optIdx}
                                                        className="flex items-center gap-1 mt-1"
                                                    >
                                                        <SmallInput
                                                            value={opt.label}
                                                            onChange={(v) => {
                                                                const opts = [
                                                                    ...(fieldConfig.options ||
                                                                        []),
                                                                ];
                                                                opts[optIdx] = {
                                                                    ...opts[
                                                                        optIdx
                                                                    ],
                                                                    label: v,
                                                                };
                                                                updateUserConfigField(
                                                                    key,
                                                                    "options",
                                                                    opts
                                                                );
                                                            }}
                                                            placeholder="Label"
                                                        />
                                                        <SmallInput
                                                            value={opt.value}
                                                            onChange={(v) => {
                                                                const opts = [
                                                                    ...(fieldConfig.options ||
                                                                        []),
                                                                ];
                                                                opts[optIdx] = {
                                                                    ...opts[
                                                                        optIdx
                                                                    ],
                                                                    value: v,
                                                                };
                                                                updateUserConfigField(
                                                                    key,
                                                                    "options",
                                                                    opts
                                                                );
                                                            }}
                                                            placeholder="Value"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const opts = (
                                                                    fieldConfig.options ||
                                                                    []
                                                                ).filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        optIdx
                                                                );
                                                                updateUserConfigField(
                                                                    key,
                                                                    "options",
                                                                    opts
                                                                );
                                                            }}
                                                            className="text-gray-600 hover:text-red-400 shrink-0"
                                                        >
                                                            <FontAwesomeIcon
                                                                icon="times"
                                                                className="h-2 w-2"
                                                            />
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </RemovableItem>
                        )
                    )}
                </div>
            </div>

            {/* Footer */}
            <div
                className={`flex items-center justify-between px-3 py-2 border-t ${bc} shrink-0`}
            >
                <span className="text-[10px] text-gray-600">
                    {dirty ? "Unsaved changes" : ""}
                </span>
                {dirty ? (
                    <button
                        onClick={handleSave}
                        className="px-3 py-1 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                    >
                        Save &amp; Compile
                    </button>
                ) : (
                    <span className="text-[10px] text-gray-600">
                        Widget Configuration
                    </span>
                )}
            </div>
        </div>
    );
};
