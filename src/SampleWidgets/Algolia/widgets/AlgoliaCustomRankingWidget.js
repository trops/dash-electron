/**
 * AlgoliaCustomRankingWidget
 *
 * Configure custom ranking criteria with asc/desc modifiers and drag-to-reorder.
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

function parseRankingAttr(raw) {
    if (raw.startsWith("asc(") && raw.endsWith(")")) {
        return { attr: raw.slice(4, -1), direction: "asc" };
    }
    if (raw.startsWith("desc(") && raw.endsWith(")")) {
        return { attr: raw.slice(5, -1), direction: "desc" };
    }
    return { attr: raw, direction: "desc" };
}

function formatRankingAttr(attr, direction) {
    return `${direction}(${attr})`;
}

function AlgoliaCustomRankingContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [criteria, setCriteria] = useState([]);
    const [newAttr, setNewAttr] = useState("");
    const [newDir, setNewDir] = useState("desc");
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
        const raw = settings.customRanking || [];
        setCriteria(raw.map(parseRankingAttr));
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const formatted = criteria.map((c) =>
            formatRankingAttr(c.attr, c.direction)
        );
        const ok = await updateSettings({ customRanking: formatted });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addCriterion = () => {
        const attr = newAttr.trim();
        if (attr && !criteria.some((c) => c.attr === attr)) {
            setCriteria([...criteria, { attr, direction: newDir }]);
            setNewAttr("");
            setDirty(true);
        }
    };

    const removeCriterion = (attr) => {
        setCriteria(criteria.filter((c) => c.attr !== attr));
        setDirty(true);
    };

    const toggleDirection = (attr) => {
        setCriteria(
            criteria.map((c) =>
                c.attr === attr
                    ? {
                          ...c,
                          direction: c.direction === "asc" ? "desc" : "asc",
                      }
                    : c
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
        const updated = [...criteria];
        const [removed] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, removed);
        setCriteria(updated);
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
                    Select an index to configure custom ranking.
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
                        title={SETTINGS_META.customRanking.label}
                        description={SETTINGS_META.customRanking.description}
                        docUrl={SETTINGS_META.customRanking.docUrl}
                    />
                    {criteria.length === 0 && (
                        <div className="text-xs text-gray-500 italic">
                            No custom ranking criteria configured.
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        {criteria.map((c, i) => (
                            <div
                                key={c.attr}
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
                                    {c.attr}
                                </span>
                                <button
                                    onClick={() => toggleDirection(c.attr)}
                                    className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                        c.direction === "asc"
                                            ? "bg-green-900/50 text-green-300 border border-green-700"
                                            : "bg-blue-900/50 text-blue-300 border border-blue-700"
                                    }`}
                                >
                                    {c.direction}
                                </button>
                                <button
                                    onClick={() => removeCriterion(c.attr)}
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
                            onKeyDown={(e) =>
                                e.key === "Enter" && addCriterion()
                            }
                            placeholder="Attribute name"
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                        <select
                            value={newDir}
                            onChange={(e) => setNewDir(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-200 focus:outline-none"
                        >
                            <option value="desc">desc</option>
                            <option value="asc">asc</option>
                        </select>
                        <button
                            onClick={addCriterion}
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

export const AlgoliaCustomRankingWidget = ({
    title = "Custom Ranking",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaCustomRankingContent title={title} />
            </Panel>
        </Widget>
    );
};
