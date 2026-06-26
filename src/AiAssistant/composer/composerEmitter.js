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
    getInputBinding,
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
    // Shim companions — Menu's iteration body references the matching
    // MenuItem variant (Menu2 → MenuItem2, ...) which the user never
    // drops directly. Auto-include so imports resolve and the bundle
    // compiles. Same rule applied by gridEmitter.collectUsedComponentNames.
    for (const name of [...used]) {
        if (name === "Menu" || name === "Menu2" || name === "Menu3") {
            used.add(name.replace(/^Menu/, "MenuItem"));
        }
    }
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
export function renderNodeJsx(
    node,
    indent = 0,
    slotVarBySlotKey = null,
    { wrapperFill = false } = {}
) {
    if (!node || typeof node.type !== "string") return "";
    const pad = "    ".repeat(indent);
    // The root wrapper carries explicit full-size flex styling so the
    // root component (Panel default `h-full w-full`, Card, etc.) has
    // a sized parent to resolve percentage heights against. Without
    // this, a composition with a single Panel collapses to content
    // height because the wrapper div is plain block flow. Non-root
    // wrappers stay unstyled — children should size against their
    // parent component, not against the composer's plumbing.
    //
    // The grid emitter calls renderNodeJsx for every leaf cell (not
    // just the root), and each leaf is sized by its grid track — so
    // it passes wrapperFill: true to opt every leaf wrapper into the
    // same fill style. Tree-mode (V1) leaves wrapperFill off; only
    // the literal "root" node gets the style.
    const isRoot = node.id === "root";
    const fillStyle =
        ` style={{ height: "100%", width: "100%", display: "flex",` +
        ` flexDirection: "column" }}`;
    const rootStyle = isRoot || wrapperFill ? fillStyle : "";
    const schema = getComponentSchema(node.type);
    if (!schema) {
        // Unknown component — emit a comment rather than fail. The
        // validator (post-emit) would reject this branch, surfacing
        // the issue to the user with the same suggestion machinery
        // the chat-flow uses.
        return `${pad}{/* unknown component: ${node.type} */}`;
    }

    // dash-react's DataList is a container (`<dl>`) that renders
    // its children — it has no `items` prop. The composer schema
    // exposes a virtual `items` slot so users can wire a data
    // source; when that slot is bound, expand it into a child loop
    // of DataList.Item with a forgiving label/value heuristic so
    // arbitrary result shapes (algolia hits, MCP rows, raw strings)
    // render without the user having to hand-map fields. The user
    // can edit the generated code via the Code tab to customize
    // the mapping.
    if (node.type === "DataList" && slotVarBySlotKey) {
        const itemsVar = slotVarBySlotKey.get(`${node.id}:items`);
        if (itemsVar) {
            const wire = node.wires && node.wires.items;
            const fieldMap = wire && wire.fieldMap;
            const fieldExpr = (target) => {
                if (fieldMap && fieldMap[target]) {
                    const src = fieldMap[target];
                    return (
                        `(typeof __it === 'string' ? __it : ` +
                        `(__it && __it[${JSON.stringify(src)}]) ?? '')`
                    );
                }
                return defaultFieldExpr(target);
            };
            // Match the standard fill-cell className injection so a
            // wired DataList inside a Card scrolls within its bounds
            // instead of spilling past sibling cells. Skipped when
            // the node isn't acting as a fill cell (V1 emit path,
            // narrow embed).
            const fillAttr = wrapperFill
                ? ' className="h-full w-full min-h-0 overflow-y-auto"'
                : "";
            return (
                `${pad}<div data-composer-node-id="${node.id}"${rootStyle}>\n` +
                `${pad}    <DataList${fillAttr}>\n` +
                `${pad}        {${rowsExpr(itemsVar)}.map((__it, __i) => (\n` +
                `${pad}            <DataList.Item key={__i} label={${fieldExpr(
                    "label"
                )}} value={${fieldExpr("value")}} />\n` +
                `${pad}        ))}\n` +
                `${pad}    </DataList>\n` +
                `${pad}</div>`
            );
        }
    }

    // Menu / Menu2 / Menu3 — dash-react's Menu is just a vertical
    // stack of children. The composer surfaces it as a data-driven
    // leaf: `items` is a virtual data slot, `onSelect` an optional
    // callback. The shim renders the wired items as a `.map()` of
    // the matching MenuItem variant. Same field-map machinery as
    // DataList so arbitrary result shapes (algolia hits, MCP rows,
    // raw strings) render without hand-mapping.
    const isMenu =
        node.type === "Menu" || node.type === "Menu2" || node.type === "Menu3";
    if (isMenu && slotVarBySlotKey) {
        const itemsVar = slotVarBySlotKey.get(`${node.id}:items`);
        if (itemsVar) {
            const wire = node.wires && node.wires.items;
            const fieldMap = wire && wire.fieldMap;
            const fieldExpr = (target) => {
                if (fieldMap && fieldMap[target]) {
                    const src = fieldMap[target];
                    return (
                        `(typeof __it === 'string' ? __it : ` +
                        `(__it && __it[${JSON.stringify(src)}]) ?? '')`
                    );
                }
                return defaultFieldExpr(target);
            };
            // Menu2 → MenuItem2, Menu3 → MenuItem3; Menu → MenuItem.
            const menuItemType = node.type.replace(/^Menu/, "MenuItem");
            // onSelect handler: bound via the input-binding / wire
            // slot map under the `onSelect` key (same path as any
            // callback slot). If unbound, omit onClick on the row.
            const onSelectVar = slotVarBySlotKey.get(`${node.id}:onSelect`);
            const onClickAttr = onSelectVar
                ? ` onClick={() => ${onSelectVar} && ${onSelectVar}(${fieldExpr(
                      "value"
                  )})}`
                : "";
            const fillAttr = wrapperFill
                ? ' className="h-full w-full min-h-0 overflow-y-auto"'
                : "";
            return (
                `${pad}<div data-composer-node-id="${node.id}"${rootStyle}>\n` +
                `${pad}    <${node.type}${fillAttr}>\n` +
                `${pad}        {${rowsExpr(itemsVar)}.map((__it, __i) => (\n` +
                `${pad}            <${menuItemType} key={__i}${onClickAttr}>{${fieldExpr(
                    "label"
                )}}</${menuItemType}>\n` +
                `${pad}        ))}\n` +
                `${pad}    </${node.type}>\n` +
                `${pad}</div>`
            );
        }
    }

    // Paragraph's text content lives in children — surface a `text`
    // virtual prop in the schema and render it as JSX content here.
    // Same shim pattern as DataList above; keeps the inspector
    // generic (text is just a string prop in the schema view).
    if (node.type === "Paragraph") {
        const text =
            node.props && typeof node.props.text === "string"
                ? node.props.text
                : "";
        const escaped = text.replace(/[<>{}]/g, (c) =>
            c === "<"
                ? "&lt;"
                : c === ">"
                ? "&gt;"
                : c === "{"
                ? "&#123;"
                : "&#125;"
        );
        return (
            `${pad}<div data-composer-node-id="${node.id}"${rootStyle}>\n` +
            `${pad}    <Paragraph>${escaped || "Sample"}</Paragraph>\n` +
            `${pad}</div>`
        );
    }

    const propEntries = [];
    for (const [propName, propSchema] of Object.entries(schema.props)) {
        if (propName === "children") continue;
        const isWired = Boolean(node.wires && node.wires[propName]);
        // slotVarBySlotKey is the unified binding map: includes
        // wire-derived vars (C4), pipe-derived vars (C5a), and
        // auto-state vars for input components (C5b). Any entry
        // here wins over the static literal / placeholder paths so
        // an input's value/onChange render against composer-
        // managed state without the user explicitly wiring them.
        if (slotVarBySlotKey) {
            const slotVar = slotVarBySlotKey.get(`${node.id}:${propName}`);
            if (slotVar) {
                const wire = node.wires && node.wires[propName];
                propEntries.push(
                    `${propName}={${adaptSlotForProp(
                        propSchema?.type,
                        slotVar,
                        wire
                    )}}`
                );
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

    // Fill-cells inject a className so components without their own
    // h-full/w-full defaults (notably Card, Table, DataList) actually
    // fill the sized cell wrapper. Panel/Container already self-size
    // but the duplicate classes are harmless. dash-react primitives
    // all accept and merge a className prop. `overflow-y-auto` is
    // included so a tall DataList/Table scrolls inside its cell
    // instead of spilling past sibling cells in the grid stack (the
    // cell wrapper itself is `overflow-hidden` for the same reason).
    // Skipped when the user already set a className via props (none
    // of the schemas surface one today, but the guard future-proofs it).
    if (wrapperFill && !propEntries.some((e) => e.startsWith("className="))) {
        propEntries.push(`className="h-full w-full min-h-0 overflow-y-auto"`);
    }

    const propsStr = propEntries.length > 0 ? " " + propEntries.join(" ") : "";
    const childrenSchema = schema.props.children;
    const hasChildrenSlot = Boolean(childrenSchema);
    const childNodes = Array.isArray(node.children) ? node.children : [];

    // Wrap every emitted component in a div carrying its node id so
    // the preview iframe can map clicks back to a node and outline
    // the hovered/selected component. dash-react primitives don't
    // forward unknown props through, so an inline data attribute on
    // <Heading data-…> gets silently dropped — the wrapper div is
    // the only reliable place to stash the id. Small layout cost
    // (one extra block element per component); harmless in installs.
    const wrap = (inner) =>
        `${pad}<div data-composer-node-id="${node.id}"${rootStyle}>\n${inner}\n${pad}</div>`;

    if (!hasChildrenSlot || childNodes.length === 0) {
        // Components with a required ReactNode `children` prop and
        // no children rendered would crash. Insert a placeholder
        // text node so the preview stays alive.
        if (
            hasChildrenSlot &&
            childrenSchema.required &&
            childNodes.length === 0
        ) {
            return wrap(
                `${pad}    <${node.type}${propsStr}>Sample</${node.type}>`
            );
        }
        return wrap(`${pad}    <${node.type}${propsStr} />`);
    }

    const renderedChildren = childNodes
        .map((c) => renderNodeJsx(c, indent + 2, slotVarBySlotKey))
        .filter(Boolean)
        .join("\n");
    return wrap(
        `${pad}    <${node.type}${propsStr}>\n${renderedChildren}\n${pad}    </${node.type}>`
    );
}

/**
 * When a wired/piped slot var lands on a prop whose schema type
 * advertises a specific item shape (e.g. SelectInput.options
 * needs Array<{label,value}>, Table.columns needs
 * Array<{key,label}>), wrap the raw var in a .map() that picks
 * sensible fallback fields so common provider return shapes
 * (algolia indices with `name`, MCP rows, plain strings, …)
 * render without the user having to hand-write a mapping. The
 * Code tab is editable for explicit customization.
 */
function adaptSlotForProp(propType, slotVar, wire) {
    if (typeof propType !== "string") return slotVar;
    const targetFields = parseShapeFields(propType);
    if (!targetFields) return slotVar;
    const fieldMap = wire && wire.fieldMap;
    const buildExpr = (targetField) => {
        if (fieldMap && fieldMap[targetField]) {
            const src = fieldMap[targetField];
            return (
                `(typeof __it === 'string' ? __it : ` +
                `(__it && __it[${JSON.stringify(src)}]) ?? '')`
            );
        }
        return defaultFieldExpr(targetField);
    };
    const props = targetFields.map((f) => `${f}: ${buildExpr(f)}`).join(", ");
    return `${rowsExpr(slotVar)}.map((__it) => ({ ${props} }))`;
}

/**
 * Parse the set of target field names from a schema type string
 * like `Array<{label,value}>` → `["label","value"]`. Returns null
 * for type strings that don't describe a shape-typed array, in
 * which case the emitter passes the slot var through unchanged.
 */
export function parseShapeFields(propType) {
    if (typeof propType !== "string") return null;
    const m = propType.match(/Array<\{([^}]+)\}>/);
    if (!m) return null;
    return m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Fallback heuristic for a target field name when the user hasn't
 * picked an explicit source field via the field-map UI. Kept narrow
 * — adds candidates only for the shape names we actually emit, so
 * an unknown target field just renders as an empty string instead
 * of fishing through every property on the source object.
 */
/**
 * Emit an expression that coerces a wired data source into an array of rows.
 *
 * - Already an array → used as-is.
 * - A plain object → `Object.entries` into `{ key, value }` rows. An object's
 *   key/value pairs are a natural fit for a DataList/Table (e.g. Algolia
 *   `getSettings` returns a settings object). Nested array/object values are
 *   JSON-stringified so they render as readable text instead of "[object
 *   Object]". `defaultFieldExpr` already maps label→key and value→value.
 * - Anything else → empty list.
 *
 * This is what lets an Object-returning provider method wire into a
 * list/table slot (the wire scorer marks it a loose match).
 */
function rowsExpr(varName) {
    return (
        `(Array.isArray(${varName}) ? ${varName} : (${varName} && typeof ${varName} === 'object' ` +
        `? Object.entries(${varName}).map(([key, value]) => ({ key, value: value && typeof value === 'object' ? JSON.stringify(value) : value })) ` +
        `: []))`
    );
}

function defaultFieldExpr(targetField) {
    const chains = {
        label:
            "__it?.label ?? __it?.name ?? __it?.title ?? __it?.key ?? " +
            "__it?.objectID ?? __it?.id",
        value: "__it?.value ?? __it?.id ?? __it?.objectID ?? __it?.key ?? __it?.name",
        key: "__it?.key ?? __it?.id ?? __it?.objectID ?? __it?.name",
    };
    const chain = chains[targetField];
    if (chain) {
        return (
            `(typeof __it === 'string' ? __it : ` +
            `(__it && (${chain})) ?? String(__it ?? ''))`
        );
    }
    return `(__it && __it[${JSON.stringify(targetField)}]) ?? ''`;
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
    //
    // The getPropType callback lets the hook emitter distinguish
    // data-fetch wires (Array/Object slots → useState + useEffect)
    // from callback wires (function slots → useCallback handler).
    const getPropType = (componentType, propName) => {
        const schema = getComponentSchema(componentType);
        if (!schema || !schema.props || !schema.props[propName]) return null;
        return schema.props[propName].type || null;
    };
    const scaffold = buildHookScaffold(
        tree,
        PROVIDER_API_REGISTRY,
        getPropType,
        getInputBinding
    );
    const {
        extraReactImports,
        coreImports,
        hookLines,
        slotVarBySlotKey,
        userConfigFields,
    } = scaffold;

    // Collect the unique provider types + classes the wires reach.
    // Drives the providers[] declaration in .dash.js so the install
    // flow can request provider configuration up front instead of
    // letting the widget render with `pc` null until the user
    // figures out a provider is needed.
    const providerDeclarations = collectProviderDeclarations(tree);

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
    // dash-core's WidgetFactory delivers userConfig fields as FLAT
    // top-level props (via `{...userPrefs}` in WidgetFactory.js), and
    // the preview pipeline mirrors that. Reading from `props.foo`
    // matches the live runtime contract; reading from `userConfig.foo`
    // (the old shape) silently picks up undefined. The .dash.js
    // config still declares the userConfig schema for the config form,
    // but the widget consumes flat props.
    const componentParams = hasWires ? "props" : "";
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
    const configCode = renderConfigCode({
        widgetName,
        displayName,
        providerDeclarations,
        userConfigFields,
    });

    return { componentCode, configCode, files: null };
}

/**
 * Walk the tree and emit one declaration per unique provider
 * (type + class). Pipe wires are skipped — they reuse the source
 * wire's provider and don't add their own.
 *
 * Shape per entry:
 *   { type, providerClass, required: true }
 *
 * Used by the install flow to surface the right configure-provider
 * UI before the user clicks Install — otherwise the widget renders
 * with a null provider client and either errors out or silently
 * shows nothing.
 */
export function collectProviderDeclarations(tree) {
    if (!tree || !tree.root) return [];
    const seen = new Map(); // key = "<class>:<type>" → entry
    const visit = (node) => {
        if (!node) return;
        if (node.wires) {
            for (const w of Object.values(node.wires)) {
                if (!w || w.kind === "pipe") continue;
                if (!w.providerType || !w.method) continue;
                const cls = w.providerClass || "credential";
                const key = `${cls}:${w.providerType}`;
                if (!seen.has(key)) {
                    seen.set(key, {
                        type: w.providerType,
                        providerClass: cls,
                        required: true,
                    });
                }
            }
        }
        if (Array.isArray(node.children)) {
            for (const c of node.children) visit(c);
        }
    };
    visit(tree.root);
    return Array.from(seen.values()).sort((a, b) =>
        a.type.localeCompare(b.type)
    );
}

export function renderConfigCode({
    widgetName,
    displayName,
    providerDeclarations,
    userConfigFields,
}) {
    // Build the userConfig field map — one entry per userConfig-
    // kind arg binding the user set. Each gets a sensible default
    // shape so the widget config panel renders a text input out of
    // the box; the user can refine instructions / type later.
    const userConfigEntries = Array.from(userConfigFields || []).sort();
    const userConfigJs =
        userConfigEntries.length === 0
            ? ""
            : "    userConfig: {\n" +
              userConfigEntries
                  .map(
                      (field) =>
                          `        ${JSON.stringify(field)}: { ` +
                          `type: "text", ` +
                          `displayName: ${JSON.stringify(
                              prettyFieldName(field)
                          )}, ` +
                          `defaultValue: "", ` +
                          `instructions: "" }`
                  )
                  .join(",\n") +
              ",\n    },\n";

    const providersJs =
        providerDeclarations.length === 0
            ? ""
            : "    providers: [\n" +
              providerDeclarations
                  .map(
                      (p) =>
                          `        { ` +
                          `type: ${JSON.stringify(p.type)}, ` +
                          `providerClass: ${JSON.stringify(
                              p.providerClass
                          )}, ` +
                          `required: ${p.required ? "true" : "false"} }`
                  )
                  .join(",\n") +
              ",\n    ],\n";

    return [
        "export default {",
        `    component: ${JSON.stringify(widgetName)},`,
        `    name: ${JSON.stringify(displayName)},`,
        `    package: ${JSON.stringify(displayName)},`,
        `    author: "Composer",`,
        `    category: "general",`,
        `    type: "widget",`,
        `    canHaveChildren: false,`,
        `    workspace: "ai-built",`,
        providersJs,
        userConfigJs,
        "};",
        "",
    ]
        .filter((line) => line !== "")
        .join("\n");
}

function prettyFieldName(field) {
    // camelCase → Title Case for displayName.
    return field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
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
 * Persist a "pipe from another wire" choice on a data slot. Stores
 * `{ kind: "pipe", sourceNodeId, sourcePropName }` on the wire
 * spec; the emitter binds the slot's JSX prop to the source wire's
 * result state at compile time.
 *
 * Typical use: SearchInput.onChange wired to `algolia.search`, then
 * DataList.items piped from `SearchInput.onChange` — the data list
 * displays whatever the search returns whenever the search fires.
 */
export function setSlotPipe(
    tree,
    nodeId,
    propName,
    sourceNodeId,
    sourcePropName
) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node) return tree;
    if (!node.wires || typeof node.wires !== "object") node.wires = {};
    node.wires[propName] = {
        kind: "pipe",
        sourceNodeId,
        sourcePropName,
    };
    return { ...tree, root: cloned };
}

/**
 * Persist a field-mapping choice on a wire or pipe. `fieldMap` is
 * an object keyed by target-shape field names whose values are the
 * source-shape field names the emitter should pull from each item.
 *
 * Example: SelectInput.options wired to algolia.listIndices —
 *   targetType is Array<{label,value}>, source items have
 *   { name, entries, dataSize, … }. Setting
 *   `{ label: "name", value: "name" }` makes the emitted code
 *   `.map(it => ({ label: it.name, value: it.name }))` instead of
 *   relying on the generic fallback heuristic.
 *
 * Passing `null` clears the override.
 */
export function setSlotFieldMap(tree, nodeId, propName, fieldMap) {
    if (!tree || !tree.root) return tree;
    const cloned = cloneNode(tree.root);
    const node = findNode(cloned, nodeId);
    if (!node || !node.wires || !node.wires[propName]) return tree;
    const wire = { ...node.wires[propName] };
    if (fieldMap === null || fieldMap === undefined) {
        delete wire.fieldMap;
    } else {
        wire.fieldMap = { ...fieldMap };
    }
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
