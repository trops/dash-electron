/**
 * Tests for the composer emitter.
 *
 * Covers:
 *   - makeEmptyTree produces a single-Panel tree the composer can
 *     start from.
 *   - emitWidgetCode for an empty tree produces compilable JSX with
 *     just the imports for components actually used.
 *   - emitWidgetCode renders user-set props as JSX attributes, with
 *     correct quoting / brace-expression for each literal type.
 *   - emitWidgetCode fills in placeholders for required props the
 *     user hasn't set yet (so the preview stays alive mid-edit).
 *   - emitWidgetCode walks nested children to arbitrary depth and
 *     only imports components that are actually present.
 *   - insertChild / removeNode are non-mutating tree operations
 *     with stable id assignment.
 *
 * The emitted code is exercised structurally (string contains, JSX
 * shape checks) rather than via a real compile — compilePreview's
 * own e2e tests cover the round-trip through esbuild.
 */

import {
    makeEmptyTree,
    collectUsedComponents,
    emitWidgetCode,
    insertChild,
    removeNode,
    updateNodeProp,
    setSlotMode,
    setSlotWire,
    setSlotPipe,
    setSlotArg,
    clearSlotWire,
    getNodeById,
} from "./composerEmitter";

describe("makeEmptyTree", () => {
    test("produces a single-Panel root with no children", () => {
        const tree = makeEmptyTree();
        expect(tree.root.type).toBe("Panel");
        expect(tree.root.id).toBe("root");
        expect(tree.root.children).toEqual([]);
        expect(tree.widgetName).toBe("ComposedWidget");
    });

    test("respects a custom widget name", () => {
        const tree = makeEmptyTree("MyCustomWidget");
        expect(tree.widgetName).toBe("MyCustomWidget");
    });
});

describe("collectUsedComponents", () => {
    test("walks nested children and collects every component type", () => {
        const tree = makeEmptyTree();
        const withChildren = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: "Hello" } },
            1
        );
        const deeper = insertChild(
            withChildren,
            "root",
            { type: "Card", props: {}, children: [] },
            2
        );
        const cardId = deeper.root.children.find((c) => c.type === "Card").id;
        const final = insertChild(
            deeper,
            cardId,
            { type: "Button", props: { title: "Click" } },
            3
        );

        const used = collectUsedComponents(final);
        expect(used.has("Panel")).toBe(true);
        expect(used.has("Heading")).toBe(true);
        expect(used.has("Card")).toBe(true);
        expect(used.has("Button")).toBe(true);
    });

    test("returns an empty set for a null tree", () => {
        expect(collectUsedComponents(null).size).toBe(0);
        expect(collectUsedComponents({}).size).toBe(0);
    });
});

describe("emitWidgetCode — minimal cases", () => {
    test("empty tree emits a Panel-only widget with correct imports", () => {
        const tree = makeEmptyTree();
        const { componentCode, configCode } = emitWidgetCode(tree);

        expect(componentCode).toContain(
            'import { Panel } from "@trops/dash-react";'
        );
        expect(componentCode).toContain(
            "export default function ComposedWidget()"
        );
        expect(componentCode).toContain("<Panel />");
        expect(configCode).toContain('component: "ComposedWidget"');
        expect(configCode).toContain('workspace: "ai-built"');
    });

    test("custom widget name flows into export and config", () => {
        const tree = makeEmptyTree("MyDashboard");
        const { componentCode, configCode } = emitWidgetCode(tree);
        expect(componentCode).toContain(
            "export default function MyDashboard()"
        );
        expect(configCode).toContain('component: "MyDashboard"');
    });

    test("emits a fallback div when the tree has no root", () => {
        const { componentCode } = emitWidgetCode({
            widgetName: "X",
            root: null,
        });
        expect(componentCode).toContain("<div />");
    });
});

