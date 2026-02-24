import React, { useState, useEffect, useContext } from "react";
import {
    Button,
    FontAwesomeIcon,
    Panel,
    Modal,
    Heading3,
    SubHeading3,
    Paragraph,
} from "@trops/dash-react";
import { ThemeContext } from "../../../../Context";

/**
 * MergeCellsModal
 *
 * Modal for merging multiple adjacent grid cells into one
 * Handles conflicts when merged cells contain multiple widgets
 *
 * @param {Boolean} open - Whether the modal is open
 * @param {Function} setIsOpen - Function to close the modal
 * @param {Array} cellNumbers - Array of cell coordinates to merge (e.g., ["1.1", "1.2"])
 * @param {Object} gridContainer - The grid container item
 * @param {Array} conflictingComponents - Array of component IDs in the cells being merged
 * @param {Function} onConfirm - Callback when merge is confirmed (keepComponent)
 */
export const MergeCellsModal = ({
    open,
    setIsOpen,
    cellNumbers = [],
    gridContainer = null,
    conflictingComponents = [],
    onConfirm = null,
}) => {
    useContext(ThemeContext);

    const [keepOption, setKeepOption] = useState("first");
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open === false) {
            // Reset state when modal closes
            setKeepOption("first");
            setError(null);
        } else {
            // Set default based on conflicting components
            if (conflictingComponents.length === 0) {
                setKeepOption("none");
            } else {
                setKeepOption("first");
            }
        }
    }, [open, conflictingComponents]);

    const handleConfirm = () => {
        if (!gridContainer) {
            setError("No grid container selected");
            return;
        }

        if (cellNumbers.length < 2) {
            setError("At least 2 cells must be selected to merge");
            return;
        }

        // Determine which component to keep (if any)
        let componentToKeep = null;
        if (keepOption === "first" && conflictingComponents.length > 0) {
            componentToKeep = conflictingComponents[0];
        } else if (keepOption === "last" && conflictingComponents.length > 0) {
            componentToKeep =
                conflictingComponents[conflictingComponents.length - 1];
        }
        // If keepOption === "none", componentToKeep remains null

        // Call the onConfirm callback
        if (onConfirm) {
            onConfirm({
                cellNumbers,
                gridContainer,
                keepComponent: componentToKeep,
            });
        }

        // Close the modal
        setIsOpen(false);
    };

    const handleCancel = () => {
        setIsOpen(false);
    };

    const renderMergePreview = () => {
        if (cellNumbers.length === 0) {
            return (
                <div className="text-gray-400 text-center p-8">
                    No cells selected
                </div>
            );
        }

        // Parse cell numbers to find bounds
        const cells = cellNumbers.map((cn) => {
            const [r, c] = cn.split(".").map(Number);
            return { row: r, col: c, number: cn };
        });

        const minRow = Math.min(...cells.map((c) => c.row));
        const maxRow = Math.max(...cells.map((c) => c.row));
        const minCol = Math.min(...cells.map((c) => c.col));
        const maxCol = Math.max(...cells.map((c) => c.col));

        const rowSpan = maxRow - minRow + 1;
        const colSpan = maxCol - minCol + 1;

        return (
            <div className="flex flex-col space-y-2">
                <div
                    className="border-2 border-dashed border-blue-500 rounded p-4 flex items-center justify-center bg-gray-800"
                    style={{ minHeight: `${rowSpan * 60}px` }}
                >
                    <div className="text-center">
                        <div className="text-gray-400 text-lg">Merged Cell</div>
                        <div className="text-gray-500 text-xs mt-1">
                            {rowSpan} row{rowSpan > 1 ? "s" : ""} × {colSpan}{" "}
                            column{colSpan > 1 ? "s" : ""}
                        </div>
                    </div>
                </div>
                <Paragraph className="text-xs text-gray-400 text-center">
                    Cells {cellNumbers.join(", ")} will be merged into a single
                    cell
                </Paragraph>
            </div>
        );
    };

    const hasConflict =
        conflictingComponents && conflictingComponents.length > 1;

    return (
        <Modal isOpen={open} setIsOpen={setIsOpen}>
            <Panel border={true} padding={true}>
                <Panel.Header border={true}>
                    <div className="flex flex-row justify-between items-center">
                        <Heading3>
                            Merge Cells
                            {cellNumbers.length > 0 && (
                                <span className="text-gray-400 text-base ml-2">
                                    ({cellNumbers.length} selected)
                                </span>
                            )}
                        </Heading3>
                        <Button
                            onClick={handleCancel}
                            backgroundColor="bg-transparent"
                            hoverBackgroundColor="hover:bg-gray-700"
                        >
                            <FontAwesomeIcon icon="times" />
                        </Button>
                    </div>
                </Panel.Header>

                <Panel.Body>
                    <div className="flex flex-col space-y-6">
                        {/* Error message */}
                        {error && (
                            <div className="bg-red-900 border border-red-700 rounded p-3 text-red-200">
                                {error}
                            </div>
                        )}

                        {/* Merge preview */}
                        <div className="flex flex-col space-y-2">
                            <SubHeading3>Preview</SubHeading3>
                            <div className="bg-gray-900 rounded p-4">
                                {renderMergePreview()}
                            </div>
                        </div>

                        {/* Widget conflict resolution */}
                        {hasConflict && (
                            <div className="flex flex-col space-y-4">
                                <div className="bg-yellow-900 border border-yellow-700 rounded p-3 text-yellow-200 text-sm">
                                    <FontAwesomeIcon
                                        icon="exclamation-triangle"
                                        className="mr-2"
                                    />
                                    <strong>Conflict Detected:</strong> Multiple
                                    cells contain widgets. Choose which widget
                                    to keep in the merged cell.
                                </div>

                                <div className="flex flex-col space-y-2">
                                    <SubHeading3>
                                        Widget Conflict Resolution
                                    </SubHeading3>

                                    <div className="flex flex-col space-y-2">
                                        {/* Keep first option */}
                                        <button
                                            onClick={() =>
                                                setKeepOption("first")
                                            }
                                            className={`flex items-center space-x-3 p-3 rounded border-2 transition-colors ${
                                                keepOption === "first"
                                                    ? "border-blue-500 bg-blue-900"
                                                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                    keepOption === "first"
                                                        ? "border-blue-500"
                                                        : "border-gray-600"
                                                }`}
                                            >
                                                {keepOption === "first" && (
                                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-gray-200">
                                                    Keep first widget
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Widget from cell{" "}
                                                    {cellNumbers[0]}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Keep last option */}
                                        <button
                                            onClick={() =>
                                                setKeepOption("last")
                                            }
                                            className={`flex items-center space-x-3 p-3 rounded border-2 transition-colors ${
                                                keepOption === "last"
                                                    ? "border-blue-500 bg-blue-900"
                                                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                    keepOption === "last"
                                                        ? "border-blue-500"
                                                        : "border-gray-600"
                                                }`}
                                            >
                                                {keepOption === "last" && (
                                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-gray-200">
                                                    Keep last widget
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Widget from cell{" "}
                                                    {
                                                        cellNumbers[
                                                            cellNumbers.length -
                                                                1
                                                        ]
                                                    }
                                                </div>
                                            </div>
                                        </button>

                                        {/* Remove all option */}
                                        <button
                                            onClick={() =>
                                                setKeepOption("none")
                                            }
                                            className={`flex items-center space-x-3 p-3 rounded border-2 transition-colors ${
                                                keepOption === "none"
                                                    ? "border-blue-500 bg-blue-900"
                                                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                    keepOption === "none"
                                                        ? "border-blue-500"
                                                        : "border-gray-600"
                                                }`}
                                            >
                                                {keepOption === "none" && (
                                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-gray-200">
                                                    Remove all widgets
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Merged cell will be empty
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* No conflict info */}
                        {!hasConflict && conflictingComponents.length === 1 && (
                            <div className="bg-blue-900 border border-blue-700 rounded p-3 text-blue-200 text-sm">
                                <FontAwesomeIcon
                                    icon="info-circle"
                                    className="mr-2"
                                />
                                One widget found. It will be kept in the merged
                                cell.
                            </div>
                        )}

                        {!hasConflict && conflictingComponents.length === 0 && (
                            <div className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-300 text-sm">
                                <FontAwesomeIcon
                                    icon="info-circle"
                                    className="mr-2"
                                />
                                No widgets found in selected cells. The merged
                                cell will be empty.
                            </div>
                        )}
                    </div>
                </Panel.Body>

                <Panel.Footer border={true}>
                    <div className="flex flex-row justify-end space-x-2">
                        <Button
                            onClick={handleCancel}
                            backgroundColor="bg-gray-700"
                            hoverBackgroundColor="hover:bg-gray-600"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            backgroundColor="bg-green-600"
                            hoverBackgroundColor="hover:bg-green-500"
                        >
                            <FontAwesomeIcon icon="check" className="mr-2" />
                            Merge Cells
                        </Button>
                    </div>
                </Panel.Footer>
            </Panel>
        </Modal>
    );
};
