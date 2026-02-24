import { useContext } from "react";
import { AppContext } from "../../Context";

/**
 * WorkspaceMenu
 */
export const WorkspaceMenu = ({ title = "Menu Title", onClick, children }) => {
    const { debugMode } = useContext(AppContext);

    function debugClasses() {
        // const styles = debugStyles['workspace-menu']['classes'];
        // return debugMode === true && `space-y-4 ${styles}`
        return "";
    }

    return (
        <div className={`${debugClasses()} flex flex-col flex-0 w-full`}>
            {debugMode === true && (
                <span className="text-xs uppercase text-white">Menu</span>
            )}
            <div
                className={`flex flex-row flex-0 w-full p-4 bg-gray-900 rounded-t uppercase font-bold text-xs text-gray-300 border-indigo-900 border-b justify-between`}
            >
                {title}
                <div className="flex flex-row space-x-1">{children}</div>
            </div>
        </div>
    );
};