describe("emitWidgetCode — props", () => {
    test("renders string props as double-quoted attributes", () => {
        const tree = makeEmptyTree();
        const next = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: "Hello there" } },
            1
        );
        const { componentCode } = emitWidgetCode(next);
        expect(componentCode).toContain('<Heading title="Hello there" />');
    });

    test("escapes embedded double quotes in string props", () => {
        const tree = makeEmptyTree();
        const next = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: 'He said "hi"' } },
            1
        );
        const { componentCode } = emitWidgetCode(next);
        expect(componentCode).toContain('<Heading title="He said \\"hi\\"" />');
    });

    test("renders number and boolean props as brace expressions", () => {
        const tree = makeEmptyTree();
        const withSlider = insertChild(
            tree,
            "root",
            { type: "Slider", props: { value: 50, min: 0, max: 100 } },
            1
        );
        const { componentCode } = emitWidgetCode(withSlider);
        // Slider is an input component — value is auto-managed
        // via useState. The user-set value becomes the initial
        // state (useState(50)) and the JSX binds to the var.
        expect(componentCode).toContain(
            "const [sliderValue, setSliderValue] = useState(50);"
        );
        expect(componentCode).toMatch(/<Slider[^>]*value=\{sliderValue\}/);
        // min/max are static (not input-bound) — render literally.
        expect(componentCode).toMatch(/min=\{0\}/);
        expect(componentCode).toMatch(/max=\{100\}/);
    });

    test("renders array props as JSON-encoded brace expressions", () => {
        const tree = makeEmptyTree();
        const withSelect = insertChild(
            tree,
            "root",
            {
                type: "SelectInput",
                props: {
                    options: [
                        { label: "A", value: "a" },
                        { label: "B", value: "b" },
                    ],
                },
            },
            1
        );
        const { componentCode } = emitWidgetCode(withSelect);
        expect(componentCode).toContain(
            'options={[{"label":"A","value":"a"},{"label":"B","value":"b"}]}'
        );
    });
});

describe("emitWidgetCode — required-prop placeholders", () => {
    test("fills required string prop with a placeholder when unset", () => {
        const tree = makeEmptyTree();
        const next = insertChild(tree, "root", { type: "Heading" }, 1);
        const { componentCode } = emitWidgetCode(next);
        // Placeholders go through a uniform `prop={expr}` channel; the
        // expr for a `string` type is the quoted literal "Sample".
        // Bare-attribute form (title="…") is reserved for user-set
        // string props rendered via renderPropLiteral.
        expect(componentCode).toContain('<Heading title={"Sample"} />');
    });

    test("fills required Array prop with []", () => {
        const tree = makeEmptyTree();
        const next = insertChild(tree, "root", { type: "Table" }, 1);
        const { componentCode } = emitWidgetCode(next);
        // Table.data and Table.columns are both required Array<…>.
        expect(componentCode).toMatch(/data=\{\[\]\}/);
        expect(componentCode).toMatch(/columns=\{\[\]\}/);
    });

    test("user-set props win over placeholders", () => {
        const tree = makeEmptyTree();
        const next = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: "Real title" } },
            1
        );
        const { componentCode } = emitWidgetCode(next);
        expect(componentCode).toContain('title="Real title"');
        expect(componentCode).not.toContain('title="Sample"');
    });

    test("fills required ReactNode children with a sample text node", () => {
        const tree = makeEmptyTree();
        // Paragraph has children: ReactNode, required.
        const next = insertChild(tree, "root", { type: "Paragraph" }, 1);
        const { componentCode } = emitWidgetCode(next);
        expect(componentCode).toContain("<Paragraph>Sample</Paragraph>");
    });
});

