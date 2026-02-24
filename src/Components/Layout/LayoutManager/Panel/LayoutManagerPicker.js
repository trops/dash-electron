import React from "react";
import { Heading } from "@trops/dash-react";
import { layoutTemplates } from "../layoutTemplates";

/**
 * TemplateCard — renders a single template option with a mini CSS grid preview.
 */
const TemplateCard = ({ template, isSelected, onSelect, onConfirm }) => {
    return (
        <div
            className={`flex flex-col items-center cursor-pointer rounded-lg p-3 transition-all ${
                isSelected
                    ? "ring-2 ring-blue-500 bg-gray-700"
                    : "hover:bg-gray-750 hover:ring-1 hover:ring-gray-600"
            }`}
            onClick={() => onSelect(template)}
            onDoubleClick={() => onConfirm(template)}
        >
            {/* Mini grid preview */}
            <div
                className="aspect-video w-full rounded bg-gray-900 border border-gray-700 p-2 overflow-hidden"
                style={{
                    display: "grid",
                    gridTemplateRows: `repeat(${template.rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                    gap: "4px",
                }}
            >
                {template.previewCells.map((cell, i) => (
                    <div
                        key={i}
                        className={`rounded-sm overflow-hidden border ${
                            isSelected
                                ? "border-blue-500/50 bg-gray-800"
                                : "border-gray-600 bg-gray-800"
                        }`}
                        style={{
                            gridColumn: cell.colSpan
                                ? `span ${cell.colSpan}`
                                : undefined,
                            gridRow: cell.rowSpan
                                ? `span ${cell.rowSpan}`
                                : undefined,
                        }}
                    >
                        {/* Mini panel header bar */}
                        <div
                            className={`h-1.5 ${
                                isSelected ? "bg-blue-500/30" : "bg-gray-600"
                            }`}
                        />
                        {/* Mini content placeholder lines */}
                        <div className="p-1 space-y-0.5">
                            <div
                                className={`h-0.5 w-3/4 rounded-full ${
                                    isSelected
                                        ? "bg-blue-400/20"
                                        : "bg-gray-700"
                                }`}
                            />
                            <div
                                className={`h-0.5 w-1/2 rounded-full ${
                                    isSelected
                                        ? "bg-blue-400/20"
                                        : "bg-gray-700"
                                }`}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {/* Template name */}
            <span
                className={`text-sm mt-2 font-medium ${
                    isSelected ? "text-blue-300" : "text-gray-400"
                }`}
            >
                {template.name}
            </span>
        </div>
    );
};

/**
 * LayoutManagerPicker — visual template grid picker UI.
 *
 * Shows an info sidebar on the left and a grid of template cards on the right.
 */
export const LayoutManagerPicker = ({
    selectedTemplate,
    onSelect,
    onConfirm,
}) => {
    return (
        <div className="flex flex-row w-full h-full">
            {/* Left 1/3 — Info sidebar */}
            <div className="flex flex-col w-1/3 p-6 py-10 space-y-4 justify-start">
                <Heading
                    title="Choose a Layout"
                    padding={false}
                    textColor="text-gray-300"
                />
                {selectedTemplate ? (
                    <div className="space-y-2">
                        <p className="text-lg font-medium text-gray-200">
                            {selectedTemplate.name}
                        </p>
                        <p className="text-base font-normal text-gray-400">
                            {selectedTemplate.description}
                        </p>
                        <p className="text-sm text-gray-600 mt-4">
                            {selectedTemplate.rows} row
                            {selectedTemplate.rows !== 1 ? "s" : ""} x{" "}
                            {selectedTemplate.cols} column
                            {selectedTemplate.cols !== 1 ? "s" : ""}
                        </p>
                    </div>
                ) : (
                    <p className="text-base font-normal text-gray-400">
                        Select a layout template to get started with your new
                        dashboard.
                    </p>
                )}
                <p className="text-sm text-gray-600 mt-auto">
                    Double-click a template to create immediately.
                </p>
            </div>

            {/* Right 2/3 — Template grid */}
            <div className="flex flex-col w-2/3 p-6">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-fr overflow-y-auto">
                    {layoutTemplates.map((template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            isSelected={selectedTemplate?.id === template.id}
                            onSelect={onSelect}
                            onConfirm={onConfirm}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
