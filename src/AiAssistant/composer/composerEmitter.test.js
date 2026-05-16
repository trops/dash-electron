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
        expect(componentCode).toMatch(/<Slider[^>]*value=\{50\}/);
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
