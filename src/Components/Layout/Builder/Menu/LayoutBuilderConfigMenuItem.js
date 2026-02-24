import React, { useState } from "react";
import { Tag } from "@trops/dash-react";
import { getContainerColor } from "../../../../utils/layout";
import { DashboardModel } from "../../../../Models";

const LayoutBuilderConfigMenuItem = ({
    id,
    component,
    onClick,
    onMouseOver,
    item,
    workspace,
}) => {
    const [isMouseOver, setIsMouseOver] = useState(false);

    function handleMouseOver(e) {
        setIsMouseOver(true);
        onMouseOver(e);
    }

    function handleMouseOut(e) {
        setIsMouseOver(false);
    }

    function handleClick(e) {
        onClick(item);
    }

    function getContainerColorForParent() {
        // get the parent workspace
        const dashboard = new DashboardModel(workspace);
        const parentWorkspace = dashboard.getComponentById(item["parent"]);
        return getContainerColor(parentWorkspace);
    }

    return (
        <div
            className={`flex flex-row w-full border border-gray-900 space-x-2 p-2 cursor-pointer justify-between items-center ${
                isMouseOver === true ? "bg-green-600" : ""
            } rounded`}
            onClick={handleClick}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
        >
            <div className="flex flex-row space-x-2">
                <Tag
                    textSize={"text-xs"}
                    text={`${id}`}
                    color={getContainerColorForParent()}
                />
                <span
                    className={`text-sm font-medium ${
                        isMouseOver === true ? "text-gray-200" : "text-gray-200"
                    }`}
                >
                    {component}
                </span>
            </div>
        </div>
    );
};

export { LayoutBuilderConfigMenuItem };
