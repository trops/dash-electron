import React, { useEffect, useState } from "react";
import { Tag } from "@trops/dash-react";
import { getContainerColor } from "../../../../utils/layout";

const LayoutBuilderConfigContainerMenuItem = ({
    id,
    component,
    onClick,
    onMouseOver,
    item,
    children,
}) => {
    useEffect(() => {
        // const color = getContainerColor(item['parentWorkspace']);
    }, [item]);

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

    return (
        <div
            className={`flex flex-col border-dashed border border-indigo-800 rounded p-2 space-y-2`}
        >
            <div
                className={`flex flex-row p-2 space-x-2 cursor-pointer ${
                    isMouseOver === true ? "bg-indigo-600" : ""
                } rounded`}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            >
                <Tag
                    text={`${id}`}
                    textSize={"text-xs"}
                    color={getContainerColor(item)}
                />
                <span className="text-sm font-medium text-gray-200">
                    {component}
                </span>
            </div>
            {children}
        </div>
    );
};

export { LayoutBuilderConfigContainerMenuItem };
