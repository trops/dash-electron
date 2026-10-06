/**
 * AlgoliaDisplayAttributesWidget
 *
 * Configure which attributes are returned in search results (attributesToRetrieve)
 * and which are hidden from the API (unretrievableAttributes).
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    AlertBanner,
    Caption2,
    Checkbox,
    InputText,
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

function TagList({ items, onRemove }) {
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();
    if (!items.length) {
        return (
            <Caption2 block className="italic">
                No attributes configured.
            </Caption2>
        );
    }
    const chipClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    key={item}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${chipClass}`}
                >
                    {item}
                    <button
                        onClick={() => onRemove(item)}
                        className={`opacity-70 ${status.error.hoverText}`}
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
            <InputText
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={placeholder}
                className="flex-1"
                height="h-7"
                padding="px-2 py-1"
                inputClassName="text-xs"
            />
            <Button2 onClick={handleAdd} size="sm">
                Add
            </Button2>
        </div>
    );
}

function AlgoliaDisplayAttributesContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();
    const status = useStatusTokens();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [retrieveAll, setRetrieveAll] = useState(true);
    const [toRetrieve, setToRetrieve] = useState([]);
    const [unretrievable, setUnretrievable] = useState([]);
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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
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
                <Caption2 block className="italic">
                    Select an index to configure display attributes.
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
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.attributesToRetrieve.label}
                            description={
                                SETTINGS_META.attributesToRetrieve.description
                            }
                            docUrl={SETTINGS_META.attributesToRetrieve.docUrl}
                        />
                        <Checkbox
                            checked={retrieveAll}
                            onChange={(checked) => {
                                setRetrieveAll(checked);
                                setDirty(true);
                            }}
                            label="Retrieve all attributes (*)"
                            className="cursor-pointer"
                        />
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
