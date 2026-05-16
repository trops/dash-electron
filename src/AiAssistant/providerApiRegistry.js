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
 *       returns: {
 *         type: "Array<Object>" | "Object" | "void" | …,
 *         sampleShape: { … },              // representative example, NOT a runtime schema
 *       },
 *     },
 *     ...
 *   }
 *
 * `args` is the destructured shape of the single object the IPC
 * handler expects. Most algolia handlers accept
 * `{ providerHash, dashboardAppId, providerName, ...callSpecific }`
 * — the credentials-resolution prefix is invariant; only the call-
 * specific fields vary.
 *
 * `returns.type` is a loose type hint string (intentionally informal —
 * "Array<Object>", "Array<{name,entries}>", "{ taskID, objectID }") used
 * by the Compose-mode wire stage to filter the methods dropdown to
 * return-shape-compatible candidates for a given component slot
 * (e.g. Table.data needs Array → only show methods returning Array).
 *
 * `returns.sampleShape` is a representative JS-literal example the
 * composer can use to populate UI defaults — column suggestions for
 * a Table, field pickers for a DataList, etc. It is NOT validated at
 * runtime against actual responses; SDK responses may carry many
 * additional fields not enumerated here. Keep it minimal: just the
 * fields the composer needs to suggest sensible bindings.
 *
 * `returns: { type: "void" }` is allowed for methods called purely
 * for side effects (writes, deletes) — the composer will not surface
 * these in "wire to provider" pickers for display slots.
 */
export const PROVIDER_API_REGISTRY = {
    algolia: {
        listIndices: {
            args: ["providerHash", "dashboardAppId", "providerName"],
            desc: "List every index in the configured Algolia application. Returns an array of `{ name, entries, ... }` rows.",
            returns: {
                type: "Array<{name,entries,dataSize,fileSize,lastBuildTimeS,numberOfPendingTasks,pendingTask,primary,replicas,updatedAt,createdAt}>",
                sampleShape: [
                    {
                        name: "string",
                        entries: "number",
                        dataSize: "number",
                        fileSize: "number",
                        lastBuildTimeS: "number",
                        updatedAt: "string",
                        createdAt: "string",
                    },
                ],
            },
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
            returns: {
                type: "{hits:Array<Object>,nbHits,page,nbPages,hitsPerPage,processingTimeMS,query,params}",
                sampleShape: {
                    hits: [
                        {
                            objectID: "string",
                            _highlightResult: "object",
                            _snippetResult: "object",
                        },
                    ],
                    nbHits: "number",
                    page: "number",
                    nbPages: "number",
                    hitsPerPage: "number",
                    processingTimeMS: "number",
                    query: "string",
                    params: "string",
                },
            },
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
            returns: {
                type: "void",
                sampleShape: null,
            },
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
            returns: {
                type: "void",
                sampleShape: null,
            },
        },
        getSettings: {
            args: [
                "providerHash",
                "dashboardAppId",
                "providerName",
                "indexName",
            ],
            desc: "Get the index's settings object (searchableAttributes, ranking, etc.).",
            returns: {
                type: "Object",
                sampleShape: {
                    searchableAttributes: "Array<string>",
                    attributesForFaceting: "Array<string>",
                    ranking: "Array<string>",
                    customRanking: "Array<string>",
                    replicas: "Array<string>",
                },
            },
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
            returns: {
                type: "void",
                sampleShape: null,
            },
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
            returns: {
                type: "Object",
                sampleShape: {
                    query: "string",
                    count: "number",
                    clickThroughRate: "number",
                    conversionRate: "number",
                    averageClickPosition: "number",
                },
            },
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
            returns: {
                type: "{hits:Array<Object>,nbHits,page,nbPages}",
                sampleShape: {
                    hits: [
                        {
                            objectID: "string",
                            description: "string",
                            conditions: "Array<Object>",
                            consequence: "Object",
                            enabled: "boolean",
                        },
                    ],
                    nbHits: "number",
                    page: "number",
                    nbPages: "number",
                },
            },
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
            returns: {
                type: "{taskID,objectID}",
                sampleShape: {
                    taskID: "number",
                    objectID: "string",
                },
            },
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
            returns: {
                type: "{taskID}",
                sampleShape: {
                    taskID: "number",
                },
            },
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
