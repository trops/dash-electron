import React from "react";
import { ComponentManager } from "../../../../ComponentManager";
import {
    getContainerColor,
    getLayoutItemById,
    isMaxOrderForItem,
    isMinOrderForItem,
    numChildrenForLayout,
} from "../../../../utils/layout";

import { ButtonIcon3 } from "@trops/dash-react";
import { DashboardModel } from "../../../../Models";

export const LayoutItemEditHeader = ({
    layoutItem,
    workspace,
    direction,
    order,
    parent,
    onClickAdd,
    onChangeDirection,
    onChangeOrder,
    onRemove,
    onOpenConfig,
    ...props
}) => {
    function renderEditFooter(item) {
        const config = ComponentManager.config(item["component"], item);
        const canHaveChildren = config ? config["canHaveChildren"] : false;
        const numChildren = numChildrenForLayout(item, workspace["layout"]);

        const dashboard = new DashboardModel(workspace);
        const parentWorkspace = dashboard.getComponentById(item["parent"]);

        console.log("parent workspace ", parentWorkspace);

        // determine the parent layout direction...
        const parentLayout = getLayoutItemById(
            workspace["layout"],
            item["parent"]
        );
        const parentDirection = parentLayout
            ? parentLayout["direction"]
            : "col";

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

        const isContainer = item.type !== "widget"; //item["component"] === "Container";
        const textColor =
            isContainer === true ? "text-gray-300" : "text-gray-300";

        console.log("HEADER ", isContainer, textColor, item, layoutItem);

        return (
            <div
                className={`flex flex-row space-x-1 justify-between w-full pb-1`}
            >
                <div className={`flex flex-row space-x-1 ${textColor}`}>
                    {canHaveChildren === true && isContainer && (
                        <ButtonIcon3
                            icon="plus"
                            onClick={() => onClickAdd()}
                            backgroundColor="bg-transparent"
                            hoverBackgroundColor="hover:bg-green-700"
                            className={`${textColor}`}
                        />
                    )}
                    <ButtonIcon3
                        icon={`${
                            direction === "col"
                                ? "arrows-left-right"
                                : "arrows-up-down"
                        }`}
                        onClick={onChangeDirection}
                        backgroundColor="bg-transparent"
                        hoverBackgroundColor="hover:bg-blue-700"
                        className={`${textColor}`}
                    />
                    <ButtonIcon3
                        className={`${textColor}`}
                        icon={"cog"}
                        onClick={onOpenConfig}
                        backgroundColor="bg-transparent"
                        hoverBackgroundColor="hover:bg-blue-700"
                    />
                    {order > 1 && numChildren > 1 && isMinOrder === false && (
                        <ButtonIcon3
                            icon={`${
                                parentDirection === "col"
                                    ? "arrow-up"
                                    : "arrow-left"
                            }`}
                            iconSize="h-3 w-3"
                            onClick={() => onChangeOrder("down")}
                            backgroundColor="bg-transparent"
                            hoverBackgroundColor="hover:bg-blue-700"
                            className={`${textColor}`}
                        />
                    )}
                    {order > 1 && numChildren > 1 && isMaxOrder === false && (
                        <ButtonIcon3
                            icon={`${
                                parentDirection === "col"
                                    ? "arrow-down"
                                    : "arrow-right"
                            }`}
                            iconSize="h-3 w-3"
                            onClick={() => onChangeOrder("up")}
                            backgroundColor="bg-transparent"
                            hoverBackgroundColor="hover:bg-blue-700"
                            className={`${textColor}`}
                        />
                    )}
                    {parent > 0 && (
                        <ButtonIcon3
                            icon="trash"
                            iconSize="h-3 w-3"
                            onClick={onRemove}
                            backgroundColor="bg-transparent"
                            hoverBackgroundColor="hover:bg-red-900"
                            className={`${textColor}`}
                        />
                    )}
                    {/* <LayoutQuickAddMenu item={layoutItem} /> */}
                </div>
            </div>
        );
    }

    function renderEditHeader(item) {
        return item["workspace"] !== "layout" ? (
            <div
                className={`flex flex-row px-2 space-x-1 text-sm font-bold ${getContainerColor(
                    item
                )} text-gray-300 w-full justify-between items-center`}
            >
                <span className="text-xs font-medium">
                    {`${item["component"]}`} - not layout
                </span>
                <div id="quick-add-menu" className="flex flex-row">
                    {renderEditFooter(layoutItem)}
                </div>
            </div>
        ) : (
            <div
                className={`flex flex-row space-x-1 px-2 text-xs ${getContainerColor(
                    item
                )} text-gray-300 font-medium w-full justify-between items-center z-10`}
            >
                <span className="text-xs font-medium text-gray-500">{`${item["component"]}`}</span>
                <div
                    id="quick-add-menu"
                    className="flex flex-row justify-end py-1 px-1"
                >
                    {renderEditFooter(layoutItem)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-row w-full justify-end z-10 flex-shrink">
            {renderEditHeader(layoutItem)}
        </div>
    );
};
