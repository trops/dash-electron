/**
 * AlgoliaDistinctWidget
 *
 * Configure de-duplication: distinct and attributeForDistinct.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
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

function AlgoliaDistinctContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();
    const status = useStatusTokens();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [distinct, setDistinct] = useState(0);
    const [attributeForDistinct, setAttributeForDistinct] = useState("");
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
        setDistinct(
            typeof settings.distinct === "number"
                ? settings.distinct
                : settings.distinct === true
                ? 1
                : 0
        );
        setAttributeForDistinct(settings.attributeForDistinct || "");
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const ok = await updateSettings({
            distinct,
            attributeForDistinct,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
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
                    Select an index to configure distinct settings.
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
                            title={SETTINGS_META.attributeForDistinct.label}
                            description={
                                SETTINGS_META.attributeForDistinct.description
                            }
                            docUrl={SETTINGS_META.attributeForDistinct.docUrl}
                        />
                        <InputText
                            type="text"
                            value={attributeForDistinct}
                            onChange={(e) => {
                                setAttributeForDistinct(e.target.value);
                                setDirty(true);
                            }}
                            placeholder="e.g., product_id"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.distinct.label}
                            description={SETTINGS_META.distinct.description}
                            docUrl={SETTINGS_META.distinct.docUrl}
                        />
                        <SelectInput
                            value={distinct}
                            onChange={(value) => {
                                setDistinct(parseInt(value, 10));
                                setDirty(true);
                            }}
                            placeholder="Select distinct level"
                            options={[
                                { value: 0, label: "0 — Off" },
                                {
                                    value: 1,
                                    label: "1 — Single result per group",
                                },
                                {
                                    value: 2,
                                    label: "2 — Two results per group",
                                },
                                {
                                    value: 3,
                                    label: "3 — Three results per group",
                                },
                            ]}
                            className="w-40"
                            inputClassName="text-xs"
                        />
                        {distinct > 0 && !attributeForDistinct && (
                            <div className={`text-xs ${status.warning.icon}`}>
                                Set attributeForDistinct before enabling
                                distinct.
                            </div>
                        )}
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

export const AlgoliaDistinctWidget = ({
    title = "Distinct Settings",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaDistinctContent title={title} />
            </Panel>
        </Widget>
    );
};
