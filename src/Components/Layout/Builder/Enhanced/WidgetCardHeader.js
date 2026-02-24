/**
 * WidgetCardHeader
 *
 * Enhanced card header for widgets in the layout builder.
 * Features:
 * - Widget name and icon
 * - Provider selectors (inline)
 * - Action buttons (configure, duplicate, delete)
 * - More menu (three-dot)
 */

import React, { useState, useRef, useEffect } from "react";
import {
    ButtonIcon2,
    DropdownPanel,
    FontAwesomeIcon,
    MenuItem2,
} from "@trops/dash-react";
import { ProviderBadge } from "./ProviderBadge";
import { WidgetIcon } from "./WidgetIcon";
import { ComponentManager } from "../../../../ComponentManager";

export const WidgetCardHeader = ({
    item, // Widget/component item
    widget, // Alias for item
    cellNumber = null, // Shown as label when no widget
    providers = [],
    selectedProviders = {},
    onProviderChange,
    onConfigure,
    onDelete, // Handler for delete
    onRemove, // Alias for onDelete
    onSplitHorizontal = null,
    onSplitVertical = null,
    onMoreOptions,
    // Merge selection props
    isSelected = false,
    isSelectable = true,
    onToggleSelect = null,
}) => {
    const [showProviderDropdown, setShowProviderDropdown] = useState(null);
    const [isCompact, setIsCompact] = useState(false);
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const headerRef = useRef(null);

    // ResizeObserver to detect compact mode
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setIsCompact(entry.contentRect.width < 320);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Support both 'item' and 'widget' props
    const widgetItem = item || widget;
    // Support both 'onDelete' and 'onRemove' props
    const handleDelete = onDelete || onRemove;

    // Get widget configuration from ComponentManager
    const widgetConfig = ComponentManager.config(
        widgetItem?.component,
        widgetItem
    );

    console.log("[WidgetCardHeader] Debug:", {
        component: widgetItem?.component,
        widgetConfig,
        configProviders: widgetConfig?.providers,
        itemProviders: widgetItem?.providers,
    });

    // Detect missing widgets (component key exists but not in ComponentManager)
    const isWidgetMissing = widgetItem?.component && !widgetConfig;

    // Get widget name from config or item
    const widgetName =
        widgetConfig?.name || widgetItem?.name || widgetItem?.component;

    // Get provider requirements from widget config (not from item directly)
    const getProviderRequirements = () => {
        // Check config first (correct source)
        if (widgetConfig?.providers) {
            return Array.isArray(widgetConfig.providers)
                ? widgetConfig.providers
                : [];
        }
        // Fallback to item (legacy)
        if (widgetItem?.providers) {
            return Array.isArray(widgetItem.providers)
                ? widgetItem.providers
                : [];
        }
        return [];
    };

    const providerRequirements = getProviderRequirements();

    // Get providers filtered by type
    const getProvidersForType = (type) => {
        return providers.filter((p) => p.type === type);
    };

    // Check if provider is configured
    const isProviderConfigured = (providerType) => {
        return selectedProviders[providerType] != null;
    };

    // Get provider name
    const getProviderName = (providerType) => {
        const providerId = selectedProviders[providerType];
        if (!providerId) return null;

        const provider = providers.find((p) => p.id === providerId);
        return provider?.name;
    };

    // Handle provider selection
    const handleProviderSelect = (providerType, providerId) => {
        console.log("[WidgetCardHeader] handleProviderSelect called:", {
            providerType,
            providerId,
        });

        if (providerId === "_new") {
            // Trigger provider creation flow
            console.log(
                "[WidgetCardHeader] Creating new provider, calling onProviderChange with isCreateNew=true"
            );
            onProviderChange(providerType, null, true); // true = create new
        } else {
            console.log(
                "[WidgetCardHeader] Selecting existing provider:",
                providerId
            );
            onProviderChange(providerType, providerId);
        }
        setShowProviderDropdown(null);
    };

    // Build overflow actions for compact mode
    const overflowActions = [];
    if (onConfigure) {
        overflowActions.push({
            icon: "cog",
            label: "Configure",
            onClick: () => {
                onConfigure(widgetItem);
                setShowOverflowMenu(false);
            },
        });
    }
    if (onSplitHorizontal) {
        overflowActions.push({
            icon: "arrows-left-right",
            label: "Split Horiz",
            onClick: () => {
                onSplitHorizontal();
                setShowOverflowMenu(false);
            },
        });
    }
    if (onSplitVertical) {
        overflowActions.push({
            icon: "arrows-up-down",
            label: "Split Vert",
            onClick: () => {
                onSplitVertical();
                setShowOverflowMenu(false);
            },
        });
    }
    if (handleDelete) {
        overflowActions.push({
            icon: "trash",
            label: "Remove",
            onClick: () => {
                handleDelete(widgetItem);
                setShowOverflowMenu(false);
            },
        });
    }
    if (onMoreOptions) {
        overflowActions.push({
            icon: "ellipsis-vertical",
            label: "More Options",
            onClick: () => {
                onMoreOptions(widget);
                setShowOverflowMenu(false);
            },
        });
    }

    return (
        <div
            ref={headerRef}
            className={`flex items-center gap-3 px-3 py-2.5 bg-transparent border-b border-gray-700 ${
                isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
            }`}
        >
            {/* Cell selection checkbox */}
            {onToggleSelect && (
                <button
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected
                            ? "bg-blue-500 border-blue-500 text-white"
                            : isSelectable
                            ? "bg-gray-800/80 border-blue-400 animate-pulse"
                            : "bg-gray-800/80 border-gray-500 opacity-30 cursor-not-allowed"
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected || isSelectable) {
                            onToggleSelect();
                        }
                    }}
                    title={
                        isSelected
                            ? "Deselect cell"
                            : isSelectable
                            ? "Select cell for merge"
                            : "Not adjacent to selection"
                    }
                >
                    {isSelected && (
                        <FontAwesomeIcon icon="check" className="text-xs" />
                    )}
                </button>
            )}

            {/* Widget Icon & Name */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <WidgetIcon
                    icon={
                        isWidgetMissing
                            ? "triangle-exclamation"
                            : widgetConfig?.icon
                    }
                    className={`h-4 w-4 flex-shrink-0 ${
                        isWidgetMissing ? "text-amber-500" : "text-white/60"
                    }`}
                />
                <span className="font-medium text-sm text-gray-100 truncate">
                    {widgetName || cellNumber || "Empty"}
                    {isWidgetMissing && (
                        <span className="text-amber-500/70 font-normal ml-1">
                            (not found)
                        </span>
                    )}
                </span>
            </div>

            {/* Provider Badges/Selectors */}
            {providerRequirements.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                    {providerRequirements.map((providerReq) => {
                        const providerType = providerReq.type;
                        const isConfigured = isProviderConfigured(providerType);
                        const providerName = getProviderName(providerType);
                        const availableProviders =
                            getProvidersForType(providerType);
                        const selectedProviderId =
                            selectedProviders[providerType];

                        return (
                            <div key={providerType} className="relative">
                                {/* Provider Badge (always visible) */}
                                <ProviderBadge
                                    providerType={providerType}
                                    providerId={selectedProviderId}
                                    providerName={providerName}
                                    isConfigured={isConfigured}
                                    isRequired={providerReq.required}
                                    onClick={() => {
                                        setShowOverflowMenu(false);
                                        setShowProviderDropdown(
                                            showProviderDropdown ===
                                                providerType
                                                ? null
                                                : providerType
                                        );
                                    }}
                                />

                                {/* Provider Dropdown (appears on click) */}
                                <DropdownPanel
                                    isOpen={
                                        showProviderDropdown === providerType
                                    }
                                    onClose={() =>
                                        setShowProviderDropdown(null)
                                    }
                                    position="absolute top-full right-0 mt-1"
                                    portal={true}
                                    direction="right"
                                >
                                    {availableProviders.length > 0 ? (
                                        <>
                                            <DropdownPanel.Header>
                                                Select {providerType}
                                            </DropdownPanel.Header>
                                            {availableProviders.map(
                                                (provider) => (
                                                    <MenuItem2
                                                        key={provider.id}
                                                        onClick={() =>
                                                            handleProviderSelect(
                                                                providerType,
                                                                provider.id
                                                            )
                                                        }
                                                        selected={
                                                            provider.id ===
                                                            selectedProviderId
                                                        }
                                                    >
                                                        <div>
                                                            <div className="font-medium">
                                                                {provider.name}
                                                            </div>
                                                            {provider.description && (
                                                                <div className="text-xs opacity-60 mt-0.5">
                                                                    {
                                                                        provider.description
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </MenuItem2>
                                                )
                                            )}
                                            <DropdownPanel.Divider />
                                        </>
                                    ) : (
                                        <div className="px-3 py-2 text-xs opacity-50 italic">
                                            No {providerType} providers
                                            configured
                                        </div>
                                    )}

                                    {/* Create new provider */}
                                    <MenuItem2
                                        onClick={() => {
                                            console.log(
                                                "[WidgetCardHeader] Create new provider button clicked for:",
                                                providerType
                                            );
                                            handleProviderSelect(
                                                providerType,
                                                "_new"
                                            );
                                        }}
                                    >
                                        <span className="text-blue-400">
                                            + Create New {providerType}
                                        </span>
                                    </MenuItem2>
                                </DropdownPanel>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
                {!isCompact ? (
                    <>
                        {onConfigure && (
                            <ButtonIcon2
                                icon="cog"
                                onClick={() => onConfigure(widgetItem)}
                                title="Configure widget"
                                theme={false}
                            />
                        )}

                        {onSplitHorizontal && (
                            <ButtonIcon2
                                icon="arrows-left-right"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSplitHorizontal();
                                }}
                                title="Split horizontally (left/right)"
                                theme={false}
                            />
                        )}

                        {onSplitVertical && (
                            <ButtonIcon2
                                icon="arrows-up-down"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSplitVertical();
                                }}
                                title="Split vertically (top/bottom)"
                                theme={false}
                            />
                        )}

                        {handleDelete && (
                            <ButtonIcon2
                                icon="trash"
                                onClick={() => handleDelete(widgetItem)}
                                title="Remove widget"
                                theme={false}
                            />
                        )}

                        {onMoreOptions && (
                            <ButtonIcon2
                                icon="ellipsis-vertical"
                                onClick={() => onMoreOptions(widget)}
                                title="More options"
                                theme={false}
                            />
                        )}
                    </>
                ) : overflowActions.length > 0 ? (
                    <div className="relative">
                        <ButtonIcon2
                            icon="chevron-down"
                            onClick={() => {
                                setShowProviderDropdown(null);
                                setShowOverflowMenu(!showOverflowMenu);
                            }}
                            title="Actions"
                            theme={false}
                        />
                        <DropdownPanel
                            isOpen={showOverflowMenu}
                            onClose={() => setShowOverflowMenu(false)}
                            position="absolute top-full right-0 mt-1"
                            portal={true}
                            align="right"
                        >
                            <DropdownPanel.Header>Actions</DropdownPanel.Header>
                            {overflowActions.map((action) => (
                                <MenuItem2
                                    key={action.label}
                                    onClick={action.onClick}
                                >
                                    <FontAwesomeIcon
                                        icon={action.icon}
                                        className="w-4 text-center opacity-60"
                                    />
                                    <span>{action.label}</span>
                                </MenuItem2>
                            ))}
                        </DropdownPanel>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default WidgetCardHeader;
