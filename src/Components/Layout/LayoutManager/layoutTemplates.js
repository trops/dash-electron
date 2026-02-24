/**
 * Layout template definitions for the dashboard template picker.
 *
 * Each template describes a grid configuration that can be used
 * to create a new workspace/dashboard layout.
 */

export const layoutTemplates = [
    {
        id: "single",
        name: "Single",
        description: "One full-size panel. Great for a single focused widget.",
        rows: 1,
        cols: 1,
        cells: [{ key: "1.1" }],
        previewCells: [{ row: 1, col: 1 }],
    },
    {
        id: "two-columns",
        name: "Two Columns",
        description:
            "Side-by-side panels. Good for comparing data or a list + detail view.",
        rows: 1,
        cols: 2,
        cells: [{ key: "1.1" }, { key: "1.2" }],
        previewCells: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
        ],
    },
    {
        id: "two-rows",
        name: "Two Rows",
        description:
            "Stacked panels. Useful for a summary on top with details below.",
        rows: 2,
        cols: 1,
        cells: [{ key: "1.1" }, { key: "2.1" }],
        previewCells: [
            { row: 1, col: 1 },
            { row: 2, col: 1 },
        ],
    },
    {
        id: "two-by-two",
        name: "2x2 Grid",
        description:
            "Four equal panels. A classic dashboard layout for monitoring multiple metrics.",
        rows: 2,
        cols: 2,
        cells: [{ key: "1.1" }, { key: "1.2" }, { key: "2.1" }, { key: "2.2" }],
        previewCells: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 2, col: 1 },
            { row: 2, col: 2 },
        ],
    },
    {
        id: "three-columns",
        name: "Three Columns",
        description:
            "Three equal columns. Ideal for status boards or category-based views.",
        rows: 1,
        cols: 3,
        cells: [{ key: "1.1" }, { key: "1.2" }, { key: "1.3" }],
        previewCells: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 1, col: 3 },
        ],
    },
    {
        id: "header-two-cols",
        name: "Header + Two Columns",
        description:
            "Full-width header row with two columns below. Perfect for a title/summary area over split content.",
        rows: 2,
        cols: 2,
        cells: [
            { key: "1.1", span: { row: 1, col: 2 } },
            { key: "1.2", hide: true },
            { key: "2.1" },
            { key: "2.2" },
        ],
        previewCells: [
            { row: 1, col: 1, colSpan: 2 },
            { row: 2, col: 1 },
            { row: 2, col: 2 },
        ],
    },
    {
        id: "sidebar-content",
        name: "Sidebar + Content",
        description:
            "Left sidebar spanning full height with two stacked panels on the right. Great for navigation or filters alongside content.",
        rows: 2,
        cols: 2,
        cells: [
            { key: "1.1", span: { row: 2, col: 1 } },
            { key: "1.2" },
            { key: "2.1", hide: true },
            { key: "2.2" },
        ],
        previewCells: [
            { row: 1, col: 1, rowSpan: 2 },
            { row: 1, col: 2 },
            { row: 2, col: 2 },
        ],
    },
    {
        id: "three-by-three",
        name: "3x3 Grid",
        description:
            "Nine equal panels. Maximum density for monitoring dashboards with many widgets.",
        rows: 3,
        cols: 3,
        cells: [
            { key: "1.1" },
            { key: "1.2" },
            { key: "1.3" },
            { key: "2.1" },
            { key: "2.2" },
            { key: "2.3" },
            { key: "3.1" },
            { key: "3.2" },
            { key: "3.3" },
        ],
        previewCells: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 1, col: 3 },
            { row: 2, col: 1 },
            { row: 2, col: 2 },
            { row: 2, col: 3 },
            { row: 3, col: 1 },
            { row: 3, col: 2 },
            { row: 3, col: 3 },
        ],
    },
];

/**
 * Create a full layout object from a template definition.
 * The returned object is compatible with WorkspaceModel({ layout: [result] }).
 */
export function createLayoutFromTemplate(template, menuId = 1) {
    const grid = { rows: template.rows, cols: template.cols, gap: "gap-2" };

    for (const cell of template.cells) {
        grid[cell.key] = {
            component: null,
            hide: cell.hide || false,
            ...(cell.span ? { span: cell.span } : {}),
        };
    }

    return {
        id: 1,
        order: 1,
        component: "LayoutGridContainer",
        type: "grid",
        workspace: "layout",
        width: "w-full",
        height: "h-full",
        hasChildren: 1,
        scrollable: false,
        parent: 0,
        menuId,
        grid,
    };
}
