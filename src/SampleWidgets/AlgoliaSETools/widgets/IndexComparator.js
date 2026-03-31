/**
 * IndexComparator
 *
 * Side-by-side comparison of two Algolia indices' settings.
 * Highlights differences for prod vs staging, before vs after, etc.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";
import { diffSettings } from "../utils/settingsDiff";
import { SettingsDiffTable } from "./components/SettingsDiffTable";

function IndexComparatorContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [indexA, setIndexA] = useState("");
    const [indexB, setIndexB] = useState("");
    const [comparing, setComparing] = useState(false);
    const [diffResult, setDiffResult] = useState(null);
    const [error, setError] = useState(null);

    // Load index list
    useEffect(() => {
        if (!pc?.providerHash) return;
        setLoadingIndices(true);

        const handleComplete = (_event, data) => {
            setIndices(data || []);
            setLoadingIndices(false);
        };
        const handleError = (_event, data) => {
            setError(data?.error || "Failed to load indices");
            setLoadingIndices(false);
        };

        window.mainApi.on("algolia-list-indices-complete", handleComplete);
        window.mainApi.on("algolia-list-indices-error", handleError);
        window.mainApi.algolia.listIndices({ ...pc, cache: true });

        return () => {
            window.mainApi.removeListener(
                "algolia-list-indices-complete",
                handleComplete
            );
            window.mainApi.removeListener(
                "algolia-list-indices-error",
                handleError
            );
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCompare = useCallback(async () => {
        if (!pc?.providerHash || !indexA || !indexB) return;
        setComparing(true);
        setError(null);
        setDiffResult(null);
        try {
            const [settingsA, settingsB] = await Promise.all([
                window.mainApi.algolia.getSettings({
                    ...pc,
                    indexName: indexA,
                }),
                window.mainApi.algolia.getSettings({
                    ...pc,
                    indexName: indexB,
                }),
            ]);
            if (settingsA?.error) {
                setError(`${indexA}: ${settingsA.message || "Failed"}`);
                return;
            }
            if (settingsB?.error) {
                setError(`${indexB}: ${settingsB.message || "Failed"}`);
                return;
            }
            setDiffResult(diffSettings(settingsA, settingsB));
        } catch (err) {
            setError(err.message || "Comparison failed");
        } finally {
            setComparing(false);
        }
    }, [pc, indexA, indexB]);

    const indexOptions = indices.map((idx) => (
        <option key={idx.name} value={idx.name}>
            {idx.name} ({(idx.entries || 0).toLocaleString()})
        </option>
    ));

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia provider not configured. Add an Algolia credential
                    provider in Settings &gt; Providers.
                </div>
            )}

            {hasCredentials && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-blue-400 uppercase tracking-wide block mb-0.5">
                                Index A
                            </label>
                            <select
                                value={indexA}
                                onChange={(e) => setIndexA(e.target.value)}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">
                                    {loadingIndices
                                        ? "Loading..."
                                        : "Select index"}
                                </option>
                                {indexOptions}
                            </select>
                        </div>
                        <span className="text-gray-600 text-xs mt-4">vs</span>
                        <div className="flex-1">
                            <label className="text-[10px] text-emerald-400 uppercase tracking-wide block mb-0.5">
                                Index B
                            </label>
                            <select
                                value={indexB}
                                onChange={(e) => setIndexB(e.target.value)}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">
                                    {loadingIndices
                                        ? "Loading..."
                                        : "Select index"}
                                </option>
                                {indexOptions}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleCompare}
                        disabled={
                            !indexA || !indexB || indexA === indexB || comparing
                        }
                        className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {comparing ? "Comparing..." : "Compare"}
                    </button>
                    {indexA && indexB && indexA === indexB && (
                        <span className="text-[10px] text-yellow-500">
                            Select two different indices to compare.
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {diffResult && (
                <SettingsDiffTable
                    diffs={diffResult.diffs}
                    extraDiffs={diffResult.extraDiffs}
                    identical={diffResult.identical}
                    summary={diffResult.summary}
                    nameA={indexA}
                    nameB={indexB}
                />
            )}

            {!diffResult && !comparing && !error && hasCredentials && (
                <div className="text-xs text-gray-600 italic">
                    Select two indices and click Compare to see a side-by-side
                    settings diff.
                </div>
            )}
        </div>
    );
}

export const IndexComparator = ({ title = "Index Comparator", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <IndexComparatorContent title={title} />
            </Panel>
        </Widget>
    );
};
