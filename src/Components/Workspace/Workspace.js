/**
 * Workspace
 *
 * The Workspace is comprised of the Layout, and Widgets that are configured by the User.
 * There may be multiple Workspaces of "Pages" that the user can create by dragging widgets into the Layout,
 * also defined by the user.
 */
import React, { useMemo } from "react";
import { getUUID } from "@trops/dash-react";
import { LayoutContainer } from "../../Components/Layout";
import { WorkspaceContext } from "../../Context";

export const Workspace = ({
    uuid,
    theme = false,
    workspaceData = null,
    children = null,
    width = "w-full",
    height = "h-full",
    direction = "col",
    scrollable = false,
    space = false,
    grow = false,
    className = "",
    ...props // what should we do with the props here...
}) => {
    // Generate the UUID for the Workspace to identify
    const uuidString = getUUID(uuid);

    const contextValue = useMemo(
        () => ({ workspaceData: props }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(props)]
    );

    return (
        <WorkspaceContext.Provider value={contextValue}>
            <LayoutContainer
                id={`WORKSPACE-${uuidString}`}
                theme={theme}
                direction={direction}
                scrollable={scrollable}
                width={width}
                height={height}
                className={`${className}`}
                grow={grow}
                space={space}
            >
                {children}
            </LayoutContainer>
        </WorkspaceContext.Provider>
    );
};
