/**
 * Validation utilities for grid-first dashboard architecture
 *
 * These functions enforce widget and grid placement rules to ensure
 * a consistent and predictable layout structure.
 */

/**
 * Validate that a widget can be placed in the target component
 *
 * Widget Placement Rules:
 * 1. Widgets can ONLY be placed in grid cells
 * 2. Widgets CANNOT be placed inside other widgets
 * 3. The target component must be a grid container
 *
 * @param {Object} targetComponent The component where the widget will be placed
 * @param {Object} widgetToPlace The widget being placed
 * @returns {Object} { valid: boolean, error: string | null }
 */
export const validateWidgetPlacement = (targetComponent, widgetToPlace) => {
    try {
        // Rule 1: Widget must be placed in a component
        if (!targetComponent) {
            return {
                valid: false,
                error: "No target component specified. Widgets must be placed in a grid cell.",
            };
        }

        // Rule 2: Target must be a grid container, not a widget
        if (targetComponent.type === "widget") {
            return {
                valid: false,
                error: "Cannot place widget inside another widget. Widgets can only be placed in grid cells.",
            };
        }

        // Rule 3: Target should have a grid property (or be a valid container type)
        const isGridContainer =
            targetComponent.grid !== null && targetComponent.grid !== undefined;
        const isValidContainerType = ["grid", "layout", "workspace"].includes(
            targetComponent.type
        );

        if (!isGridContainer && !isValidContainerType) {
            return {
                valid: false,
                error: "Target component is not a valid container. Widgets must be placed in grid cells.",
            };
        }

        // Rule 4: Widget must have correct type
        if (widgetToPlace.type !== "widget") {
            return {
                valid: false,
                error: `Component type "${widgetToPlace.type}" is not a widget. Only widgets can be validated for widget placement.`,
            };
        }

        // Rule 5: Widget cannot have children
        if (widgetToPlace.canHaveChildren === true) {
            return {
                valid: false,
                error: "Invalid widget configuration. Widgets cannot have children.",
            };
        }

        // All validation passed
        return {
            valid: true,
            error: null,
        };
    } catch (e) {
        return {
            valid: false,
            error: `Validation error: ${e.message}`,
        };
    }
};

/**
 * Validate that a grid container can be placed in the target component
 *
 * Grid Placement Rules:
 * 1. Grids CAN be placed inside grid cells (nested grids allowed)
 * 2. Grids CANNOT be placed inside widgets
 * 3. The target component must be a grid container
 *
 * @param {Object} targetComponent The component where the grid will be placed
 * @param {Object} gridToPlace The grid container being placed
 * @returns {Object} { valid: boolean, error: string | null }
 */
export const validateGridPlacement = (targetComponent, gridToPlace) => {
    try {
        // Rule 1: Grid must be placed in a component
        if (!targetComponent) {
            return {
                valid: false,
                error: "No target component specified. Grids must be placed in a grid cell.",
            };
        }

        // Rule 2: Target cannot be a widget
        if (targetComponent.type === "widget") {
            return {
                valid: false,
                error: "Cannot place grid inside a widget. Grids can only be placed in grid cells.",
            };
        }

        // Rule 3: Grid being placed must be a valid grid type
        const isValidGridType = ["grid", "layout", "workspace"].includes(
            gridToPlace.type
        );
        if (!isValidGridType) {
            return {
                valid: false,
                error: `Component type "${gridToPlace.type}" is not a valid grid container type.`,
            };
        }

        // Rule 4: Grid should have grid property or be a container type
        const hasGridProperty =
            gridToPlace.grid !== null && gridToPlace.grid !== undefined;
        const isContainerComponent = [
            "LayoutGridContainer",
            "Container",
        ].includes(gridToPlace.component);

        if (!hasGridProperty && !isContainerComponent) {
            return {
                valid: false,
                error: "Grid component does not have a grid property or valid component type.",
            };
        }

        // All validation passed
        return {
            valid: true,
            error: null,
        };
    } catch (e) {
        return {
            valid: false,
            error: `Validation error: ${e.message}`,
        };
    }
};

/**
 * Validate grid cell coordinates
 *
 * @param {String} cellNumber Cell coordinate (e.g., "1.1", "2.3")
 * @param {Object} grid Grid object with rows and cols
 * @returns {Object} { valid: boolean, error: string | null, row: number, col: number }
 */
