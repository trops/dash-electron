/**
 * Tests for gridEmitter — exercises the recursive grid → JSX
 * emission path, including container nesting and leaf reuse of the
 * existing tree emitter's helpers.
 */

import { makeEmptyGrid, addRow, setCellComponent } from "./gridLayout";
import { emitGridWidgetCode } from "./gridEmitter";

describe("emitGridWidgetCode", () => {
    test("empty grid emits a single-cell placeholder wrapped in the root grid div", () => {
        const g = makeEmptyGrid();
        const { componentCode } = emitGridWidgetCode(g);
        // Root grid wrapper is now a vertical flex stack so rows can
        // mix auto + fill heights without the user picking a knob.
        expect(componentCode).toMatch(
            /data-composer-node-id="grid-root"[^>]*flex[^>]*flex-col/
        );
        // The single empty cell renders its own placeholder div.
        expect(componentCode).toMatch(/data-composer-node-id="cell-1"/);
    });

    test("root grid wrapper fills its parent so single-component compositions don't collapse", () => {
        // Without h-full/w-full the root flex stack is content-height
        // and a Panel-only composition shrinks to padding.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /data-composer-node-id="grid-root"[^>]*h-full[^>]*w-full/
        );
        // The Panel-row claims flex-1 because its cell is a fill
        // component, so it grows into available height.
        expect(componentCode).toMatch(/<div className="[^"]*flex-1[^"]*">/);
        // The container cell wrapper around <Panel> also fills.
        expect(componentCode).toMatch(
            /data-composer-node-id="cell-1"[^>]*h-full/
        );
    });

    test("a fill-component cell (Table) emits the wrapper fill style on the leaf wrapper", () => {
        // Table is fillsCell: true, so the leaf wrapper carries the
        // inline height/width 100% style so a percentage-height table
        // (or its inner overflow container) has a sized parent.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Table");
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /<div data-composer-node-id="cell-1" style=\{\{ height: "100%", width: "100%"/
        );
    });

    test("Menu auto-allocates state for the selected value; onSelect binds to the setter", () => {
        // Auto-state mirrors what SearchInput.onChange already gets:
        // a useState pair (`menuSelected`, `setMenuSelected`) plus
        // an onSelect binding so clicks capture the selection
        // without the user wiring anything. The MenuItem shim's
        // onClick reads the same slot map so the rendered list
        // already writes to that state.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Menu");
        // Wire items so the shim path runs and emits the MenuItem
        // onClick referencing the auto-state setter.
        g1.cells[cellId].wires = {
            items: {
                provider: "TestAlgolia",
                providerType: "algolia",
                providerClass: "credential",
                method: "listIndices",
            },
        };
        const { componentCode } = emitGridWidgetCode(g1);
        // useState pair allocated.
        expect(componentCode).toMatch(
            /const \[menuSelected, setMenuSelected\] = useState\(null\);/
        );
        // MenuItem shim onClick wires through the setter.
        expect(componentCode).toMatch(
            /<MenuItem key=\{__i\} onClick=\{\(\) => setMenuSelected && setMenuSelected\(/
        );
    });

    test("Menu with wired items emits a .map of MenuItem and auto-imports MenuItem", () => {
        // Menu is a wired-only data leaf (mirrors DataList). The user
        // never drops MenuItem manually — the shim generates it as
        // iteration output. The import collector has to auto-include
        // MenuItem (matching variant) so the bundle compiles.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Menu2");
        // Synthesize a configured wire on the items slot so the
        // emitter takes the shim path (renderNodeJsx checks
        // slotVarBySlotKey for `cell-1:items`). The simplest way to
        // exercise that path is to set a wire spec the hook scaffold
        // will turn into a state var.
        g1.cells[cellId].wires = {
            items: {
                provider: "TestProvider",
                providerType: "algolia",
                providerClass: "credential",
                method: "listIndices",
            },
        };
        const { componentCode } = emitGridWidgetCode(g1);
        // Both Menu2 and MenuItem2 land in the import line.
        expect(componentCode).toContain(
            'import { Menu2, MenuItem2 } from "@trops/dash-react"'
        );
        // The shim renders a .map of MenuItem2 inside <Menu2>.
        expect(componentCode).toMatch(/<Menu2[^>]*>[\s\S]*<MenuItem2 key=/);
        expect(componentCode).toMatch(/<\/Menu2>/);
    });

    test("MenuItem is hidden from the palette (still in schema for import resolution)", () => {
        // Sanity check the hideFromPalette filter: getSchemasByCategory
        // (which the palette iterates) must NOT include MenuItem
        // variants, but they're still present in
        // DASH_REACT_COMPONENT_SCHEMAS so the import collector can
        // pull them in.
        const {
            getSchemasByCategory,
            DASH_REACT_COMPONENT_SCHEMAS,
        } = require("../dashReactComponentSchemas");
        const grouped = getSchemasByCategory();
        const allPaletteNames = Object.values(grouped).flat();
        expect(allPaletteNames).not.toContain("MenuItem");
        expect(allPaletteNames).not.toContain("MenuItem2");
        expect(allPaletteNames).not.toContain("MenuItem3");
        // Schema still present so import collector finds them.
        expect(DASH_REACT_COMPONENT_SCHEMAS.MenuItem).toBeDefined();
        expect(DASH_REACT_COMPONENT_SCHEMAS.MenuItem2).toBeDefined();
        expect(DASH_REACT_COMPONENT_SCHEMAS.MenuItem3).toBeDefined();
    });

    test("Heading2 / Card3 variants inherit their base's schema shape (props, fillsCell)", () => {
        // dash-react ships 2/3 visual variants of most components.
        // The composer exposes them as separate palette items with
        // the same prop surface as the base. Schema additions are
        // mechanical clones — this test guards against accidentally
        // dropping a variant or skewing its props.
        const g0 = makeEmptyGrid();
        const cellA = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellA, "Heading2", {
            title: "Variant test",
        });
        const out1 = emitGridWidgetCode(g1).componentCode;
        expect(out1).toContain('<Heading2 title="Variant test"');
        expect(out1).toContain('import { Heading2 } from "@trops/dash-react"');

        const g2 = setCellComponent(g0, cellA, "Card3");
        const out2 = emitGridWidgetCode(g2).componentCode;
        expect(out2).toMatch(
            /<Card3 className="h-full w-full min-h-0 overflow-y-auto">/
        );
    });

    test("Card container injects className=h-full so it actually fills the wrapper", () => {
        // Card has no h-full default (unlike Panel / Container) so
        // without the injected className it sits at content height
        // even inside a sized cell wrapper.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Card");
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /<Card className="h-full w-full min-h-0 overflow-y-auto">/
        );
    });

    test("Table leaf injects className=h-full so the table div fills the cell", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Table");
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /<Table[^>]*className="h-full w-full min-h-0 overflow-y-auto"/
        );
    });

    test("a primitive cell (Heading2) does NOT emit the wrapper fill style — it sits at content height", () => {
        // Heading2 isn't fillsCell, so a Heading2-only widget shouldn't
        // stretch a tiny title across the full preview canvas.
        // (Uses Heading2 rather than raw Heading because the Phase C
        // emitter guardrail rewrites Heading → SubHeading2 — this test
        // is about fillsCell behavior, not the guardrail.)
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading2", { title: "Hi" });
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).not.toMatch(
            /data-composer-node-id="cell-1" style=/
        );
        // And its row doesn't claim flex-1 — content-height row keeps
        // the title at the top with empty space below (rather than a
        // tall whitespace cell spanning the canvas).
        const headingRowMatch = componentCode.match(
            /<div className="(flex flex-row[^"]*)">[\s\S]*?cell-1/
        );
        expect(headingRowMatch).not.toBeNull();
        expect(headingRowMatch[1]).not.toContain("flex-1");
    });

    test("widget name flows into export + config", () => {
        const g = makeEmptyGrid("MyDashboard");
        const { componentCode, configCode } = emitGridWidgetCode(g);
        expect(componentCode).toContain(
            "export default function MyDashboard()"
        );
        expect(configCode).toContain('component: "MyDashboard"');
    });

    test("a leaf component cell renders the component with the composer wrapper", () => {
        // Uses Heading2 rather than raw Heading because the Phase C
        // emitter guardrail rewrites Heading → SubHeading2 — this test
        // is about the wrapper + prop pass-through, not the guardrail
        // (covered by its own tests below).
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading2", { title: "Hello" });
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /data-composer-node-id="cell-1"[\s\S]*<Heading2 title="Hello"/
        );
    });

    test("a container component cell renders the component wrapping its inner grid", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Panel");
        const { componentCode } = emitGridWidgetCode(g1);
        // The Panel cell wraps a <Panel> wrapping the inner grid.
        // (className is injected on fill containers — match any.)
        expect(componentCode).toMatch(/<Panel[^>]*>/);
        expect(componentCode).toMatch(/<\/Panel>/);
        // The inner grid is its own vertical flex stack (rows render
        // inside that stack), with its own data-composer-node-id.
        expect(componentCode).toMatch(
            /data-composer-node-id="grid-1"[^>]*flex flex-col/
        );
    });

    test("nested container — Panel containing Card containing Heading2", () => {
        // Uses Heading2 (not raw Heading) so this test exercises pure
        // container nesting without the Phase C emitter guardrail
        // rewriting the leaf type. Heading→SubHeading2 downgrade is
        // tested separately below.
        const g0 = makeEmptyGrid();
        const outerCell = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, outerCell, "Panel");
        const innerGrid = g1.cells[outerCell].gridId;
        const innerCell = g1.grids[innerGrid].rows[0].cells[0];
        const g2 = setCellComponent(g1, innerCell, "Card");
        const card = g2.cells[innerCell];
        const cardInnerGrid = card.gridId;
        const headingCell = g2.grids[cardInnerGrid].rows[0].cells[0];
        const g3 = setCellComponent(g2, headingCell, "Heading2", {
            title: "Inside the card",
        });
        const { componentCode } = emitGridWidgetCode(g3);
        // All three components show up in the import list and the JSX.
        expect(componentCode).toContain("import { Card, Heading2, Panel }");
        expect(componentCode).toMatch(
            /<Panel[^>]*>[\s\S]*<Card[^>]*>[\s\S]*<Heading2/
        );
        // Closing-tag order: Card closes before Panel (Heading2 is a
        // self-closing leaf and has no close tag).
        expect(componentCode).toMatch(/<\/Card>[\s\S]*<\/Panel>/);
    });

    test("multi-row grid emits one flex-row wrapper per row", () => {
        const g0 = makeEmptyGrid();
        // Add a second row so the root grid has two rows.
        const g1 = addRow(g0, g0.rootGridId);
        const { componentCode } = emitGridWidgetCode(g1);
        // Two `<div className="flex flex-row ...">` row wrappers
        // inside the root grid stack.
        const rowMatches =
            componentCode.match(/<div className="flex flex-row[^"]*">/g) || [];
        expect(rowMatches.length).toBe(2);
    });

    test("does NOT emit the dash-react import line when no components are placed", () => {
        const g = makeEmptyGrid();
        const { componentCode } = emitGridWidgetCode(g);
        expect(componentCode).not.toContain("@trops/dash-react");
    });

    test("emits the dash-react import when at least one component is placed", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "SearchInput");
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toContain(
            'import { SearchInput } from "@trops/dash-react";'
        );
    });
});

