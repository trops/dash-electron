/**
 * AlgoliaRankingFormulaWidget
 *
 * Configure the ranking formula — drag-to-reorder the 8 ranking criteria
 * that determine result order. Includes Reset to Default.
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
import {
    SETTINGS_META,
    RANKING_CRITERIA,
} from "../utils/algoliaSettingsMetadata";

const DEFAULT_RANKING = [
    "typo",
    "geo",
    "words",
    "filters",
    "proximity",
    "attribute",
    "exact",
    "custom",
];

function AlgoliaRankingFormulaContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [ranking, setRanking] = useState([...DEFAULT_RANKING]);
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
        setRanking(settings.ranking || [...DEFAULT_RANKING]);
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const ok = await updateSettings({ ranking });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const resetToDefault = () => {
        setRanking([...DEFAULT_RANKING]);
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
        const updated = [...ranking];
        const [removed] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, removed);
        setRanking(updated);
        setDirty(true);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const isDefault =
        ranking.length === DEFAULT_RANKING.length &&
        ranking.every((r, i) => r === DEFAULT_RANKING[i]);

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
                    Select an index to configure the ranking formula.
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
                        title={SETTINGS_META.ranking.label}
                        description={SETTINGS_META.ranking.description}
                        docUrl={SETTINGS_META.ranking.docUrl}
                    />
                    <div className="flex flex-col gap-1">
                        {ranking.map((criterion, i) => (
                            <div
                                key={criterion}
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
                                <span className="text-xs text-gray-200 font-semibold w-20">
                                    {criterion}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {RANKING_CRITERIA[criterion] || ""}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs text-white transition-colors"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                            onClick={resetToDefault}
                            disabled={isDefault}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs text-gray-200 transition-colors"
                        >
                            Reset to Default
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

export const AlgoliaRankingFormulaWidget = ({
    title = "Ranking Formula",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaRankingFormulaContent title={title} />
            </Panel>
        </Widget>
    );
};
