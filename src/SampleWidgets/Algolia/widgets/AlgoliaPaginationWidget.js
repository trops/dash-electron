/**
 * AlgoliaPaginationWidget
 *
 * Configure pagination settings: hitsPerPage, paginationLimitedTo, maxValuesPerFacet.
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

function AlgoliaPaginationContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();
    const status = useStatusTokens();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [hitsPerPage, setHitsPerPage] = useState(20);
    const [paginationLimitedTo, setPaginationLimitedTo] = useState(1000);
    const [maxValuesPerFacet, setMaxValuesPerFacet] = useState(100);
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
        setHitsPerPage(settings.hitsPerPage ?? 20);
        setPaginationLimitedTo(settings.paginationLimitedTo ?? 1000);
        setMaxValuesPerFacet(settings.maxValuesPerFacet ?? 100);
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const ok = await updateSettings({
            hitsPerPage,
            paginationLimitedTo,
            maxValuesPerFacet,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const handleChange = (setter) => (e) => {
        setter(parseInt(e.target.value, 10) || 0);
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
                    Select an index to configure pagination settings.
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
                            title={SETTINGS_META.hitsPerPage.label}
                            description={SETTINGS_META.hitsPerPage.description}
                            docUrl={SETTINGS_META.hitsPerPage.docUrl}
                        />
                        <InputText
                            type="number"
                            min={1}
                            max={1000}
                            value={hitsPerPage}
                            onChange={handleChange(setHitsPerPage)}
                            className="w-32"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.paginationLimitedTo.label}
                            description={
                                SETTINGS_META.paginationLimitedTo.description
                            }
                            docUrl={SETTINGS_META.paginationLimitedTo.docUrl}
                        />
                        <InputText
                            type="number"
                            min={0}
                            value={paginationLimitedTo}
                            onChange={handleChange(setPaginationLimitedTo)}
                            className="w-32"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.maxValuesPerFacet.label}
                            description={
                                SETTINGS_META.maxValuesPerFacet.description
                            }
                            docUrl={SETTINGS_META.maxValuesPerFacet.docUrl}
                        />
                        <InputText
                            type="number"
                            min={1}
                            max={1000}
                            value={maxValuesPerFacet}
                            onChange={handleChange(setMaxValuesPerFacet)}
                            className="w-32"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs"
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

export const AlgoliaPaginationWidget = ({
    title = "Pagination Settings",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaPaginationContent title={title} />
            </Panel>
        </Widget>
    );
};
