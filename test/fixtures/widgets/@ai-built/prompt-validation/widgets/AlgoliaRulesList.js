// File: widgets/AlgoliaRulesList.js
import React, { useState, useEffect, useMemo } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    StatusBadge,
    SearchInput,
    EmptyState,
    Skeleton,
    Alert2,
    Caption2,
    Caption3,
    Button3,
} from "@trops/dash-react";
import {
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

const HITS_PER_PAGE = 50;

function getRuleLabel(rule) {
    if (
        rule &&
        typeof rule.description === "string" &&
        rule.description.trim()
    ) {
        return rule.description;
    }
    if (rule && typeof rule.objectID === "string" && rule.objectID) {
        return rule.objectID;
    }
    return "(untitled rule)";
}

function getRuleSubtitle(rule) {
    // Surface the rule's primary anchoring (query / context / filters)
    // so the user can tell rules apart at a glance.
    if (!rule || typeof rule !== "object") return "";
    const condition = Array.isArray(rule.conditions)
        ? rule.conditions[0]
        : rule.condition;
    if (condition && typeof condition === "object") {
        if (typeof condition.pattern === "string" && condition.pattern.trim()) {
            const anchoring =
                typeof condition.anchoring === "string"
                    ? ` (${condition.anchoring})`
                    : "";
            return `query: "${condition.pattern}"${anchoring}`;
        }
        if (typeof condition.context === "string" && condition.context.trim()) {
            return `context: ${condition.context}`;
        }
        if (typeof condition.filters === "string" && condition.filters.trim()) {
            return `filters: ${condition.filters}`;
        }
    }
    return rule.objectID ? `id: ${rule.objectID}` : "";
}

function isRuleEnabled(rule) {
    // Algolia's API returns `enabled` as a boolean; if absent, the rule is
    // treated as enabled (Algolia's documented default).
    if (!rule || typeof rule !== "object") return false;
    if (typeof rule.enabled === "boolean") return rule.enabled;
    return true;
}

export default function AlgoliaRulesList({
    title = "Algolia Rules",
    indexName = "",
}) {
    // Hooks first — Rules of Hooks. All branching renders go AFTER this block.
    const { hasProvider, getProvider } = useWidgetProviders();
    const provider = getProvider("algolia");
    const pc = useProviderClient(provider);
    const { publishEvent } = useWidgetEvents();

    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [rules, setRules] = useState(null);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Debounce the search input so we don't hit the API on every keystroke.
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQuery(searchInput), 250);
        return () => clearTimeout(handle);
    }, [searchInput]);

    // Load rules whenever the index, search query, or refresh trigger changes.
    useEffect(() => {
        if (!pc?.providerHash) return;
        if (!indexName) return;
        let cancelled = false;
        setError(null);
        setRules(null);
        window.mainApi.algolia
            .searchRules({
                providerHash: pc.providerHash,
                dashboardAppId: pc.dashboardAppId,
                providerName: pc.providerName,
                indexName,
                query: debouncedQuery,
                hitsPerPage: HITS_PER_PAGE,
                page: 0,
            })
            .then((response) => {
                if (cancelled) return;
                // Algolia returns { hits, nbHits, page, ... } but the IPC
                // method may unwrap to an array — handle both shapes.
                const hits = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.hits)
                    ? response.hits
                    : [];
                setRules(hits);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err);
                setRules([]);
            });
        return () => {
            cancelled = true;
        };
    }, [
        pc?.providerHash,
        pc?.dashboardAppId,
        pc?.providerName,
        indexName,
        debouncedQuery,
        refreshKey,
    ]);

    const stats = useMemo(() => {
        if (!Array.isArray(rules)) return null;
        const total = rules.length;
        const enabled = rules.filter(isRuleEnabled).length;
        return { total, enabled, disabled: total - enabled };
    }, [rules]);

    // Conditional renders AFTER all hooks have run.
    if (!hasProvider("algolia")) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <EmptyState
                    title="No Algolia provider"
                    description="Configure an Algolia provider in Settings → Providers."
                />
            </Panel>
        );
    }

    if (!indexName) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <EmptyState
                    title="No index selected"
                    description="Set the Algolia Index Name in Settings → Configure."
                />
            </Panel>
        );
    }

    return (
        <Panel>
            <div className="flex items-center justify-between gap-3 mb-3">
                <SubHeading2 title={title} />
                <Button3
                    title="Refresh"
                    size="sm"
                    onClick={() => setRefreshKey((k) => k + 1)}
                />
            </div>

            <div className="mb-3">
                <SearchInput
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Filter rules by query or description…"
                />
            </div>

            {stats && (
                <div className="mb-3 flex items-center gap-3">
                    <Caption2
                        text={`${stats.total} rule${
                            stats.total === 1 ? "" : "s"
                        }`}
                    />
                    <Caption3
                        text={`${stats.enabled} on · ${stats.disabled} off`}
                    />
                </div>
            )}

            {error && (
                <Alert2
                    title="Failed to load rules"
                    message={error?.message || String(error)}
                />
            )}

            {!error && rules === null && <Skeleton.Text lines={6} />}

            {!error && Array.isArray(rules) && rules.length === 0 && (
                <EmptyState
                    title="No rules found"
                    description={
                        debouncedQuery
                            ? `No rules match "${debouncedQuery}" on index "${indexName}".`
                            : `Index "${indexName}" has no query rules yet.`
                    }
                />
            )}

            {!error && Array.isArray(rules) && rules.length > 0 && (
                <Menu>
                    {rules.map((rule, idx) => {
                        const enabled = isRuleEnabled(rule);
                        const objectID =
                            rule && typeof rule.objectID === "string"
                                ? rule.objectID
                                : `rule-${idx}`;
                        return (
                            <MenuItem
                                key={objectID}
                                onClick={() =>
                                    publishEvent("ruleSelected", {
                                        objectID,
                                        indexName,
                                        enabled,
                                        description:
                                            typeof rule?.description ===
                                            "string"
                                                ? rule.description
                                                : "",
                                    })
                                }
                            >
                                <div className="flex items-center justify-between gap-3 w-full">
                                    <div className="flex flex-col min-w-0">
                                        <Caption2 text={getRuleLabel(rule)} />
                                        <Caption3
                                            text={getRuleSubtitle(rule)}
                                        />
                                    </div>
                                    <StatusBadge
                                        state={enabled ? "success" : "neutral"}
                                        label={enabled ? "on" : "off"}
                                        compact
                                    />
                                </div>
                            </MenuItem>
                        );
                    })}
                </Menu>
            )}
        </Panel>
    );
}
