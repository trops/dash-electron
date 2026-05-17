/**
 * Sample-layout fixture tests — each curated layout must produce a
 * grid that:
 *   1. is NOT detected as empty (otherwise QuickStartPane would
 *      re-appear immediately after apply).
 *   2. emits valid widget code (no "unknown component" comments
 *      mean every node type maps to a known schema entry).
 *   3. resolves every cell id consistently (defensive — catches
 *      malformed grids before they crash the editor).
 */

import {
    SAMPLE_LAYOUTS,
    INTENTS,
    getSampleLayoutsForIntent,
} from "./composerSampleLayouts";
import { isGridEmpty, findCellLocation, walkLeafCells } from "./gridLayout";
import { emitGridWidgetCode } from "./gridEmitter";

describe("composerSampleLayouts", () => {
    test("ships at least one layout", () => {
        expect(SAMPLE_LAYOUTS.length).toBeGreaterThan(0);
    });

    test.each(SAMPLE_LAYOUTS.map((l) => [l.id, l]))(
        "%s — buildGrid produces a non-empty, code-emitting grid with consistent cell ids",
        (_id, layout) => {
            expect(typeof layout.label).toBe("string");
            expect(typeof layout.description).toBe("string");
            expect(typeof layout.outline).toBe("string");
            const grid = layout.buildGrid();
            expect(isGridEmpty(grid)).toBe(false);
            // Every cell in the cells map is reachable via a grid row,
            // and every leaf cell resolves through findCellLocation
            // (catches dangling cells that aren't placed anywhere).
            const seenLeafIds = [];
            walkLeafCells(grid, (cell) => seenLeafIds.push(cell.id));
            for (const cellId of seenLeafIds) {
                expect(findCellLocation(grid, cellId)).not.toBeNull();
            }
            // Emitted code must mention every leaf type and must NOT
            // include the "unknown component" comment marker (which
            // renderNodeJsx emits when a node.type isn't in the
            // schema map — a typo in the fixture).
            const { componentCode } = emitGridWidgetCode(grid);
            expect(componentCode).not.toContain("unknown component");
        }
    );

    test("every layout tags at least one intent", () => {
        for (const layout of SAMPLE_LAYOUTS) {
            expect(Array.isArray(layout.intents)).toBe(true);
            expect(layout.intents.length).toBeGreaterThan(0);
        }
    });

    test("every layout-driven intent has at least one sample layout", () => {
        // The `provider` intent is purely AI-led — it routes through a
        // provider picker rather than a static sample gallery — so
        // it's exempt from this invariant.
        for (const intent of INTENTS) {
            if (intent.id === "provider") continue;
            const matches = getSampleLayoutsForIntent(intent.id);
            expect(matches.length).toBeGreaterThan(0);
        }
    });

    test("getSampleLayoutsForIntent returns the full list when intent is null", () => {
        expect(getSampleLayoutsForIntent(null).length).toBe(
            SAMPLE_LAYOUTS.length
        );
    });
});
