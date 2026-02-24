import { useContext } from "react";
import { AppContext, ThemeContext } from "../../Context";

/**
 * WorkspaceFooter
 */
export const WorkspaceFooter = ({
    title = "Footer Title",
    onClick,
    children,
}) => {
    const { debugMode } = useContext(AppContext);
    const { currentTheme } = useContext(ThemeContext);

    function debugClasses() {
        // const styles = debugStyles['workspace-footer']['classes'];
        // return debugMode === true && `space-y-4 ${styles}`
        return "";
    }

    return (
        <div className={`${debugClasses()} flex flex-col flex-0 w-full`}>
            {debugMode === true && (
                <span className="text-xs uppercase text-white">Footer</span>
            )}
            <div
                className={`flex flex-row flex-0 w-full p-4 ${currentTheme["bgPrimary"]} rounded-b uppercase font-bold text-xs text-gray-300 border-indigo-900 border-t`}
            >
                {title}
            </div>
        </div>
    );
};
