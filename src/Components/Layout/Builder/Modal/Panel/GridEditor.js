import React, { useState } from "react";
import { ButtonIcon } from "@trops/dash-react";
import clsx from "clsx";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const defaultGrid = {
    rows: 1,
    cols: 1,
    "0.0": { component: null, rowSpan: 1, colSpan: 1 },
};

const ItemType = "CELL";

export default function GridEditor({ onUpdate, initialGrid = defaultGrid }) {
    const [grid, setGrid] = useState(initialGrid || defaultGrid);

    const addRow = () => {
        const newRow = grid.rows;
        const newGrid = { ...grid, rows: grid.rows + 1 };
        for (let col = 0; col < grid.cols; col++) {
            newGrid[`${newRow}.${col}`] = {
                component: null,
                rowSpan: 1,
                colSpan: 1,
            };
        }
        // now we have to sort the grid
        saveGridChanges(newGrid);
    };

    const addColumn = () => {
        const newCol = grid.cols;
        const newGrid = { ...grid, cols: grid.cols + 1 };
        for (let row = 0; row < grid.rows; row++) {
            newGrid[`${row}.${newCol}`] = {
                component: null,
                rowSpan: 1,
                colSpan: 1,
            };
        }

        // now we have to sort the grid
        saveGridChanges(newGrid);
    };

    const mergeRight = (row, col) => {
        const currentKey = `${row}.${col}`;
        let nextKey = `${row}.${col + 1}`;
        // we have to make sure that the key exists, in case something had skipped..
        if (!grid[nextKey]) {
            Object.keys(grid)
                .filter((v) => v !== "rows" && v !== "cols")
                .forEach((k) => {
                    if (!grid[nextKey]) {
                        const parts = k.split(".");
                        const tempRow = parseInt(parts[0]);
                        const tempCol = parseInt(parts[1]);
                        if (
                            tempRow === parseInt(row) &&
                            tempCol > parseInt(col)
                        ) {
                            nextKey = `${tempRow}.${tempCol}`;
                        }
                    }
                });
        }

        if (grid[nextKey]) {
            const newGrid = { ...grid };
            newGrid[currentKey] = {
                ...newGrid[currentKey],
                colSpan: newGrid[currentKey].colSpan + 1,
            };
            delete newGrid[nextKey];

            // now we have to sort the grid
            saveGridChanges(newGrid);
        }
    };

    const mergeDown = (row, col) => {
        const currentKey = `${row}.${col}`;
        const belowKey = `${row + 1}.${col}`;
        if (grid[belowKey]) {
            const newGrid = { ...grid };
            newGrid[currentKey] = {
                ...newGrid[currentKey],
                rowSpan: newGrid[currentKey].rowSpan + 1,
            };
            delete newGrid[belowKey];
            // now we have to sort the grid
            saveGridChanges(newGrid);
        }
    };

    /**
     * split the cell into 2 cells
     * @param {Number} row the row index number
     * @param {Number} col the column index number
     */
    const splitCell = (row, col) => {
        const key = `${row}.${col}`;
        const cell = grid[key];
        const newGrid = { ...grid };

        // we have to check the colspan, and since the colspan is greater than 1
        // Only handle horizontal split if colSpan > 1
        if (cell.colSpan > 1) {
            // Shift all cells in the same row with col > current col to the right by 1
            const maxCols = Object.keys(grid)
                .filter((k) => k.startsWith(`${row}.`))
                .map((k) => parseInt(k.split(".")[1], 10));
            const maxCol = Math.max(...maxCols);

            for (let c = maxCol; c > col; c--) {
                const oldKey = `${row}.${c}`;
                const newKey = `${row}.${c + 1}`;
                if (newGrid[oldKey]) {
                    newGrid[newKey] = { ...newGrid[oldKey] };
                    delete newGrid[oldKey];
                }
            }

            // Update the original cell's colSpan
            newGrid[key] = { ...cell, colSpan: cell.colSpan - 1 };

            // Insert the new cell at col + 1
            newGrid[`${row}.${col + 1}`] = {
                component: null,
                rowSpan: 1,
                colSpan: 1,
            };
        }

        if (cell.rowSpan > 1) {
            newGrid[key] = { ...newGrid[key], rowSpan: cell.rowSpan - 1 };
            newGrid[`${row + 1}.${col}`] = {
                component: null,
                rowSpan: 1,
                colSpan: 1,
            };
        }

        // now we have to sort the grid
        saveGridChanges(newGrid);
    };

    function sortObjectByKeys(obj) {
        const sortedKeys = Object.keys(obj).sort();
        const sortedObj = {};
        for (const key of sortedKeys) {
            sortedObj[key] = obj[key];
        }
        return sortedObj;
    }

    function resequenceGridKeys(grid) {
        const { rows, cols, ...cells } = grid;
        const newGrid = { rows, cols };
        const rowsMap = {};

        // Group cells by row
        Object.keys(cells).forEach((key) => {
            const [row, col] = key.split(".").map(Number);
            if (!rowsMap[row]) rowsMap[row] = [];
            rowsMap[row].push({ oldCol: col, key, cell: cells[key] });
        });

        // For each row, sort columns and reassign sequential col indices
        Object.keys(rowsMap).forEach((row) => {
            const sortedCells = rowsMap[row].sort(
                (a, b) => a.oldCol - b.oldCol
            );
            let colIndex = 0;
            sortedCells.forEach((item, idx) => {
                const isLast = idx === sortedCells.length - 1;
                const newKey = `${row}.${colIndex}`;
                // If this is the last cell in the row, expand its colSpan to fill the row
                if (isLast) {
                    item.cell.colSpan = cols - colIndex;
                }
                newGrid[newKey] = item.cell;
                colIndex += item.cell.colSpan || 1;
            });
        });

        // get a count of the rows and columns based on the new keys
        const newRows = rows;
        const newCols = cols;
        newGrid.rows = newRows;
        newGrid.cols = newCols;

        // Ensure colSpan and rowSpan are valid for each cell and expand to fill new cols/rows
        Object.keys(newGrid).forEach((key) => {
            if (key === "rows" || key === "cols") return;
            const [row, col] = key.split(".").map(Number);
            const cell = newGrid[key];

            // Clamp colSpan to not exceed columns remaining in the row
            const maxColSpan = newCols - col;
            if (cell.colSpan > maxColSpan) {
                cell.colSpan = maxColSpan;
            }
            // Clamp rowSpan to not exceed rows remaining below
            const maxRowSpan = newRows - row;
            if (cell.rowSpan > maxRowSpan) {
                cell.rowSpan = maxRowSpan;
            }
            newGrid[key] = cell;
        });

        // Remove any keys that are not in the new grid
        Object.keys(newGrid).forEach((key) => {
            if (key !== "rows" && key !== "cols" && !newGrid[key]) {
                delete newGrid[key];
            }
        });

        return newGrid;
    }

    /**
     * Move the cell from one position to another swapping their contents
     * @param {*} from
     * @param {*} to
     * @returns
     */
    const moveCell = (from, to) => {
        const fromKey = `${from.row}.${from.col}`;
        const toKey = `${to.row}.${to.col}`;
        if (fromKey === toKey) return;
        const newGrid = { ...grid };

        // Swap the cells
        const temp = newGrid[fromKey];
        newGrid[fromKey] = newGrid[toKey];
        newGrid[toKey] = temp;

        // now we have to sort the grid
        saveGridChanges(newGrid);
    };

    function saveGridChanges(grid) {
        // now we have to sort the grid
        const sortedGrid = sortObjectByKeys(grid);
        // resequence the keys to ensure they are in order
        // this will also ensure that the row and column counts are correct
        // and that the colSpan and rowSpan are valid
        // this will also ensure that the colSpan and rowSpan are valid
        // and that the keys are in the correct order
        const sequencedGrid = resequenceGridKeys(sortedGrid);

        // set the grid state with the sequenced grid
        setGrid(sequencedGrid);
        onUpdate(sequencedGrid);
        // console.log("Grid updated:", sequencedGrid);
    }

    function resetGridLayout() {
        const newGrid = { ...defaultGrid };
        setGrid(newGrid);
        onUpdate(newGrid);
    }

    const Cell = ({ row, col }) => {
        const key = `${row}.${col}`;
        const cell = grid[key];

        const [{ isDragging }, drag] = useDrag({
            type: ItemType,
            item: { row, col },
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        });

        const [, drop] = useDrop({
            accept: ItemType,
            drop: (item) => moveCell(item, { row, col }),
        });

        if (!cell) return null;

        // Calculate Tailwind width class based on colSpan and total columns
        let widthClass = "w-full";
        if (cell.colSpan && grid.cols && cell.colSpan < grid.cols) {
            widthClass = `w-${cell.colSpan}/${grid.cols}`;
        }

        return (
            <div
                ref={(node) => drag(drop(node))}
                className={clsx(
                    "flex-col p-2 bg-gray-800 h-full rounded",
                    isDragging && "opacity-50",
                    widthClass
                )}
                style={
                    {
                        // Optionally, you can still use flex for fallback or rowSpan for height
                        // minHeight: `${cell.rowSpan * 40}px`,
                    }
                }
            >
                <div className="text-sm flex flex-row space-x-2 w-full justify-between items-center">
                    {/* <div className="flex nowrap">Colspan: {cell.colSpan} Rowspan: {cell.rowSpan}</div> */}
                    {/* <div className="flex flex-row space-x-1 justify-end">
            <ButtonIcon icon="arrow-right" title="Merge" size="sm" onClick={() => mergeRight(row, col)} />
            <ButtonIcon icon="arrow-down" title="down" size="sm" onClick={() => mergeDown(row, col)} />
            <ButtonIcon
                icon="plus"
                title="split"
                size="sm"
                variant="secondary"
                onClick={() => splitCell(row, col)}
            />
            </div> */}
                </div>
                <div className="flex flex-col w-full h-full items-center justify-center font-bold text-lg text-gray-500">
                    {key}
                    <div className="flex flex-row space-x-1 justify-end">
                        {hasCellToTheRight(row, col) && (
                            <ButtonIcon
                                icon="arrow-right-to-bracket"
                                title="Merge"
                                size="sm"
                                onClick={() => mergeRight(row, col)}
                            />
                        )}
                        {hasCellBelow(row, col) && (
                            <ButtonIcon
                                icon="arrow-down"
                                title="down"
                                size="sm"
                                onClick={() => mergeDown(row, col)}
                            />
                        )}
                        {cell.colSpan > 1 && (
                            <ButtonIcon
                                icon="arrow-right-from-bracket"
                                title="split"
                                size="sm"
                                variant="secondary"
                                onClick={() => splitCell(row, col)}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    function hasCellToTheRight(row, col) {
        // Find the next cell in the same row with a higher column index
        const candidates = Object.keys(grid).filter((key) => {
            if (key === "rows" || key === "cols") return false;
            const [r, c] = key.split(".").map(Number);
            return r === row && c > col;
        });
        return candidates.length > 0;
    }

    function hasCellBelow(row, col) {
        // Find the next cell in the same column with a higher row index
        const candidates = Object.keys(grid).filter((key) => {
            if (key === "rows" || key === "cols") return false;
            const [r, c] = key.split(".").map(Number);
            return c === col && r > row;
        });
        return candidates.length > 0;
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="flex flex-col p-4 h-full w-full">
                <div className="flex justify-between items-center py-2">
                    <div className="text-lg font-bold">
                        Rows {grid.rows} Columns {grid.cols}
                    </div>
                    <div className="flex space-x-2">
                        <ButtonIcon
                            icon="plus"
                            text="Add Row"
                            onClick={addRow}
                        />
                        <ButtonIcon
                            icon="plus"
                            text="Add Column"
                            onClick={addColumn}
                        />
                        <ButtonIcon
                            icon="plus"
                            text="Reset Grid"
                            onClick={resetGridLayout}
                        />
                    </div>
                </div>
                {/* <div className="text-xs"><pre>{JSON.stringify(grid, null, 2)}</pre></div> */}
                <div
                    className={`grid gap-4 w-full bg-gray-700 h-full p-4 rounded`}
                >
                    {[...Array(grid.rows)].map((_, row) => (
                        <div
                            key={row}
                            className="flex bg-gray-700 h-full w-full justify-between items-center space-x-4"
                        >
                            {[...Array(grid.cols)].map((_, col) => (
                                <Cell
                                    key={`${row}.${col}`}
                                    row={row}
                                    col={col}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </DndProvider>
    );
}
