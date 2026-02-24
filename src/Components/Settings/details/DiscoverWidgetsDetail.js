import React, { useState, useContext } from "react";
import {
    ThemeContext,
    FontAwesomeIcon,
    SearchInput,
    Sidebar,
    Button,
    Paragraph,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";
import { RegistryPackageDetail } from "./RegistryPackageDetail";
import { useRegistrySearch } from "../../../hooks/useRegistrySearch";

/**
 * DiscoverWidgetsDetail — registry browser that lives inside the detail panel.
 *
 * Contains a back button, search input, scrollable package list, and when a
 * package is selected shows RegistryPackageDetail inline.
 */
export const DiscoverWidgetsDetail = ({ onBack }) => {
    const { currentTheme } = useContext(ThemeContext);
    const panelStyles = getStylesForItem(themeObjects.PANEL, currentTheme, {
        grow: false,
    });

    const {
        packages,
        flatWidgets,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        isInstalling,
        installError,
        installPackage,
        retry,
    } = useRegistrySearch();

    const [selectedPackageName, setSelectedPackageName] = useState(null);

    const selectedWidget = selectedPackageName
        ? flatWidgets.find((w) => w.packageName === selectedPackageName)
        : null;

    const handleInstall = () => {
        if (selectedWidget) {
            installPackage(selectedWidget);
        }
    };

    // If a package is selected, show its detail inline
    if (selectedWidget) {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                {/* Back to package list */}
                <div className="flex-shrink-0 px-4 pt-4">
                    <button
                        type="button"
                        onClick={() => setSelectedPackageName(null)}
                        className="flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <FontAwesomeIcon
                            icon="arrow-left"
                            className="h-3 w-3"
                        />
                        <span>Back</span>
                    </button>
                </div>

                <RegistryPackageDetail
                    widget={selectedWidget}
                    onInstall={handleInstall}
                    isInstalling={isInstalling}
                    installError={installError}
                />
            </div>
        );
    }

    // Package list view
    let listBody;

    if (isLoading) {
        listBody = (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <Paragraph className="text-sm opacity-50">
                        Loading registry...
                    </Paragraph>
                </div>
            </div>
        );
    } else if (error) {
        listBody = (
            <div className="px-4 py-8 text-center">
                <Paragraph className="text-sm text-red-400 mb-3">
                    {error}
                </Paragraph>
                <Button
                    title="Retry"
                    bgColor="bg-gray-700"
                    hoverBackgroundColor="hover:bg-gray-600"
                    textSize="text-sm"
                    padding="py-1 px-3"
                    onClick={retry}
                />
            </div>
        );
    } else if (packages.length === 0) {
        listBody = (
            <div className="px-4 py-8 text-center">
                <Paragraph className="text-sm opacity-50">
                    {searchQuery
                        ? "No packages match your search."
                        : "No packages available."}
                </Paragraph>
            </div>
        );
    } else {
        listBody = (
            <div className="space-y-1">
                {packages.map((pkg) => {
                    const widgetCount = (pkg.widgets || []).length;
                    return (
                        <Sidebar.Item
                            key={pkg.name}
                            icon={
                                <FontAwesomeIcon
                                    icon="cube"
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onClick={() => setSelectedPackageName(pkg.name)}
                            badge={`${widgetCount}`}
                        >
                            {pkg.displayName || pkg.name}
                        </Sidebar.Item>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col flex-1 min-h-0 ${
                panelStyles.textColor || "text-gray-200"
            }`}
        >
            {/* Back button */}
            <div className="flex-shrink-0 px-4 pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 transition-opacity"
                >
                    <FontAwesomeIcon icon="arrow-left" className="h-3 w-3" />
                    <span>Back</span>
                </button>
            </div>

            {/* Search */}
            <div className="flex-shrink-0 px-4 py-3">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search packages..."
                    inputClassName="py-1.5 text-xs"
                />
            </div>

            {/* Package list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2">
                {listBody}
            </div>

            {/* Summary footer */}
            {!isLoading && !error && packages.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 text-[10px] opacity-40 border-t border-white/10">
                    {packages.length} package
                    {packages.length !== 1 ? "s" : ""}
                </div>
            )}
        </div>
    );
};
