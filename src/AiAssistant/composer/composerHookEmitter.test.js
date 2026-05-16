/**
 * Tests for composerHookEmitter (Stage 4).
 *
 * collectWires:
 *   - skips unconfigured (skeleton) wires
 *   - returns every configured wire across the tree
 *
 * buildHookScaffold:
 *   - empty when no wires
 *   - credential class: emits useWidgetProviders + useProviderClient
 *     once per provider instance, plus useState/useEffect per slot
 *   - mcp class: emits useMcpProvider + callTool with the picked tool
 *   - auto-supplies the credential triplet (providerHash/dashboardAppId/
 *     providerName) without the user binding them
 *   - literal-kind args render as JSON-encoded values
 *   - userConfig-kind args render as `userConfig.<field>` and
 *     populate the userConfigFields set
 *   - return-shape heuristic: methods returning {hits:Array} unwrap
 *     to result?.hits; methods returning Array unwrap with Array.isArray;
 *     other shapes use `result` directly
 *   - slot var names disambiguate when the same propName is wired
 *     on multiple nodes
 */

import { collectWires, buildHookScaffold } from "./composerHookEmitter";

const fakeRegistry = {
    algolia: {
        listIndices: { returns: { type: "Array<{name,entries}>" } },
        search: { returns: { type: "{hits:Array<Object>,nbHits}" } },
        getSettings: { returns: { type: "Object" } },
    },
};

function makeTree() {
    return {
        widgetName: "W",
        root: {
            id: "root",
            type: "Panel",
            props: {},
            children: [],
        },
    };
}

describe("collectWires", () => {
    test("returns empty for an empty tree", () => {
        expect(collectWires(makeTree())).toEqual([]);
        expect(collectWires(null)).toEqual([]);
    });

    test("skips skeleton wires (provider:null, method:null)", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: { data: { provider: null, method: null } },
            children: [],
        });
        expect(collectWires(tree)).toEqual([]);
    });

    test("returns configured wires across the tree", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "listIndices",
                },
            },
            children: [],
        });
        tree.root.children.push({
            id: "node-2",
            type: "DataList",
            props: {},
            wires: {
                items: {
                    provider: "B",
                    providerType: "filesystem",
                    providerClass: "mcp",
                    method: "read_file",
                },
            },
            children: [],
        });
        const wires = collectWires(tree);
        expect(wires.map((w) => w.nodeId)).toEqual(["node-1", "node-2"]);
        expect(wires.map((w) => w.propName)).toEqual(["data", "items"]);
    });
});

describe("buildHookScaffold", () => {
    test("returns empty scaffold for a tree with no wires", () => {
        const s = buildHookScaffold(makeTree(), fakeRegistry);
        expect(s.extraReactImports.size).toBe(0);
        expect(s.coreImports.size).toBe(0);
        expect(s.hookLines).toEqual([]);
        expect(s.slotVarBySlotKey.size).toBe(0);
    });

    test("credential wire emits useWidgetProviders + useProviderClient + state + effect", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "MyAlgolia",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "listIndices",
                    args: {},
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        expect(s.extraReactImports.has("useState")).toBe(true);
        expect(s.extraReactImports.has("useEffect")).toBe(true);
        expect(s.coreImports.has("useWidgetProviders")).toBe(true);
        expect(s.coreImports.has("useProviderClient")).toBe(true);

        const text = s.hookLines.join("\n");
        expect(text).toContain("useProviderClient(provider_MyAlgolia)");
        expect(text).toContain("useState(null)");
        expect(text).toContain("window.mainApi.algolia.listIndices");
        // Auto-supplied credential triplet.
        expect(text).toContain("providerHash: pc_MyAlgolia.providerHash");
        expect(text).toContain("dashboardAppId: pc_MyAlgolia.dashboardAppId");
        expect(text).toContain("providerName: pc_MyAlgolia.providerName");
        // listIndices returns Array<…> → uses Array.isArray unwrap.
        expect(text).toContain("set_data(Array.isArray(result) ? result : [])");
    });

    test("search method returns {hits:Array} → unwraps to result?.hits", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "MyAlgolia",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "search",
                    args: {
                        indexName: { kind: "literal", value: "products" },
                        query: { kind: "literal", value: "" },
                    },
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        const text = s.hookLines.join("\n");
        expect(text).toContain("set_data(result?.hits || [])");
        expect(text).toContain('indexName: "products"');
        expect(text).toContain('query: ""');
    });

    test("mcp wire emits useMcpProvider + callTool", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "DataList",
            props: {},
            wires: {
                items: {
                    provider: "MyFs",
                    providerType: "filesystem",
                    providerClass: "mcp",
                    method: "read_file",
                    args: {
                        path: { kind: "literal", value: "/tmp/a.txt" },
                    },
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        expect(s.coreImports.has("useMcpProvider")).toBe(true);
        expect(s.coreImports.has("useWidgetProviders")).toBe(false);
        const text = s.hookLines.join("\n");
        expect(text).toContain('useMcpProvider("filesystem")');
        expect(text).toContain('mcp_filesystem.callTool("read_file"');
        expect(text).toContain('path: "/tmp/a.txt"');
    });

    test("userConfig args populate userConfigFields set", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "search",
                    args: {
                        indexName: {
                            kind: "userConfig",
                            field: "indexName",
                        },
                        query: {
                            kind: "userConfig",
                            field: "searchTerm",
                        },
                    },
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        expect([...s.userConfigFields].sort()).toEqual([
            "indexName",
            "searchTerm",
        ]);
        const text = s.hookLines.join("\n");
        expect(text).toContain("indexName: userConfig.indexName");
        expect(text).toContain("query: userConfig.searchTerm");
    });

    test("provider hook renders once when two slots use the same instance", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "listIndices",
                    args: {},
                },
            },
            children: [],
        });
        tree.root.children.push({
            id: "node-2",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "search",
                    args: {
                        indexName: { kind: "literal", value: "x" },
                        query: { kind: "literal", value: "" },
                    },
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        const text = s.hookLines.join("\n");
        // The "useProviderClient" line should appear exactly once
        // (one provider instance, multiple slots).
        const matches = text.match(/useProviderClient\(provider_A\)/g) || [];
        expect(matches.length).toBe(1);
    });

    test("disambiguates slot var names when same propName wired on multiple nodes", () => {
        const tree = makeTree();
        tree.root.children.push({
            id: "node-1",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "listIndices",
                    args: {},
                },
            },
            children: [],
        });
        tree.root.children.push({
            id: "node-2",
            type: "Table",
            props: {},
            wires: {
                data: {
                    provider: "A",
                    providerType: "algolia",
                    providerClass: "credential",
                    method: "search",
                    args: {
                        indexName: { kind: "literal", value: "x" },
                    },
                },
            },
            children: [],
        });
        const s = buildHookScaffold(tree, fakeRegistry);
        const vars = [...s.slotVarBySlotKey.values()];
        // Two distinct var names — second disambiguated by suffix.
        expect(new Set(vars).size).toBe(2);
        expect(vars).toContain("data");
        expect(vars.some((v) => v.startsWith("data_"))).toBe(true);
    });
});
