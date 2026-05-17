/**
 * Sample composer layouts — curated starting grids the user can pick
 * from when opening a fresh widget. Each layout is structure-only
 * (no preconfigured wires) so it's portable across users regardless
 * of which providers they've configured.
 *
 * Each entry exposes a `buildGrid()` that composes the grid through
 * the same mutators a user-driven session would use
 * (`makeEmptyGrid` + `setCellComponent` + `addRow` + `splitCell`) —
 * NOT a hand-rolled object literal. This guarantees the produced
 * grid passes every invariant the rest of the composer expects
 * (stable cell ids, correct `_nextCellId`, proper container/leaf
 * shape per the schema's `children` prop).
 *
 * Add a new entry by appending to SAMPLE_LAYOUTS. Each layout needs
 * a stable id (used as React key), a short label and one-liner
 * description, and an `outline` — a simple text sketch shown on the
 * picker card so the user can scan the structure visually.
 */

import {
    makeEmptyGrid,
    addRow,
    splitCell,
    setCellComponent,
} from "./gridLayout";

function buildSearchAndList() {
    // Panel { SearchInput, DataList } — canonical "type and see
    // results" pattern. User wires SearchInput.onChange to a tool
    // and DataList.items to the same tool's result (pipe).
    let g = makeEmptyGrid();
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, seed, "Panel");
    const panelGridId = g.cells[seed].gridId;
    const searchCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, searchCell, "SearchInput");
    g = addRow(g, panelGridId);
    const listCell = g.grids[panelGridId].rows[1].cells[0];
    g = setCellComponent(g, listCell, "DataList");
    return g;
}

function buildTwoColumnSplit() {
    // Panel { [Card, Card] } — two side-by-side surfaces for
    // dashboards that show two related views (filter on the left,
    // results on the right; metrics + chart; etc.).
    let g = makeEmptyGrid();
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, seed, "Panel");
    const panelGridId = g.cells[seed].gridId;
    const leftCellId = g.grids[panelGridId].rows[0].cells[0];
    g = splitCell(g, leftCellId);
    const [leftId, rightId] = g.grids[panelGridId].rows[0].cells;
    g = setCellComponent(g, leftId, "Card");
    g = setCellComponent(g, rightId, "Card");
    return g;
}

function buildDashboardSummary() {
    // Panel { Heading, Card { Paragraph } } — title at top, a
    // single-stat surface below. User refines by swapping the inner
    // Paragraph for whatever they actually want to show.
    let g = makeEmptyGrid();
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, seed, "Panel");
    const panelGridId = g.cells[seed].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, "Heading", { title: "Dashboard" });
    g = addRow(g, panelGridId);
    const cardCell = g.grids[panelGridId].rows[1].cells[0];
    g = setCellComponent(g, cardCell, "Card");
    const cardGridId = g.cells[cardCell].gridId;
    const innerCell = g.grids[cardGridId].rows[0].cells[0];
    g = setCellComponent(g, innerCell, "Paragraph", {
        text: "Summary",
    });
    return g;
}

function buildTableViewer() {
    // Panel { Heading, Table } — list-of-records pattern. User wires
    // Table.data to a fetch and edits Table.columns to define the
    // shape they care about.
    let g = makeEmptyGrid();
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, seed, "Panel");
    const panelGridId = g.cells[seed].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, "Heading", { title: "Records" });
    g = addRow(g, panelGridId);
    const tableCell = g.grids[panelGridId].rows[1].cells[0];
    g = setCellComponent(g, tableCell, "Table");
    return g;
}

export const SAMPLE_LAYOUTS = [
    {
        id: "search-and-list",
        label: "Search & list",
        description:
            "Type-ahead search across a provider, with a list of " +
            "matching items below.",
        outline: ["Panel", " ├─ SearchInput", " └─ DataList"].join("\n"),
        buildGrid: buildSearchAndList,
    },
    {
        id: "two-column-split",
        label: "Two-column split",
        description:
            "Two side-by-side cards. Drop different content in each — " +
            "filters + results, metrics + chart, etc.",
        outline: ["Panel", " └─ [ Card | Card ]"].join("\n"),
        buildGrid: buildTwoColumnSplit,
    },
    {
        id: "dashboard-summary",
        label: "Dashboard summary",
        description:
            "Titled panel with a single card surface for a hero " +
            "metric or short summary.",
        outline: ["Panel", " ├─ Heading", " └─ Card", "     └─ Paragraph"].join(
            "\n"
        ),
        buildGrid: buildDashboardSummary,
    },
    {
        id: "table-viewer",
        label: "Table viewer",
        description:
            "Titled panel containing a Table. Wire Table.data to a " +
            "provider fetch.",
        outline: ["Panel", " ├─ Heading", " └─ Table"].join("\n"),
        buildGrid: buildTableViewer,
    },
];
