/**
 * AlgoliaDisplayAttributesWidget
 *
 * Configure which attributes are returned in search results (attributesToRetrieve)
 * and which are hidden from the API (unretrievableAttributes).
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
} from "@trops/dash-core";
import { useAlgoliaSettings } from "../hooks/useAlgoliaSettings";
import { IndexSelector } from "../components/IndexSelector";
import { SettingHeader } from "../components/SettingHeader";
import { SETTINGS_META } from "../utils/algoliaSettingsMetadata";

function TagList({ items, onRemove }) {
    if (!items.length) {
        return (
            <div className="text-xs text-gray-500 italic">
                No attributes configured.
            </div>
        );
    }
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-200"
                >
                    {item}
                    <button
                        onClick={() => onRemove(item)}
                        className="text-gray-400 hover:text-red-400"
                    >
                        &times;
                    </button>
                </span>
            ))}
        </div>
    );
}

function AddInput({ onAdd, placeholder }) {
    const [value, setValue] = useState("");
    const handleAdd = () => {
        const v = value.trim();
        if (v) {
            onAdd(v);
            setValue("");
        }
    };
    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={placeholder}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
            <button
                onClick={handleAdd}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
            >
                Add
            </button>
        </div>
    );
}

function AlgoliaDisplayAttributesContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [retrieveAll, setRetrieveAll] = useState(true);
    const [toRetrieve, setToRetrieve] = useState([]);
    const [unretrievable, setUnretrievable] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (!settings) return;
        const atr = settings.attributesToRetrieve || ["*"];
        const isAll = atr.length === 1 && atr[0] === "*";
        setRetrieveAll(isAll);
        setToRetrieve(isAll ? [] : atr);
        setUnretrievable(settings.unretrievableAttributes || []);
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const ok = await updateSettings({
            attributesToRetrieve: retrieveAll ? ["*"] : toRetrieve,
            unretrievableAttributes: unretrievable,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addRetrieve = (attr) => {
        if (!toRetrieve.includes(attr)) {
            setToRetrieve([...toRetrieve, attr]);
            setDirty(true);
        }
    };

    const removeRetrieve = (attr) => {
        setToRetrieve(toRetrieve.filter((a) => a !== attr));
        setDirty(true);
    };

    const addUnretrievable = (attr) => {
        if (!unretrievable.includes(attr)) {
            setUnretrievable([...unretrievable, attr]);
            setDirty(true);
        }
    };

    const removeUnretrievable = (attr) => {
        setUnretrievable(unretrievable.filter((a) => a !== attr));
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
                    Select an index to configure display attributes.
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
                            title={SETTINGS_META.attributesToRetrieve.label}
                            description={
                                SETTINGS_META.attributesToRetrieve.description
                            }
                            docUrl={SETTINGS_META.attributesToRetrieve.docUrl}
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={retrieveAll}
                                onChange={(e) => {
                                    setRetrieveAll(e.target.checked);
                                    setDirty(true);
                                }}
                                className="rounded"
                            />
                            <span className="text-xs text-gray-300">
                                Retrieve all attributes (*)
                            </span>
                        </label>
                        {!retrieveAll && (
                            <>
                                <TagList
                                    items={toRetrieve}
                                    onRemove={removeRetrieve}
                                />
                                <AddInput
                                    onAdd={addRetrieve}
                                    placeholder="Attribute name"
                                />
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.unretrievableAttributes.label}
                            description={
                                SETTINGS_META.unretrievableAttributes
                                    .description
                            }
                            docUrl={
                                SETTINGS_META.unretrievableAttributes.docUrl
                            }
                        />
                        <TagList
                            items={unretrievable}
                            onRemove={removeUnretrievable}
                        />
                        <AddInput
                            onAdd={addUnretrievable}
                            placeholder="Attribute name"
                        />
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

export const AlgoliaDisplayAttributesWidget = ({
    title = "Display Attributes",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaDisplayAttributesContent title={title} />
            </Panel>
        </Widget>
    );
};
