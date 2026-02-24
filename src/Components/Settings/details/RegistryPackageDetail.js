import React, { useContext } from "react";
import {
    ThemeContext,
    Button,
    SubHeading3,
    FontAwesomeIcon,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";

/**
 * RegistryPackageDetail — detail panel for a registry package/widget.
 *
 * Shows package header, description, tags, included widgets (with provider
 * badges), repository link, and an install button.
 *
 * Props:
 *   widget        – a flat widget entry with `isRegistry: true`
 *   onInstall     – callback to trigger install
 *   isInstalling  – true while install is in progress
 *   installError  – error string from a failed install (or null)
 */
export const RegistryPackageDetail = ({
    widget,
    onInstall,
    isInstalling = false,
    installError = null,
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const panelStyles = getStylesForItem(themeObjects.PANEL, currentTheme, {
        grow: false,
    });

    if (!widget) return null;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div
                className={`flex-1 min-h-0 overflow-y-auto p-6 space-y-6 ${
                    panelStyles.textColor || "text-gray-200"
                }`}
            >
                {/* Package Header */}
                <div className="flex flex-row items-center gap-3">
                    <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
                        <FontAwesomeIcon
                            icon={widget.icon || "cube"}
                            className="h-5 w-5"
                        />
                    </div>
                    <div>
                        <SubHeading3
                            title={widget.packageDisplayName}
                            padding={false}
                        />
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm opacity-60">
                                by {widget.packageAuthor || "Unknown"}
                            </span>
                            <span
                                className={`text-xs px-2 py-0.5 rounded ${currentTheme["bg-primary-medium"]} opacity-70`}
                            >
                                v{widget.packageVersion}
                            </span>
                        </div>
                    </div>
                </div>

                <hr className={currentTheme["border-primary-medium"]} />

                {/* Description */}
                {widget.packageDescription && (
                    <p className="text-sm">{widget.packageDescription}</p>
                )}

                {/* Tags */}
                {widget.packageTags && widget.packageTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {widget.packageTags.map((tag) => (
                            <span
                                key={tag}
                                className={`text-xs px-2 py-0.5 rounded ${currentTheme["bg-primary-medium"]} opacity-60`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Included Widgets */}
                <div>
                    <span className="text-xs font-semibold opacity-50 mb-1 block">
                        INCLUDED WIDGETS
                    </span>
                    <div className="space-y-1.5">
                        {(widget.packageWidgets || []).map((w, idx) => (
                            <div
                                key={idx}
                                className={`p-2 rounded ${currentTheme["bg-primary-medium"]}`}
                            >
                                <div className="text-sm font-medium">
                                    {w.displayName || w.name}
                                </div>
                                {w.description && (
                                    <div className="text-xs opacity-50 mt-0.5">
                                        {w.description}
                                    </div>
                                )}
                                {w.providers && w.providers.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {w.providers.map((p, pidx) => (
                                            <span
                                                key={pidx}
                                                className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400"
                                            >
                                                {p.type}
                                                {p.required ? " *" : ""}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Repository Link */}
                {widget.repository && (
                    <div>
                        <span className="text-xs font-semibold opacity-50 mb-1 block">
                            REPOSITORY
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                window.mainApi?.shell?.openExternal(
                                    widget.repository
                                )
                            }
                            className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors break-all text-left"
                        >
                            {widget.repository}
                        </button>
                    </div>
                )}

                {/* Install Error */}
                {installError && (
                    <div className="p-2 rounded bg-red-900/30 border border-red-700">
                        <p className="text-xs text-red-400">{installError}</p>
                    </div>
                )}
            </div>

            {/* Install Footer */}
            <div
                className={`flex items-center justify-end px-6 py-3 border-t ${currentTheme["border-primary-medium"]}`}
            >
                <Button
                    title={isInstalling ? "Installing..." : "Install Package"}
                    bgColor="bg-blue-600"
                    hoverBackgroundColor={
                        isInstalling ? "" : "hover:bg-blue-700"
                    }
                    textSize="text-sm"
                    padding="py-1.5 px-4"
                    onClick={onInstall}
                    disabled={isInstalling}
                />
            </div>
        </div>
    );
};
