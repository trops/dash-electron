/**
 * IndexComparator
 *
 * Side-by-side comparison of two Algolia indices' settings.
 * Highlights differences for prod vs staging, before vs after, etc.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useContext } from "react";
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
import { diffSettings } from "../utils/settingsDiff";
import { SettingsDiffTable } from "./components/SettingsDiffTable";

function IndexComparatorContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();
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
                    if (payload.name) setIndexA(payload.name);
                },
            });
        }
    }, [listeners, listen]);

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
                setError(`${indexA}: ${readableError(settingsA, "Failed")}`);
                return;
            }
            if (settingsB?.error) {
                setError(`${indexB}: ${readableError(settingsB, "Failed")}`);
                return;
            }
            setDiffResult(diffSettings(settingsA, settingsB));
        } catch (err) {
            setError(readableError(err, "Comparison failed"));
        } finally {
            setComparing(false);
        }
    }, [pc, indexA, indexB]);

    const indexOptions = indices.map((idx) => ({
        value: idx.name,
        label: `${idx.name} (${(idx.entries || 0).toLocaleString()})`,
    }));
    const indexPlaceholder = loadingIndices ? "Loading..." : "Select index";

    // Index A / Index B are color-coded with the theme's secondary and
    // tertiary accents (matches the SettingsDiffTable column headers).
    const accentA = currentTheme?.["text-secondary-medium"] || "";
    const accentB = currentTheme?.["text-tertiary-medium"] || "";

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
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <label
                                className={`text-xs uppercase tracking-wide block mb-0.5 ${accentA}`}
                            >
                                Index A
                            </label>
                            <SelectInput
                                value={indexA}
                                onChange={(value) => setIndexA(value)}
                                options={indexOptions}
                                placeholder={indexPlaceholder}
                                inputClassName="text-xs"
                            />
                        </div>
                        <Caption2 className="mt-4">vs</Caption2>
                        <div className="flex-1 min-w-0">
                            <label
                                className={`text-xs uppercase tracking-wide block mb-0.5 ${accentB}`}
                            >
                                Index B
                            </label>
                            <SelectInput
                                value={indexB}
                                onChange={(value) => setIndexB(value)}
                                options={indexOptions}
                                placeholder={indexPlaceholder}
                                inputClassName="text-xs"
                            />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleCompare}
                        disabled={
                            !indexA || !indexB || indexA === indexB || comparing
                        }
                    >
                        {comparing ? "Comparing..." : "Compare"}
                    </Button>
                    {indexA && indexB && indexA === indexB && (
                        <span className={`text-xs ${status.warning.icon}`}>
                            Select two different indices to compare.
                        </span>
                    )}
                </div>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
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
                <Caption2 block className="italic">
                    Select two indices and click Compare to see a side-by-side
                    settings diff.
                </Caption2>
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
