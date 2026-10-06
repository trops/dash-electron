/**
 * AlgoliaCustomRankingWidget
 *
 * Configure custom ranking criteria with asc/desc modifiers and drag-to-reorder.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                    Select an index to configure custom ranking.
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
                        title={SETTINGS_META.customRanking.label}
                        description={SETTINGS_META.customRanking.description}
                        docUrl={SETTINGS_META.customRanking.docUrl}
                    />
                    {criteria.length === 0 && (
                        <Caption2 block className="italic">
                            No custom ranking criteria configured.
                        </Caption2>
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
                                className={`flex items-center gap-2 p-1.5 rounded cursor-grab active:cursor-grabbing ${rowClass}`}
                            >
                                <Caption2 className="select-none">
                                    &#x2630;
                                </Caption2>
                                <Caption2 className="w-4">{i + 1}.</Caption2>
                                <span
                                    className={`flex-1 text-xs font-mono ${bodyText}`}
                                >
                                    {c.attr}
                                </span>
                                <button
                                    onClick={() => toggleDirection(c.attr)}
                                    className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                        c.direction === "asc"
                                            ? `border ${status.success.bg} ${status.success.text} ${status.success.border}`
                                            : `border ${status.info.bg} ${status.info.text} ${status.info.border}`
                                    }`}
                                >
                                    {c.direction}
                                </button>
                                <button
                                    onClick={() => removeCriterion(c.attr)}
                                    className={`text-xs px-1 ${
                                        currentTheme?.["text-primary-medium"] ||
                                        ""
                                    } ${status.error.hoverText}`}
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <InputText
                            type="text"
                            value={newAttr}
                            onChange={(e) => setNewAttr(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && addCriterion()
                            }
                            placeholder="Attribute name"
                            className="flex-1"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                        />
                        <SelectInput
                            value={newDir}
                            onChange={(value) => setNewDir(value)}
                            placeholder="Direction"
                            options={[
                                { value: "desc", label: "desc" },
                                { value: "asc", label: "asc" },
                            ]}
                            inputClassName="text-xs"
                        />
                        <Button2 onClick={addCriterion} size="sm">
                            Add
                        </Button2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            size="sm"
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
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
