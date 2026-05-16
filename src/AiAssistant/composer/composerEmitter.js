/**
 * Composer emitter — pure functions that translate a composition
 * tree into widget code (componentCode + configCode) the existing
 * compilePreview pipeline can consume.
 *
 * Tree shape:
 *
 *   {
 *     widgetName: "MyWidget",
 *     root: {
 *       id: "node-1",            // unique within tree
 *       type: "Panel",           // schema key from dashReactComponentSchemas
 *       props: { … },            // user-set props (literal values only in C1;
 *                                //   C3 will add wired-to-provider entries)
 *       children: [ … nodes … ], // present iff schema accepts children
 *     },
 *   }
 *
 * The emitter does NOT validate the tree's prop completeness — that
 * is the composer UI's job (required props are surfaced in the
 * property inspector). It DOES fall back to type-appropriate
 * placeholders for required props that have no user-set value, so
 * the emitted code always compiles and previews. Without this, the
 * user couldn't see "what would this look like" mid-composition.
 *
 * Imports are computed by walking the tree and collecting every
 * component name encountered. Components imported but not actually
 * used in any branch are dropped — keeps the emitted code tidy and
 * the bundle minimal.
 *
 * C1 emits a single-component, data-less widget skeleton (no hooks,
 * no provider calls). C3+ will introduce useWidgetProviders /
 * useProviderClient / useMcpProvider scaffolding for wired slots.
 *
 * C2 adds: per-prop edits via updateNodeProp, plus a parallel
 * `wires` map per node that tracks which dataSlots are in
 * "wire-to-provider" mode. The emitter treats wired slots as if
 * they were unset (falls back to the type-appropriate placeholder)
 * until C3 fills in real provider/method bindings — that way the
 * preview keeps compiling while the user is still picking what to
 * wire.
 */

import {
    getComponentSchema,
    DASH_REACT_COMPONENT_SCHEMAS,
} from "../dashReactComponentSchemas";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { buildHookScaffold } from "./composerHookEmitter";

/**
 * Make a fresh tree containing only a root Panel. Use this as the
 * initial state when the user opens the composer for a new widget.
 *
 * The `widgetName` defaults to "ComposedWidget" — the user can
 * rename via the composer toolbar before installing.
 */
export function makeEmptyTree(widgetName = "ComposedWidget") {
    return {
        widgetName,
        root: {
            id: "root",
            type: "Panel",
            props: {},
            children: [],
        },
    };
}

/**
 * Walk the tree and collect the set of every component type
 * referenced. Includes the root.
 */
export function collectUsedComponents(tree) {
    const used = new Set();
    if (!tree || !tree.root) return used;
    walk(tree.root, (node) => {
        if (node && typeof node.type === "string") used.add(node.type);
    });
    return used;
}

function walk(node, visit) {
    if (!node) return;
    visit(node);
    if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child, visit);
    }
}

/**
 * Generate a literal placeholder value for a prop given its declared
 * schema type. Pure heuristic — keeps the data-less preview alive
 * without forcing the user to fill every required field upfront.
 *
 * Returns a JS expression as a string (so the caller can drop it
 * into JSX directly), or null for types we cannot guess at safely.
 */
function placeholderForType(typeStr) {
    if (typeof typeStr !== "string") return null;
    if (typeStr === "string") return '"Sample"';
    if (typeStr === "number") return "0";
    if (typeStr === "boolean") return "false";
    if (typeStr === "function") return "() => {}";
    if (typeStr === "any") return "null";
    if (typeStr === "ReactNode") return null; // children only, never a prop literal
    if (typeStr.startsWith("Array<")) return "[]";
    return null;
}

/**
 * Render a single node's JSX. Indentation is two spaces per nesting
 * level (matches the rest of the AI-emitted code style we don't
 * format-strictly afterwards — prettier runs at install time anyway).
 */
