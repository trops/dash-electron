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

function buildSubmitForm() {
    // Panel { InputText, InputText, Button } — minimal form. User
    // wires the Button.onClick to a tool that consumes the inputs
    // via componentValue arg bindings.
    let g = makeEmptyGrid();
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    g = setCellComponent(g, seed, "Panel");
    const panelGridId = g.cells[seed].gridId;
    const firstCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, firstCell, "InputText", { label: "Name" });
    g = addRow(g, panelGridId);
    const secondCell = g.grids[panelGridId].rows[1].cells[0];
    g = setCellComponent(g, secondCell, "InputText", { label: "Notes" });
    g = addRow(g, panelGridId);
    const buttonCell = g.grids[panelGridId].rows[2].cells[0];
    g = setCellComponent(g, buttonCell, "Button", { title: "Submit" });
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

/**
 * Intent tags drive the intent-first quick-start UI: after the user
 * picks an intent (search / view / act / else), QuickStartPane shows
 * only the matching layouts. A layout can fit multiple intents (e.g.
 * Two-column split is generic enough for search OR free-form), so
 * each entry carries an array.
 */
export const INTENTS = [
    {
        id: "search",
        label: "Search",
        icon: "🔍",
        tagline: "Find or filter data — input on top, results below.",
        aiHint:
            "The user wants a SEARCH widget: prioritize layouts with " +
            "an input (SearchInput / InputText) up top driving a " +
            "results region (DataList / Table) below it.",
    },
    {
        id: "view",
        label: "View",
        icon: "📊",
        tagline: "Show data, stats, or records — a read-only surface.",
        aiHint:
            "The user wants a VIEW widget: prioritize layouts that " +
            "display data (Heading + Table / DataList / Card with " +
            "stats). No input controls unless filtering is essential.",
    },
    {
        id: "act",
        label: "Act",
        icon: "⚡",
        tagline: "Submit a form or fire an action — inputs + a button.",
        aiHint:
            "The user wants an ACTION widget: include input fields " +
            "(InputText / TextArea / SelectInput) and a Button to " +
            "submit. The Button.onClick will be wired to a tool.",
    },
    {
        id: "else",
        label: "Custom",
        icon: "✨",
        tagline: "Something else — start free-form or let AI propose.",
        aiHint:
            "The user wants a CUSTOM widget that doesn't fit search / " +
            "view / action neatly. Suggest a flexible layout with " +
            "containers (Panel / Card) the user can fill in.",
    },
    {
        id: "provider",
        label: "Provider",
        icon: "📡",
        tagline:
            "Start from a service — Slack, Algolia, Google Drive, " +
            "GitHub, etc.",
        // aiHint is overridden at scaffold time by the chosen
        // provider's name (see QuickStartPane.buildSystemPrompt) —
        // this string is a fallback if the user lands on the AI
        // form without picking a provider first.
        aiHint:
            "The user wants a widget that connects to a specific " +
            "external service. Suggest layouts whose data slots are " +
            "obviously meant to be wired to provider tools.",
    },
];

export const SAMPLE_LAYOUTS = [
    {
        id: "search-and-list",
        label: "Search & list",
        intents: ["search"],
        description:
            "Type-ahead search across a provider, with a list of " +
            "matching items below.",
        outline: ["Panel", " ├─ SearchInput", " └─ DataList"].join("\n"),
        buildGrid: buildSearchAndList,
    },
    {
        id: "two-column-split",
        label: "Two-column split",
        intents: ["search", "view", "else"],
        description:
            "Two side-by-side cards. Drop different content in each — " +
            "filters + results, metrics + chart, etc.",
        outline: ["Panel", " └─ [ Card | Card ]"].join("\n"),
        buildGrid: buildTwoColumnSplit,
    },
    {
        id: "dashboard-summary",
        label: "Dashboard summary",
        intents: ["view"],
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
        intents: ["view"],
        description:
            "Titled panel containing a Table. Wire Table.data to a " +
            "provider fetch.",
        outline: ["Panel", " ├─ Heading", " └─ Table"].join("\n"),
        buildGrid: buildTableViewer,
    },
    {
        id: "submit-form",
        label: "Submit form",
        intents: ["act"],
        description:
            "Two text inputs and a submit button. Wire the button's " +
            "onClick to a tool that reads the inputs.",
        outline: ["Panel", " ├─ InputText", " ├─ InputText", " └─ Button"].join(
            "\n"
        ),
        buildGrid: buildSubmitForm,
    },
];

/**
 * Sample layouts filtered to a given intent. Returns the full list
 * when intent is null/unknown (defensive). Always at least one
 * entry per intent in the shipped fixture set.
 */
export function getSampleLayoutsForIntent(intentId) {
    if (!intentId) return SAMPLE_LAYOUTS;
    return SAMPLE_LAYOUTS.filter(
        (l) => Array.isArray(l.intents) && l.intents.includes(intentId)
    );
}
