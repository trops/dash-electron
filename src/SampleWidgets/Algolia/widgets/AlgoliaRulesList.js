/**
 * AlgoliaRulesList
 *
 * Paginated list of an Algolia index's rules. Each row shows the rule's
 * description, an enabled/disabled state badge, and a condition /
 * consequence-op count. Clicking a row publishes `ruleSelected`.
 *
 * Exemplar widget (post-cohesion rubric): every UI element is a
 * `@trops/dash-react` primitive that reads ThemeContext.
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Caption2,
    Button2,
    Button3,
    Menu,
    MenuItem,
    InputText,
    StatusBadge,
    EmptyState,
    Alert2,
    Skeleton,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function statusState({ hasCredentials, activeIndex, error, loading }) {
    if (!hasCredentials) return "neutral";
    if (!activeIndex) return "warning";
    if (error) return "error";
    if (loading) return "info";
    return "success";
}

function statusLabel({ hasCredentials, activeIndex, loading, error, nbHits }) {
    if (!hasCredentials) return "no provider";
    if (!activeIndex) return "no index";
    if (loading) return "loading";
    if (error) return "error";
    return `${nbHits} rule${nbHits === 1 ? "" : "s"}`;
}

function AlgoliaRulesListContent({ title, indexName, hitsPerPage }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [activeIndex, setActiveIndex] = useState(indexName || "");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rules, setRules] = useState([]);
    const [nbPages, setNbPages] = useState(0);
    const [nbHits, setNbHits] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const configIndexRef = useRef(indexName);
    useEffect(() => {
        if (indexName !== configIndexRef.current) {
            configIndexRef.current = indexName;
            setActiveIndex(indexName || "");
            setPage(0);
        }
    }, [indexName]);

    const indexSelectedRef = useRef(null);
    indexSelectedRef.current = (data) => {
        const payload = data?.message || data;
        const name =
            (typeof payload === "string" ? payload : payload?.name) || "";
        if (name) {
            setActiveIndex(name);
            setPage(0);
        }
    };
    useEffect(() => {
        if (!listeners || !listen) return;
        listen(listeners, {
            indexSelected: (payload) => indexSelectedRef.current(payload),
        });
    }, [listen, listeners]);

    const loadRules = useCallback(
        (targetPage = 0) => {
            if (!pc?.providerHash || !activeIndex) return;
            setLoading(true);
            setError(null);
            window.mainApi.algolia
                .searchRules({
                    ...pc,
                    indexName: activeIndex,
                    query: query.trim(),
                    hitsPerPage,
                    page: targetPage,
                })
                .then((data) => {
                    setRules(Array.isArray(data?.hits) ? data.hits : []);
                    setNbPages(data?.nbPages || 0);
                    setNbHits(data?.nbHits || 0);
                    setPage(data?.page || 0);
                    setLoading(false);
                })
                .catch((err) => {
                    setError(err?.message || "Failed to load rules");
                    setLoading(false);
                });
        },
        [pc?.providerHash, activeIndex, query, hitsPerPage]
    );

    useEffect(() => {
        loadRules(0);
    }, [pc?.providerHash, activeIndex, loadRules]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadRules(0);
    };

    const handleSelect = (rule) => {
        setSelectedId(rule.objectID);
        publishEvent("ruleSelected", {
            objectID: rule.objectID,
            description: rule.description || "",
            indexName: activeIndex,
            rule,
        });
    };

    const handlePrev = () => {
        if (page > 0) loadRules(page - 1);
    };
    const handleNext = () => {
        if (page + 1 < nbPages) loadRules(page + 1);
    };

    const ruleLabel = (rule) =>
        rule.description ||
        rule.objectID ||
        (rule.conditions && rule.conditions[0]?.pattern) ||
        "(unnamed rule)";

    const conditionCount = (rule) =>
        Array.isArray(rule.conditions) ? rule.conditions.length : 0;

    const consequenceOpCount = (rule) => {
        const c = rule.consequence || {};
        let n = 0;
        if (Array.isArray(c.promote)) n += c.promote.length;
        if (Array.isArray(c.hide)) n += c.hide.length;
        if (c.userData) n += 1;
        if (c.filterPromotes) n += 1;
        if (c.params) n += 1;
        return n;
    };

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto">
            <SubHeading2 title={title} />

            <div className="flex items-center gap-2">
                <StatusBadge
                    state={statusState({
                        hasCredentials,
                        activeIndex,
                        error,
                        loading,
                    })}
                    label={statusLabel({
                        hasCredentials,
                        activeIndex,
                        loading,
                        error,
                        nbHits,
                    })}
                    compact
                />
                {activeIndex && <Caption2 text={`(${activeIndex})`} />}
            </div>

            {error && <Alert2 title="Failed to load rules" message={error} />}

            {!hasCredentials && (
                <EmptyState
                    title="No Algolia provider"
                    description="Configure an Algolia provider (appId + apiKey) in Settings to load rules."
                />
            )}

            {hasCredentials && !activeIndex && (
                <EmptyState
                    title="No index configured"
                    description="Set the Index Name in this widget's settings, or pair it with a widget that publishes an indexSelected event."
                />
            )}

            {hasCredentials && activeIndex && (
                <>
                    <form
                        onSubmit={handleSearchSubmit}
                        className="flex items-center gap-2"
                    >
                        <div className="flex-1">
                            <InputText
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter rules by query…"
                                disabled={!hasCredentials || !activeIndex}
                            />
                        </div>
                        <Button2
                            title={loading ? "Loading…" : "Search"}
                            onClick={handleSearchSubmit}
                            disabled={
                                !hasCredentials || !activeIndex || loading
                            }
                            size="sm"
                        />
                    </form>

                    <div className="flex items-center justify-between">
                        <SubHeading3 title="Rules" />
                        {nbPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button3
                                    title="← Prev"
                                    onClick={handlePrev}
                                    disabled={page === 0 || loading}
                                    size="sm"
                                />
                                <Caption2
                                    text={`page ${page + 1} of ${nbPages}`}
                                />
                                <Button3
                                    title="Next →"
                                    onClick={handleNext}
                                    disabled={page + 1 >= nbPages || loading}
                                    size="sm"
                                />
                            </div>
                        )}
                    </div>

                    {loading && <Skeleton.Text lines={4} />}

                    {!loading && !error && rules.length === 0 && (
                        <EmptyState
                            title="No matching rules"
                            description={
                                query.trim()
                                    ? `Index ${activeIndex} has no rules matching "${query.trim()}".`
                                    : `Index ${activeIndex} has no rules.`
                            }
                        />
                    )}

                    {!loading && rules.length > 0 && (
                        <Menu className="flex-1 overflow-y-auto space-y-1">
                            {rules.map((rule) => {
                                const enabled = rule.enabled !== false;
                                return (
                                    <MenuItem
                                        key={rule.objectID}
                                        onClick={() => handleSelect(rule)}
                                        selected={selectedId === rule.objectID}
                                    >
                                        <div className="flex flex-col gap-1 w-full">
                                            <div className="flex items-center justify-between gap-2 w-full">
                                                <span className="truncate flex-1">
                                                    {ruleLabel(rule)}
                                                </span>
                                                <StatusBadge
                                                    state={
                                                        enabled
                                                            ? "success"
                                                            : "neutral"
                                                    }
                                                    label={
                                                        enabled ? "on" : "off"
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Caption2
                                                    text={`${conditionCount(
                                                        rule
                                                    )} cond`}
                                                />
                                                <Caption2
                                                    text={`${consequenceOpCount(
                                                        rule
                                                    )} action${
                                                        consequenceOpCount(
                                                            rule
                                                        ) === 1
                                                            ? ""
                                                            : "s"
                                                    }`}
                                                />
                                                <Caption2
                                                    text={rule.objectID}
                                                    className="truncate"
                                                />
                                            </div>
                                        </div>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    )}
                </>
            )}
        </div>
    );
}

export const AlgoliaRulesList = ({
    title = "Algolia Rules",
    indexName = "",
    hitsPerPage = 25,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaRulesListContent
                    title={title}
                    indexName={indexName}
                    hitsPerPage={Number(hitsPerPage) || 25}
                />
            </Panel>
        </Widget>
    );
};