export const validateGridCell = (cellNumber, grid) => {
    try {
        if (!cellNumber || typeof cellNumber !== "string") {
            return {
                valid: false,
                error: "Cell number must be a string in format 'row.col'",
                row: null,
                col: null,
            };
        }

        const parts = cellNumber.split(".");
        if (parts.length !== 2) {
            return {
                valid: false,
                error: "Cell number must be in format 'row.col' (e.g., '1.1')",
                row: null,
                col: null,
            };
        }

        const row = parseInt(parts[0], 10);
        const col = parseInt(parts[1], 10);

        if (isNaN(row) || isNaN(col)) {
            return {
                valid: false,
                error: "Row and column must be valid numbers",
                row: null,
                col: null,
            };
        }

        if (!grid || !grid.rows || !grid.cols) {
            return {
                valid: false,
                error: "Grid must have rows and cols properties",
                row,
                col,
            };
        }

        if (row < 1 || row > grid.rows) {
            return {
                valid: false,
                error: `Row ${row} is out of bounds (grid has ${grid.rows} rows)`,
                row,
                col,
            };
        }

        if (col < 1 || col > grid.cols) {
            return {
                valid: false,
                error: `Column ${col} is out of bounds (grid has ${grid.cols} columns)`,
                row,
                col,
            };
        }

        return {
            valid: true,
            error: null,
            row,
            col,
        };
    } catch (e) {
        return {
            valid: false,
            error: `Validation error: ${e.message}`,
            row: null,
            col: null,
        };
    }
};

/**
 * Validate that cells can be merged
 *
 * Merge Requirements:
 * 1. All cells must exist in the grid
 * 2. Cells must be adjacent
 * 3. Cells must form a rectangular shape
 *
 * @param {Array} cellNumbers Array of cell coordinates (e.g., ["1.1", "1.2", "2.1", "2.2"])
 * @param {Object} grid Grid object with rows and cols
 * @returns {Object} { valid: boolean, error: string | null, bounds: object | null }
 */
export const validateCellMerge = (cellNumbers, grid) => {
    try {
        if (!Array.isArray(cellNumbers) || cellNumbers.length < 2) {
            return {
                valid: false,
                error: "Must provide at least 2 cells to merge",
                bounds: null,
            };
        }

        // Validate each cell
        const cells = [];
        for (const cellNumber of cellNumbers) {
            const validation = validateGridCell(cellNumber, grid);
            if (!validation.valid) {
                return {
                    valid: false,
                    error: validation.error,
                    bounds: null,
                };
            }
            cells.push({
                row: validation.row,
                col: validation.col,
                number: cellNumber,
            });
        }

        // Find bounding box
        const minRow = Math.min(...cells.map((c) => c.row));
        const maxRow = Math.max(...cells.map((c) => c.row));
        const minCol = Math.min(...cells.map((c) => c.col));
        const maxCol = Math.max(...cells.map((c) => c.col));

        // Check if cells form a complete rectangle
        const expectedCellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (cells.length !== expectedCellCount) {
            return {
                valid: false,
                error: "Cells must form a rectangular shape to be merged",
                bounds: { minRow, maxRow, minCol, maxCol },
            };
        }

        // Check if all cells in the rectangle are present
        const cellSet = new Set(cellNumbers);
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cellNumber = `${r}.${c}`;
                if (!cellSet.has(cellNumber)) {
                    return {
                        valid: false,
                        error: `Missing cell ${cellNumber} in merge selection. All cells in the rectangle must be selected.`,
                        bounds: { minRow, maxRow, minCol, maxCol },
                    };
                }
            }
        }

        return {
            valid: true,
            error: null,
            bounds: { minRow, maxRow, minCol, maxCol },
        };
    } catch (e) {
        return {
            valid: false,
            error: `Validation error: ${e.message}`,
            bounds: null,
        };
    }
};

/**
 * Check if a component can have children
 *
 * @param {Object} component Component to check
 * @returns {Boolean}
 */
export const canHaveChildren = (component) => {
    if (!component) return false;

    // Widgets cannot have children
    if (component.type === "widget") return false;

    // Check canHaveChildren property
    if ("canHaveChildren" in component) {
        return component.canHaveChildren === true;
    }

    // Grid and layout containers can have children
    return ["grid", "layout", "workspace"].includes(component.type);
};
