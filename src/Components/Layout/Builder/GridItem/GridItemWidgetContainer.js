import React from "react";
import { ButtonIcon, DropComponent, DragComponent } from "@trops/dash-react";
import { WidgetFactory } from "../../../../Widget";
import { LayoutContainer } from "../../../../Components/Layout";

import {
    getContainerBorderColor,
    getContainerColor,
    getLayoutItemById,
    isMaxOrderForItem,
    isMinOrderForItem,
    numChildrenForLayout,
    renderComponent,
} from "../../../../utils/layout";
import { ComponentManager } from "../../../../ComponentManager";
import { getRandomInt } from "@trops/dash-react";
import {
    getLayoutItemForWorkspace,
    isContainer,
    isWorkspace,
} from "../../../../utils/layout";

import { LayoutItemEditHeader } from "../../../../Components/Layout/Builder/Menu/LayoutItemEditHeader";
import { WidgetCardHeader } from "../Enhanced/WidgetCardHeader";
import { DashboardModel } from "../../../../Models";

// Feature flag for enhanced widget header with provider support
const USE_ENHANCED_WIDGET_HEADER = true;

// uuid={uuid}
// id={id}
// item={childLayout}
// parent={parent}
// onChangeDirection={onChangeDirection}
// onChangeOrder={onChangeOrder}
// onClickRemove={onClickRemove}
// isContainer={true}
// direction={direction}
// scrollable={scrollable}
// onClickAdd={onClickAdd}
// onClickQuickAdd={onClickQuickAdd}
// order={order}
// preview={previewMode}
// editMode={editMode}
// onOpenConfig={onOpenConfig}
// onOpenEvents={onOpenEvents}
// onDropItem={onDropItem}
// onDragItem={onDragItem}
// width={width}
// isDraggable={isDraggable}
// workspace={workspace}
// height={height}
// space={space}
// grow={grow}

export const GridItemWidgetContainer = ({
    item,
    workspace,
    preview = false,
    id,
    parent,
    scrollable,
    space,
    grow,
    order,
    children = null,
    onClickAdd,
    onClickQuickAdd,
    onClickRemove,
    onChangeDirection,
    onChangeOrder,
    onClickExpand,
    onClickShrink,
    onOpenConfig,
    onOpenEvents,
    width,
    height = "h-full",
    direction,
    onDropItem,
    onDragItem,
    editMode,
    uuid,
    layout,
    component,
    isDraggable,
    providers = [], // Available providers from context
    onProviderSelect = null, // Handler for provider selection
}) => {
    function handleClickAdd() {
        onClickAdd(item);
    }

    function handleClickRemove(item) {
        onClickRemove(id);
    }

    function handleChangeDirection(item) {
        onChangeDirection(id, direction);
    }

    function handleOpenConfig() {
        onOpenConfig(item);
    }

    function handleProviderChange(providerType, providerId, createNew = false) {
        console.log("[GridItemWidgetContainer] Provider change:", {
            providerType,
            providerId,
            createNew,
            item,
        });
        if (onProviderSelect) {
            onProviderSelect(item, providerType, providerId, createNew);
        }
    }

    function handleDropItem(item) {
        if (onDropItem) {
            onDropItem(item);
        }
    }

    function handleDragItem(item) {
        console.log("dragging item ", item);
        // if (onDragItem) {
        //     onDragItem(item);
        // }
    }

    function handleChangeOrder(direction) {
        onChangeOrder(item, direction);
    }

    function getBorderStyle() {
        try {
            return WidgetFactory.workspace(item["component"]) === "layout"
                ? "border-dashed"
                : "border-4";
        } catch (e) {
            return "";
        }
    }

    function renderComponentContainer(children) {
        return item
            ? renderComponent(item["component"], id, item, children)
            : null;
    }

    function getAllWorkspaceNames() {
        if (workspace !== null) {
            const names = workspace.layout.map((layout) => {
                return "workspace" in layout ? layout.workspace : null;
            });
            return names
                .filter((value, index, array) => array.indexOf(value) === index)
                .filter((i) => i !== null);
        }
        return null;
    }

    function dropType(item) {
        // if item is a Workspace, and NOT a container, can only drop into a Container (layout)
        if (isWorkspace(item) === true) {
            return ["layout", item["parentWorkspaceName"]];
        }
        // if a container, we can place this into ANY other container or workspace
        if (isContainer(item) === true) {
            return getAllWorkspaceNames();
        }
        return ["layout", item["parentWorkspaceName"]];
    }

    function dragType(item) {
        if (isWorkspace(item) === true) {
            return item["parentWorkspaceName"];
        }
        if (isContainer(item)) {
            return "layout";
        }
        return item["parentWorkspaceName"];
    }

    function renderEditItem() {
        return (
            <DropComponent
                item={item}
                id={id}
                type={dropType(item)}
                onDropItem={handleDropItem}
                width={"w-full"}
                height={"h-full"}
            >
                <DragComponent
                    id={id}
                    type={dragType(item)}
                    onDropItem={handleDropItem}
                    onDragItem={handleDragItem}
                    width={"w-full"}
                    height={"h-full"}
                >
                    <LayoutContainer
                        id={`grid-container-parent-${id}`}
                        direction={"col"}
                        width={"w-full"}
                        height={"h-full"}
                        scrollable={false}
                        className={`rounded overflow-x-clip ${
                            preview === false && "border-2 rounded"
                        } ${
                            preview === false && getContainerBorderColor(item)
                        } ${preview === false && getBorderStyle()} min-h-24 ${
                            item["component"] === "Container" && ""
                        } z-10`}
                        space={preview}
                    >
                        {/* {preview === false && renderEditFooter()} */}
                        {/* {preview === false && renderEditHeader()} */}
                        {preview === false &&
                            USE_ENHANCED_WIDGET_HEADER &&
                            item.type === "widget" && (
                                <WidgetCardHeader
                                    widget={item}
                                    providers={providers}
                                    selectedProviders={
                                        item.selectedProviders || {}
                                    }
                                    onProviderChange={handleProviderChange}
                                    onConfigure={handleOpenConfig}
                                    onRemove={() => handleClickRemove(item)}
                                    isDraggable={isDraggable}
                                />
                            )}
                        {preview === false &&
                            (!USE_ENHANCED_WIDGET_HEADER ||
                                item.type !== "widget") && (
                                <LayoutItemEditHeader
                                    layoutItem={item}
                                    workspace={workspace}
                                    direction={direction}
                                    order={order}
                                    parent={parent}
                                    onChangeOrder={handleChangeOrder}
                                    onChangeDirection={handleChangeDirection}
                                    onRemove={handleClickRemove}
                                    onClickAdd={handleClickAdd}
                                    onOpenConfig={handleOpenConfig}
                                />
                            )}
                        <LayoutContainer
                            id={`grid-container-${id}`}
                            direction={direction}
                            scrollable={scrollable}
                            width={"w-full"}
                            height={`h-full min-h-24`}
                            space={preview}
                            grow={grow}
                            className={`${
                                preview === false &&
                                item["component"] !== "Container"
                                    ? "p-2"
                                    : "p-2"
                            } ${
                                direction === "row" ? "space-x-2" : "space-y-2"
                            } ${
                                item.hasChildren === true
                                    ? "justify-between"
                                    : ""
                            }`}
                        >
                            {children !== null && children}
                        </LayoutContainer>
                        {/* {preview === false && renderEditFooter()} */}
                    </LayoutContainer>
                </DragComponent>
            </DropComponent>
        );
    }

    return preview === false
        ? renderEditItem()
        : renderComponentContainer(children);
};
