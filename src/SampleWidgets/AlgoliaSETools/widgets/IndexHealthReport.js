/**
 * IndexHealthReport
 *
 * Analyze an Algolia index's settings against best practices and display
 * a scored health report. Helps SEs quickly identify configuration gaps.
 *
 * Requires the Algolia credential provider (appId + apiKey).
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    AlertBanner,
    Caption2,
    SelectInput,
    readableError,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";
import { scoreIndex } from "../utils/indexHealthScorer";
import { HealthScorecard } from "./components/HealthScorecard";

function IndexHealthReportContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [settings, setSettings] = useState(null);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [report, setReport] = useState(null);
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
        setLoadingSettings(true);
        setError(null);
        setReport(null);
        try {
            const result = await window.mainApi.algolia.getSettings({
                ...pc,
                indexName: selectedIndex,
            });
            if (result?.error) {
                setError(readableError(result, "Failed to load settings"));
                return;
            }
            setSettings(result);
            const scored = scoreIndex(result);
            setReport(scored);
        } catch (err) {
            setError(readableError(err, "Failed to analyze index"));
        } finally {
            setLoadingSettings(false);
        }
    }, [pc, selectedIndex]);

    // Auto-trigger analyze when index is set via indexSelected event
    useEffect(() => {
        if (fromEventRef.current && selectedIndex) {
            fromEventRef.current = false;
            handleAnalyze();
        }
    }, [selectedIndex, handleAnalyze]);

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
                        options={indices.map((idx) => ({
                            value: idx.name,
                            label: `${idx.name} (${(
                                idx.entries || 0
                            ).toLocaleString()} records)`,
                        }))}
                        placeholder={
                            loadingIndices
                                ? "Loading indices..."
                                : "Select an index"
                        }
                        className="flex-1 min-w-0"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleAnalyze}
                        disabled={!selectedIndex || loadingSettings}
                    >
                        {loadingSettings ? "Analyzing..." : "Analyze"}
                    </Button>
                </div>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {report && (
                <HealthScorecard
                    score={report.score}
                    maxScore={report.maxScore}
                    checks={report.checks}
                />
            )}

            {!report && !loadingSettings && !error && hasCredentials && (
                <Caption2 block className="italic">
                    Select an index and click Analyze to generate a health
                    report.
                </Caption2>
            )}
        </div>
    );
}

export const IndexHealthReport = ({
    title = "Index Health Report",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <IndexHealthReportContent title={title} />
            </Panel>
        </Widget>
    );
};
