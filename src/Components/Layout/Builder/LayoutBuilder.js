import React, { useContext, useEffect, useState } from "react";
import { AppContext, DashboardContext, AppThemeScope } from "../../../Context";
import {
    addItemToItemLayout,
    changeDirectionForLayoutItem,
    getNextHighestItemInLayout,
    getNextLowestItemInLayout,
    updateLayoutItem,
    updateParentForItem,
} from "../../../utils/layout";
import { deepCopy } from "@trops/dash-react";
import { LayoutContainer } from "../../../Components/Layout";
import { LayoutDragBuilder, LayoutDragBuilderEdit } from "./";

import { LayoutBuilderAddItemModal, LayoutBuilderConfigModal } from "./Modal";
import { EnhancedWidgetDropdown } from "./Enhanced";
import {
    getComponentInLayout,
    getParentWorkspaceForItem,
    isContainer,
    isWidget,
    isWorkspace,
} from "../../../utils/layout";
import { DashboardModel, LayoutModel } from "../../../Models";
import { ComponentManager } from "../../../ComponentManager";
import { ProviderSelector } from "../../Provider/ProviderSelector";
import { McpServerPicker } from "../../Provider/McpServerPicker";

// import LayoutBuilderEditItemModal from "./Modal/LayoutBuilderEditItemModal";
// import LayoutBuilderEventModal from "./Modal/LayoutBuilderEventModal";
// import LayoutBuilderConfigModal from "./Modal/LayoutBuilderConfigModal";
// import LayoutBuilderAddItemModal from "./Modal/LayoutBuilderAddItemModal";

/**
 * Feature Flags for Enhanced UI
 */
const USE_ENHANCED_WIDGET_SELECTOR = true; // Set to false to use original modal

/**
 * sampleLayout
 * A test to see if this will be more condusive to iterating over a layout configuration
 */

const sampleLayout = [
    {
        id: 1,
        order: 1,
        direction: "row",
        width: "w-full",
        component: "LayoutContainer",
        type: "workspace",
        hasChildren: 1,
        scrollable: true,
        parent: 0,
    },
];

