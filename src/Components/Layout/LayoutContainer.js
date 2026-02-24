import React, { useContext } from "react";
import { ThemeContext } from "../../Context";
import { getStylesForItem, themeObjects, getUUID } from "@trops/dash-react";

export const LayoutContainer = ({
    id,
    children,
    direction = "row",
    className = "",
    scrollable = false,
    width = "w-full",
    height = "",
    space = true,
    grow = false,
    debug = false,
    onClick = undefined,
    padding = "",
    prefix = "layout-container",
    ...props
}) => {
    const containerId = "uuid" in props ? props["uuid"] : getUUID(id, prefix);

    // get the styles
    const { currentTheme } = useContext(ThemeContext);
    const styles = getStylesForItem(
        themeObjects.LAYOUT_CONTAINER,
        currentTheme,
        {
            scrollable,
            width,
            height,
            grow,
            hasChildren: children !== undefined,
            childCount: React.Children.count(children),
            direction,
            space,
            padding,
        },
        containerId
    );

    //console.log("layout container styles ", styles);

    function renderDebugger(children, styleString) {
        return (
            debug === true && (
                <div
                    className={`flex flex-col bg-inherit space-y-1 flex-shrink`}
                >
                    <span className="flex flex-row flex-shrink text-xs bg-gray-900 uppercase text-gray-200 rounded">
                        {containerId} {styleString}
                    </span>
                    {children}
                </div>
            )
        );
    }

    // const classString = className !== "" ? className : styles.string;
    const classString = styles.string;

    return (
        <div
            // id={`LayoutContainer-${containerId}-${id}`}
            id={containerId}
            className={`flex ${classString} ${className}`}
            onClick={onClick}
        >
            {debug === false && children}
            {debug === true && renderDebugger(children, styles.string)}
        </div>
    );
};
