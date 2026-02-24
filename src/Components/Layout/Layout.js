import React, { useContext, useEffect } from "react";
import { WorkspaceContext, AppContext } from "../../Context";
import { LayoutBuilder } from "../../Components/Layout";

/**
 * Manage the Layout of Workspaces
 */
export const Layout = ({ children, preview, scrollable = false }) => {
    const { debugMode } = useContext(AppContext);
    const workspaceDataFromContext = useContext(WorkspaceContext);

    useEffect(() => {
        console.log("LAYOUT effect", workspaceDataFromContext);
    });

    function debugClasses() {
        // const styles = debugStyles !== null && debugStyles !== undefined
        //     ? ('layout' in debugStyles ? debugStyles['layout']['classes'] : null) : null;
        return debugMode === true && `space-y-4`; // ${styles}`
    }

    return !children && workspaceDataFromContext ? (
        <LayoutBuilder
            workspace={workspaceDataFromContext}
            preview={preview}
            type={workspaceDataFromContext["type"]}
            controls={false}
        />
    ) : (
        <div
            className={`flex flex-col w-full space-y-4 ${
                scrollable === true ? "overflow-y-auto h-full" : "h-full" //"overflow-clip h-full"
            } ${debugClasses()} p-4`}
        >
            {debugMode && (
                <span className={`text-white uppercase text-xs`}>
                    LAYOUT has children and{" "}
                    {scrollable === true
                        ? "is scrollable"
                        : "is not scrollable"}
                </span>
            )}
            {/* <div
                className={`flex flex-col w-full space-y-4 p-0 h-full ${
                    scrollable === false ? "overflow-clip" : ""
                }`}
            > */}
            <div className={`flex flex-col w-full space-y-4 p-0 h-full`}>
                {children}
            </div>
        </div>
    );
};
