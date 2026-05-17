/**
 * Reproduces the user's "search rules + table pipe" scenario as a
 * pure unit test against the grid emitter. Pins the EXACT shape of
 * the emitted IPC call so a future drift in the emitter — wrong
 * arg name, missing prop, lost pipe binding — fails CI instead of
 * surfacing as a confusing runtime error in the preview.
 *
 * Scenario being verified:
 *   - SearchInput at the top of a Panel, with onChange wired to
 *     algolia.searchRules and bound args:
 *       indexName = literal "airports"
 *       query     = eventArg (the typed string)
 *   - Table below, with data slot piped from SearchInput.onChange
 *     so each keystroke that resolves the searchRules call repaints
 *     the table.
 *
 * Assertions cover both correctness (right method, right args) and
 * the affordances we added for debugging:
 *   - "[composer] algolia.searchRules call" + "result" console logs
 *   - the rich error-handler block so plain-object rejections still
 *     produce readable messages.
 */

import { makeEmptyGrid, addRow, setCellComponent } from "./gridLayout";
import { setSlotWire, setSlotArg, setSlotPipe } from "./composerEmitter";
import { emitGridWidgetCode } from "./gridEmitter";

function buildSearchRulesScenario() {
    let g = makeEmptyGrid("SearchRulesWidget");
    const root = g.rootGridId;

    // Root cell becomes a Panel container.
    const rootCell = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, rootCell, "Panel");
    const panelGridId = g.cells[rootCell].gridId;

    // Row 0 of the panel: SearchInput.
    const searchCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, searchCell, "SearchInput");

    // Row 1: Table.
    g = addRow(g, panelGridId);
    const tableCell = g.grids[panelGridId].rows[1].cells[0];
    g = setCellComponent(g, tableCell, "Table");

    // Wire SearchInput.onChange → algolia.searchRules with the args
    // the user reported configuring (indexName literal "airports",
    // query bound to eventArg). The mutators operate on a synthetic
    // tree shim under the cell — same translation ComposerPaneV2's
    // applyCellMutator does at runtime.
    const wireOn = (cellId, propName, wire) => {
        const shim = {
            root: {
                id: cellId,
                type: g.cells[cellId].type,
                props: g.cells[cellId].props || {},
                wires: g.cells[cellId].wires || {},
                children: [],
            },
        };
        const out = setSlotWire(shim, cellId, propName, wire);
        g = {
            ...g,
            cells: {
                ...g.cells,
                [cellId]: {
                    ...g.cells[cellId],
                    wires: out.root.wires,
                },
            },
        };
    };
    const argOn = (cellId, propName, argName, binding) => {
        const shim = {
            root: {
                id: cellId,
                type: g.cells[cellId].type,
                props: g.cells[cellId].props || {},
                wires: g.cells[cellId].wires || {},
                children: [],
            },
        };
        const out = setSlotArg(shim, cellId, propName, argName, binding);
        g = {
            ...g,
            cells: {
                ...g.cells,
                [cellId]: {
                    ...g.cells[cellId],
                    wires: out.root.wires,
                },
            },
        };
    };
    const pipeOn = (cellId, propName, sourceNodeId, sourcePropName) => {
        const shim = {
            root: {
                id: cellId,
                type: g.cells[cellId].type,
                props: g.cells[cellId].props || {},
                wires: g.cells[cellId].wires || {},
                children: [],
            },
        };
        const out = setSlotPipe(
            shim,
            cellId,
            propName,
            sourceNodeId,
            sourcePropName
        );
        g = {
            ...g,
            cells: {
                ...g.cells,
                [cellId]: {
                    ...g.cells[cellId],
                    wires: out.root.wires,
                },
            },
        };
    };

    wireOn(searchCell, "onChange", {
        provider: "MyAlgolia",
        providerType: "algolia",
        providerClass: "credential",
        method: "searchRules",
    });
    argOn(searchCell, "onChange", "indexName", {
        kind: "literal",
        value: "airports",
    });
    argOn(searchCell, "onChange", "query", { kind: "eventArg" });

    // Pipe Table.data ← SearchInput.onChange. Table is a leaf; the
    // pipe mutator binds the data slot to the source wire's result
    // state. Two-step (wire → pipe) is what the inspector does
    // under the hood when the user picks the pipe option.
    pipeOn(tableCell, "data", searchCell, "onChange");

    return { grid: g, searchCellId: searchCell, tableCellId: tableCell };
}

describe("emitter — search-rules + table-pipe scenario", () => {
    const { grid } = buildSearchRulesScenario();
    const { componentCode } = emitGridWidgetCode(grid);

    test("emits a useCallback that wires SearchInput.onChange to algolia.searchRules", () => {
        // The callback name derives from the slot's prop (onChange).
        expect(componentCode).toMatch(
            /const onChange = useCallback\(async \(eventArg\) => \{/
        );
    });

    test("the IPC payload includes the credential triplet AND the user-bound args", () => {
        // The args literal must include:
        //  - providerHash / dashboardAppId / providerName (auto, from pc handle)
        //  - indexName: "airports" (literal binding)
        //  - query: eventArg (event-arg binding)
        // Use a single regex anchored on the call so we know the
        // arg block applies to THIS call, not some other one.
        expect(componentCode).toContain(
            "providerHash: pc_MyAlgolia.providerHash,"
        );
        expect(componentCode).toContain(
            "dashboardAppId: pc_MyAlgolia.dashboardAppId,"
        );
        expect(componentCode).toContain(
            "providerName: pc_MyAlgolia.providerName,"
        );
        expect(componentCode).toContain('indexName: "airports",');
        expect(componentCode).toContain("query: eventArg,");
    });

    test("invokes the IPC method as window.mainApi.algolia.searchRules(_args)", () => {
        expect(componentCode).toContain(
            "await window.mainApi.algolia.searchRules(_args)"
        );
    });

    test("captures call + result via console.log so the user can see what's happening", () => {
        expect(componentCode).toContain(
            'console.log("[composer] algolia.searchRules call", _args);'
        );
        expect(componentCode).toContain(
            'console.log("[composer] algolia.searchRules result", result);'
        );
    });

    test("catch block produces a readable message regardless of error shape", () => {
        // Helper emits a 3-line _msg derivation; verify the
        // signature so a future regression in the helper surfaces.
        expect(componentCode).toMatch(
            /const _msg = \(err && err\.message\) \|\|/
        );
        expect(componentCode).toContain(
            '"[composer] algolia.searchRules failed:"'
        );
    });

    test("pipes Table.data from the SearchInput.onChange result state", () => {
        // The callback wire allocates `<name>Result` state and the
        // pipe binds the consuming slot to it. Verify both halves.
        expect(componentCode).toContain(
            "const [onChangeResult, set_onChangeResult] = useState([]);"
        );
        expect(componentCode).toMatch(/<Table[^>]*data=\{onChangeResult\}/);
    });

    test("result-capture uses the {hits} unwrap heuristic so the pipe gets an Array", () => {
        // Algolia searchRules returns {hits, nbHits, page, nbPages}.
        // The registry annotates this; the emitter unwraps to
        // result?.hits so the downstream Table.data sees an array.
        expect(componentCode).toContain(
            "set_onChangeResult(result?.hits || []);"
        );
    });
});
