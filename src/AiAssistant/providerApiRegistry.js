/**
 * Provider API Registry — every credential-provider IPC method
 * available at `window.mainApi.<service>.*` and the exact arg
 * shape it expects. Sourced from public/preload.js + the matching
 * IPC handlers in public/electron.js.
 *
 * Why this exists: the AI building widgets in this modal would
 * otherwise hallucinate methods like `mainApi.algolia.getRules`,
 * `mainApi.algolia.saveRule`, `mainApi.algolia.deleteRule` — none
 * of which exist. Those widgets compile but throw at runtime
 * (or return undefined and silently fail). The registry feeds
 * the prompt with the *actual* surface area, and the validator
 * (widgetCodeValidator.js) rejects compiled code that calls a
 * method outside this list.
 *
 * Drift detector: providerApiRegistry.test.js parses preload.js
 * and asserts every key in REGISTRY[service] also appears in the
 * preload's `<service>: { ... }` block (no fictional entries) and
 * every preload entry shows up in the registry (no missing
 * entries). If the bridge changes, the test fails until both are
 * updated.
 */

/**
 * Shape:
 *   PROVIDER_API_REGISTRY[serviceName] = {
 *     [methodName]: {
 *       args: ["field1", "field2", ...],   // top-level keys of the payload object
 *       desc:  "Short one-line description.",
 *     },
 *     ...
 *   }
 *
 * `args` is the destructured shape of the single object the IPC
 * handler expects. Most algolia handlers accept
 * `{ providerHash, dashboardAppId, providerName, ...callSpecific }`
 * — the credentials-resolution prefix is invariant; only the call-
 * specific fields vary.
 */
export const PROVIDER_API_REGISTRY = {
    algolia: {
        listIndices: {
            args: ["providerHash", "dashboardAppId", "providerName"],
            desc: "List every index in the configured Algolia application. Returns an array of `{ name, entries, ... }` rows.",
        },
        search: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "query",
                "options",
            ],
            desc: "Run a search against an index. `options` is the standard Algolia search options object.",
        },
        browseObjectsToFile: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "toFilename",
                "query",
            ],
            desc: "Stream every record matching `query` (default empty = all) into a JSON file at `toFilename`. Use for export workflows.",
        },
        partialUpdateObjectsFromDirectory: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "dir",
                "createIfNotExists",
            ],
            desc: "Bulk-update records by reading every JSON file in `dir`. `createIfNotExists` toggles upsert behavior.",
        },
        getSettings: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
            ],
            desc: "Get the index's settings object (searchableAttributes, ranking, etc.).",
        },
        setSettings: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "settings",
            ],
            desc: "Replace the index's settings object.",
        },
        getAnalyticsForQuery: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "query",
            ],
            desc: "Fetch analytics for a single query (count, click-through, conversion).",
        },
        searchRules: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "query",
                "hitsPerPage",
                "page",
            ],
            desc: "List/search query rules on an index. `query` defaults to '' (returns all rules). `hitsPerPage` and `page` are optional pagination. Returns the standard Algolia rules-search response (`{ hits, nbHits, page, nbPages }`).",
        },
        saveRule: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "rule",
            ],
            desc: "Create or update (upsert) a single query rule. `rule` is the full rule object including `objectID`. There is no separate createRule/updateRule — saveRule does both.",
        },
        deleteRule: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
                "objectID",
            ],
            desc: "Delete a query rule by `objectID`. Destructive — every install of an `@ai-built/*` widget that calls this triggers the install-time permission gate.",
        },
    },
};

/**
 * Format the registry for a specific service into a prompt-ready
 * markdown section the system prompt can inject. Keep terse — the
 * AI gets every field it needs and nothing extra.
 *
 * Returns an empty string for unknown services so the caller can
 * unconditionally interpolate without checking.
 */
export function formatProviderApiSection(service) {
    if (!service || typeof service !== "string") return "";
    const entries = PROVIDER_API_REGISTRY[service];
    if (!entries) return "";

    const lines = [];
    lines.push(
        `## AVAILABLE METHODS — \`window.mainApi.${service}.*\` (credential class)`
    );
    lines.push("");
    lines.push(
        `These are the ONLY methods you may call on \`window.mainApi.${service}\`. Calling any method not in this list is a hard compile error in this app — the validator rejects it before render. Do NOT invent new method names. Do NOT guess based on what the underlying SDK exposes — only this surface is bridged.`
    );
    lines.push("");
    for (const [name, spec] of Object.entries(entries)) {
        const argsList = spec.args.map((a) => `\`${a}\``).join(", ");
        lines.push(`- \`${service}.${name}({ ${spec.args.join(", ")} })\``);
        lines.push(`  - args: ${argsList}`);
        lines.push(`  - ${spec.desc}`);
    }
    lines.push("");
    lines.push(
        `\`providerHash\`, \`dashboardAppId\`, and \`providerName\` come from the provider client handle: \`const pc = useProviderClient(provider)\` → \`pc.providerHash\`, \`pc.dashboardAppId\`, \`pc.providerName\`. Always pass these three. Never pass the bare \`pc\` object — the IPC handler destructures the keys, not the wrapper.`
    );
    return lines.join("\n");
}
