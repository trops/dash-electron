/**
 * AlgoliaPaginationWidget
 *
 * Configure pagination settings: hitsPerPage, paginationLimitedTo, maxValuesPerFacet.
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

function AlgoliaPaginationContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [hitsPerPage, setHitsPerPage] = useState(20);
    const [paginationLimitedTo, setPaginationLimitedTo] = useState(1000);
    const [maxValuesPerFacet, setMaxValuesPerFacet] = useState(100);
    const [dirty, setDirty] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
                    Select an index to configure pagination settings.
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
                            title={SETTINGS_META.hitsPerPage.label}
                            description={SETTINGS_META.hitsPerPage.description}
                            docUrl={SETTINGS_META.hitsPerPage.docUrl}
                        />
                        <input
                            type="number"
                            min={1}
                            max={1000}
                            value={hitsPerPage}
                            onChange={handleChange(setHitsPerPage)}
                            className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                        <input
                            type="number"
                            min={0}
                            value={paginationLimitedTo}
                            onChange={handleChange(setPaginationLimitedTo)}
                            className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                        <input
                            type="number"
                            min={1}
                            max={1000}
                            value={maxValuesPerFacet}
                            onChange={handleChange(setMaxValuesPerFacet)}
                            className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
