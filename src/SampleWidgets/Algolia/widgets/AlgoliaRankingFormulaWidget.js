/**
 * AlgoliaRankingFormulaWidget
 *
 * Configure the ranking formula — drag-to-reorder the 8 ranking criteria
 * that determine result order. Includes Reset to Default.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button3,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    const rowClass = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />
            <IndexSelector
                pc={pc}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
            />
            {!selectedIndex && (
                <Caption2 block className="italic">
                    Select an index to configure the ranking formula.
                </Caption2>
            )}
            {loading && (
                <Caption2 block className="italic">
                    Loading settings...
                </Caption2>
            )}
            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
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
                                className={`flex items-center gap-2 p-1.5 rounded cursor-grab active:cursor-grabbing ${rowClass}`}
                            >
                                <Caption2 className="select-none">
                                    &#x2630;
                                </Caption2>
                                <Caption2 className="w-4">{i + 1}.</Caption2>
                                <span
                                    className={`text-xs font-semibold w-20 ${bodyText}`}
                                >
                                    {criterion}
                                </span>
                                <Caption2>
                                    {RANKING_CRITERIA[criterion] || ""}
                                </Caption2>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            size="sm"
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button3
                            onClick={resetToDefault}
                            disabled={isDefault}
                            size="sm"
                        >
                            Reset to Default
                        </Button3>
                        {saveSuccess && (
                            <span className={`text-xs ${status.success.icon}`}>
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