describe("emitWidgetCode — nesting and imports", () => {
    test("imports include every distinct component used in any branch", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Card" }, 1);
        const cardId = t2.root.children[0].id;
        const t3 = insertChild(
            t2,
            cardId,
            { type: "Heading", props: { title: "Section" } },
            2
        );
        const t4 = insertChild(
            t3,
            cardId,
            { type: "Button", props: { title: "Go" } },
            3
        );
        const { componentCode } = emitWidgetCode(t4);
        expect(componentCode).toContain(
            'import { Button, Card, Heading, Panel } from "@trops/dash-react";'
        );
    });

    test("nests children to arbitrary depth", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Card" }, 1);
        const cardId = t2.root.children[0].id;
        const t3 = insertChild(
            t2,
            cardId,
            { type: "Heading", props: { title: "Inside the card" } },
            2
        );
        const { componentCode } = emitWidgetCode(t3);
        expect(componentCode).toContain("<Panel>");
        expect(componentCode).toContain("<Card>");
        expect(componentCode).toContain('<Heading title="Inside the card" />');
        expect(componentCode).toContain("</Card>");
        expect(componentCode).toContain("</Panel>");
    });
});

describe("insertChild / removeNode — immutability and stable ids", () => {
    test("insertChild does not mutate the input tree", () => {
        const tree = makeEmptyTree();
        const before = JSON.stringify(tree);
        const next = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: "x" } },
            1
        );
        expect(JSON.stringify(tree)).toBe(before);
        expect(next).not.toBe(tree);
        expect(next.root.children).toHaveLength(1);
    });

    test("insertChild assigns ids derived from the supplied counter", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 7);
        const t3 = insertChild(t2, "root", { type: "Button" }, 8);
        const ids = t3.root.children.map((c) => c.id);
        expect(ids).toEqual(["node-7", "node-8"]);
    });

    test("insertChild falls back to root when parentId is not found", () => {
        const tree = makeEmptyTree();
        const next = insertChild(
            tree,
            "no-such-id",
            { type: "Heading", props: { title: "x" } },
            1
        );
        expect(next.root.children).toHaveLength(1);
        expect(next.root.children[0].type).toBe("Heading");
    });

    test("removeNode strips a child by id", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 1);
        const t3 = insertChild(t2, "root", { type: "Button" }, 2);
        const t4 = removeNode(t3, "node-1");
        expect(t4.root.children).toHaveLength(1);
        expect(t4.root.children[0].type).toBe("Button");
    });

    test("removeNode refuses to remove the root", () => {
        const tree = makeEmptyTree();
        const next = removeNode(tree, "root");
        expect(next.root.id).toBe("root");
    });
});

describe("updateNodeProp", () => {
    test("sets a static prop on the named node", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 1);
        const t3 = updateNodeProp(t2, "node-1", "title", "Hello");
        const node = getNodeById(t3, "node-1");
        expect(node.props.title).toBe("Hello");
    });

    test("clears a prop when value is undefined", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(
            tree,
            "root",
            { type: "Heading", props: { title: "x" } },
            1
        );
        const t3 = updateNodeProp(t2, "node-1", "title", undefined);
        const node = getNodeById(t3, "node-1");
        expect(node.props.title).toBeUndefined();
    });

    test("does not mutate the input tree", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 1);
        const before = JSON.stringify(t2);
        updateNodeProp(t2, "node-1", "title", "Hello");
        expect(JSON.stringify(t2)).toBe(before);
    });

    test("is a no-op when the nodeId is not found", () => {
        const tree = makeEmptyTree();
        const next = updateNodeProp(tree, "no-such-id", "title", "x");
        expect(next).toBe(tree);
    });

    test("propagates static value into emitted JSX", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 1);
        const t3 = updateNodeProp(t2, "node-1", "title", "Hello");
        const { componentCode } = emitWidgetCode(t3);
        expect(componentCode).toContain('<Heading title="Hello" />');
    });
});

