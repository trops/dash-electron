/**
 * AlgoliaTypoToleranceWidget
 *
 * Configure typo tolerance settings: typoTolerance mode, min word sizes,
 * numeric token typos, and per-attribute disabling.
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

const TYPO_MODES = [
    {
        value: "true",
        label: "true",
        description: "Enable full typo tolerance",
    },
    {
        value: "false",
        label: "false",
        description: "Disable typo tolerance entirely",
    },
    {
        value: "min",
        label: "min",
        description: "Allow only 1 typo (never 2)",
    },
    {
        value: "strict",
        label: "strict",
        description: "Disallow typos on first matched word",
    },
];

function AlgoliaTypoToleranceContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [typoTolerance, setTypoTolerance] = useState("true");
    const [minWord1, setMinWord1] = useState(4);
    const [minWord2, setMinWord2] = useState(8);
    const [allowNumeric, setAllowNumeric] = useState(true);
    const [disabledAttrs, setDisabledAttrs] = useState([]);
    const [newAttr, setNewAttr] = useState("");
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
        const tt = settings.typoTolerance;
        if (tt === true) setTypoTolerance("true");
        else if (tt === false) setTypoTolerance("false");
        else if (typeof tt === "string") setTypoTolerance(tt);
        else setTypoTolerance("true");
        setMinWord1(settings.minWordSizefor1Typo ?? 4);
        setMinWord2(settings.minWordSizefor2Typos ?? 8);
        setAllowNumeric(settings.allowTyposOnNumericTokens !== false);
        setDisabledAttrs(settings.disableTypoToleranceOnAttributes || []);
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        let ttValue;
        if (typoTolerance === "true") ttValue = true;
        else if (typoTolerance === "false") ttValue = false;
        else ttValue = typoTolerance;

        const ok = await updateSettings({
            typoTolerance: ttValue,
            minWordSizefor1Typo: minWord1,
            minWordSizefor2Typos: minWord2,
            allowTyposOnNumericTokens: allowNumeric,
            disableTypoToleranceOnAttributes: disabledAttrs,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addDisabledAttr = () => {
        const attr = newAttr.trim();
        if (attr && !disabledAttrs.includes(attr)) {
            setDisabledAttrs([...disabledAttrs, attr]);
            setNewAttr("");
            setDirty(true);
        }
    };

    const removeDisabledAttr = (attr) => {
        setDisabledAttrs(disabledAttrs.filter((a) => a !== attr));
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
                    Select an index to configure typo tolerance.
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
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.typoTolerance.label}
                            description={
                                SETTINGS_META.typoTolerance.description
                            }
                            docUrl={SETTINGS_META.typoTolerance.docUrl}
                        />
                        <select
                            value={typoTolerance}
                            onChange={(e) => {
                                setTypoTolerance(e.target.value);
                                setDirty(true);
                            }}
                            className="w-48 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                            {TYPO_MODES.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label} — {m.description}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.minWordSizefor1Typo.label}
                            description={
                                SETTINGS_META.minWordSizefor1Typo.description
                            }
                            docUrl={SETTINGS_META.minWordSizefor1Typo.docUrl}
                        />
                        <input
                            type="number"
                            min={1}
                            value={minWord1}
                            onChange={(e) => {
                                setMinWord1(parseInt(e.target.value, 10) || 1);
                                setDirty(true);
                            }}
                            className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.minWordSizefor2Typos.label}
                            description={
                                SETTINGS_META.minWordSizefor2Typos.description
                            }
                            docUrl={SETTINGS_META.minWordSizefor2Typos.docUrl}
                        />
                        <input
                            type="number"
                            min={1}
                            value={minWord2}
                            onChange={(e) => {
                                setMinWord2(parseInt(e.target.value, 10) || 1);
                                setDirty(true);
                            }}
                            className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={
                                SETTINGS_META.allowTyposOnNumericTokens.label
                            }
                            description={
                                SETTINGS_META.allowTyposOnNumericTokens
                                    .description
                            }
                            docUrl={
                                SETTINGS_META.allowTyposOnNumericTokens.docUrl
                            }
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allowNumeric}
                                onChange={(e) => {
                                    setAllowNumeric(e.target.checked);
                                    setDirty(true);
                                }}
                                className="rounded"
                            />
                            <span className="text-xs text-gray-300">
                                Allow typos on numeric tokens
                            </span>
                        </label>
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={
                                SETTINGS_META.disableTypoToleranceOnAttributes
                                    .label
                            }
                            description={
                                SETTINGS_META.disableTypoToleranceOnAttributes
                                    .description
                            }
                            docUrl={
                                SETTINGS_META.disableTypoToleranceOnAttributes
                                    .docUrl
                            }
                        />
                        <div className="flex flex-wrap gap-1">
                            {disabledAttrs.map((attr) => (
                                <span
                                    key={attr}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-200"
                                >
                                    {attr}
                                    <button
                                        onClick={() => removeDisabledAttr(attr)}
                                        className="text-gray-400 hover:text-red-400"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newAttr}
                                onChange={(e) => setNewAttr(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && addDisabledAttr()
                                }
                                placeholder="Attribute name"
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={addDisabledAttr}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
                            >
                                Add
                            </button>
                        </div>
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

export const AlgoliaTypoToleranceWidget = ({
    title = "Typo Tolerance",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaTypoToleranceContent title={title} />
            </Panel>
        </Widget>
    );
};
