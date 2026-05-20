/**
 * Grid emitter — JSX generation for the recursive grid composition
 * model (gridLayout.js).
 *
 * Mirrors composerEmitter.emitWidgetCode but starts from a grid-of-
 * cells shape instead of a tree-of-children shape. The hook
 * scaffold (composerHookEmitter.js), per-leaf JSX renderer
 * (renderNodeJsx), wire/pipe/field-map handling, .dash.js config
 * emission, and provider declarations are all reused as-is.
 *
 * What this file owns:
 *   - Adapting grid leaves into the per-node shape buildHookScaffold
 *     + renderNodeJsx + collectProviderDeclarations expect.
 *   - Producing the top-level JSX: a Tailwind CSS grid wrapping
 *     each cell's rendered output, with containers wrapping their
 *     own inner grids of children.
 *
 * Grids render as `<div className="grid grid-cols-N gap-2">` where
 * N is the max cells-per-row in the grid. Rows with fewer cells
 * span the remaining columns implicitly (empty slots). This is a
 * deliberately simple emission — colspan/rowspan support is a
 * follow-up that swaps to grid-template-areas.
 *
 * Each rendered DOM element (grid wrapper, container, leaf) carries
 * a `data-composer-node-id` attribute so the preview iframe's
 * click-to-select can resolve hits back to a cell id. Same pattern
 * as the tree emitter's wrapper-div.
 */

import {
    renderNodeJsx,
    collectProviderDeclarations,
    renderConfigCode,
} from "./composerEmitter";
import {
    walkLeafCells,
    isContainer,
    cellFillsRow,
    rowHasFillingCell,
    isGridEmpty,
} from "./gridLayout";
import { buildHookScaffold } from "./composerHookEmitter";
import {
    DASH_REACT_COMPONENT_SCHEMAS,
    getInputBinding,
} from "../dashReactComponentSchemas";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { HEADING_CONVENTIONS, LAYOUT_CONVENTIONS } from "./widgetConventions";

/**
 * Phase C step 3 — emission-time guardrails.
 *
 * Backstop for the AI / starter / hand-author still occasionally
 * placing a raw <Heading> inside a widget cell. The conventions
 * (widgetConventions.js) forbid Heading in-widget; the prompt + the
 * starter layouts respect this, but a stray "Heading" persists in
 * older drafts and any future code path the conventions aren't piped
 * into. Rewriting at emit time keeps the runtime widget shipped with
 * the right variant regardless of upstream source.
 *
 * applyHeadingGuardrail: leaf cells with type in HEADING_CONVENTIONS.
 * forbidden are rewritten to HEADING_CONVENTIONS.preferredTitle
 * (SubHeading2). The user can still explicitly pick raw Heading via
 * the variant picker — at that point the cell's type IS the picker's
 * stored type, and the picker is the user's signal of intent, not a
 * default. The guardrail only rewrites the default path.
 *
 * Returns the same cell reference when nothing needed rewriting so
 * downstream identity checks (===) keep working.
 */
function applyHeadingGuardrail(cell) {
    if (!cell || cell.kind !== "leaf") return cell;
    if (!HEADING_CONVENTIONS.forbidden.includes(cell.type)) return cell;
    return { ...cell, type: HEADING_CONVENTIONS.preferredTitle };
}

/**
 * Emit the componentCode + configCode pair for a composition grid.
 * Return shape matches emitWidgetCode so the modal routes through
 * the same compilePreview pipeline.
 */
/**
 * Emit a friendly placeholder widget for a composer in its empty
 * onboarding state. Without this the default emission was a stack of
 * dashed-border `<div>` cells with no imports, no primitives, and no
 * widget shape — which fails the acceptance scorecard before the
 * user has done anything, and triggers the "rendered with no visible
 * content" warning on the preview.
 *
 * The placeholder uses Panel + SubHeading2 + EmptyState so:
 *   - the preview shows a recognizable "this is an empty widget, drop
 *     components into it" message instead of a black canvas
 *   - the scorecard's static checks (Title uses SubHeading2, EmptyState
 *     present, no hardcoded color Tailwind) all pass from the first
 *     render
 *   - the code is something the user could legitimately ship if they
 *     chose to — no fake imports, no synthetic markup, no special
 *     case for the preview iframe to handle
 */
