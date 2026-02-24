/**
 * LayoutBuilderGridItem
 * An item without any Children in the editable layout
 *
 * @param {*} param0
 * @returns
 */
import React from "react";
import { ButtonIcon } from "@trops/dash-react";
import { DragComponent } from "@trops/dash-react";
import {
    renderComponent,
    getContainerColor,
    getContainerBorderColor,
    numChildrenForLayout,
    getLayoutItemById,
    isMaxOrderForItem,
    isMinOrderForItem,
} from "../../../utils/layout";

import { LayoutContainerGridItem } from "./GridItem/LayoutContainerGridItem";
import { WorkspaceContainerGridItem } from "./GridItem/WorkspaceContainerGridItem";
import { WidgetContainerGridItem } from "./GridItem/WidgetContainerGridItem";
import { DashboardModel } from "../../../Models";
import { ComponentManager } from "../../../ComponentManager";
import { WidgetCard } from "./Enhanced";

// Feature flag for enhanced widget header with provider support
const USE_ENHANCED_WIDGET_HEADER = true;

/**
 * Depending on the editMode we will show the different grid builder items to show the correct
 * functionality for editing appropriately.
 */
export const LayoutBuilderGridItem = ({
    item,
    workspace,
    id,
    parent,
    order,
    scrollable,
    component = null,
    preview,
    editMode,
    children,
    onClickRemove,
    onClickAdd,
    onClickQuickAdd,
    onClickExpand,
    onClickShrink,
    onClickContextSettings,
    onChangeDirection,
    onChangeOrder,
    onOpenConfig,
    onOpenEvents,
    onDropItem,
    onDragItem,
    onProviderSelect,
    providers = [],
    width,
    height,
    space,
    grow,
    direction,
    isDraggable,
    uuid,
    layout,
}) => {
    function handleClickRemove(e) {
        console.log("clicked remove ", e, id);
        onClickRemove(id);
    }

    function handleChangeDirection() {
        onChangeDirection(id, direction);
    }

    function handleChangeOrder(direction) {
        console.log("changing order ", order);
        onChangeOrder(item, direction);
    }

    function handleOpenConfig() {
        onOpenConfig(item);
    }

    function renderArrows() {
        return (
            preview === false && (
                <div className={`flex ${direction}`}>
                    <div
                        className={`flex ${direction} w-full h-fit min-h-full text-base lg:text-lg cursor-pointer text-gray-200 pb-2`}
                        onClick={handleOpenConfig}
                    >
                        {component}
                    </div>
                </div>
            )
        );
    }

    function renderUserPreferences() {
        try {
            return (
                preview === false &&
                item.hasOwnProperty("userPrefs") && (
                    <div className={`flex flex-col h-fit`}>
                        <div
                            className={`flex flex-col w-full text-xs text-gray-200 justify-start p-2`}
                            onClick={handleOpenConfig}
                        >
                            {Object.keys(item["userPrefs"]).map((userPref) => {
                                return (
                                    <span
                                        key={`user-pref-${userPref}`}
                                        className="font-normal"
                                    >{`${userPref}:${item["userPrefs"][userPref]}`}</span>
                                );
                            })}
                        </div>
                    </div>
                )
            );
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    function renderComponentData() {
        console.log("rendering component data ", component, id, item);
        return component ? renderComponent(component, id, item, null) : null;
    }

    function handleDropItem(item) {
        // we have to shuffle the parent of the source item to the drop item
        if (onDropItem) {
            onDropItem(item);
        }
    }

    function handleDragItem(item) {
        // we have to shuffle the parent of the source item to the drag item
        if (onDragItem) {
            onDragItem(item);
        }
    }

    function handleClickEvents() {
        onOpenEvents(item);
    }

    function dragType(item) {
        console.log("widget drag type ", item["workspace"]);

        if (
            item["type"] === "workspace" &&
            item["component"] !== "Container" &&
            item["component"] !== "LayoutContainer"
        ) {
            return item["parentWorkspaceName"];
        }
        if (
            item["component"] === "Container" ||
            item["component"] === "LayoutContainer"
        ) {
            return "layout";
        }
        return item["parentWorkspaceName"];
    }

    function handleClickContextSettings(item) {
        onClickContextSettings(item);
    }

    // function numChildrenForLayout() {
    //     let num = 0;
    //     if ('parentWorkspace' in item) {
    //         if ('layout' in item['parentWorkspace']) {
    //             num = Object.keys(item['parentWorkspace']['layout']).length;
    //         }
    //     }
    //     return num;
    // }

    function handleClickAdd() {
        if (onClickAdd) {
            onClickAdd(item);
        }
    }

    function handleProviderChange(providerType, providerId, createNew = false) {
        console.log("[LayoutBuilderGridItem] Provider change:", {
            providerType,
            providerId,
            createNew,
            item,
        });
        if (onProviderSelect) {
            onProviderSelect(item, providerType, providerId, createNew);
        }
    }

    function renderEditView() {
        const drag = dragType(item);
        const numChildren = numChildrenForLayout(item, workspace["layout"]);

        // Check if this item can have children (for + button)
        const config = ComponentManager.config(item["component"], item);
        const canHaveChildren = config ? config["canHaveChildren"] : false;
        const isContainer = item.type !== "widget";

        // get the parent workspace
        const dashboard = new DashboardModel(workspace);
        const parentWorkspace = dashboard.getComponentById(item["parent"]);

        // determine the parent layout direction...
        const parentLayout = getLayoutItemById(
            workspace["layout"],
            item["parent"]
        );
        const parentDirection = parentLayout
            ? parentLayout["direction"]
            : parentWorkspace["direction"];

        // determine if the item is at the "start/end" of the col/row
        const isMaxOrder = isMaxOrderForItem(
            workspace["layout"],
            item,
            item["parent"]
        );
        const isMinOrder = isMinOrderForItem(
            workspace["layout"],
            item,
            item["parent"]
        );

        const containerBorderColor = getContainerBorderColor(item);
        const containerBackgroundColor = getContainerColor(item);

        return isDraggable === true ? (
            <DragComponent
                obj={item}
                id={id}
                type={drag}
                parent={parent}
                onDropItem={handleDropItem}
                onDragItem={handleDragItem}
                width={"w-full"}
                height={"h-full"}
            >
                <div
                    className={`flex flex-col border-4 h-full w-full ${containerBorderColor} rounded text-xs font-bold text-gray-200 p-2 ${containerBackgroundColor}`}
                >
                    {console.log(
                        "[LayoutBuilderGridItem renderEditView] Debug:",
                        {
                            USE_ENHANCED_WIDGET_HEADER,
                            itemType: item.type,
                            itemComponent: item.component,
                            preview,
                            willRenderWidgetCard:
                                USE_ENHANCED_WIDGET_HEADER &&
                                item.type === "widget",
                            willRenderOldHeader:
                                !USE_ENHANCED_WIDGET_HEADER ||
                                item.type !== "widget",
                        }
                    )}

                    {/* Enhanced Widget Card with Header, Body, Footer */}
                    {USE_ENHANCED_WIDGET_HEADER && item.type === "widget" && (
                        <WidgetCard preview={preview}>
                            <WidgetCard.Header
                                item={item}
                                providers={providers}
                                selectedProviders={item.selectedProviders || {}}
                                onProviderChange={handleProviderChange}
                                onConfigure={handleOpenConfig}
                                onDelete={handleClickRemove}
                            />
                            <WidgetCard.Body padding="p-3">
                                {renderComponentData()}
                            </WidgetCard.Body>
                            <WidgetCard.Footer
                                item={item}
                                onConfigure={handleOpenConfig}
                            />
                        </WidgetCard>
                    )}

                    {/* Original Header (Fallback or for containers) */}
                    {(!USE_ENHANCED_WIDGET_HEADER ||
                        item.type !== "widget") && (
                        <>
                            {item["parentWorkspaceName"]}
                            <div
                                className={`flex flex-col ${scrollable} ${
                                    preview === false && "text-blue-900 rounded"
                                } `}
                                onClick={handleOpenConfig}
                            >
                                {preview === false && renderArrows()}
                                {preview === false && renderUserPreferences()}
                            </div>
                            <div className="flex flex-row space-x-1 justify-between text-xs w-full">
                                <div className="flex flex-row space-x-1">
                                    {/* Add button for containers that can have children */}
                                    {canHaveChildren && isContainer && (
                                        <ButtonIcon
                                            theme={false}
                                            icon="plus"
                                            onClick={handleClickAdd}
                                            backgroundColor="bg-transparent"
                                            hoverBackgroundColor="hover:bg-green-700"
                                        />
                                    )}
                                    {item.eventHandlers.length > 0 && (
                                        <ButtonIcon
                                            icon="phone"
                                            onClick={handleClickEvents}
                                            backgroundColor={getContainerColor(
                                                parentWorkspace
                                            )}
                                            hoverBackgroundColor=""
                                            text={
                                                item.eventHandlers.length > 0
                                                    ? item.eventHandlers.length
                                                    : ""
                                            }
                                            textSize={"text-xs"}
                                        />
                                    )}
                                    {order > 1 &&
                                        numChildren > 1 &&
                                        isMinOrder === false && (
                                            <ButtonIcon
                                                theme={false}
                                                icon={`${
                                                    parentDirection === "col"
                                                        ? "arrow-left"
                                                        : "arrow-up"
                                                }`}
                                                onClick={() =>
                                                    handleChangeOrder("down")
                                                }
                                                backgroundColor="bg-transparent"
                                                hoverBackgroundColor="hover:bg-blue-700"
                                            />
                                        )}
                                    {order > 1 &&
                                        numChildren > 1 &&
                                        isMaxOrder === false && (
                                            <ButtonIcon
                                                theme={false}
                                                icon={`${
                                                    parentDirection === "col"
                                                        ? "arrow-right"
                                                        : "arrow-down"
                                                }`}
                                                onClick={() =>
                                                    handleChangeOrder("up")
                                                }
                                                backgroundColor="bg-transparent"
                                                hoverBackgroundColor="hover:bg-blue-700"
                                            />
                                        )}
                                    <ButtonIcon
                                        theme={false}
                                        icon="trash"
                                        onClick={handleClickRemove}
                                        backgroundColor={getContainerColor(
                                            parentWorkspace
                                        )}
                                        hoverBackgroundColor="hover:bg-red-900"
                                    />
                                    <ButtonIcon
                                        theme={false}
                                        icon="plug"
                                        onClick={() =>
                                            handleClickContextSettings(item)
                                        }
                                        backgroundColor={getContainerColor(
                                            parentWorkspace
                                        )}
                                        hoverBackgroundColor="hover:bg-red-900"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DragComponent>
        ) : (
            <div
                className={`flex flex-col border-4 rounded text-xs font-bold text-gray-200 grow`}
            >
                {/* Enhanced Widget Card with Header, Body, Footer (Non-Draggable) */}
                {USE_ENHANCED_WIDGET_HEADER && item.type === "widget" && (
                    <WidgetCard preview={preview}>
                        <WidgetCard.Header
                            item={item}
                            providers={providers}
                            selectedProviders={item.selectedProviders || {}}
                            onProviderChange={handleProviderChange}
                            onConfigure={handleOpenConfig}
                            onDelete={handleClickRemove}
                        />
                        <WidgetCard.Body padding="p-3">
                            {renderComponentData()}
                        </WidgetCard.Body>
                        <WidgetCard.Footer
                            item={item}
                            onConfigure={handleOpenConfig}
                        />
                    </WidgetCard>
                )}

                {/* Original Header (Fallback or for containers) */}
                {(!USE_ENHANCED_WIDGET_HEADER || item.type !== "widget") && (
                    <>
                        <div className="flex flex-row space-x-2 rounded-t justify-between w-full">
                            <div className="hidden xl:flex flex-row space-x-1 w-full justify-end p-2">
                                {/* Add button for containers that can have children */}
                                {canHaveChildren && isContainer && (
                                    <ButtonIcon
                                        icon="plus"
                                        onClick={handleClickAdd}
                                        backgroundColor="bg-transparent"
                                        hoverBackgroundColor="hover:bg-green-700"
                                    />
                                )}
                                {numChildren > 1 && (
                                    <ButtonIcon
                                        icon={`${
                                            parentDirection === "col"
                                                ? "arrows-left-right"
                                                : "arrows-up-down"
                                        }`}
                                        onClick={handleChangeDirection}
                                        backgroundColor="bg-transparent"
                                        hoverBackgroundColor="hover:bg-blue-700"
                                    />
                                )}
                                <ButtonIcon
                                    icon={"cog"}
                                    onClick={handleOpenConfig}
                                    backgroundColor="bg-transparent"
                                    hoverBackgroundColor="hover:bg-blue-700"
                                />
                                <ButtonIcon
                                    icon="trash"
                                    onClick={handleClickRemove}
                                    backgroundColor="bg-transparent"
                                    hoverBackgroundColor="hover:bg-red-900"
                                />
                            </div>
                        </div>
                        <div
                            className={`flex ${direction} ${scrollable} text-lg ${
                                preview === false && "text-blue-900 rounded m-2"
                            }`}
                        >
                            {/* ITEM not draggable {editMode} {item["component"]} {item["type"]} {item["workspace"]} */}
                            {preview === false && renderUserPreferences()}
                        </div>
                        <div className="flex flex-row space-x-1 w-full justify-between text-xs">
                            {/* {item && "workspace" in item && (
                        <Tag text={`${dragType(item)}`} textSize={"text-xs"} />
                    )} */}
                            <div className="flex flex-row space-x-1">
                                {item.eventHandlers.length > 0 && (
                                    <ButtonIcon
                                        icon="phone"
                                        onClick={handleClickEvents}
                                        bgColor={getContainerColor(
                                            parentWorkspace
                                        )}
                                        hoverBackgroundColor="hover:bg-gray-900"
                                        text={
                                            item.eventHandlers.length > 0
                                                ? item.eventHandlers.length
                                                : ""
                                        }
                                        textSize={"text-xs"}
                                    />
                                )}
                                <ButtonIcon
                                    icon="trash"
                                    onClick={handleClickRemove}
                                    backgroundColor={getContainerColor(
                                        parentWorkspace
                                    )}
                                    hoverBackgroundColor="hover:bg-red-900"
                                />
                                {order > 1 &&
                                    numChildren > 1 &&
                                    isMinOrder === false && (
                                        <ButtonIcon
                                            icon={`${
                                                parentDirection === "col"
                                                    ? "arrow-left"
                                                    : "arrow-up"
                                            }`}
                                            onClick={() =>
                                                handleChangeOrder("down")
                                            }
                                            backgroundColor="bg-transparent"
                                            hoverBackgroundColor="hover:bg-blue-700"
                                        />
                                    )}
                                {order > 1 &&
                                    numChildren > 1 &&
                                    isMaxOrder === false && (
                                        <ButtonIcon
                                            icon={`${
                                                parentDirection === "col"
                                                    ? "arrow-right"
                                                    : "arrow-down"
                                            }`}
                                            onClick={() =>
                                                handleChangeOrder("up")
                                            }
                                            backgroundColor="bg-transparent"
                                            hoverBackgroundColor="hover:bg-blue-700"
                                        />
                                    )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    function renderEditModeView() {
        console.log("[LayoutBuilderGridItem renderEditModeView] Called with:", {
            editMode,
            itemType: item.type,
            itemComponent: item.component,
            preview,
        });
        if (editMode === "layout") return renderLayoutGridItem();
        if (editMode === "workspace") return renderWorkspaceGridItem();
        if (editMode === "widget") return renderWidgetGridItem();
        if (editMode === "all") return renderEditView();
    }

    function renderLayoutGridItem() {
        return (
            <LayoutContainerGridItem
                key={`container-grid-item-${uuid}-${
                    preview === true ? "view" : "edit"
                }`}
                uuid={uuid}
                item={item}
                layout={layout}
                id={id}
                parent={parent}
                row={order}
                col={order}
                order={order}
                onClickAdd={onClickAdd}
                onClickQuickAdd={onClickQuickAdd}
                onClickRemove={onClickRemove}
                onClickExpand={onClickExpand}
                onClickShrink={onClickShrink}
                onChangeDirection={onChangeDirection}
                onChangeOrder={onChangeOrder}
                onDropItem={onDropItem}
                onDragItem={onDragItem}
                name={id}
                width={width}
                height={height}
                direction={direction}
                scrollable={scrollable}
                space={space}
                grow={grow}
                preview={preview}
                editMode={editMode}
                component={component}
                onOpenConfig={onOpenConfig}
                onOpenEvents={onOpenEvents}
                isDraggable={isDraggable}
                workspace={workspace}
            >
                {children}
            </LayoutContainerGridItem>
        );
    }

    function renderWorkspaceGridItem() {
        return (
            <WorkspaceContainerGridItem
                key={`container-grid-item-${uuid}-${
                    preview === true ? "view" : "edit"
                }`}
                uuid={uuid}
                item={item}
                layout={layout}
                id={id}
                parent={parent}
                row={order}
                col={order}
                order={order}
                onClickAdd={onClickAdd}
                onClickQuickAdd={onClickQuickAdd}
                onClickRemove={onClickRemove}
                onClickExpand={onClickExpand}
                onClickShrink={onClickShrink}
                onChangeDirection={onChangeDirection}
                onChangeOrder={onChangeOrder}
                onDropItem={onDropItem}
                onDragItem={onDragItem}
                name={id}
                width={width}
                height={height}
                direction={direction}
                scrollable={scrollable}
                space={space}
                grow={grow}
                preview={preview}
                editMode={editMode}
                component={component}
                onOpenConfig={onOpenConfig}
                onOpenEvents={onOpenEvents}
                isDraggable={isDraggable}
                workspace={workspace}
            >
                {children}
            </WorkspaceContainerGridItem>
        );
    }

    function renderWidgetGridItem() {
        return (
            <WidgetContainerGridItem
                key={`container-grid-item-${uuid}-${
                    preview === true ? "view" : "edit"
                }`}
                uuid={uuid}
                item={item}
                layout={layout}
                id={id}
                parent={parent}
                row={order}
                col={order}
                order={order}
                onClickAdd={onClickAdd}
                onClickQuickAdd={onClickQuickAdd}
                onClickRemove={onClickRemove}
                onClickExpand={onClickExpand}
                onClickShrink={onClickShrink}
                onChangeDirection={onChangeDirection}
                onChangeOrder={onChangeOrder}
                onDropItem={onDropItem}
                onDragItem={onDragItem}
                onProviderSelect={onProviderSelect}
                providers={providers}
                name={id}
                width={width}
                height={height}
                direction={direction}
                scrollable={scrollable}
                space={space}
                grow={grow}
                preview={preview}
                editMode={editMode}
                component={component}
                onOpenConfig={onOpenConfig}
                onOpenEvents={onOpenEvents}
                isDraggable={isDraggable}
                workspace={workspace}
            >
                {children}
            </WidgetContainerGridItem>
        );
    }

    console.log("[LayoutBuilderGridItem] Rendering:", {
        component: item?.component,
        type: item?.type,
        preview,
        hasChildren: !!children,
        editMode,
        willRenderHeader:
            USE_ENHANCED_WIDGET_HEADER &&
            item?.type === "widget" &&
            preview === false,
    });

    return children
        ? children
        : preview === false
        ? renderEditModeView()
        : renderComponentData();
};
