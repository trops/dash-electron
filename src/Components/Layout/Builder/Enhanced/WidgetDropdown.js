/**
 * WidgetDropdown
 *
 * Inline dropdown widget selector to replace the modal-based widget picker.
 * Features:
 * - Search/filter widgets
 * - Shows recent widgets
 * - Categorized by workspace type
 * - Keyboard navigation
 * - Positions inline (no modal interruption)
 */

import React, { useState, useRef, useEffect } from "react";
import { ComponentManager } from "../../../../ComponentManager";
import { Panel, InputText, Paragraph } from "@trops/dash-react";
import { WidgetIcon } from "./WidgetIcon";

export const WidgetDropdown = ({
    isOpen,
    onClose,
    onSelectWidget,
    workspaceType = null,
    position = "below", // "below" | "above" | "center"
}) => {
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    // Get available widgets from ComponentManager
    const allWidgets = ComponentManager.map();

    // DEBUG: Show what we have
    console.log(
        "[WidgetDropdown] All widgets from ComponentManager:",
        allWidgets
    );
    console.log("[WidgetDropdown] Widget keys:", Object.keys(allWidgets));

    // Filter widgets based on workspace compatibility and search
    const getFilteredWidgets = () => {
        let widgets = Object.keys(allWidgets)
            .map((key) => ({
                key,
                ...allWidgets[key],
            }))
            .filter((widget) => {
                // Only show widgets, not containers
                console.log(`[WidgetDropdown] Checking widget ${widget.key}:`, {
                    type: widget.type,
                    workspace: widget.workspace,
                });
                if (widget.type !== "widget") {
                    console.log(
                        `  ❌ Filtered out - type is "${widget.type}", not "widget"`
                    );
                    return false;
                }

                // Note: We intentionally don't filter by workspace type
                // This allows widgets to be added directly to containers
                // without requiring an intermediate workspace

                // Filter by search query
                if (search) {
                    const searchLower = search.toLowerCase();
                    return (
                        widget.name?.toLowerCase().includes(searchLower) ||
                        widget.key?.toLowerCase().includes(searchLower)
                    );
                }

                console.log(`  ✅ Passed all filters`);
                return true;
            });

        console.log(
            "[WidgetDropdown] Widgets after filtering:",
            widgets.map((w) => ({ key: w.key, type: w.type, name: w.name }))
        );
        return widgets;
    };

    const filteredWidgets = getFilteredWidgets();
    console.log(
        "[WidgetDropdown] Final filtered widgets count:",
        filteredWidgets.length
    );

    // Get recently used widgets from localStorage
    const getRecentWidgets = () => {
        try {
            const recent = JSON.parse(
                localStorage.getItem("recentWidgets") || "[]"
            );
            return recent
                .slice(0, 3)
                .map((key) => {
                    const widget = allWidgets[key];
                    if (!widget) return null; // Widget doesn't exist
                    return {
                        key, // Add key property
                        ...widget,
                    };
                })
                .filter((widget) => {
                    // Only keep valid widgets with required properties
                    return widget && widget.name && widget.type === "widget";
                });
        } catch {
            return [];
        }
    };

    const recentWidgets = getRecentWidgets();

    // Save to recent widgets
    const addToRecent = (widgetKey) => {
        try {
            const recent = JSON.parse(
                localStorage.getItem("recentWidgets") || "[]"
            );
            const updated = [
                widgetKey,
                ...recent.filter((k) => k !== widgetKey),
            ].slice(0, 10);
            localStorage.setItem("recentWidgets", JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save recent widget:", error);
        }
    };

    // Handle widget selection
    const handleSelectWidget = (widget) => {
        addToRecent(widget.key);
        onSelectWidget(widget);
        onClose();
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        Math.min(prev + 1, filteredWidgets.length - 1)
                    );
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.max(prev - 1, 0));
                    break;
                case "Enter":
                    e.preventDefault();
                    if (filteredWidgets[selectedIndex]) {
                        handleSelectWidget(filteredWidgets[selectedIndex]);
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    onClose();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, filteredWidgets, selectedIndex]);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () =>
                document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen, onClose]);

    if (!isOpen) {
        console.log("[WidgetDropdown] Not rendering - isOpen is false");
        return null;
    }

    console.log("[WidgetDropdown] Rendering dropdown", {
        isOpen,
        workspaceType,
        filteredWidgetsCount: filteredWidgets.length,
    });

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Dropdown */}
            <div
                ref={dropdownRef}
                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96"
            >
                <Panel
                    border={true}
                    padding={false}
                    backgroundColor="bg-gray-800"
                    borderColor="border-gray-700"
                    className="shadow-2xl"
                >
                    {/* Header */}
                    <Panel.Header
                        border={true}
                        borderColor="border-blue-600"
                        backgroundColor="bg-blue-600"
                        padding={true}
                        defaultPadding="px-4 py-3"
                    >
                        <h3 className="text-white font-semibold text-sm">
                            ✨ Add Widget
                        </h3>
                    </Panel.Header>

                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-700">
                        <InputText
                            ref={searchInputRef}
                            type="text"
                            placeholder="🔍 Search widgets..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setSelectedIndex(0);
                            }}
                            className="text-sm"
                        />
                    </div>

                    {/* Widget List */}
                    <Panel.Body padding={false}>
                        <div className="max-h-96 overflow-y-auto">
                            {/* Recent Widgets */}
                            {!search && recentWidgets.length > 0 && (
                                <div className="px-2 py-2">
                                    <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
                                        ⚡ Recent
                                    </div>
                                    {recentWidgets.map((widget) => (
                                        <WidgetItem
                                            key={widget.key}
                                            widget={widget}
                                            onClick={() =>
                                                handleSelectWidget(widget)
                                            }
                                            isSelected={false}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* All Widgets */}
                            {filteredWidgets.length > 0 ? (
                                <div className="px-2 py-2">
                                    {!search && (
                                        <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
                                            All Widgets
                                        </div>
                                    )}
                                    {filteredWidgets.map((widget, index) => (
                                        <WidgetItem
                                            key={widget.key}
                                            widget={widget}
                                            onClick={() =>
                                                handleSelectWidget(widget)
                                            }
                                            isSelected={index === selectedIndex}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-400">
                                    <div className="text-3xl mb-2">🔍</div>
                                    <Paragraph className="text-sm">
                                        No widgets found
                                    </Paragraph>
                                    <p className="text-xs mt-1 opacity-70">
                                        Try a different search term
                                    </p>
                                </div>
                            )}
                        </div>
                    </Panel.Body>

                    {/* Footer Tip */}
                    <Panel.Footer
                        border={true}
                        borderColor="border-gray-700"
                        padding={true}
                        defaultPadding="px-3 py-2"
                    >
                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>
                                💡{" "}
                                <kbd className="px-1 bg-gray-700 border border-gray-600 rounded text-gray-300">
                                    ↑
                                </kbd>
                                <kbd className="px-1 bg-gray-700 border border-gray-600 rounded text-gray-300 ml-1">
                                    ↓
                                </kbd>{" "}
                                to navigate
                            </span>
                            <span>
                                <kbd className="px-1 bg-gray-700 border border-gray-600 rounded text-gray-300">
                                    Enter
                                </kbd>{" "}
                                to select
                            </span>
                        </div>
                    </Panel.Footer>
                </Panel>
            </div>
        </>
    );
};

/**
 * WidgetItem - Individual widget in the dropdown list
 */
const WidgetItem = ({ widget, onClick, isSelected }) => {
    const getWidgetDescription = (widget) => {
        // Get description or show workspace type
        return widget.description || `${widget.workspace} widget`;
    };

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-2 py-2.5 rounded cursor-pointer transition-all
                ${
                    isSelected
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-700 text-gray-100"
                }
            `}
        >
            {/* Widget Icon */}
            <WidgetIcon icon={widget.icon} className="h-5 w-5 text-white/70" />

            {/* Widget Info */}
            <div className="flex-1 min-w-0 text-left">
                <div className="font-medium text-sm truncate">
                    {widget.name || widget.key}
                </div>
                <div
                    className={`text-xs truncate ${
                        isSelected ? "text-blue-100" : "text-gray-400"
                    }`}
                >
                    {getWidgetDescription(widget)}
                </div>
            </div>

            {/* Provider indicator */}
            {widget.providers && widget.providers.length > 0 && (
                <div
                    className={`flex-shrink-0 text-xs ${
                        isSelected ? "text-blue-200" : "text-gray-500"
                    }`}
                >
                    🔌
                </div>
            )}
        </button>
    );
};

export default WidgetDropdown;