function renderNodeJsx(node, indent = 0, slotVarBySlotKey = null) {
    if (!node || typeof node.type !== "string") return "";
    const pad = "    ".repeat(indent);
    const schema = getComponentSchema(node.type);
    if (!schema) {
        // Unknown component — emit a comment rather than fail. The
        // validator (post-emit) would reject this branch, surfacing
        // the issue to the user with the same suggestion machinery
        // the chat-flow uses.
        return `${pad}{/* unknown component: ${node.type} */}`;
    }

    const propEntries = [];
    for (const [propName, propSchema] of Object.entries(schema.props)) {
        if (propName === "children") continue;
        const isWired = Boolean(node.wires && node.wires[propName]);
        // C4: if the wire is configured (the hook emitter assigned
        // a state-var name for this slot), bind the prop to that
        // var instead of any placeholder or static literal.
        if (isWired && slotVarBySlotKey) {
            const slotVar = slotVarBySlotKey.get(`${node.id}:${propName}`);
            if (slotVar) {
                propEntries.push(`${propName}={${slotVar}}`);
                continue;
            }
        }
        const userValue =
            !isWired && node.props ? node.props[propName] : undefined;
        if (userValue !== undefined) {
            propEntries.push(renderPropLiteral(propName, userValue));
            continue;
        }
        if (propSchema.required || isWired) {
            const placeholder = placeholderForType(propSchema.type);
            if (placeholder !== null) {
                propEntries.push(`${propName}={${placeholder}}`);
            }
        }
    }

    const propsStr = propEntries.length > 0 ? " " + propEntries.join(" ") : "";
    const childrenSchema = schema.props.children;
    const hasChildrenSlot = Boolean(childrenSchema);
    const childNodes = Array.isArray(node.children) ? node.children : [];

    if (!hasChildrenSlot || childNodes.length === 0) {
        // Components with a required ReactNode `children` prop and
        // no children rendered would crash. Insert a placeholder
        // text node so the preview stays alive.
        if (
            hasChildrenSlot &&
            childrenSchema.required &&
            childNodes.length === 0
        ) {
            return `${pad}<${node.type}${propsStr}>Sample</${node.type}>`;
        }
        return `${pad}<${node.type}${propsStr} />`;
    }

    const renderedChildren = childNodes
        .map((c) => renderNodeJsx(c, indent + 1, slotVarBySlotKey))
        .filter(Boolean)
        .join("\n");
    return `${pad}<${node.type}${propsStr}>\n${renderedChildren}\n${pad}</${node.type}>`;
}

/**
 * Render a single user-set prop. C1 only handles literal types
 * (string/number/boolean/array/object) — the wire-to-provider path
 * lands in C3 and will short-circuit here.
 */
