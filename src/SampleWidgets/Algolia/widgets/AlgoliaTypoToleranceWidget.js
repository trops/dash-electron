/**
 * AlgoliaTypoToleranceWidget
 *
 * Configure typo tolerance settings: typoTolerance mode, min word sizes,
 * numeric token typos, and per-attribute disabling.
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    // Attribute chips sit one step above the Panel surface.
    const chipClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;

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
                    Select an index to configure typo tolerance.
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
                            title={SETTINGS_META.typoTolerance.label}
                            description={
                                SETTINGS_META.typoTolerance.description
                            }
                            docUrl={SETTINGS_META.typoTolerance.docUrl}
                        />
                        <SelectInput
                            value={typoTolerance}
                            onChange={(value) => {
                                setTypoTolerance(value);
                                setDirty(true);
                            }}
                            options={TYPO_MODES.map((m) => ({
                                value: m.value,
                                label: `${m.label} — ${m.description}`,
                            }))}
                            placeholder="Select a mode"
                            className="w-48"
                            inputClassName="text-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.minWordSizefor1Typo.label}
                            description={
                                SETTINGS_META.minWordSizefor1Typo.description
                            }
                            docUrl={SETTINGS_META.minWordSizefor1Typo.docUrl}
                        />
                        <InputText
                            type="number"
                            min={1}
                            value={minWord1}
                            onChange={(e) => {
                                setMinWord1(parseInt(e.target.value, 10) || 1);
                                setDirty(true);
                            }}
                            className="w-24"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
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
                        <InputText
                            type="number"
                            min={1}
                            value={minWord2}
                            onChange={(e) => {
                                setMinWord2(parseInt(e.target.value, 10) || 1);
                                setDirty(true);
                            }}
                            className="w-24"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
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
                        <Checkbox
                            checked={allowNumeric}
                            onChange={(checked) => {
                                setAllowNumeric(checked);
                                setDirty(true);
                            }}
                            label="Allow typos on numeric tokens"
                            className="cursor-pointer"
                        />
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
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${chipClass}`}
                                >
                                    {attr}
                                    <button
                                        onClick={() => removeDisabledAttr(attr)}
                                        className={`opacity-70 ${status.error.hoverText}`}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newAttr}
                                onChange={(e) => setNewAttr(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && addDisabledAttr()
                                }
                                placeholder="Attribute name"
                                className="flex-1"
                                height="h-7"
                                padding="px-2 py-1"
                                inputClassName="text-xs"
                            />
                            <Button2 onClick={addDisabledAttr} size="sm">
                                Add
                            </Button2>
                        </div>
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
