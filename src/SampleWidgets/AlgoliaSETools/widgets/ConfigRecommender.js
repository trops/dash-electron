/**
 * ConfigRecommender
 *
 * Analyzes an Algolia index's settings and record structure, then
 * generates specific, actionable configuration recommendations.
 * Goes beyond the health report by suggesting exact setting values.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";
import { analyzeRecords } from "../utils/attributeAnalyzer";
import { generateRecommendations } from "../utils/configRecommender";

const PRIORITY_STYLES = {
    high: { dot: "bg-red-500", text: "text-red-400", label: "High" },
    medium: { dot: "bg-yellow-500", text: "text-yellow-400", label: "Med" },
    low: { dot: "bg-blue-500", text: "text-blue-400", label: "Low" },
};

function ConfigRecommenderContent({ title, sampleSize = "100" }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    const [error, setError] = useState(null);

    // Load index list via invoke (returns data directly)
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoadingIndices(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || "Failed to load indices");
                    setLoadingIndices(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleAnalyze = useCallback(async () => {
        if (!pc?.providerHash || !selectedIndex) return;
        setAnalyzing(true);
        setError(null);
        setRecommendations(null);

        try {
            // Fetch settings
            const settings = await window.mainApi.algolia.getSettings({
                ...pc,
                indexName: selectedIndex,
            });
            if (settings?.error) {
                setError(settings.message || "Failed to load settings");
                return;
            }

            // Sample records for attribute analysis
            const size = Math.min(parseInt(sampleSize) || 100, 500);
            const result = await window.mainApi.algolia.search({
                ...pc,
                indexName: selectedIndex,
                query: "",
                page: 0,
                hitsPerPage: size,
            });

            const { attributes } = analyzeRecords(result?.hits || []);
            const recs = generateRecommendations(settings, attributes);
            setRecommendations(recs);
        } catch (err) {
            setError(err.message || "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    }, [pc, selectedIndex, sampleSize]);

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
                <div className="flex items-center gap-2">
                    <select
                        value={selectedIndex}
                        onChange={(e) => setSelectedIndex(e.target.value)}
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">
                            {loadingIndices
                                ? "Loading indices..."
                                : "Select an index"}
                        </option>
                        {indices.map((idx) => (
                            <option key={idx.name} value={idx.name}>
                                {idx.name} (
                                {(idx.entries || 0).toLocaleString()})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleAnalyze}
                        disabled={!selectedIndex || analyzing}
                        className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {analyzing ? "Analyzing..." : "Get Recommendations"}
                    </button>
                </div>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {recommendations && recommendations.length === 0 && (
                <div className="p-3 bg-green-900/20 border border-green-700 rounded text-green-300 text-xs">
                    No recommendations — this index looks well configured.
                </div>
            )}

            {recommendations && recommendations.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs text-gray-500">
                        {recommendations.length} recommendation
                        {recommendations.length !== 1 ? "s" : ""}
                    </span>
                    {recommendations.map((r, i) => {
                        const style =
                            PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.low;
                        return (
                            <div
                                key={i}
                                className="p-2 bg-gray-800/30 rounded space-y-1"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${style.dot}`}
                                    />
                                    <span className="text-xs text-gray-300 font-medium flex-1">
                                        {r.title}
                                    </span>
                                    <span
                                        className={`text-[10px] ${style.text}`}
                                    >
                                        {style.label}
                                    </span>
                                    <span className="text-[10px] text-gray-600">
                                        {r.category}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-400 pl-4">
                                    {r.detail}
                                </div>
                                {r.suggestion && (
                                    <div className="text-[11px] text-emerald-400 pl-4 font-mono bg-gray-900/50 rounded px-2 py-1 mt-1">
                                        {r.suggestion}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!recommendations && !analyzing && !error && hasCredentials && (
                <div className="text-xs text-gray-600 italic">
                    Select an index to get specific configuration
                    recommendations based on your data and current settings.
                </div>
            )}
        </div>
    );
}

export const ConfigRecommender = ({
    title = "Config Recommender",
    sampleSize = "100",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <ConfigRecommenderContent
                    title={title}
                    sampleSize={sampleSize}
                />
            </Panel>
        </Widget>
    );
};