describe("setSlotMode / wires", () => {
    test('"wire" mode installs a skeleton wires entry', () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotMode(t2, "node-1", "data", "wire");
        const node = getNodeById(t3, "node-1");
        expect(node.wires).toBeDefined();
        expect(node.wires.data).toEqual({ provider: null, method: null });
    });

    test('"static" mode removes the wires entry', () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotMode(t2, "node-1", "data", "wire");
        const t4 = setSlotMode(t3, "node-1", "data", "static");
        const node = getNodeById(t4, "node-1");
        expect(node.wires && node.wires.data).toBeUndefined();
    });

    test("wired slots fall back to type-appropriate placeholders at emit time", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(
            tree,
            "root",
            { type: "Table", props: { data: [{ x: 1 }], columns: [] } },
            1
        );
        // Static values present — emitter uses them.
        const before = emitWidgetCode(t2).componentCode;
        expect(before).toContain('data={[{"x":1}]}');

        const t3 = setSlotMode(t2, "node-1", "data", "wire");
        const after = emitWidgetCode(t3).componentCode;
        // Wired now — placeholder [] wins despite the static value
        // still being in node.props (preserved across mode flips).
        expect(after).toMatch(/data=\{\[\]\}/);
        expect(after).not.toContain('data={[{"x":1}]}');
    });

    test("static value is preserved across a wire → static round-trip", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(
            tree,
            "root",
            { type: "Table", props: { data: [{ x: 1 }] } },
            1
        );
        const wired = setSlotMode(t2, "node-1", "data", "wire");
        const back = setSlotMode(wired, "node-1", "data", "static");
        const node = getNodeById(back, "node-1");
        expect(node.props.data).toEqual([{ x: 1 }]);
    });

    test("cloneNode (via insertChild) preserves wires on existing nodes", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotMode(t2, "node-1", "data", "wire");
        const t4 = insertChild(t3, "root", { type: "Heading" }, 2);
        const table = getNodeById(t4, "node-1");
        expect(table.wires.data).toEqual({ provider: null, method: null });
    });
});