export const LayoutBuilder = ({
    workspace,
    preview = false,
    onTogglePreview,
    onWorkspaceChange = null,
    onProviderSelect = null,
    dashboardId,
    editMode = "all",
    workspaceRef = null,
}) => {
    const appContext = useContext(AppContext);
    const { debugMode } = appContext;
    const dashboardContext = useContext(DashboardContext);

    // Get providers from AppContext (not DashboardContext, which has a structural
    // issue where providers from AppWrapper don't flow through DashboardWrapper)
    const providersObj = appContext?.providers || {};
    const providers = Object.entries(providersObj).map(([id, p]) => ({
        ...p,
        id,
        name: p.name || id,
    }));
    console.log("[LayoutBuilder] Providers available:", providers);

    const [, setIsConfigOpen] = useState(false);
    const [, setIsContextSettingsOpen] = useState(true);
    const [, setIsWidgetModalOpen] = useState(false);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [configInitialSection, setConfigInitialSection] = useState(null);
    const [itemSelected, setItemSelected] = useState(null);

    // Enhanced UI state
    const [showWidgetDropdown, setShowWidgetDropdown] = useState(false);
    const [dropdownTarget, setDropdownTarget] = useState(null);
    const [targetCellNumber, setTargetCellNumber] = useState(null);

    // Provider modal state
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [providerModalConfig, setProviderModalConfig] = useState({
        widgetId: null,
        providerType: null,
        credentialSchema: {},
    });
    const [isMcpPickerOpen, setIsMcpPickerOpen] = useState(false);
    const [mcpPickerWidgetId, setMcpPickerWidgetId] = useState(null);
    const [mcpPickerProviderType, setMcpPickerProviderType] = useState(null);

    const [currentWorkspace, setCurrentWorkspace] = useState(workspace);
    const [, setSelectedItem] = useState(null);

    useEffect(() => {
        // IMPORTANT DO NOT REMOVE!!!!
        // We have to check the diff in the layout and set
        // We also have to "reset" the layout upon a new layout...

        // Normalize grids on load to repair any persisted corruption.
        // DashboardModel._initialize() deep-copies and normalizes,
        // so we use its layout to replace any corrupted grid data.
        if (workspace && workspace["layout"]) {
            const model = new DashboardModel(workspace);
            setCurrentWorkspace({
                ...workspace,
                layout: model.layout,
            });
        } else {
            setCurrentWorkspace(workspace);
        }

        if (currentWorkspace["layout"] === null) {
            setCurrentWorkspace({
                name: "Workspace " + Date.now(),
                layout: sampleLayout,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace]);

    // Keep the parent's ref in sync with LayoutBuilder's internal workspace state
    useEffect(() => {
        if (workspaceRef) {
            workspaceRef.current = currentWorkspace;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWorkspace]);

    /**
     * onClickAdd
     * From the Widget or Container, clicked plus button to add a widget
     * @param {Object} item - The container item
     * @param {String} cellNumber - Optional grid cell number (e.g., "1.1")
     */
    function onClickAdd(item, cellNumber = null) {
        console.log(
            "[LayoutBuilder] onClickAdd called",
            "USE_ENHANCED_WIDGET_SELECTOR:",
            USE_ENHANCED_WIDGET_SELECTOR,
            "item:",
            item,
            "cellNumber:",
            cellNumber
        );

        if (USE_ENHANCED_WIDGET_SELECTOR) {
            // Use new inline dropdown
            console.log("[LayoutBuilder] Opening enhanced widget dropdown");
            setDropdownTarget(item);
            setTargetCellNumber(cellNumber);
            setShowWidgetDropdown(true);
        } else {
            // Use original modal
            console.log("[LayoutBuilder] Opening original modal");
            setItemSelected(item);
            setTargetCellNumber(cellNumber);
            setIsAddWidgetModalOpen(true);
        }
    }

    function onClickQuickAdd(item, toItem) {
        console.log("quick add ", item, toItem);
        handleClickConfirmAdd(item, toItem);
    }

    function handleSaveWorkspace(tempWorkspace) {
        console.log("saving workspace", tempWorkspace);
        setCurrentWorkspace(tempWorkspace);
        setIsAddWidgetModalOpen(false);
    }

    function handleClickConfirmAdd(itemChosen, toItem) {
        try {
            console.log(
                "confirm add ",
                itemChosen,
                toItem,
                "cellNumber:",
                targetCellNumber
            );
            console.log(
                "[handleClickConfirmAdd] itemChosen.component:",
                itemChosen.component
            );
            console.log(
                "[handleClickConfirmAdd] itemChosen.key:",
                itemChosen.key
            );
            const layout = currentWorkspace["layout"];
            const hasChildren = itemChosen["type"] === "workspace";

            // Check if we're adding to a grid cell
            if (targetCellNumber && toItem.grid) {
                console.log(
                    "[LayoutBuilder] Adding widget to grid cell",
                    targetCellNumber
                );
                console.log(
                    "[LayoutBuilder] Grid before:",
                    JSON.stringify(toItem.grid, null, 2)
                );

                // Add widget to layout first
                const newLayout = addItemToItemLayout(
                    layout,
                    toItem["id"],
                    itemChosen,
                    hasChildren
                );

                // Get the newly added widget's ID (should be the last item)
                const newWidgetId = newLayout[newLayout.length - 1].id;
                console.log("[LayoutBuilder] New widget ID:", newWidgetId);

                // Find the grid container in the NEW layout and update it
                const gridContainer = newLayout.find(
                    (item) => item.id === toItem.id
                );
                if (gridContainer && gridContainer.grid) {
                    console.log(
                        "[LayoutBuilder] Found grid container:",
                        gridContainer.id
                    );
                    console.log(
                        "[LayoutBuilder] Cell before update:",
                        gridContainer.grid[targetCellNumber]
                    );

                    // Update the cell to reference the new widget
                    gridContainer.grid[targetCellNumber] = {
                        component: newWidgetId,
                        hide: false,
                    };

                    console.log(
                        "[LayoutBuilder] Cell after update:",
                        gridContainer.grid[targetCellNumber]
                    );
                    console.log(
                        "[LayoutBuilder] Grid after:",
                        JSON.stringify(gridContainer.grid, null, 2)
                    );
                } else {
                    console.error(
                        "[LayoutBuilder] Grid container not found or no grid!",
                        {
                            found: !!gridContainer,
                            hasGrid: gridContainer?.grid ? true : false,
                        }
                    );
                }

                // Create new workspace with updated layout
                const newWorkspace = JSON.parse(
                    JSON.stringify(currentWorkspace)
                );
                newWorkspace["layout"] = newLayout;

                // Store provider selections at workspace level for the new widget
                const newWidget = newLayout[newLayout.length - 1];
                if (
                    newWidget.selectedProviders &&
                    Object.keys(newWidget.selectedProviders).length > 0
                ) {
                    newWorkspace.selectedProviders =
                        newWorkspace.selectedProviders || {};
                    newWorkspace.selectedProviders[newWidget.uuid] =
                        newWidget.selectedProviders;
                }

                console.log(
                    "[LayoutBuilder] Setting new workspace with layout:",
                    newLayout.length,
                    "items"
                );
                setCurrentWorkspace(newWorkspace);
                setTargetCellNumber(null); // Clear cell number after use
                setShowWidgetDropdown(false);
            } else {
                // Old flexbox container behavior
                const newLayout = addItemToItemLayout(
                    layout,
                    toItem["id"],
                    itemChosen,
                    hasChildren
                );
                const newWorkspace = JSON.parse(
                    JSON.stringify(currentWorkspace)
                );
                newWorkspace["layout"] = newLayout;

                // Store provider selections at workspace level for the new widget
                const newWidget = newLayout[newLayout.length - 1];
                if (
                    newWidget.selectedProviders &&
                    Object.keys(newWidget.selectedProviders).length > 0
                ) {
                    newWorkspace.selectedProviders =
                        newWorkspace.selectedProviders || {};
                    newWorkspace.selectedProviders[newWidget.uuid] =
                        newWidget.selectedProviders;
                }

                setCurrentWorkspace(newWorkspace);
                setIsAddWidgetModalOpen(false);
            }
        } catch (e) {
            console.log("[LayoutBuilder] Error in handleClickConfirmAdd:", e);
        }
    }

    function handleSaveNewWorkspace(newWorkspace) {
        console.log("builder save workspace ", newWorkspace);
        setCurrentWorkspace(() => newWorkspace);
        setIsConfigModalOpen(false);
        onWorkspaceChange(newWorkspace);
    }

    function onClickRemove(id) {
        try {
            const dashboard = new DashboardModel(currentWorkspace);
            dashboard.removeItemFromLayout(id);

            console.log("new workspace after remove ", dashboard.workspace());
            setCurrentWorkspace(dashboard.workspace());

            // const layout = currentWorkspace["layout"];
            // const newLayout = removeItemFromLayout(layout, id);
            // const newWorkspace = JSON.parse(JSON.stringify(currentWorkspace));
            // newWorkspace["layout"] = newLayout;
            // setCurrentWorkspace(newWorkspace);
        } catch (e) {
            console.log(e);
        }
    }

    function onDragItem(item) {
        console.log("onDragItem LayoutBuilder ", item);
    }

    function onDropItem(item) {
        try {
            // console.log("dropped item ", item);

            const draggedId = item["sourceIndex"];
            const droppedId = item["dropIndex"];

            const draggedComponent = getComponentInLayout(
                draggedId,
                currentWorkspace["layout"]
            );
            const droppedComponent = getComponentInLayout(
                droppedId,
                currentWorkspace["layout"]
            );

            // console.log("FOUND IT IN LAYOUT ", draggedComponent);
            // console.log(
            //     "RESULT ",
            //     "widget: ",
            //     isDraggedWidget,
            //     "drop widget: ",
            //     isDroppedWidget,
            //     "container: ",
            //     isContainer(droppedComponent),
            //     "workspace: ",
            //     isWorkspace(droppedComponent)
            // );

            // We have to determine if we are allowed to DROP the DRAGGED item
            // onto the DROPPED ITEM...

            // RULES
            // 1. IF DRAG item is a widget, and the DROPPED item is a Container...
            //      the next workspace parent of the DROPPED item MUST match the widget workspace type
            if (
                isWidget(draggedComponent) === true &&
                isContainer(droppedComponent) === true
            ) {
                const parent = getParentWorkspaceForItem(
                    droppedId,
                    currentWorkspace["layout"],
                    draggedComponent["workspace"]
                );
                // If there is no parent workspace that matches the dragged item in the chain, (encapsulating)
                // then we have to return as this child does not belong where the user has dropped the component
                if (parent === null) return;
            }
            //     return;
            // 2. If DRAG item is a Workspace, and DROPPED item is a Container - OK

            // 2a If DRAG item is a Workspace, and DROPPED item is a Workspace - FAIL
            if (
                isWorkspace(draggedComponent) === true &&
                isWorkspace(droppedComponent) === true
            )
                return;

            // traverseParentTree(currentWorkspace["layout"], {
            //     parent: item["dropIndex"],
            //     current: item["sourceIndex"],
            // });

            if (currentWorkspace) {
                const { sourceIndex, dropIndex } = item;
                // we have to find the item
                // then we have to set the parent id to a different id
                const layout = currentWorkspace["layout"];
                const newLayout = updateParentForItem(
                    layout,
                    sourceIndex,
                    dropIndex
                );
                if (newLayout) {
                    const newWorkspace = JSON.parse(
                        JSON.stringify(currentWorkspace)
                    );

                    newWorkspace["layout"] = newLayout;
                    setCurrentWorkspace(() => newWorkspace);
                } else {
                    // console.log("failed new layout", newLayout);
                }
            } else {
                // console.log("no current workspace ", currentWorkspace);
            }
        } catch (e) {
            console.log(e);
        }
    }

    function onClickShrink(id, currentWidth) {
        console.log("shrink ", id, currentWidth);
    }

    function onClickExpand(id, currentWidth) {
        console.log("expand ", id, currentWidth);
    }

    function onChangeDirection(id, currentDirection) {
        const layout = currentWorkspace["layout"];
        const newLayout = changeDirectionForLayoutItem(
            layout,
            id,
            currentDirection
        );
        const newWorkspace = JSON.parse(JSON.stringify(currentWorkspace));
        newWorkspace["layout"] = newLayout;
        setCurrentWorkspace(newWorkspace);
    }

    function onChangeOrder(item, direction) {
        console.log("changing order ", item["order"], direction);

        const currentOrder = parseInt(item["order"], 10);
        const layout = currentWorkspace["layout"];
        let nextItem = null;
        let layoutFiltered = {};
        Object.keys(layout)
            .filter((li) => layout[li]["parent"] === item["parent"])
            .forEach((fli) => {
                layoutFiltered[fli] = layout[fli];
            });

        // Add 1 to the selected item's order, and then loop and find the new order value item and increase
        if (direction === "up") {
            // increase current item by 1 (1,2 3 ...2 moves "down" to 1 and 1 to 2)
            // increase the existing item with this new order (check) by 1
            nextItem = getNextHighestItemInLayout(layoutFiltered, currentOrder);
            console.log("next highest item ", nextItem);
            // item['order'] = nextItem['order'];
            // nextItem['order'] = currentOrder;
        }

        if (direction === "down") {
            // decrease current item by 1 (1,2 3 ...2 moves "down" to 1 and 1 to 2)
            // decrease the existing item with this new order (check) by 1
            nextItem = getNextLowestItemInLayout(layoutFiltered, currentOrder);
            // item['order'] = nextItem['order'];
            // nextItem['order'] = currentOrder;
            console.log("next lowest item ", nextItem);
        }

        // we have to loop through and set the new items...

        // // const newLayout = changeDirectionForLayoutItem(layout, id, currentDirection);
        let newWorkspace = deepCopy(currentWorkspace); //JSON.parse(JSON.stringify(currentWorkspace));
        if (nextItem) {
            Object.keys(currentWorkspace.layout).forEach((li) => {
                if (currentWorkspace.layout[li]["id"] === nextItem["id"]) {
                    console.log(
                        "setting to current",
                        currentWorkspace.layout[li]["id"]
                    );
                    newWorkspace.layout[li]["order"] = currentOrder;
                }

                if (newWorkspace.layout[li]["id"] === item["id"]) {
                    console.log(
                        "setting to next",
                        currentWorkspace.layout[li]["id"]
                    );
                    newWorkspace.layout[li]["order"] = nextItem["order"];
                }
            });
        }

        // // newWorkspace['layout'] = newLayout;
        setCurrentWorkspace(() => newWorkspace);
    }

    function handleSaveConfiguration(data) {
        console.log("SAVING CONFIG ", data);

        const newWorkspace = saveItemToWorkspace(data);
        setCurrentWorkspace(newWorkspace);
        setIsConfigOpen(false);
        setIsWidgetModalOpen(false);
        setSelectedItem(null);

        onTogglePreview();
    }

    function saveItemToWorkspace(data) {
        const layout = deepCopy(currentWorkspace["layout"]); // JSON.parse(JSON.stringify(currentWorkspace["layout"]));
        const newLayout = updateLayoutItem(layout, data);
        const newWorkspace = deepCopy(currentWorkspace); //JSON.parse(JSON.stringify(currentWorkspace));
        newWorkspace["layout"] = newLayout;
        return newWorkspace;
    }

    function handleClickEditItem(newItem, initialSection = null) {
        delete newItem["api"];
        delete newItem["componentData"];

        // Refresh config fields (eventHandlers, events, etc.) from the
        // component definition so that grid-path items — which skip
        // LayoutModel during rendering — always have up-to-date metadata.
        const refreshedItem = LayoutModel(
            newItem,
            currentWorkspace?.layout || [],
            dashboardId
        );

        setItemSelected(() => refreshedItem || newItem);
        setConfigInitialSection(initialSection);
        // setIsWidgetModalOpen(() => true);
        setIsConfigModalOpen(() => true);
    }

    function handleClickEvents(d) {
        console.log(d);
        const refreshedItem = LayoutModel(
            d,
            currentWorkspace?.layout || [],
            dashboardId
        );
        setItemSelected(() => refreshedItem || d);
        // setIsEventModalOpen(() => true);
        setIsConfigModalOpen(true);
    }

    // Provider Handlers

    function handleOpenProviderModal(widgetId, providerType, isCreateNew) {
        console.log("[LayoutBuilder] Open provider modal:", {
            widgetId,
            providerType,
            isCreateNew,
        });

        // Check if the widget requires an MCP provider
        // Look up the widget to get its component config
        const dashboard = new DashboardModel(currentWorkspace);
        const widget =
            typeof widgetId === "object"
                ? widgetId
                : dashboard.getComponentById(widgetId);
        const widgetConfig = widget
            ? ComponentManager.config(widget.component, widget)
            : null;
        const providerReqs = widgetConfig?.providers || [];
        const matchingReq = providerReqs.find((r) => r.type === providerType);
        const isMcpRequired = matchingReq?.providerClass === "mcp";

        if (isMcpRequired) {
            // Open the MCP Server Picker for MCP providers
            setMcpPickerWidgetId(widgetId);
            setMcpPickerProviderType(providerType);
            setIsMcpPickerOpen(true);
            return;
        }

        // For credential providers, open the standard ProviderSelector
        const providerSchemas = {
            algolia: {
                appId: {
                    type: "text",
                    displayName: "Application ID",
                    instructions: "Your Algolia Application ID",
                    required: true,
                    secret: false,
                },
                apiKey: {
                    type: "text",
                    displayName: "API Key",
                    instructions: "Your Algolia API Key",
                    required: true,
                    secret: true,
                },
                indexName: {
                    type: "text",
                    displayName: "Index Name",
                    instructions: "Default index to search",
                    required: true,
                    secret: false,
                },
            },
            github: {
                token: {
                    type: "text",
                    displayName: "Personal Access Token",
                    instructions: "Your GitHub PAT with appropriate scopes",
                    required: true,
                    secret: true,
                },
            },
        };

        const schema = providerSchemas[providerType] || {};

        setProviderModalConfig({
            widgetId,
            providerType,
            credentialSchema: schema,
        });
        setIsProviderModalOpen(true);
    }

    function handleSelectProvider(
        widgetIdOrItem,
        providerType,
        providerId,
        createNew = false
    ) {
        console.log("[LayoutBuilder] Select provider:", {
            widgetIdOrItem,
            providerType,
            providerId,
            createNew,
        });

        // Handle "Create New" flow — open the provider creation modal
        if (createNew) {
            handleOpenProviderModal(widgetIdOrItem, providerType, true);
            return;
        }

        if (onProviderSelect) {
            onProviderSelect(widgetIdOrItem, providerType, providerId);
        }

        // widgetIdOrItem may be the layout item object (from WidgetCardHeader chain)
        // or a string/number ID (from ProviderSelector callback)
        const dashboard = new DashboardModel(currentWorkspace);
        const widget =
            typeof widgetIdOrItem === "object"
                ? widgetIdOrItem
                : dashboard.getComponentById(widgetIdOrItem);

        if (widget) {
            // Update widget-level selectedProviders
            widget.selectedProviders = widget.selectedProviders || {};
            widget.selectedProviders[providerType] = providerId;

            // Also update workspace-level selectedProviders
            // so useMcpProvider can find the selection via WorkspaceContext
            const newWorkspace = dashboard.workspace();
            const uuid = widget.uuid || widget.uuidString;
            if (uuid) {
                newWorkspace.selectedProviders =
                    newWorkspace.selectedProviders || {};
                newWorkspace.selectedProviders[uuid] = {
                    ...(newWorkspace.selectedProviders[uuid] || {}),
                    [providerType]: providerId,
                };
            }

            setCurrentWorkspace(newWorkspace);
        }
    }

    function handleCreateProvider(providerName, credentials) {
        console.log("[LayoutBuilder] Create provider:", {
            providerName,
            credentials,
        });

        const { widgetId, providerType } = providerModalConfig;
        const appId = dashboardContext?.credentials?.appId;

        if (dashboardContext?.dashApi && appId) {
            dashboardContext.dashApi.saveProvider(
                appId,
                providerName,
                {
                    providerType,
                    credentials,
                },
                () => {
                    console.log(
                        "[LayoutBuilder] Provider created:",
                        providerName
                    );
                    handleSelectProvider(widgetId, providerType, providerName);
                    setIsProviderModalOpen(false);
                    appContext?.refreshProviders &&
                        appContext.refreshProviders();
                },
                (e, err) => {
                    console.error(
                        "[LayoutBuilder] Failed to create provider:",
                        err
                    );
                }
            );
        }
    }

    function handleMcpProviderSave(
        providerName,
        providerType,
        mcpCredentials,
        mcpConfig
    ) {
        console.log("[LayoutBuilder] MCP provider save:", {
            providerName,
            providerType,
            mcpCredentials,
            mcpConfig,
        });

        const appId = dashboardContext?.credentials?.appId;

        if (dashboardContext?.dashApi && appId) {
            dashboardContext.dashApi.saveProvider(
                appId,
                providerName,
                {
                    providerType,
                    credentials: mcpCredentials,
                    providerClass: "mcp",
                    mcpConfig,
                },
                () => {
                    console.log(
                        "[LayoutBuilder] MCP provider created:",
                        providerName
                    );
                    handleSelectProvider(
                        mcpPickerWidgetId,
                        mcpPickerProviderType,
                        providerName
                    );
                    setIsMcpPickerOpen(false);
                    appContext?.refreshProviders &&
                        appContext.refreshProviders();
                },
                (e, err) => {
                    console.error(
                        "[LayoutBuilder] Failed to create MCP provider:",
                        err
                    );
                }
            );
        }
    }

    // Grid Operation Handlers

    function handleSplitCell({ cellNumber, direction, count, gridContainer }) {
        try {
            console.log(
                "[LayoutBuilder] Split cell:",
                cellNumber,
                direction,
                count
            );
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.splitGridCell(
                gridContainer.id,
                cellNumber,
                direction,
                count
            );

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Cell split successful");
            } else {
                console.error("[LayoutBuilder] Failed to split cell");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error splitting cell:", e);
        }
    }

    function handleMergeCells({ cellNumbers, gridContainer, keepComponent }) {
        try {
            console.log(
                "[LayoutBuilder] Merge cells:",
                cellNumbers,
                "keep:",
                keepComponent
            );
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.mergeGridCells(
                gridContainer.id,
                cellNumbers
            );

            if (result) {
                // Handle component cleanup if needed
                if (
                    result.conflictingComponents &&
                    result.conflictingComponents.length > 0
                ) {
                    // Remove components that weren't selected to keep
                    result.conflictingComponents.forEach((componentId) => {
                        if (componentId !== keepComponent) {
                            dashboard.removeItemFromLayout(componentId);
                        }
                    });
                }

                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Cells merged successful");
            } else {
                console.error("[LayoutBuilder] Failed to merge cells");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error merging cells:", e);
        }
    }

    function handleAddGridRow(gridContainerId, afterRow) {
        try {
            console.log("[LayoutBuilder] Add row after:", afterRow);
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.addGridRow(gridContainerId, afterRow);

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Row added successfully");
            } else {
                console.error("[LayoutBuilder] Failed to add row");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error adding row:", e);
        }
    }

    function handleDeleteGridRow(gridContainerId, rowNumber) {
        try {
            console.log("[LayoutBuilder] Delete row:", rowNumber);
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.deleteGridRow(gridContainerId, rowNumber);

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Row deleted successfully");
            } else {
                console.error("[LayoutBuilder] Failed to delete row");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error deleting row:", e);
        }
    }

    function handleAddGridColumn(gridContainerId, afterCol) {
        try {
            console.log("[LayoutBuilder] Add column after:", afterCol);
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.addGridColumn(gridContainerId, afterCol);

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Column added successfully");
            } else {
                console.error("[LayoutBuilder] Failed to add column");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error adding column:", e);
        }
    }

    function handleDeleteGridColumn(gridContainerId, colNumber) {
        try {
            console.log("[LayoutBuilder] Delete column:", colNumber);
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.deleteGridColumn(
                gridContainerId,
                colNumber
            );

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);

                console.log("[LayoutBuilder] Column deleted successfully");
            } else {
                console.error("[LayoutBuilder] Failed to delete column");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error deleting column:", e);
        }
    }

    function handleDropWidgetFromSidebar(
        gridContainerId,
        cellNumber,
        widgetKey
    ) {
        try {
            console.log(
                "[LayoutBuilder] Drop widget from sidebar:",
                widgetKey,
                "→ cell",
                cellNumber
            );
            const config = ComponentManager.config(widgetKey);
            if (!config) return;

            const widgetItem = {
                ...config,
                component: widgetKey,
                key: widgetKey,
            };
            const layout = currentWorkspace["layout"];
            const hasChildren = widgetItem["type"] === "workspace";

            const newLayout = addItemToItemLayout(
                layout,
                gridContainerId,
                widgetItem,
                hasChildren
            );

            const newWidgetId = newLayout[newLayout.length - 1].id;

            const updatedGrid = newLayout.find(
                (item) => item.id === gridContainerId
            );
            if (updatedGrid && updatedGrid.grid) {
                updatedGrid.grid[cellNumber] = {
                    component: newWidgetId,
                    hide: false,
                };
            }

            const newWorkspace = JSON.parse(JSON.stringify(currentWorkspace));
            newWorkspace["layout"] = newLayout;
            setCurrentWorkspace(newWorkspace);
        } catch (e) {
            console.log(
                "[LayoutBuilder] Error in handleDropWidgetFromSidebar:",
                e
            );
        }
    }

    function handleMoveWidgetToCell(
        gridContainerId,
        sourceCellNumber,
        targetCellNumber
    ) {
        try {
            console.log(
                "[LayoutBuilder] Move widget:",
                sourceCellNumber,
                "→",
                targetCellNumber
            );
            const dashboard = new DashboardModel(currentWorkspace);
            dashboard.moveWidgetToCell(
                gridContainerId,
                sourceCellNumber,
                targetCellNumber
            );
            const newWorkspace = dashboard.workspace();
            setCurrentWorkspace(newWorkspace);
        } catch (e) {
            console.error("[LayoutBuilder] Error moving widget:", e);
        }
    }

    function handleChangeRowHeight(gridContainerId, rowNumber, multiplier) {
        try {
            console.log(
                "[LayoutBuilder] Change row height:",
                rowNumber,
                "to",
                multiplier + "x"
            );
            const dashboard = new DashboardModel(currentWorkspace);
            const result = dashboard.changeRowHeight(
                gridContainerId,
                rowNumber,
                multiplier
            );

            if (result) {
                const newWorkspace = dashboard.workspace();
                setCurrentWorkspace(newWorkspace);
            } else {
                console.error("[LayoutBuilder] Failed to change row height");
            }
        } catch (e) {
            console.error("[LayoutBuilder] Error changing row height:", e);
        }
    }

    /**
     * handle the click of a cell in a grid that does not contain a widget yet
     * the idea here is to allow the user to CHOOSE a widget that corresponds to
     * the workspace that they are clicking a cell inside of
     *
     * @param {*} cellNumber the number of the cell they have clicked (to tie to the widget selected upcoming)
     * @param {*} cellData the data for the cell clicked (this may be pertinent depending on the widget)
     * @param {*} workspace the workspace that this cell lives in, use this to find corresponding widgets to select
     */
    function handleOnClickEmptyCell(cellNumber, cellData, workspace) {
        console.log(
            "handling click empty cell",
            cellNumber,
            cellData,
            workspace
        );
    }

    /**
     * When the user selects the widget for the particular cell, we want to update
     * the cell in the grid for the workspace, and update any other pertinent parentWorkspaces
     * that have the same id
     * @param {Number} widgetName the name of the widget selected from the registry
     * @param {String} cellNumber the number for the cell in the grid
     * @param {Object} workspace the workspace that the cell lives in
     */
    function handleSelectWidgetForCell(
        widgetName,
        cellNumber,
        cellData,
        component,
        workspace
    ) {
        console.log(
            "handle select widget for cell ",
            widgetName,
            cellNumber,
            cellData,
            component,
            workspace
        );

        try {
            // create the new dashboard.
            let dashboard = new DashboardModel(workspace);
            let componentToAdd = ComponentManager.getComponent(widgetName);
            let widget = LayoutModel(
                componentToAdd,
                dashboard.workspace(),
                dashboard.id
            );
            dashboard.addChildToLayoutItem(widget, component.id, cellNumber);

            console.log("NEW WORKSPACE ", dashboard.workspace());
            setCurrentWorkspace(() => dashboard.workspace());
        } catch (e) {
            console.log("error adding widget to grid ", e);
        }
    }

    console.log("component map ", ComponentManager.componentMap());

    // in this case we would like to reduce all of the contexts into one provider....

    return (
        // <LayoutContexts workspace={currentWorkspace}>
        <div
            className={`flex flex-col w-full h-full overflow-clip`}
            key={"layout-builder"}
        >
            <div className="flex flex-row w-full h-full overflow-clip">
                <LayoutContainer
                    key={"search-layout-builder"}
                    id="search-layout-builder"
                    scrollable={!preview}
                    direction={"col"}
                    width={"w-full"}
                    height={"h-full"}
                    grow={true}
                    space={preview}
                >
                    {preview === true && (
                        <LayoutDragBuilder
                            key={`layout-drag-${dashboardId}`}
                            dashboardId={dashboardId}
                            isDraggable={true}
                            workspace={currentWorkspace}
                            header={currentWorkspace["name"]}
                            layout={currentWorkspace["layout"]}
                            parentKey={0}
                            debugMode={debugMode}
                            previewMode={preview}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickShrink={onClickShrink}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={handleOnClickEmptyCell}
                            onSelectWidgetForCell={handleSelectWidgetForCell}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onOpenConfig={handleClickEditItem}
                            onOpenEvents={handleClickEvents}
                            onSaveConfiguration={handleSaveConfiguration}
                            onProviderSelect={handleSelectProvider}
                            onCreateProvider={handleOpenProviderModal}
                            onClickEdit={onTogglePreview}
                            onSplitCell={handleSplitCell}
                            onMergeCells={handleMergeCells}
                            onAddGridRow={handleAddGridRow}
                            onDeleteGridRow={handleDeleteGridRow}
                            onAddGridColumn={handleAddGridColumn}
                            onDeleteGridColumn={handleDeleteGridColumn}
                            onChangeRowHeight={handleChangeRowHeight}
                            onMoveWidgetToCell={handleMoveWidgetToCell}
                        />
                    )}
                    {preview === false && editMode === "all" && (
                        <LayoutDragBuilderEdit
                            key={`layout-drag-edit-${dashboardId}`}
                            dashboardId={dashboardId}
                            isDraggable={true}
                            workspace={currentWorkspace}
                            header={currentWorkspace["name"]}
                            layout={currentWorkspace["layout"]}
                            parentKey={0}
                            debugMode={debugMode}
                            previewMode={preview}
                            editMode={editMode}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickShrink={onClickShrink}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={handleOnClickEmptyCell}
                            onClickContextSettings={(i) => {
                                console.log("context settings clicked ", i);
                                // set the item here so that we can constrict the contexts
                                // that the user can choose from, only show the compatible contexts
                                setItemSelected(() => i);
                                setIsContextSettingsOpen(true);
                            }}
                            onSelectWidgetForCell={handleSelectWidgetForCell}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onOpenConfig={handleClickEditItem}
                            onOpenEvents={handleClickEvents}
                            onSaveConfiguration={handleSaveConfiguration}
                            onProviderSelect={handleSelectProvider}
                            onCreateProvider={handleOpenProviderModal}
                            providers={providers}
                            onClickEdit={onTogglePreview}
                            onSplitCell={handleSplitCell}
                            onMergeCells={handleMergeCells}
                            onAddGridRow={handleAddGridRow}
                            onDeleteGridRow={handleDeleteGridRow}
                            onAddGridColumn={handleAddGridColumn}
                            onDeleteGridColumn={handleDeleteGridColumn}
                            onChangeRowHeight={handleChangeRowHeight}
                            onMoveWidgetToCell={handleMoveWidgetToCell}
                            onDropWidgetFromSidebar={
                                handleDropWidgetFromSidebar
                            }
                        />
                    )}

                    {/* {preview === false && editMode === "layout" && (
                        <LayoutDragBuilderEdit
                            key={`layout-drag-edit-${dashboardId}`}
                            dashboardId={dashboardId}
                            isDraggable={true}
                            workspace={currentWorkspace}
                            header={currentWorkspace["name"]}
                            layout={currentWorkspace["layout"]}
                            parentKey={0}
                            debugMode={debugMode}
                            previewMode={preview}
                            editMode={editMode}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickShrink={onClickShrink}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={handleOnClickEmptyCell}
                            onSelectWidgetForCell={handleSelectWidgetForCell}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onOpenConfig={handleClickEditItem} //{handleClickConfigure}
                            onOpenEvents={handleClickEvents}
                            onSaveConfiguration={handleSaveConfiguration}
                            onClickEdit={onTogglePreview}
                        />
                    )} */}
                    {/* {preview === false && editMode === "workspace" && (
                        <LayoutDragBuilderEdit
                            key={`layout-drag-edit-${dashboardId}`}
                            dashboardId={dashboardId}
                            isDraggable={true}
                            workspace={currentWorkspace}
                            header={currentWorkspace["name"]}
                            layout={currentWorkspace["layout"]}
                            parentKey={0}
                            debugMode={debugMode}
                            previewMode={preview}
                            editMode={editMode}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickShrink={onClickShrink}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={handleOnClickEmptyCell}
                            onSelectWidgetForCell={handleSelectWidgetForCell}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onOpenConfig={handleClickEditItem} 
                            onOpenEvents={handleClickEvents}
                            onSaveConfiguration={handleSaveConfiguration}
                            onClickEdit={onTogglePreview}
                        />
                    )} */}
                    {/* {preview === false && editMode === "widget" && (
                        <LayoutDragBuilderEdit
                            key={`layout-drag-edit-${dashboardId}`}
                            dashboardId={dashboardId}
                            isDraggable={true}
                            workspace={currentWorkspace}
                            header={currentWorkspace["name"]}
                            layout={currentWorkspace["layout"]}
                            parentKey={0}
                            debugMode={debugMode}
                            previewMode={preview}
                            editMode={editMode}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickShrink={onClickShrink}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={handleOnClickEmptyCell}
                            onSelectWidgetForCell={handleSelectWidgetForCell}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onOpenConfig={handleClickEditItem} //{handleClickConfigure}
                            onOpenEvents={handleClickEvents}
                            onSaveConfiguration={handleSaveConfiguration}
                            onClickEdit={onTogglePreview}
                        />
                    )} */}
                </LayoutContainer>
                {/* {preview === false && (
                    <div className="flex flex-col p-2 text-xs text-green-700 h-full hidden xl:flex xl:w-1/4 bg-slate-900 rounded">
                        <LayoutBuilderConfigPanel 
                            workspace={currentWorkspace} 
                            onComplete={(e) => console.log(e)} 
                            onClickEdit={handleClickEditItem}
                        />
                    </div>
                )} */}

                {/* {preview === false && itemSelected && (
                    <div className="flex flex-col p-2 text-xs text-green-700 h-full hidden xl:flex xl:w-1/4 bg-slate-900 rounded">
                         <WidgetConfigPanel
                            item={itemSelected}
                            onChange={(e) => console.log("handle update ", e)}
                            // onSave={handleAddItem}
                            disabled={false}
                            workspace={currentWorkspace}
                            parentWorkspace={currentWorkspace}
                        />
                    </div>
                )} */}
            </div>
            {/* {itemSelected !== null && (
                <LayoutBuilderEditItemModal
                    open={isWidgetModalOpen}
                    setIsOpen={setIsWidgetModalOpen}
                    item={itemSelected}
                    onUpdate={handleSaveWidgetChanges}
                    workspace={currentWorkspace}
                />
            )} */}
            {/*
                Modals — wrapped in AppThemeScope so they use the app theme
                instead of the dashboard-specific theme from DashboardThemeProvider.
            */}
            <AppThemeScope>
                {/*
                    Enhanced Widget Dropdown (NEW)
                    Inline dropdown for faster widget selection
                */}
                {USE_ENHANCED_WIDGET_SELECTOR && showWidgetDropdown && (
                    <EnhancedWidgetDropdown
                        isOpen={showWidgetDropdown}
                        onClose={() => setShowWidgetDropdown(false)}
                        onSelectWidget={(widget) => {
                            console.log(
                                "[LayoutBuilder] onSelectWidget called"
                            );
                            console.log(
                                "[LayoutBuilder] Original widget object:",
                                widget
                            );
                            console.log(
                                "[LayoutBuilder] widget.key:",
                                widget.key
                            );
                            console.log(
                                "[LayoutBuilder] widget.component:",
                                widget.component
                            );

                            // Add component property from widget.key
                            const widgetWithComponent = {
                                ...widget,
                                component: widget.key,
                            };
                            console.log(
                                "[LayoutBuilder] widgetWithComponent after mapping:",
                                widgetWithComponent
                            );
                            console.log(
                                "[LayoutBuilder] widgetWithComponent.component:",
                                widgetWithComponent.component
                            );

                            handleClickConfirmAdd(
                                widgetWithComponent,
                                dropdownTarget
                            );
                            setShowWidgetDropdown(false);
                        }}
                        workspaceType={currentWorkspace?.workspace}
                    />
                )}

                {/*
                    Original Modal (FALLBACK)
                    This is the modal window that will allow a user to ADD a widget
                    It has the "Build" title and contains all of the widgets/workspaces that can be added
                    to the project
                */}
                {!USE_ENHANCED_WIDGET_SELECTOR && itemSelected !== null && (
                    <LayoutBuilderAddItemModal
                        open={isAddWidgetModalOpen}
                        setIsOpen={setIsAddWidgetModalOpen}
                        item={
                            isAddWidgetModalOpen === true ? itemSelected : null
                        }
                        onSaveItem={handleSaveWorkspace}
                        workspace={
                            isAddWidgetModalOpen === true
                                ? currentWorkspace
                                : null
                        }
                    />
                )}
                {/* {itemSelected !== null && (
                    <LayoutBuilderEventModal
                        open={isConfigModalOpen}
                        setIsOpen={setIsEventModalOpen}
                        item={isConfigModalOpen === true ? itemSelected : null}
                        onSave={handleSaveNewWorkspace}
                        workspace={
                            isEventModalOpen === true ? currentWorkspace : null
                        }
                    />
                )} */}

                {itemSelected !== null && (
                    <LayoutBuilderConfigModal
                        open={isConfigModalOpen}
                        setIsOpen={setIsConfigModalOpen}
                        item={isConfigModalOpen === true ? itemSelected : null}
                        initialSection={configInitialSection}
                        onSaveWorkspace={handleSaveNewWorkspace}
                        // onSaveWidgetChanges={handleSaveWidgetChanges}
                        workspace={
                            isConfigModalOpen === true ? currentWorkspace : null
                        }
                    />
                )}

                {/* {itemSelected !== null && (
                    <LayoutBuilderWidgetConfigPanel
                        open={true}
                        setOpen={setIsConfigModalOpen}
                        // item={isConfigModalOpen === true ? itemSelected : null}
                        layoutItem={itemSelected}
                        workspace={
                            isConfigModalOpen === true ? currentWorkspace : null
                        }
                        onClose={() => console.log("close me")}
                    />
                )} */}

                {/* {currentWorkspace && currentWorkspace !== null && (
                        <ContextSettingsModal
                            open={isContextSettingsOpen}
                            setIsOpen={setIsContextSettingsOpen}
                            workspace={currentWorkspace}
                            widget={itemSelected}
                        />
                    )} */}

                {/* Provider Creation Modal */}
                <ProviderSelector
                    isOpen={isProviderModalOpen}
                    setIsOpen={setIsProviderModalOpen}
                    providerType={providerModalConfig.providerType}
                    existingProviders={providers}
                    credentialSchema={providerModalConfig.credentialSchema}
                    onSelect={(providerId) => {
                        handleSelectProvider(
                            providerModalConfig.widgetId,
                            providerModalConfig.providerType,
                            providerId
                        );
                        setIsProviderModalOpen(false);
                    }}
                    onCreate={handleCreateProvider}
                />

                {/* MCP Server Picker Modal */}
                <McpServerPicker
                    isOpen={isMcpPickerOpen}
                    setIsOpen={setIsMcpPickerOpen}
                    onSave={handleMcpProviderSave}
                />
            </AppThemeScope>
        </div>
        // </LayoutContexts>
    );
};
