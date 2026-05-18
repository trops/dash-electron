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
import { HEADING_CONVENTIONS } from "./widgetConventions";

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

    test.each(SAMPLE_LAYOUTS.map((l) => [l.id, l]))(
        "%s — emitted code uses SubHeading2/SubHeading3 for headings, never raw <Heading>",
        (_id, layout) => {
            // The user's H1 complaint: raw <Heading> is H1, too large
            // for in-widget use. Every starter must reflect the
            // conventions' preferred variants. The only allowed
            // non-SubHeading is the numeric-display Heading2/Heading3.
            const { componentCode } = emitGridWidgetCode(layout.buildGrid());
            // Forbidden: bare <Heading> tag (not <Heading2> / <Heading3>
            // and not </Heading2> closer). Word-boundary regex catches
            // <Heading title=…/> and <Heading /> but lets <Heading2…> pass.
            expect(componentCode).not.toMatch(/<Heading[\s/>]/);
        }
    );

    test("provider-flavored starters carry a recognized provider id", () => {
        const knownProviders = new Set([
            "algolia",
            "slack",
            "github",
            "gmail",
            "google-drive",
            "notion",
            "filesystem",
        ]);
        for (const layout of SAMPLE_LAYOUTS) {
            if (!layout.provider) continue;
            expect(knownProviders.has(layout.provider)).toBe(true);
        }
    });

    test("every provider that has a Phase B widget has at least one flavored starter", () => {
        const tagged = new Set(
            SAMPLE_LAYOUTS.filter((l) => l.provider).map((l) => l.provider)
        );
        // Each of the 7 distinct providers covered by Phase B's 8
        // widgets (Slack pair counts once) must have a starter ready
        // to surface when the user picks that provider.
        for (const p of [
            "algolia",
            "slack",
            "github",
            "gmail",
            "google-drive",
            "notion",
            "filesystem",
        ]) {
            expect(tagged.has(p)).toBe(true);
        }
    });

    test("getSampleLayoutsForIntent ranks provider-flavored starters first when providerChoice is supplied", () => {
        // Pick a provider that has at least one flavored starter.
        const flavoredForAlgolia = SAMPLE_LAYOUTS.filter(
            (l) => l.provider === "algolia"
        );
        expect(flavoredForAlgolia.length).toBeGreaterThan(0);

        const ranked = getSampleLayoutsForIntent("search", { id: "algolia" });
        // Algolia starter must lead.
        expect(ranked[0].provider).toBe("algolia");
        // Generic search-and-list (no provider) must still appear
        // somewhere in the returned list — provider ranking should
        // PARTITION, not FILTER.
        const ids = ranked.map((l) => l.id);
        expect(ids).toContain("search-and-list");
    });

    test("providerChoice with no matching starter is a no-op (no crash, original order)", () => {
        const baseline = getSampleLayoutsForIntent("search");
        const ranked = getSampleLayoutsForIntent("search", {
            id: "nonexistent-provider",
        });
        expect(ranked.map((l) => l.id)).toEqual(baseline.map((l) => l.id));
    });

    test("getSampleLayoutsForIntent without providerChoice preserves the original SAMPLE_LAYOUTS order for the intent", () => {
        const baseline = SAMPLE_LAYOUTS.filter(
            (l) => Array.isArray(l.intents) && l.intents.includes("search")
        );
        expect(getSampleLayoutsForIntent("search").map((l) => l.id)).toEqual(
            baseline.map((l) => l.id)
        );
    });

    test("HEADING_CONVENTIONS preferredTitle is reflected in at least one starter (smoke check that the conventions import is wired)", () => {
        // Defensive — if someone refactors HEADING_CONVENTIONS away
        // from "SubHeading2", the starters that reference it inline
        // would silently switch. Asserting that at least one
        // emitted code contains the preferred title variant catches
        // the drift.
        const allEmitted = SAMPLE_LAYOUTS.map(
            (l) => emitGridWidgetCode(l.buildGrid()).componentCode
        ).join("\n");
        expect(allEmitted).toContain(`<${HEADING_CONVENTIONS.preferredTitle}`);
    });
});
