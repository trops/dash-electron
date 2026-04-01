/**
 * AlgoliaFacetingWidget
 *
 * Configure attributesForFaceting with modifier support:
 * plain (facetable), filterOnly(), searchable().
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect } from "react";
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

const FACET_MODIFIERS = [
    { value: "plain", label: "Facetable (plain)" },
    { value: "filterOnly", label: "filterOnly()" },
    { value: "searchable", label: "searchable()" },
];

function parseFacetAttr(raw) {
    if (raw.startsWith("filterOnly(") && raw.endsWith(")")) {
        return { attr: raw.slice(11, -1), modifier: "filterOnly" };
    }
    if (raw.startsWith("searchable(") && raw.endsWith(")")) {
        return { attr: raw.slice(11, -1), modifier: "searchable" };
    }
    return { attr: raw, modifier: "plain" };
}

function formatFacetAttr(attr, modifier) {
    if (modifier === "filterOnly") return `filterOnly(${attr})`;
    if (modifier === "searchable") return `searchable(${attr})`;
    return attr;
}

function AlgoliaFacetingContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [facets, setFacets] = useState([]);
    const [newAttr, setNewAttr] = useState("");
    const [newModifier, setNewModifier] = useState("plain");
    const [dirty, setDirty] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
        const raw = settings.attributesForFaceting || [];
        setFacets(raw.map(parseFacetAttr));
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const formatted = facets.map((f) =>
            formatFacetAttr(f.attr, f.modifier)
        );
        const ok = await updateSettings({
            attributesForFaceting: formatted,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addFacet = () => {
        const attr = newAttr.trim();
        if (attr && !facets.some((f) => f.attr === attr)) {
            setFacets([...facets, { attr, modifier: newModifier }]);
            setNewAttr("");
            setNewModifier("plain");
            setDirty(true);
        }
    };

    const removeFacet = (attr) => {
        setFacets(facets.filter((f) => f.attr !== attr));
        setDirty(true);
    };

    const changeModifier = (attr, modifier) => {
        setFacets(
            facets.map((f) => (f.attr === attr ? { ...f, modifier } : f))
        );
        setDirty(true);
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
                    Select an index to configure faceting attributes.
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
                        title={SETTINGS_META.attributesForFaceting.label}
                        description={
                            SETTINGS_META.attributesForFaceting.description
                        }
                        docUrl={SETTINGS_META.attributesForFaceting.docUrl}
                    />
                    {facets.length === 0 && (
                        <div className="text-xs text-gray-500 italic">
                            No faceting attributes configured.
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        {facets.map((f) => (
                            <div
                                key={f.attr}
                                className="flex items-center gap-2 p-1.5 bg-gray-800/50 rounded"
                            >
                                <span className="flex-1 text-xs text-gray-200 font-mono">
                                    {f.attr}
                                </span>
                                <select
                                    value={f.modifier}
                                    onChange={(e) =>
                                        changeModifier(f.attr, e.target.value)
                                    }
                                    className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none"
                                >
                                    {FACET_MODIFIERS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => removeFacet(f.attr)}
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
                            onKeyDown={(e) => e.key === "Enter" && addFacet()}
                            placeholder="Attribute name"
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                        <select
                            value={newModifier}
                            onChange={(e) => setNewModifier(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-200 focus:outline-none"
                        >
                            {FACET_MODIFIERS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={addFacet}
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

export const AlgoliaFacetingWidget = ({
    title = "Faceting Attributes",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaFacetingContent title={title} />
            </Panel>
        </Widget>
    );
};