function renderPropLiteral(propName, value) {
    if (typeof value === "string") {
        // Escape embedded double-quotes — bare ones would break the
        // attribute. Backticks would be a more robust default but
        // change the JSX shape; stick with double-quoted strings
        // until we know we need template literals.
        const escaped = value.replace(/"/g, '\\"');
        return `${propName}="${escaped}"`;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return `${propName}={${value}}`;
    }
    if (value === null) {
        return `${propName}={null}`;
    }
    // Arrays / plain objects — JSON.stringify is correct because the
    // emitted JSX runs in a JS context, not HTML. Escapes everything
    // for free. Functions are not currently supported (the composer
    // UI never sets a function-typed prop).
    try {
        return `${propName}={${JSON.stringify(value)}}`;
    } catch {
        return "";
    }
}

/**
 * Emit the componentCode + configCode pair for a composition tree.
 *
 * The returned shape matches what compilePreview expects today, so
 * the composer can route through the same pipeline as Build mode.
 */
export function emitWidgetCode(tree) {
    const widgetName =
        (tree && typeof tree.widgetName === "string" && tree.widgetName) ||
        "ComposedWidget";
    const used = collectUsedComponents(tree);
    // Drop names that aren't in the curated schema. (Validator
    // catches unknown names downstream, but emitting an import for
    // something we never knew about is wasted work.)
    const importNames = [...used]
        .filter((n) => Boolean(DASH_REACT_COMPONENT_SCHEMAS[n]))
        .sort();

    // C4: hook scaffolding for any configured wires in the tree.
    // Returns the slot-var map renderNodeJsx uses to bind wired
    // props to state vars, plus the imports and useEffect bodies
    // the assembled component needs at the top.
    const scaffold = buildHookScaffold(tree, PROVIDER_API_REGISTRY);
    const { extraReactImports, coreImports, hookLines, slotVarBySlotKey } =
        scaffold;

    const reactImport =
        extraReactImports.size > 0
            ? `import React, { ${[...extraReactImports]
                  .sort()
                  .join(", ")} } from "react";`
            : 'import React from "react";';

    const reactComponentImport =
        importNames.length > 0
            ? `import { ${importNames.join(", ")} } from "@trops/dash-react";`
            : "";

    const coreImport =
        coreImports.size > 0
            ? `import { ${[...coreImports]
                  .sort()
                  .join(", ")} } from "@trops/dash-core";`
            : "";

    const hasWires = slotVarBySlotKey.size > 0;
    const componentParams = hasWires ? "{ userConfig = {} }" : "";
    const rootJsx =
        tree && tree.root ? renderNodeJsx(tree.root, 2, slotVarBySlotKey) : "";

    const componentBody = [
        ...hookLines,
        hookLines.length > 0 ? "" : null,
        "    return (",
        rootJsx || "        <div />",
        "    );",
    ].filter((line) => line !== null);

    // `null` entries are conditional-skip; "" entries are intentional
    // blank lines for visual separation.
    const componentCode =
        [
            reactImport,
            reactComponentImport || null,
            coreImport || null,
            "",
            `export default function ${widgetName}(${componentParams}) {`,
            ...componentBody,
            "}",
        ]
            .filter((line) => line !== null)
            .join("\n") + "\n";

    const displayName = widgetName.replace(/([A-Z])/g, " $1").trim();
    const configCode = `export default { component: "${widgetName}", name: "${displayName}", package: "${displayName}", author: "Composer", category: "general", type: "widget", canHaveChildren: false, workspace: "ai-built" };`;

    return { componentCode, configCode, files: null };
}

/**
 * Insert a child node into the tree under a given parent id. Pure —
 * returns a new tree, never mutates. Used by the composer's "Add to
 * widget" button. If `parentId` is not found, the child is appended
 * to the root (safer default than throwing — keeps the composer UI
 * resilient to id drift during heavy edits).
 *
 * Caller supplies `idCounter` so ids stay unique across inserts.
 */
export function insertChild(tree, parentId, child, idCounter) {
    const childWithId = {
        ...child,
        id: `node-${idCounter}`,
        children: Array.isArray(child.children) ? child.children : [],
    };
    const cloned = cloneNode(tree.root);
    const parent = findNode(cloned, parentId) || cloned;
    parent.children = Array.isArray(parent.children) ? parent.children : [];
    parent.children.push(childWithId);
    return { ...tree, root: cloned };
}

/**
 * Remove a node by id. Refuses to remove the root (returns the tree
 * unchanged) — the composer always needs at least one node to emit
 * valid JSX.
 */
export function removeNode(tree, nodeId) {
    if (!tree || !tree.root) return tree;
    if (tree.root.id === nodeId) return tree;
    const cloned = cloneNode(tree.root);
    removeChildById(cloned, nodeId);
    return { ...tree, root: cloned };
}

/**
 * Set a static prop value on a node by id. Pure. If the value is
 * `undefined`, the prop is cleared (falls back to placeholder
 * rendering at emit time). Has no effect when the node is not found.
 *
 * Setting a static value on a wired slot does NOT auto-flip the
 * slot back to static mode — the user must explicitly toggle. This
 * preserves wire-state across exploratory edits.
 */
export function updateNodeProp(tree, nodeId, propName, value) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node) return tree;
    if (!node.props || typeof node.props !== "object") node.props = {};
    if (value === undefined) {
        delete node.props[propName];
    } else {
        node.props[propName] = value;
    }
    return { ...tree, root: cloned };
}