describe("emitWidgetCode — hook scaffolding for configured wires (C4)", () => {
    function makeWiredTableTree() {
        const tree = makeEmptyTree("WiredWidget");
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        return setSlotWire(t2, "node-1", "data", {
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "listIndices",
            args: {},
        });
    }

    test("emits the full hook+effect+JSX bind for a wired Table", () => {
        const { componentCode } = emitWidgetCode(makeWiredTableTree());
        // React import grows to include useState + useEffect.
        expect(componentCode).toContain(
            'import React, { useEffect, useState } from "react";'
        );
        // dash-core hooks pulled in.
        expect(componentCode).toContain(
            'import { useProviderClient, useWidgetProviders } from "@trops/dash-core";'
        );
        // dash-react components still imported.
        expect(componentCode).toContain(
            'import { Panel, Table } from "@trops/dash-react";'
        );
        // Hook calls + state + effect body.
        expect(componentCode).toContain(
            "useProviderClient(provider_MyAlgolia)"
        );
        // listIndices returns Array → initial state is [] so the
        // Table doesn't crash with .map(null) on the first render
        // before the fetch completes.
        expect(componentCode).toContain(
            "const [data, set_data] = useState([]);"
        );
        expect(componentCode).toContain("window.mainApi.algolia.listIndices");
        // Wired prop binds to the slot var instead of [] placeholder.
        expect(componentCode).toContain("<Table data={data} columns={[]} />");
        // Component now takes a userConfig prop because at least one
        // wire is configured (even though no userConfig args set).
        expect(componentCode).toContain(
            "export default function WiredWidget({ userConfig = {} })"
        );
    });

    test("data-less tree (no wires) emits the C1 shape unchanged", () => {
        const tree = makeEmptyTree();
        const { componentCode } = emitWidgetCode(tree);
        expect(componentCode).toContain('import React from "react";');
        expect(componentCode).not.toContain("@trops/dash-core");
        expect(componentCode).not.toContain("useState");
        expect(componentCode).not.toContain("useEffect");
        expect(componentCode).toContain(
            "export default function ComposedWidget()"
        );
    });

    test("callback wire (Button.onClick → algolia.search) emits useCallback binding", () => {
        const tree = makeEmptyTree("CtaWidget");
        const t2 = insertChild(
            tree,
            "root",
            { type: "Button", props: { title: "Search" } },
            1
        );
        const t3 = setSlotWire(t2, "node-1", "onClick", {
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
            args: {
                indexName: { kind: "literal", value: "products" },
                query: { kind: "literal", value: "" },
            },
        });
        const { componentCode } = emitWidgetCode(t3);
        // useState is also imported for the result-capture state
        // that downstream pipe wires read from.
        expect(componentCode).toContain(
            'import React, { useCallback, useState } from "react";'
        );
        expect(componentCode).toContain(
            "const onClick = useCallback(async (eventArg) => {"
        );
        expect(componentCode).toContain("window.mainApi.algolia.search");
        expect(componentCode).toContain(
            "const [onClickResult, set_onClickResult] = useState([]);"
        );
        // JSX binds the callback to the prop.
        expect(componentCode).toMatch(/<Button[^>]*onClick=\{onClick\}/);
    });

    test("enriched .dash.js: providers declared from wires, userConfig from bindings", () => {
        // Compose a widget that wires Table.data → algolia.search
        // with one userConfig-bound arg. Config should declare both
        // the algolia credential provider AND the userConfig field.
        const tree = makeEmptyTree("EnrichedWidget");
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotWire(t2, "node-1", "data", {
            provider: null,
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
            args: {
                indexName: { kind: "userConfig", field: "indexName" },
                query: { kind: "userConfig", field: "searchQuery" },
            },
        });
        const { configCode } = emitWidgetCode(t3);
        // Provider declaration emitted.
        expect(configCode).toMatch(/providers:\s*\[/);
        expect(configCode).toContain('type: "algolia"');
        expect(configCode).toContain('providerClass: "credential"');
        expect(configCode).toContain("required: true");
        // userConfig declarations emitted, sorted, one per bound field.
        expect(configCode).toMatch(/userConfig:\s*\{/);
        expect(configCode).toContain('"indexName"');
        expect(configCode).toContain('"searchQuery"');
        expect(configCode).toContain('displayName: "Index Name"');
        expect(configCode).toContain('displayName: "Search Query"');
    });

    test("enriched .dash.js: pipe wires don't duplicate the source's provider declaration", () => {
        const tree = makeEmptyTree("PipeProviderWidget");
        // Button.onClick → google-drive.search (the source).
        const t2 = insertChild(tree, "root", { type: "Button" }, 1);
        const t3 = setSlotWire(t2, "node-1", "onClick", {
            providerType: "google-drive",
            providerClass: "mcp",
            method: "search",
        });
        // DataList.items piped from the same callback.
        const t4 = insertChild(t3, "root", { type: "DataList" }, 2);
        const t5 = setSlotPipe(t4, "node-2", "items", "node-1", "onClick");
        const { configCode } = emitWidgetCode(t5);
        // One provider entry — pipe wire doesn't add a second.
        const matches = configCode.match(/type: "google-drive"/g) || [];
        expect(matches.length).toBe(1);
        expect(configCode).toContain('providerClass: "mcp"');
    });

    test("data-less tree emits the original sparse config (no providers, no userConfig)", () => {
        const tree = makeEmptyTree();
        const { configCode } = emitWidgetCode(tree);
        expect(configCode).not.toMatch(/providers:/);
        expect(configCode).not.toMatch(/userConfig:/);
        expect(configCode).toContain('component: "ComposedWidget"');
    });

    test("input component (SearchInput) auto-allocates value state and binds onChange to setter", () => {
        // Just a SearchInput with no wires — emitter should still
        // produce a useState binding so the component captures the
        // typed value into state.
        const tree = makeEmptyTree("StatefulSearch");
        const t2 = insertChild(tree, "root", { type: "SearchInput" }, 1);
        const { componentCode } = emitWidgetCode(t2);
        expect(componentCode).toContain(
            'import React, { useState } from "react";'
        );
        expect(componentCode).toMatch(
            /const \[searchInputValue, setSearchInputValue\] = useState\(""\);/
        );
        expect(componentCode).toMatch(
            /<SearchInput[^>]*value=\{searchInputValue\}/
        );
        expect(componentCode).toMatch(
            /<SearchInput[^>]*onChange=\{setSearchInputValue\}/
        );
    });

    test("input + wired onChange merges setter call into the tool-call handler; eventArg binding works", () => {
        // SearchInput.onChange wired to google-drive.search with
        // query bound to the event arg (the typed string).
        const tree = makeEmptyTree("LiveSearch");
        const t2 = insertChild(tree, "root", { type: "SearchInput" }, 1);
        const t3 = setSlotWire(t2, "node-1", "onChange", {
            providerType: "google-drive",
            providerClass: "mcp",
            method: "search",
            args: {
                query: { kind: "eventArg" },
            },
        });
        const { componentCode } = emitWidgetCode(t3);
        // useState for the input value, useCallback for the tool
        // handler.
        expect(componentCode).toContain(
            'import React, { useCallback, useState } from "react";'
        );
        expect(componentCode).toMatch(
            /const \[searchInputValue, setSearchInputValue\] = useState\(""\);/
        );
        // Handler signature uses eventArg (so arg-binding can
        // reference it).
        expect(componentCode).toContain(
            "const onChange = useCallback(async (eventArg) => {"
        );
        // Setter call prepended — captures the typed value into
        // state even though the user wired onChange.
        expect(componentCode).toContain("setSearchInputValue(eventArg);");
        // eventArg arg binding renders as the literal `eventArg`.
        expect(componentCode).toContain("query: eventArg");
        // JSX binds onChange to the wired handler (not the setter).
        expect(componentCode).toMatch(
            /<SearchInput[^>]*value=\{searchInputValue\}[^>]*onChange=\{onChange\}/
        );
    });

    test("pipe wire (DataList.items piped from Button.onClick) binds to the callback's result state", () => {
        const tree = makeEmptyTree("PipeWidget");
        // Add a Button + wire its onClick to algolia.search.
        const t2 = insertChild(tree, "root", { type: "Button" }, 1);
        const t3 = setSlotWire(t2, "node-1", "onClick", {
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
            args: { indexName: { kind: "literal", value: "p" } },
        });
        // Add a DataList + pipe its items from node-1's onClick.
        const t4 = insertChild(t3, "root", { type: "DataList" }, 2);
        const t5 = setSlotPipe(t4, "node-2", "items", "node-1", "onClick");
        const { componentCode } = emitWidgetCode(t5);
        // No second useEffect / useCallback for the pipe — it's
        // a JSX-level rebind.
        const useCallbackCount = (componentCode.match(/useCallback\(/g) || [])
            .length;
        expect(useCallbackCount).toBe(1);
        // The DataList items prop binds to the source's result var.
        expect(componentCode).toMatch(/<DataList[^>]*items=\{onClickResult\}/);
    });

    test("mcp-class wire emits useMcpProvider + callTool", () => {
        const tree = makeEmptyTree("McpWidget");
        const t2 = insertChild(tree, "root", { type: "DataList" }, 1);
        const t3 = setSlotWire(t2, "node-1", "items", {
            provider: "MyFs",
            providerType: "filesystem",
            providerClass: "mcp",
            method: "read_file",
            args: {
                path: { kind: "literal", value: "/tmp/x.json" },
            },
        });
        const { componentCode } = emitWidgetCode(t3);
        expect(componentCode).toContain(
            'import { useMcpProvider } from "@trops/dash-core";'
        );
        expect(componentCode).toContain('useMcpProvider("filesystem")');
        expect(componentCode).toContain('mcp_filesystem.callTool("read_file"');
        expect(componentCode).toContain('path: "/tmp/x.json"');
        expect(componentCode).toContain("<DataList items={items} />");
    });
});

describe("setSlotWire / clearSlotWire", () => {
    test("setSlotWire installs a wire spec and flips slot into wire mode", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotWire(t2, "node-1", "data", {
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
        });
        const node = getNodeById(t3, "node-1");
        expect(node.wires.data).toMatchObject({
            provider: "MyAlgolia",
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
        });
    });

    test("setSlotWire is non-mutating", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const before = JSON.stringify(t2);
        setSlotWire(t2, "node-1", "data", {
            provider: "X",
            method: "y",
        });
        expect(JSON.stringify(t2)).toBe(before);
    });

    test("setSlotWire is a no-op when the nodeId is not found", () => {
        const tree = makeEmptyTree();
        const next = setSlotWire(tree, "no-such-id", "data", {
            provider: "X",
            method: "y",
        });
        expect(next).toBe(tree);
    });

    test("clearSlotWire resets the spec but keeps the slot in wire mode", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const t3 = setSlotWire(t2, "node-1", "data", {
            provider: "X",
            method: "y",
        });
        const t4 = clearSlotWire(t3, "node-1", "data");
        const node = getNodeById(t4, "node-1");
        // Wire entry preserved (so static editor stays hidden) but
        // provider/method are nulled so the picker re-appears.
        expect(node.wires.data).toEqual({ provider: null, method: null });
    });

    test("clearSlotWire is a no-op when no wire exists", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const next = clearSlotWire(t2, "node-1", "data");
        expect(next).toBe(t2);
    });
});

