/**
 * AlgoliaSearchableAttributesWidget
 *
 * Configure searchableAttributes with drag-to-reorder priority and unordered() toggle.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useRef } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";
import { useAlgoliaSettings } from "../hooks/useAlgoliaSettings";
import { IndexSelector } from "../components/IndexSelector";
import { SettingHeader } from "../components/SettingHeader";
import { SETTINGS_META } from "../utils/algoliaSettingsMetadata";

function parseSearchableAttr(raw) {
    if (raw.startsWith("unordered(") && raw.endsWith(")")) {
        return { attr: raw.slice(10, -1), unordered: true };
    }
    return { attr: raw, unordered: false };
}

function formatSearchableAttr(attr, unordered) {
    return unordered ? `unordered(${attr})` : attr;
}

function AlgoliaSearchableAttributesContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [attrs, setAttrs] = useState([]);
    const [newAttr, setNewAttr] = useState("");
    const [dirty, setDirty] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    useEffect(() => {
        if (!settings) return;
        const raw = settings.searchableAttributes || [];
        setAttrs(raw.map(parseSearchableAttr));
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const formatted = attrs.map((a) =>
            formatSearchableAttr(a.attr, a.unordered)
        );
        const ok = await updateSettings({ searchableAttributes: formatted });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addAttr = () => {
        const attr = newAttr.trim();
        if (attr && !attrs.some((a) => a.attr === attr)) {
            setAttrs([...attrs, { attr, unordered: false }]);
            setNewAttr("");
            setDirty(true);
        }
    };

    const removeAttr = (attr) => {
        setAttrs(attrs.filter((a) => a.attr !== attr));
        setDirty(true);
    };

    const toggleUnordered = (attr) => {
        setAttrs(
            attrs.map((a) =>
                a.attr === attr ? { ...a, unordered: !a.unordered } : a
            )
        );
        setDirty(true);
    };

    const handleDragStart = (index) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = () => {
        if (
            dragItem.current === null ||
            dragOverItem.current === null ||
            dragItem.current === dragOverItem.current
        ) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        const updated = [...attrs];
        const [removed] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, removed);
        setAttrs(updated);
        setDirty(true);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia credential provider not configured. Add an Algolia
                    provider with your App ID and API Key.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />
            <IndexSelector
                pc={pc}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
            />
            {!selectedIndex && (
                <div className="text-xs text-gray-500 italic">
                    Select an index to configure searchable attributes.
                </div>
            )}
            {loading && (
                <div className="text-xs text-gray-400 italic">
                    Loading settings...
                </div>
            )}
            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}
            {settings && selectedIndex && (
                <div className="flex flex-col gap-4">
                    <SettingHeader
                        title={SETTINGS_META.searchableAttributes.label}
                        description={
                            SETTINGS_META.searchableAttributes.description
                        }
                        docUrl={SETTINGS_META.searchableAttributes.docUrl}
                    />
                    {attrs.length === 0 && (
                        <div className="text-xs text-gray-500 italic">
                            No searchable attributes configured (all attributes
                            are searchable by default).
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        {attrs.map((a, i) => (
                            <div
                                key={a.attr}
                                draggable
                                onDragStart={() => handleDragStart(i)}
                                onDragEnter={() => handleDragEnter(i)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className="flex items-center gap-2 p-1.5 bg-gray-800/50 rounded cursor-grab active:cursor-grabbing"
                            >
                                <span className="text-gray-500 text-xs select-none">
                                    &#x2630;
                                </span>
                                <span className="text-xs text-gray-400 w-4">
                                    {i + 1}.
                                </span>
                                <span className="flex-1 text-xs text-gray-200 font-mono">
                                    {a.attr}
                                </span>
                                <button
                                    onClick={() => toggleUnordered(a.attr)}
                                    className={`px-1.5 py-0.5 rounded text-xs ${
                                        a.unordered
                                            ? "bg-amber-900/50 text-amber-300 border border-amber-700"
                                            : "bg-gray-700 text-gray-400 border border-gray-600"
                                    }`}
                                    title={
                                        a.unordered
                                            ? "unordered — position does not affect ranking"
                                            : "ordered — position affects ranking"
                                    }
                                >
                                    {a.unordered ? "unordered" : "ordered"}
                                </button>
                                <button
                                    onClick={() => removeAttr(a.attr)}
                                    className="text-gray-400 hover:text-red-400 text-xs px-1"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newAttr}
                            onChange={(e) => setNewAttr(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addAttr()}
                            placeholder="Attribute name"
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={addAttr}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
                        >
                            Add
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs text-white transition-colors"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                        {saveSuccess && (
                            <span className="text-xs text-green-400">
                                Saved!
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export const AlgoliaSearchableAttributesWidget = ({
    title = "Searchable Attributes",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaSearchableAttributesContent title={title} />
            </Panel>
        </Widget>
    );
};