/**
 * Toggle a prop slot between "static" and "wire" modes on a node.
 *
 *   mode === "wire"   → node.wires[propName] = { provider: null, method: null }
 *                       (skeleton — Stage 3 fills in the picker
 *                       result via setSlotWire)
 *   mode === "static" → delete node.wires[propName]
 *
 * The static prop value is preserved across mode flips so the user
 * can experiment without losing their literal. Has no effect when
 * the node is not found.
 */
export function setSlotMode(tree, nodeId, propName, mode) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node) return tree;
    if (!node.wires || typeof node.wires !== "object") node.wires = {};
    if (mode === "wire") {
        if (!node.wires[propName]) {
            node.wires[propName] = { provider: null, method: null };
        }
    } else if (mode === "static") {
        delete node.wires[propName];
    }
    return { ...tree, root: cloned };
}

/**
 * Persist the user's provider+method pick on a wired slot. Implies
 * wire mode — if the slot wasn't yet in wire mode, this also flips
 * it (so the picker UI can be a one-shot "I picked this" rather
 * than a two-step "set wire mode, then pick").
 *
 * `wire` shape (from the C3 picker):
 *   {
 *     provider: "MyAlgoliaInstance",   // providerName from app.providers
 *     providerType: "algolia",         // provider.type
 *     providerClass: "credential",     // "credential" | "mcp"
 *     method: "search",                // method/tool name
 *   }
 *
 * Stage 4 will extend the wire spec with `args: { … }` to carry the
 * user's per-arg bindings; the emitter ignores fields it doesn't
 * recognize so adding them is non-breaking.
 */
export function setSlotWire(tree, nodeId, propName, wire) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node) return tree;
    if (!node.wires || typeof node.wires !== "object") node.wires = {};
    node.wires[propName] = { ...wire };
    return { ...tree, root: cloned };
}

/**
 * Set one arg binding on a configured wire. `binding` shapes:
 *   - { kind: "literal",    value: <any> }
 *   - { kind: "userConfig", field: <string> }
 *   - undefined → clears the arg (the emitter omits it)
 *
 * Has no effect when the slot has no wire spec yet (the picker has
 * to set provider+method first before args make sense).
 */
export function setSlotArg(tree, nodeId, propName, argName, binding) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node || !node.wires || !node.wires[propName]) return tree;
    const wire = { ...node.wires[propName] };
    const args = { ...(wire.args || {}) };
    if (binding === undefined) {
        delete args[argName];
    } else {
        args[argName] = binding;
    }
    wire.args = args;
    node.wires[propName] = wire;
    return { ...tree, root: cloned };
}

/**
 * Clear any wire spec on a slot. The slot stays in wire mode (the
 * picker reappears) — use setSlotMode("static") to flip back to a
 * literal editor. Separating these two operations lets the user
 * re-pick a different provider without losing the wire state.
 */
export function clearSlotWire(tree, nodeId, propName) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node || !node.wires) return tree;
    if (node.wires[propName]) {
        node.wires[propName] = { provider: null, method: null };
    }
    return { ...tree, root: cloned };
}

/**
 * Read-only lookup by id. Returns null if the node is not present.
 * Used by the property inspector to render the currently-selected
 * node's prop state.
 */
export function getNodeById(tree, nodeId) {
    if (!tree || !tree.root || !nodeId) return null;
    return findNode(tree.root, nodeId);
}

function cloneNode(node) {
    if (!node) return node;
    return {
        ...node,
        props: node.props ? { ...node.props } : {},
        wires: node.wires ? { ...node.wires } : undefined,
        children: Array.isArray(node.children)
            ? node.children.map(cloneNode)
            : [],
    };
}

function findNode(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            const found = findNode(child, id);
            if (found) return found;
        }
    }
    return null;
}

function removeChildById(node, id) {
    if (!node || !Array.isArray(node.children)) return;
    node.children = node.children.filter((c) => c.id !== id);
    for (const child of node.children) removeChildById(child, id);
}
