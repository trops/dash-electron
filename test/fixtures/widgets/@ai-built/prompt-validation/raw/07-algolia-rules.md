<!-- scenario: 07-algolia-rules -->
<!-- userPrompt: List rules for an Algolia index with their on/off state, search to filter. -->
<!-- exitCode: 0 -->
<!-- durationMs: 56937 -->

I'll build an Algolia widget that lists query rules for an index with on/off badges and a server-side search filter. Since `searchRules` accepts a `query` parameter, the search is sent to Algolia directly (debounced) so it filters by query string and description natively.

**Permission note (read before clicking Install):** This widget calls `window.mainApi.algolia.searchRules`. It does NOT call `saveRule` or `deleteRule` — read-only.

```javascript
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
```

```javascript
// File: widgets/AlgoliaRulesList.dash.js
import AlgoliaRulesList from "./AlgoliaRulesList";

export default {
    component: AlgoliaRulesList,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Rules",
            displayName: "Title",
            instructions: "Header shown at the top of the widget.",
            required: false,
        },
        indexName: {
            type: "text",
            defaultValue: "",
            displayName: "Algolia Index Name",
            instructions:
                "The Algolia index whose query rules will be listed (e.g., 'products').",
            required: true,
        },
    },
    providers: [
        {
            type: "algolia",
            providerClass: "credential",
            required: true,
        },
    ],
    events: ["ruleSelected"],
};
```

```javascript
// File: index.js
export { default as AlgoliaRulesList } from "./widgets/AlgoliaRulesList";
export { default as AlgoliaRulesListConfig } from "./widgets/AlgoliaRulesList.dash.js";
```

**What it does**

-   Lists every query rule on the configured Algolia index, one row per rule, with an `on`/`off` `StatusBadge` showing the rule's `enabled` flag (treated as `true` when absent, per Algolia's default).
-   The search input is sent to Algolia's `searchRules` endpoint as the `query` parameter — Algolia matches it against rule description, objectID, and pattern, so the user gets server-side filtering rather than a local-only contains check.
-   Search is debounced (250 ms) so typing doesn't fire an IPC call per keystroke.
-   A "Refresh" button forces a reload without changing the query.
-   The stats line above the list shows the on/off split for the currently-shown page.

**Event emitted**

-   `ruleSelected` — fires when the user clicks a row. Payload: `{ objectID, indexName, enabled, description }`. Wire a sibling rule-editor or rule-detail widget to it via Settings → Configure → Event Handlers.

**Permissions you'll see at Install time**

-   `algolia.searchRules` — read-only listing of query rules. No write or delete methods are called.