describe("setSlotArg (C4 arg binding)", () => {
    function wiredTree() {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        return setSlotWire(t2, "node-1", "data", {
            provider: "A",
            providerType: "algolia",
            providerClass: "credential",
            method: "search",
        });
    }

    test("sets a literal binding", () => {
        const t = setSlotArg(wiredTree(), "node-1", "data", "indexName", {
            kind: "literal",
            value: "products",
        });
        const node = getNodeById(t, "node-1");
        expect(node.wires.data.args.indexName).toEqual({
            kind: "literal",
            value: "products",
        });
    });

    test("sets a userConfig binding", () => {
        const t = setSlotArg(wiredTree(), "node-1", "data", "query", {
            kind: "userConfig",
            field: "searchTerm",
        });
        const node = getNodeById(t, "node-1");
        expect(node.wires.data.args.query).toEqual({
            kind: "userConfig",
            field: "searchTerm",
        });
    });

    test("undefined binding clears the arg", () => {
        const t1 = setSlotArg(wiredTree(), "node-1", "data", "indexName", {
            kind: "literal",
            value: "x",
        });
        const t2 = setSlotArg(t1, "node-1", "data", "indexName", undefined);
        const node = getNodeById(t2, "node-1");
        expect(node.wires.data.args.indexName).toBeUndefined();
    });

    test("is a no-op when no wire spec exists on the slot", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Table" }, 1);
        const next = setSlotArg(t2, "node-1", "data", "indexName", {
            kind: "literal",
            value: "x",
        });
        expect(next).toBe(t2);
    });

    test("is non-mutating", () => {
        const t = wiredTree();
        const before = JSON.stringify(t);
        setSlotArg(t, "node-1", "data", "indexName", {
            kind: "literal",
            value: "x",
        });
        expect(JSON.stringify(t)).toBe(before);
    });

    test("propagates into emitted code through the hook scaffold", () => {
        const t = setSlotArg(wiredTree(), "node-1", "data", "indexName", {
            kind: "literal",
            value: "products",
        });
        const { componentCode } = emitWidgetCode(t);
        expect(componentCode).toContain('indexName: "products"');
    });
});

describe("getNodeById", () => {
    test("returns the matching node", () => {
        const tree = makeEmptyTree();
        const t2 = insertChild(tree, "root", { type: "Heading" }, 1);
        expect(getNodeById(t2, "node-1").type).toBe("Heading");
    });

    test("returns null for missing id, null tree, or null id", () => {
        const tree = makeEmptyTree();
        expect(getNodeById(tree, "no-such-id")).toBeNull();
        expect(getNodeById(null, "root")).toBeNull();
        expect(getNodeById(tree, null)).toBeNull();
    });
});
