/**
 * ConfigRecommender
 *
 * Analyzes an Algolia index's settings and record structure, then
 * generates specific, actionable configuration recommendations.
 * Goes beyond the health report by suggesting exact setting values.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    AlertBanner,
    Caption2,
    SelectInput,
    ThemeContext,
    useStatusTokens,
    readableError,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";
import { analyzeRecords } from "../utils/attributeAnalyzer";
import { generateRecommendations } from "../utils/configRecommender";

// Maps recommendation priority to a status-token family (light/dark aware).
const PRIORITY_STYLES = {
    high: { status: "error", label: "High" },
    medium: { status: "warning", label: "Med" },
    low: { status: "info", label: "Low" },
};

function ConfigRecommenderContent({ title, sampleSize = "100" }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    const [error, setError] = useState(null);
    const fromEventRef = useRef(false);

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
                    setError(readableError(err, "Failed to load indices"));
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
                    if (payload.name) {
                        fromEventRef.current = true;
                        setSelectedIndex(payload.name);
                    }
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
                setError(readableError(settings, "Failed to load settings"));
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
            setError(readableError(err, "Analysis failed"));
        } finally {
            setAnalyzing(false);
        }
    }, [pc, selectedIndex, sampleSize]);

    // Auto-trigger analysis when index is set via indexSelected event
    useEffect(() => {
        if (fromEventRef.current && selectedIndex) {
            fromEventRef.current = false;
            handleAnalyze();
        }
    }, [selectedIndex, handleAnalyze]);

    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia provider not configured. Add an Algolia credential provider in Settings > Providers."
                />
            )}

            {hasCredentials && (
                <div className="flex flex-wrap items-center gap-2">
                    <SelectInput
                        value={selectedIndex}
                        onChange={(value) => setSelectedIndex(value)}
                        placeholder={
                            loadingIndices
                                ? "Loading indices..."
                                : "Select an index"
                        }
                        options={indices.map((idx) => ({
                            value: idx.name,
                            label: `${idx.name} (${(
                                idx.entries || 0
                            ).toLocaleString()})`,
                        }))}
                        className="flex-1 min-w-0"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleAnalyze}
                        disabled={!selectedIndex || analyzing}
                    >
                        {analyzing ? "Analyzing..." : "Get Recommendations"}
                    </Button>
                </div>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {recommendations && recommendations.length === 0 && (
                <AlertBanner
                    variant="success"
                    size="compact"
                    message="No recommendations — this index looks well configured."
                />
            )}

            {recommendations && recommendations.length > 0 && (
                <div className="space-y-2">
                    <Caption2>
                        {recommendations.length} recommendation
                        {recommendations.length !== 1 ? "s" : ""}
                    </Caption2>
                    {recommendations.map((r, i) => {
                        const style =
                            PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.low;
                        const tone = status[style.status] || status.info;
                        return (
                            <div
                                key={i}
                                className={`p-2 rounded space-y-1 ${
                                    currentTheme?.["bg-primary-dark"] || ""
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${tone.solidBg}`}
                                    />
                                    <span
                                        className={`text-xs font-medium flex-1 ${bodyText}`}
                                    >
                                        {r.title}
                                    </span>
                                    <span className={`text-xs ${tone.icon}`}>
                                        {style.label}
                                    </span>
                                    <Caption2>{r.category}</Caption2>
                                </div>
                                <div className={`text-xs pl-4 ${bodyText}`}>
                                    {r.detail}
                                </div>
                                {r.suggestion && (
                                    <div
                                        className={`text-xs font-mono rounded border px-2 py-1 mt-1 ml-4 ${
                                            currentTheme?.[
                                                "text-secondary-medium"
                                            ] || ""
                                        } ${
                                            currentTheme?.[
                                                "border-primary-dark"
                                            ] || ""
                                        }`}
                                    >
                                        {r.suggestion}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!recommendations && !analyzing && !error && hasCredentials && (
                <Caption2 block className="italic">
                    Select an index to get specific configuration
                    recommendations based on your data and current settings.
                </Caption2>
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
