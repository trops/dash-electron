/**
 * algoliaOps unit tests — mock the Algolia client and assert each
 * helper invokes the SDK with the EXACT positional shape the SDK
 * expects. A signature mistake here is what produced the
 * "Expecting a string (near 1:11)" runtime error for the user;
 * these tests are the regression net.
 */

"use strict";

const ops = require("./algoliaOps.cjs");

/**
 * Build a stub Algolia client. `initIndex(name)` returns a per-name
 * stub object whose SDK methods are jest.fn()s — callers can read
 * `client._index(name).searchRules.mock.calls` to inspect what was
 * passed. The "fresh per name" detail matters because the real SDK
 * returns a distinct index object per indexName too.
 */
function fakeClient() {
    const indexes = {};
    return {
        initIndex(name) {
            if (!indexes[name]) {
                indexes[name] = {
                    searchRules: jest.fn().mockResolvedValue({
                        hits: [],
                        nbHits: 0,
                        page: 0,
                        nbPages: 0,
                    }),
                    saveRule: jest
                        .fn()
                        .mockResolvedValue({ taskID: 1, objectID: "x" }),
                    deleteRule: jest
                        .fn()
                        .mockResolvedValue({ taskID: 2, objectID: "x" }),
                    getSettings: jest.fn().mockResolvedValue({ attrs: [] }),
                    setSettings: jest.fn().mockResolvedValue({ taskID: 3 }),
                };
            }
            return indexes[name];
        },
        _index(name) {
            return indexes[name];
        },
    };
}

describe("algoliaOps.searchRules", () => {
    test("calls index.searchRules(query, options) POSITIONALLY — not as one object", async () => {
        // This is the bug the user hit. The SDK signature is
        // `searchRules(query: string, options?: SearchOptions)`. A
        // single object first-arg stringifies to "[object Object]"
        // and Algolia throws a query-parse error.
        const client = fakeClient();
        await ops.searchRules(client, {
            indexName: "airports",
            query: "promo",
            hitsPerPage: 50,
            page: 2,
        });
        const idx = client._index("airports");
        expect(idx.searchRules).toHaveBeenCalledTimes(1);
        const args = idx.searchRules.mock.calls[0];
        // First arg: the query STRING (not an object).
        expect(args[0]).toBe("promo");
        // Second arg: an options object carrying optional fields.
        expect(args[1]).toEqual({ hitsPerPage: 50, page: 2 });
    });

    test("substitutes empty string when query is null/undefined (SDK requires a string)", async () => {
        const client = fakeClient();
        await ops.searchRules(client, {
            indexName: "airports",
            query: undefined,
        });
        const idx = client._index("airports");
        expect(idx.searchRules.mock.calls[0][0]).toBe("");
    });

    test("omits optional fields when they aren't passed (no `hitsPerPage: undefined` leakage)", async () => {
        const client = fakeClient();
        await ops.searchRules(client, { indexName: "airports", query: "x" });
        const idx = client._index("airports");
        expect(idx.searchRules.mock.calls[0][1]).toEqual({});
    });
});

describe("algoliaOps.saveRule", () => {
    test("calls index.saveRule(rule) with the rule object positionally", async () => {
        const client = fakeClient();
        const rule = { objectID: "r1", description: "hi" };
        await ops.saveRule(client, { indexName: "airports", rule });
        const idx = client._index("airports");
        expect(idx.saveRule).toHaveBeenCalledTimes(1);
        expect(idx.saveRule.mock.calls[0][0]).toBe(rule);
    });
});

describe("algoliaOps.deleteRule", () => {
    test("calls index.deleteRule(objectID) with the id string positionally", async () => {
        const client = fakeClient();
        await ops.deleteRule(client, {
            indexName: "airports",
            objectID: "r1",
        });
        const idx = client._index("airports");
        expect(idx.deleteRule.mock.calls[0][0]).toBe("r1");
    });
});

describe("algoliaOps.getSettings / setSettings", () => {
    test("getSettings: no positional args (settings come from the index handle)", async () => {
        const client = fakeClient();
        await ops.getSettings(client, { indexName: "airports" });
        const idx = client._index("airports");
        expect(idx.getSettings).toHaveBeenCalledWith();
    });
    test("setSettings: settings object passed positionally", async () => {
        const client = fakeClient();
        const settings = { searchableAttributes: ["name"] };
        await ops.setSettings(client, { indexName: "airports", settings });
        const idx = client._index("airports");
        expect(idx.setSettings.mock.calls[0][0]).toBe(settings);
    });
});
