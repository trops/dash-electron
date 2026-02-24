import React, { useContext } from "react";
import {
    ThemeContext,
    Button,
    SubHeading3,
    FontAwesomeIcon,
    Tag3,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";
import { resolveIcon } from "../../../utils/resolveIcon";

/**
 * InstalledWidgetDetail — detail panel for a selected installed widget.
 *
 * Shows widget name, version, author, description, install path, and actions
 * (Open in Finder, Uninstall).
 */
export const InstalledWidgetDetail = ({ widget, onDelete }) => {
    const { currentTheme } = useContext(ThemeContext);
    const panelStyles = getStylesForItem(themeObjects.PANEL, currentTheme, {
        grow: false,
    });

    if (!widget) return null;

    const handleOpenInFinder = () => {
        if (widget.path) {
            window.mainApi?.shell?.openPath(widget.path);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Body */}
            <div
                className={`flex-1 min-h-0 overflow-y-auto p-6 space-y-6 ${
                    panelStyles.textColor || "text-gray-200"
                }`}
            >
                {/* Name + icon */}
                <div className="flex flex-row items-center gap-3">
                    <FontAwesomeIcon
                        icon={resolveIcon(widget.icon)}
                        className="h-5 w-5 opacity-60"
                    />
                    <SubHeading3
                        title={widget.displayName || widget.name}
                        padding={false}
                    />
                    {widget.source === "builtin" && <Tag3 text="Built-in" />}
                </div>

                {/* Version */}
                {widget.version && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            VERSION
                        </span>
                        <span
                            className={`text-xs px-2 py-0.5 rounded ${currentTheme["bg-primary-medium"]} opacity-70 w-fit`}
                        >
                            v{widget.version}
                        </span>
                    </div>
                )}

                {/* Author */}
                {widget.author && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            AUTHOR
                        </span>
                        <span className="text-sm opacity-70">
                            {widget.author}
                        </span>
                    </div>
                )}

                {/* Description */}
                {widget.description && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            DESCRIPTION
                        </span>
                        <p className="text-sm opacity-70">
                            {widget.description}
                        </p>
                    </div>
                )}

                {/* Workspace */}
                {widget.workspace && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            WORKSPACE
                        </span>
                        <span className="text-sm opacity-70">
                            {widget.workspace}
                        </span>
                    </div>
                )}

                {/* Providers */}
                {widget.providers && widget.providers.length > 0 && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            PROVIDERS
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {widget.providers.map((p, i) => (
                                <span
                                    key={i}
                                    className={`text-xs px-2 py-0.5 rounded ${
                                        currentTheme["bg-primary-medium"] ||
                                        "bg-white/10"
                                    } opacity-70`}
                                >
                                    {p.type}
                                    {p.providerClass === "mcp" ? " (MCP)" : ""}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Location */}
                {widget.path && (
                    <div className="flex flex-col space-y-1">
                        <span className="text-xs font-semibold opacity-50">
                            LOCATION
                        </span>
                        <span className="text-xs opacity-50 break-all">
                            {widget.path}
                        </span>
                    </div>
                )}
            </div>

            {/* Footer — only show for installed (non-builtin) widgets */}
            {widget.source !== "builtin" && (
                <div
                    className={`flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t ${
                        currentTheme["border-primary-medium"] ||
                        "border-white/10"
                    }`}
                >
                    {widget.path && (
                        <Button
                            title="Open in Finder"
                            onClick={handleOpenInFinder}
                            size="sm"
                        />
                    )}
                    <Button
                        title="Uninstall"
                        onClick={() => onDelete(widget)}
                        size="sm"
                    />
                </div>
            )}
        </div>
    );
};
