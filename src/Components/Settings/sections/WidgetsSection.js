import React, { useState, useRef, useEffect, useContext } from "react";
import {
    ConfirmationModal,
    FontAwesomeIcon,
    Sidebar,
    Paragraph,
    Tag3,
    ThemeContext,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";
import { SectionLayout } from "../SectionLayout";
import { InstalledWidgetDetail } from "../details/InstalledWidgetDetail";
import { InstallWidgetPicker } from "../details/InstallWidgetPicker";
import { DiscoverWidgetsDetail } from "../details/DiscoverWidgetsDetail";
import { useInstalledWidgets } from "../../../hooks/useInstalledWidgets";
import { resolveIcon } from "../../../utils/resolveIcon";

/**
 * WidgetsSection — unified widgets tab in AppSettingsModal.
 *
 * Left column: installed widgets list.
 * Detail panel: widget detail, install picker, registry browser, or
 * install result depending on state.
 */
export const WidgetsSection = ({
    createRequested = false,
    onCreateAcknowledged = null,
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const panelStyles = getStylesForItem(themeObjects.PANEL, currentTheme, {
        grow: false,
    });

    const { widgets, isLoading, error, uninstallWidget, refresh } =
        useInstalledWidgets();

    const [selectedWidgetName, setSelectedWidgetName] = useState(null);
    // null | "picker" | "discover" | "zip-result" | "folder-result"
    const [installMode, setInstallMode] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [installResult, setInstallResult] = useState(null);

    // Respond to external create trigger from header button
    const prevCreateRequested = useRef(false);
    useEffect(() => {
        if (createRequested && !prevCreateRequested.current) {
            setSelectedWidgetName(null);
            setInstallMode("picker");
            setInstallResult(null);
        }
        prevCreateRequested.current = createRequested;
        if (createRequested && onCreateAcknowledged) {
            onCreateAcknowledged();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createRequested]);

    const selectedWidget = selectedWidgetName
        ? widgets.find((w) => w.name === selectedWidgetName)
        : null;

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        try {
            await uninstallWidget(deleteTarget.name);
            if (selectedWidgetName === deleteTarget.name) {
                setSelectedWidgetName(null);
            }
        } catch (err) {
            console.error("[WidgetsSection] Uninstall error:", err);
        }
        setDeleteTarget(null);
    }

    async function handleInstallFromZip() {
        if (!window.mainApi?.dialog) return;
        try {
            const filepath = await window.mainApi.dialog.chooseFile(true, [
                "zip",
            ]);
            if (!filepath) return;

            // Extract widget name from filename (e.g., "weather.zip" -> "weather")
            const filename = filepath.split("/").pop() || filepath;
            const widgetName = filename.replace(/\.zip$/i, "");

            setInstallMode("zip-result");
            setInstallResult({ status: "loading", message: "Installing..." });

            await window.mainApi.widgets.installLocal(widgetName, filepath);
            await refresh();

            setInstallResult({
                status: "success",
                message: `Widget "${widgetName}" installed successfully.`,
            });
        } catch (err) {
            console.error("[WidgetsSection] ZIP install error:", err);
            setInstallResult({
                status: "error",
                message: err.message || "Failed to install widget from ZIP.",
            });
        }
    }

    async function handleLoadFolder() {
        if (!window.mainApi?.dialog) return;
        try {
            const folderPath = await window.mainApi.dialog.chooseFile(false);
            if (!folderPath) return;

            setInstallMode("folder-result");
            setInstallResult({
                status: "loading",
                message: "Loading widgets...",
            });

            const results = await window.mainApi.widgets.loadFolder(folderPath);
            await refresh();

            const count = Array.isArray(results) ? results.length : 0;
            const isSingle = count === 1 && results[0]?.mode === "single";
            const skipped = results?.skipped || 0;

            let message;
            if (isSingle) {
                message = `Installed widget "${results[0].name}" from folder.`;
            } else if (count > 0) {
                message = `Loaded ${count} widget${
                    count !== 1 ? "s" : ""
                } from folder.`;
                if (skipped > 0) {
                    message += ` (${skipped} non-widget folder${
                        skipped !== 1 ? "s" : ""
                    } skipped)`;
                }
            } else {
                message =
                    "No widgets found in the selected folder. Expected a folder containing widget subdirectories, each with a package.json or widgets/ directory.";
            }

            setInstallResult({
                status: count > 0 ? "success" : "error",
                message,
                details: count > 0 ? results : null,
            });
        } catch (err) {
            console.error("[WidgetsSection] Folder load error:", err);
            setInstallResult({
                status: "error",
                message: err.message || "Failed to load widgets from folder.",
            });
        }
    }

    function handlePickerSelect(option) {
        if (option === "discover") {
            setInstallMode("discover");
        } else if (option === "zip") {
            handleInstallFromZip();
        } else if (option === "folder") {
            handleLoadFolder();
        }
    }

    // ── List content (left column) ──────────────────────────────────────

    let listBody;

    if (isLoading) {
        listBody = (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <Paragraph className="text-sm opacity-50">
                        Loading widgets...
                    </Paragraph>
                </div>
            </div>
        );
    } else if (error) {
        listBody = (
            <span className="text-sm text-red-400 py-8 text-center block px-4">
                {error}
            </span>
        );
    } else if (widgets.length === 0) {
        listBody = (
            <span className="text-sm opacity-40 py-8 text-center block">
                No widgets available
            </span>
        );
    } else {
        listBody = widgets.map((widget) => {
            const isSelected =
                selectedWidgetName === widget.name && !installMode;
            return (
                <Sidebar.Item
                    key={widget.name}
                    icon={
                        <FontAwesomeIcon
                            icon={resolveIcon(widget.icon)}
                            className="h-3.5 w-3.5"
                        />
                    }
                    active={isSelected}
                    onClick={() => {
                        setSelectedWidgetName(widget.name);
                        setInstallMode(null);
                        setInstallResult(null);
                    }}
                    className={isSelected ? "bg-white/10 opacity-100" : ""}
                >
                    <span className="flex items-center gap-2">
                        {widget.displayName || widget.name}
                        {widget.source === "builtin" && (
                            <Tag3 text="Built-in" />
                        )}
                    </span>
                </Sidebar.Item>
            );
        });
    }

    const listContent = (
        <div className="flex flex-col h-full">
            <Sidebar.Content>{listBody}</Sidebar.Content>

            {/* Summary footer */}
            {!isLoading && !error && widgets.length > 0 && (
                <div className="px-3 py-2 text-[10px] opacity-40 flex-shrink-0 border-t border-white/10">
                    {(() => {
                        const builtinCount = widgets.filter(
                            (w) => w.source === "builtin"
                        ).length;
                        const installedCount = widgets.filter(
                            (w) => w.source === "installed"
                        ).length;
                        const parts = [];
                        if (builtinCount > 0)
                            parts.push(`${builtinCount} built-in`);
                        if (installedCount > 0)
                            parts.push(`${installedCount} installed`);
                        return parts.join(", ");
                    })()}
                </div>
            )}
        </div>
    );

    // ── Detail content (right column) ───────────────────────────────────

    let detailContent = null;

    if (installMode === "picker") {
        detailContent = <InstallWidgetPicker onSelect={handlePickerSelect} />;
    } else if (installMode === "discover") {
        detailContent = (
            <DiscoverWidgetsDetail onBack={() => setInstallMode("picker")} />
        );
    } else if (
        installMode === "zip-result" ||
        installMode === "folder-result"
    ) {
        detailContent = (
            <div
                className={`flex flex-col flex-1 min-h-0 p-6 space-y-4 ${
                    panelStyles.textColor || "text-gray-200"
                }`}
            >
                {installResult?.status === "loading" && (
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <span className="text-sm opacity-70">
                            {installResult.message}
                        </span>
                    </div>
                )}
                {installResult?.status === "success" && (
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon
                                icon="circle-check"
                                className="h-4 w-4 text-green-400"
                            />
                            <span className="text-sm">
                                {installResult.message}
                            </span>
                        </div>
                        {installResult.details &&
                            installResult.details.length > 0 && (
                                <div className="space-y-1 pl-6">
                                    {installResult.details.map((w, i) => (
                                        <div
                                            key={i}
                                            className="text-xs opacity-60"
                                        >
                                            {w.displayName || w.name || w}
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                )}
                {installResult?.status === "error" && (
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                            icon="circle-xmark"
                            className="h-4 w-4 text-red-400"
                        />
                        <span className="text-sm text-red-400">
                            {installResult.message}
                        </span>
                    </div>
                )}
            </div>
        );
    } else if (selectedWidget) {
        detailContent = (
            <InstalledWidgetDetail
                widget={selectedWidget}
                onDelete={(w) => setDeleteTarget(w)}
            />
        );
    }

    return (
        <>
            <SectionLayout
                listContent={listContent}
                detailContent={detailContent}
                emptyDetailMessage="Select a widget to view details"
            />
            <ConfirmationModal
                isOpen={!!deleteTarget}
                setIsOpen={() => setDeleteTarget(null)}
                title="Uninstall Widget"
                message={`Are you sure you want to uninstall "${
                    deleteTarget?.displayName || deleteTarget?.name
                }"?`}
                confirmLabel="Uninstall"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
};
