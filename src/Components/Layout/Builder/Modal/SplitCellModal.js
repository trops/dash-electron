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
 * SplitCellModal
 *
 * Modal for splitting a grid cell into multiple cells
 *
 * @param {Boolean} open - Whether the modal is open
 * @param {Function} setIsOpen - Function to close the modal
 * @param {String} cellNumber - Cell coordinate (e.g., "1.1")
 * @param {Object} gridContainer - The grid container item
 * @param {Function} onConfirm - Callback when split is confirmed (direction, count)
 */
export const SplitCellModal = ({
    open,
    setIsOpen,
    cellNumber = "1.1",
    gridContainer = null,
    onConfirm = null,
}) => {
    useContext(ThemeContext);

    const [direction, setDirection] = useState("horizontal");
    const [cellCount, setCellCount] = useState(2);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open === false) {
            // Reset state when modal closes
            setDirection("horizontal");
            setCellCount(2);
            setError(null);
        }
    }, [open]);

    const handleDirectionChange = (newDirection) => {
        setDirection(newDirection);
        setError(null);
    };

    const handleCellCountChange = (e) => {
        const count = parseInt(e.target.value, 10);
        if (count >= 2 && count <= 4) {
            setCellCount(count);
            setError(null);
        }
    };

    const handleConfirm = () => {
        if (!gridContainer) {
            setError("No grid container selected");
            return;
        }

        if (!cellNumber) {
            setError("No cell selected");
            return;
        }

        if (cellCount < 2 || cellCount > 4) {
            setError("Cell count must be between 2 and 4");
            return;
        }

        // Call the onConfirm callback with the selected options
        if (onConfirm) {
            onConfirm({
                cellNumber,
                direction,
                count: cellCount,
                gridContainer,
            });
        }

        // Close the modal
        setIsOpen(false);
    };

    const handleCancel = () => {
        setIsOpen(false);
    };

    const renderPreview = () => {
        const cells = [];

        if (direction === "horizontal") {
            // Show cells side by side
            for (let i = 0; i < cellCount; i++) {
                cells.push(
                    <div
                        key={i}
                        className="flex-1 border-2 border-dashed border-blue-500 rounded p-4 flex items-center justify-center bg-gray-800"
                    >
                        <span className="text-gray-400 text-sm">
                            Cell {i + 1}
                        </span>
                    </div>
                );
            }
            return <div className="flex space-x-2 h-32 w-full">{cells}</div>;
        } else {
            // Show cells stacked
            for (let i = 0; i < cellCount; i++) {
                cells.push(
                    <div
                        key={i}
                        className="flex-1 border-2 border-dashed border-blue-500 rounded p-4 flex items-center justify-center bg-gray-800"
                    >
                        <span className="text-gray-400 text-sm">
                            Cell {i + 1}
                        </span>
                    </div>
                );
            }
            return (
                <div className="flex flex-col space-y-2 h-64 w-full">
                    {cells}
                </div>
            );
        }
    };

    return (
        <Modal isOpen={open} setIsOpen={setIsOpen}>
            <Panel border={true} padding={true}>
                <Panel.Header border={true}>
                    <div className="flex flex-row justify-between items-center">
                        <Heading3>Split Cell {cellNumber}</Heading3>
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

                        {/* Direction selection */}
                        <div className="flex flex-col space-y-2">
                            <SubHeading3>Split Direction</SubHeading3>
                            <div className="flex space-x-4">
                                <Button
                                    onClick={() =>
                                        handleDirectionChange("horizontal")
                                    }
                                    backgroundColor={
                                        direction === "horizontal"
                                            ? "bg-blue-600"
                                            : "bg-gray-700"
                                    }
                                    hoverBackgroundColor="hover:bg-blue-500"
                                    className="flex-1"
                                >
                                    <div className="flex flex-col items-center space-y-1">
                                        <FontAwesomeIcon icon="grip-lines-vertical" />
                                        <span className="text-sm">
                                            Horizontal
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            (Left/Right)
                                        </span>
                                    </div>
                                </Button>
                                <Button
                                    onClick={() =>
                                        handleDirectionChange("vertical")
                                    }
                                    backgroundColor={
                                        direction === "vertical"
                                            ? "bg-blue-600"
                                            : "bg-gray-700"
                                    }
                                    hoverBackgroundColor="hover:bg-blue-500"
                                    className="flex-1"
                                >
                                    <div className="flex flex-col items-center space-y-1">
                                        <FontAwesomeIcon icon="grip-lines" />
                                        <span className="text-sm">
                                            Vertical
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            (Top/Bottom)
                                        </span>
                                    </div>
                                </Button>
                            </div>
                        </div>

                        {/* Cell count slider */}
                        <div className="flex flex-col space-y-2">
                            <SubHeading3>
                                Number of Cells: {cellCount}
                            </SubHeading3>
                            <input
                                type="range"
                                min="2"
                                max="4"
                                value={cellCount}
                                onChange={handleCellCountChange}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>2</span>
                                <span>3</span>
                                <span>4</span>
                            </div>
                        </div>

                        {/* Live preview */}
                        <div className="flex flex-col space-y-2">
                            <SubHeading3>Preview</SubHeading3>
                            <div className="bg-gray-900 rounded p-4">
                                {renderPreview()}
                            </div>
                            <Paragraph className="text-xs text-gray-400">
                                {direction === "horizontal"
                                    ? `This will split the cell into ${cellCount} columns`
                                    : `This will split the cell into ${cellCount} rows`}
                            </Paragraph>
                        </div>

                        {/* Widget placement info */}
                        {gridContainer?.grid?.[cellNumber]?.component && (
                            <div className="bg-yellow-900 border border-yellow-700 rounded p-3 text-yellow-200 text-sm">
                                <FontAwesomeIcon
                                    icon="exclamation-triangle"
                                    className="mr-2"
                                />
                                This cell contains a widget. The widget will be
                                removed during the split.
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
                            backgroundColor="bg-blue-600"
                            hoverBackgroundColor="hover:bg-blue-500"
                        >
                            <FontAwesomeIcon icon="check" className="mr-2" />
                            Split Cell
                        </Button>
                    </div>
                </Panel.Footer>
            </Panel>
        </Modal>
    );
};