describe("emitGridWidgetCode — Phase C step 3 guardrails", () => {
    test("Heading is downgraded to SubHeading2 in the emitted JSX (the H1 rule)", () => {
        // The user's H1 complaint: AI / old drafts emit raw <Heading>
        // (H1 size) inside widgets where SubHeading2 belongs. The
        // emitter rewrites at output time so a stale Heading in the
        // grid still ships as a section-sized heading.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading", {
            title: "Reports",
        });
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toContain('<SubHeading2 title="Reports"');
        // Guarded against the bare <Heading> tag — word-boundary
        // pattern (matches "<Heading " and "<Heading/" but not
        // "<Heading2", "<SubHeading2").
        expect(componentCode).not.toMatch(/<Heading[\s/>]/);
    });

    test("Heading downgrade flows through to the dash-react import block", () => {
        // If the import block still listed Heading while the JSX
        // emitted SubHeading2, the compiled module would fail with
        // "SubHeading2 is not defined" at runtime.
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading", { title: "X" });
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(/import \{[^}]*SubHeading2[^}]*\}/);
        // Heading should NOT be imported — the original type was
        // rewritten before the import set was built.
        expect(componentCode).not.toMatch(/import \{[^}]*\bHeading\b[^}]*\}/);
    });

    test("Heading2 / Heading3 / SubHeading2 are NOT downgraded (only raw Heading is forbidden)", () => {
        for (const variant of [
            "Heading2",
            "Heading3",
            "SubHeading2",
            "SubHeading3",
        ]) {
            const g0 = makeEmptyGrid();
            const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
            const g1 = setCellComponent(g0, cellId, variant, { title: "X" });
            const { componentCode } = emitGridWidgetCode(g1);
            expect(componentCode).toContain(`<${variant}`);
        }
    });

    test("Heading downgrade preserves the props (title etc.)", () => {
        const g0 = makeEmptyGrid();
        const cellId = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, cellId, "Heading", {
            title: "Quarterly Stats",
        });
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toContain('title="Quarterly Stats"');
    });

    test("multi-row grid uses gap-4 (LAYOUT_CONVENTIONS.sectionGap)", () => {
        // The conventions specify gap-4 between top-level rows. Old
        // emitter used gap-2 everywhere — components visually fused.
        // Two rows → gap-4. A grid wrapper match like:
        //   <div data-composer-node-id="grid-root" className="... gap-4 ...">
        const g0 = makeEmptyGrid();
        const g1 = addRow(g0, g0.rootGridId);
        const { componentCode } = emitGridWidgetCode(g1);
        expect(componentCode).toMatch(
            /data-composer-node-id="grid-root"[^>]*gap-4/
        );
        expect(componentCode).not.toMatch(
            /data-composer-node-id="grid-root"[^>]*gap-2/
        );
    });

    test("single-row grid keeps the tighter gap-2 (no inter-row spacing to reveal)", () => {
        const g = makeEmptyGrid();
        const { componentCode } = emitGridWidgetCode(g);
        expect(componentCode).toMatch(
            /data-composer-node-id="grid-root"[^>]*gap-2/
        );
        expect(componentCode).not.toMatch(
            /data-composer-node-id="grid-root"[^>]*gap-4/
        );
    });

    test("multi-row inner grid (inside a Panel) also gets gap-4", () => {
        // The guardrail applies at every grid level, not just root.
        // A Panel with multiple child rows should still get gap-4 on
        // its inner grid.
        const g0 = makeEmptyGrid();
        const outerCell = g0.grids[g0.rootGridId].rows[0].cells[0];
        const g1 = setCellComponent(g0, outerCell, "Panel");
        const innerGridId = g1.cells[outerCell].gridId;
        const g2 = addRow(g1, innerGridId);
        const { componentCode } = emitGridWidgetCode(g2);
        expect(componentCode).toMatch(
            new RegExp(`data-composer-node-id="${innerGridId}"[^>]*gap-4`)
        );
    });
});