function emitEmptyGridPlaceholder(widgetName) {
    const componentCode =
        'import React from "react";\n' +
        'import { Panel, SubHeading2, EmptyState } from "@trops/dash-react";\n' +
        "\n" +
        `export default function ${widgetName}() {\n` +
        "    return (\n" +
        "        <Panel>\n" +
        '            <div className="flex flex-col gap-4 h-full overflow-y-auto">\n' +
        `                <SubHeading2 title="${widgetName}" />\n` +
        "                <EmptyState\n" +
        '                    title="Empty widget"\n' +
        '                    description="Drop components from the palette to start building."\n' +
        "                />\n" +
        "            </div>\n" +
        "        </Panel>\n" +
        "    );\n" +
        "}\n";
    const configCode = renderConfigCode({
        widgetName,
        providerDeclarations: [],
        userConfigFields: [],
    });
    return { componentCode, configCode };
}

export function emitGridWidgetCode(grid) {
    const widgetName =
        (grid && typeof grid.widgetName === "string" && grid.widgetName) ||
        "ComposedWidget";

    // Empty composer — emit a friendly placeholder instead of the
    // raw empty-cell grid that has no primitives, no title, and looks
    // like a black canvas at preview time. See emitEmptyGridPlaceholder
    // for the rationale.
    if (isGridEmpty(grid)) {
        return emitEmptyGridPlaceholder(widgetName);
    }

    // Flatten the grid into a list of per-leaf nodes the existing
    // hook scaffold + provider-decls passes can consume. The
    // scaffold doesn't care about tree ancestry — it iterates the
    // root's `children` to enumerate wires and their slot vars.
    // We wrap the flat list in a synthetic root with `children`
    // pointing at the leaves so the existing code path runs
    // unchanged.
    const leafNodes = [];
    // Apply the heading guardrail before the leaf reaches the hook
    // scaffold so any provider/wire bookkeeping it might do agrees
    // with the type the JSX renderer will emit. Heading has no
    // wires/state today so this is defensive, not load-bearing —
    // but keeping the two passes in lockstep is cheap.
    walkLeafCells(grid, (cell) =>
        leafNodes.push(cellToNode(applyHeadingGuardrail(cell)))
    );
    const treeShim = {
        widgetName,
        root: {
            id: "grid-synthetic-root",
            type: "Panel",
            props: {},
            children: leafNodes,
        },
    };

    const usedComponents = collectUsedComponentNames(grid);
    const importNames = [...usedComponents]
        .filter((n) => Boolean(DASH_REACT_COMPONENT_SCHEMAS[n]))
        .sort();

    const getPropType = (componentType, propName) => {
        const schema = DASH_REACT_COMPONENT_SCHEMAS[componentType];
        if (!schema || !schema.props || !schema.props[propName]) return null;
        return schema.props[propName].type || null;
    };
    const scaffold = buildHookScaffold(
        treeShim,
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

    const providerDeclarations = collectProviderDeclarations(treeShim);

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
    // See composerEmitter.emitWidgetCode for why the params are
    // plain `props` (flat userConfig fields) rather than
    // `{ userConfig = {} }`.
    const componentParams = hasWires ? "props" : "";
    const rootJsx =
        grid && grid.rootGridId
            ? renderGridJsx(grid, grid.rootGridId, 2, slotVarBySlotKey)
            : "        <div />";

    const componentBody = [
        ...hookLines,
        hookLines.length > 0 ? "" : null,
        "    return (",
        rootJsx,
        "    );",
    ].filter((l) => l !== null);

    const componentCode =
        [reactImport, reactComponentImport || null, coreImport || null, ""]
            .filter((l) => l !== null)
            .join("\n") +
        `export default function ${widgetName}(${componentParams}) {\n` +
        componentBody.join("\n") +
        "\n}\n";

    const configCode = renderConfigCode({
        widgetName,
        providerDeclarations,
        userConfigFields,
    });

    return { componentCode, configCode };
}

/**
 * Recursively walk a grid and emit its JSX. Returns a string with
 * `pad`-indented lines suitable for splicing into the component body.
 *
 * Layout model: a vertical flex stack of rows. Each row is a
 * horizontal flex of cells. Rows containing any fill-component
 * (Panel/Card/Container/Table/DataList) take `flex-1` and grow into
 * available height; rows of only primitives (Heading/Button/...)
 * stay at content height. This gives the user "Panel-only fills the
 * canvas, Heading-only sits at top, mixed widgets layer naturally"
 * for free — no per-row sizing knob needed.
 */
function renderGridJsx(grid, gridId, indent, slotVarBySlotKey) {
    const pad = "    ".repeat(indent);
    const targetGrid = grid.grids[gridId];
    if (!targetGrid) return `${pad}<div />`;
    // Phase C step 3 — multi-row grids get the conventions' sectionGap
    // (gap-4) so consecutive components aren't visually fused. Single-
    // row grids keep the tighter gap-2 since there's no inter-row
    // spacing to reveal. LAYOUT_CONVENTIONS.sectionGap is the source
    // of truth — a future tweak there ripples through every emitted
    // multi-row widget at the next compile.
    const rowGap =
        targetGrid.rows.length > 1 ? LAYOUT_CONVENTIONS.sectionGap : "gap-2";
    const gridClass = `flex flex-col ${rowGap} h-full w-full min-h-0 min-w-0`;
    const lines = [
        `${pad}<div data-composer-node-id="${gridId}" className="${gridClass}">`,
    ];
    for (const row of targetGrid.rows) {
        const fill = rowHasFillingCell(grid, row);
        const rowClass = fill
            ? "flex flex-row gap-2 flex-1 min-h-0"
            : "flex flex-row gap-2 min-h-0";
        lines.push(`${pad}    <div className="${rowClass}">`);
        for (const cellId of row.cells) {
            const cell = grid.cells[cellId];
            lines.push(renderCellJsx(grid, cell, indent + 2, slotVarBySlotKey));
        }
        lines.push(`${pad}    </div>`);
    }
    lines.push(`${pad}</div>`);
    return lines.join("\n");
}

function renderCellJsx(grid, cellIn, indent, slotVarBySlotKey) {
    const pad = "    ".repeat(indent);
    if (!cellIn) return `${pad}{/* missing cell */}`;
    // Apply emission-time guardrails BEFORE deciding effective kind
    // or delegating to the per-node renderer. The downgraded cell
    // looks identical structurally to the original; only its `type`
    // string changes, so the kind machinery below is unaffected.
    const cell = applyHeadingGuardrail(cellIn);
    // Same effective-kind override as the editor: if the cell's
    // recorded kind disagrees with the current schema (Paragraph
    // used to be a container and isn't anymore), render against
    // the schema. Keeps emit, preview, and editor consistent
    // across schema migrations without rewriting persisted grids.
    const effectiveKind =
        cell.kind === "container" && cell.type && !isContainer(cell.type)
            ? "leaf"
            : cell.kind;
    if (effectiveKind === "empty") {
        // Empty cells take their row's width budget so a one-column
        // empty row keeps shape. `min-h-[40px]` is not in the prebuilt
        // safelist — using `min-h-8` (32px) which is — so the dashed
        // placeholder always renders visibly even before any wiring.
        //
        // Border uses `border-current opacity-20` rather than an
        // explicit Tailwind color shade. Two reasons:
        //   1. The cohesion rule (COLOR_TAILWIND_REGEX) forbids
        //      `border-{color}-{shade}` in emitted widget code — the
        //      empty-cell placeholder used to leak `border-gray-700/40`
        //      which tripped the scorecard on every composer-emitted
        //      widget that had unfilled cells.
        //   2. `border-current` inherits the surrounding text color,
        //      so the placeholder adapts to the theme automatically
        //      (light/dark) without us picking a shade.
        return (
            `${pad}<div data-composer-node-id="${cell.id}" ` +
            `className="flex-1 min-w-0 min-h-8 border border-dashed border-current opacity-20 rounded" />`
        );
    }
    const fills = cellFillsRow(grid, cell);
    // Cells always claim equal horizontal width inside their row
    // (`flex-1 min-w-0`). Fill cells additionally claim full height
    // + flex-column so the component inside (Panel h-full, Table)
    // has a sized parent to resolve against. Natural cells leave
    // height alone so the component sits at its content size.
    // overflow-hidden on the wrapper ensures the contained component
    // can't paint outside the cell's box — so a long DataList/Table
    // inside a Card stays clipped to the Card and the inner element
    // takes responsibility for scroll. Without this, the component
    // (which has h-full but no overflow rule of its own — Card,
    // DataList, …) lets its children spill past sibling cells in the
    // grid stack.
    const cellLayoutClass = fills
        ? "flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden"
        : "flex-1 min-w-0";
    if (effectiveKind === "leaf") {
        // Delegate to the tree emitter's per-node renderer for leaf
        // concerns (DataList iteration, slot adaptation, field maps,
        // wrapper div with data-composer-node-id). For fill-cells we
        // skip renderNodeJsx's own wrapper sizing — the outer cell
        // wrapper here owns the layout — but we still need the cell
        // wrapper around the leaf renderer's output so its className
        // sits on the right element. Solution: wrap renderNodeJsx's
        // output (which includes its own data-composer-node-id div)
        // in an outer cell-layout div. Selection still works because
        // `closest('[data-composer-node-id]')` finds the inner div.
        const inner = renderNodeJsx(
            cellToNode(cell),
            indent + 1,
            slotVarBySlotKey,
            { wrapperFill: fills }
        );
        return (
            `${pad}<div className="${cellLayoutClass}">\n` +
            `${inner}\n` +
            `${pad}</div>`
        );
    }
    if (effectiveKind === "container" && cell.gridId) {
        const inner = renderGridJsx(
            grid,
            cell.gridId,
            indent + 2,
            slotVarBySlotKey
        );
        // Container components get the fill className so Card (which
        // has no h-full default) actually fills the wrapper. Panel
        // and Container already self-size to h-full/w-full; the
        // duplicate classes are harmless. `overflow-y-auto` makes
        // Card behave like Panel does (Panel/Container already scroll
        // their content in dash-react) so a long child list scrolls
        // inside the container instead of spilling past it.
        const componentClass = fills
            ? ' className="h-full w-full min-h-0 overflow-y-auto"'
            : "";
        return (
            `${pad}<div data-composer-node-id="${cell.id}" className="${cellLayoutClass}">\n` +
            `${pad}    <${cell.type}${componentClass}>\n` +
            `${inner}\n` +
            `${pad}    </${cell.type}>\n` +
            `${pad}</div>`
        );
    }
    return `${pad}{/* unknown cell kind: ${cell.kind} */}`;
}

/**
 * Collect every component name referenced in the grid (leaf or
 * container). Drives the dash-react import block.
 *
 * Auto-includes "shim companion" components that the emitter injects
 * but the user doesn't drop directly — Menu's iteration body
 * references `MenuItem` (matching variant), so seeing Menu2 in the
 * tree pulls MenuItem2 into the imports. Without this the emitted
 * code fails to compile with "MenuItem is not defined".
 */
function collectUsedComponentNames(grid) {
    const out = new Set();
    if (!grid || !grid.cells) return out;
    for (const cell of Object.values(grid.cells)) {
        // Apply the same heading guardrail used at render time so the
        // import block contains the rewritten type (SubHeading2), not
        // the original Heading. Otherwise the emitted module would
        // import Heading but render SubHeading2 — "SubHeading2 is not
        // defined" at compile time.
        const effective = applyHeadingGuardrail(cell);
        if (effective.kind === "leaf" && effective.type)
            out.add(effective.type);
        if (effective.kind === "container" && effective.type)
            out.add(effective.type);
    }
    for (const name of [...out]) {
        if (name === "Menu" || name === "Menu2" || name === "Menu3") {
            out.add(name.replace(/^Menu/, "MenuItem"));
        }
    }
    return out;
}

function cellToNode(cell) {
    return {
        id: cell.id,
        type: cell.type,
        props: cell.props || {},
        children: [],
        wires: cell.wires || {},
    };
}
