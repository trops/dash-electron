import React, { useState, useContext } from "react";
import {
    Button,
    ButtonIcon3,
    Sidebar,
    SettingsModal,
    SubHeading2,
    ThemeContext,
    getStylesForItem,
    themeObjects,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { DashboardsSection } from "./sections/DashboardsSection";
import { FoldersSection } from "./sections/FoldersSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { ThemesSection } from "./sections/ThemesSection";
import { GeneralSection } from "./sections/GeneralSection";
import { WidgetsSection } from "./sections/WidgetsSection";

const SECTIONS = [
    { key: "dashboards", label: "Dashboards", icon: "clone" },
    { key: "folders", label: "Folders", icon: "folder" },
    { key: "providers", label: "Providers", icon: "plug" },
    { key: "themes", label: "Themes", icon: "palette" },
    { key: "widgets", label: "Widgets", icon: "puzzle-piece" },
    { key: "general", label: "General", icon: "cog" },
];

export const AppSettingsModal = ({
    isOpen,
    setIsOpen,
    initialSection = "dashboards",
    workspaces = [],
    menuItems = [],
    dashApi = null,
    credentials = null,
    onReloadWorkspaces = null,
    onReloadMenuItems = null,
    onOpenThemeEditor = null,
}) => {
    const [activeSection, setActiveSection] = useState(initialSection);
    const [createRequested, setCreateRequested] = useState(false);
    const { currentTheme } = useContext(ThemeContext);

    // Sync initialSection when modal opens with a different section
    React.useEffect(() => {
        if (isOpen) {
            setActiveSection(initialSection);
        }
    }, [isOpen, initialSection]);

    // Reset create request when section changes
    React.useEffect(() => {
        setCreateRequested(false);
    }, [activeSection]);

    const activeDef =
        SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];
    const panelStyles = getStylesForItem(themeObjects.PANEL, currentTheme, {
        grow: false,
    });

    return (
        <SettingsModal isOpen={isOpen} setIsOpen={setIsOpen}>
            <SettingsModal.Sidebar>
                <Sidebar.Content>
                    {SECTIONS.map((section) => {
                        const isActive = activeSection === section.key;
                        return (
                            <Sidebar.Item
                                key={section.key}
                                icon={
                                    <FontAwesomeIcon
                                        icon={section.icon}
                                        className="h-3.5 w-3.5"
                                    />
                                }
                                active={isActive}
                                onClick={() => setActiveSection(section.key)}
                                className={
                                    isActive ? "bg-white/10 opacity-100" : ""
                                }
                            >
                                {section.label}
                            </Sidebar.Item>
                        );
                    })}
                </Sidebar.Content>
            </SettingsModal.Sidebar>

            <SettingsModal.Header border={true} padding="px-4 py-3">
                <SubHeading2 title={activeDef.label} padding={false} />
                {(activeSection === "folders" ||
                    activeSection === "providers" ||
                    activeSection === "themes" ||
                    activeSection === "widgets") && (
                    <ButtonIcon3
                        icon="plus"
                        text={
                            activeSection === "folders"
                                ? "New Folder"
                                : activeSection === "providers"
                                ? "New Provider"
                                : activeSection === "widgets"
                                ? "Install Widgets"
                                : "New Theme"
                        }
                        onClick={() => setCreateRequested(true)}
                        spacing="px-3 py-1.5"
                        iconSize="h-3.5 w-3.5"
                        className="text-sm"
                    />
                )}
            </SettingsModal.Header>

            <SettingsModal.Body
                scrollable={false}
                padding="p-0"
                className="flex flex-col min-h-0"
            >
                {activeSection === "dashboards" && (
                    <DashboardsSection
                        workspaces={workspaces}
                        menuItems={menuItems}
                        dashApi={dashApi}
                        credentials={credentials}
                        onReloadWorkspaces={onReloadWorkspaces}
                    />
                )}
                {activeSection === "folders" && (
                    <FoldersSection
                        menuItems={menuItems}
                        workspaces={workspaces}
                        dashApi={dashApi}
                        credentials={credentials}
                        onReloadMenuItems={onReloadMenuItems}
                        createRequested={createRequested}
                        onCreateAcknowledged={() => setCreateRequested(false)}
                    />
                )}
                {activeSection === "providers" && (
                    <ProvidersSection
                        dashApi={dashApi}
                        credentials={credentials}
                        createRequested={createRequested}
                        onCreateAcknowledged={() => setCreateRequested(false)}
                    />
                )}
                {activeSection === "themes" && (
                    <ThemesSection
                        onOpenThemeEditor={onOpenThemeEditor}
                        dashApi={dashApi}
                        credentials={credentials}
                        createRequested={createRequested}
                        onCreateAcknowledged={() => setCreateRequested(false)}
                    />
                )}
                {activeSection === "widgets" && (
                    <WidgetsSection
                        createRequested={createRequested}
                        onCreateAcknowledged={() => setCreateRequested(false)}
                    />
                )}
                {activeSection === "general" && (
                    <div
                        className={`flex-1 overflow-y-auto p-6 ${
                            panelStyles.textColor || "text-gray-200"
                        }`}
                    >
                        <GeneralSection />
                    </div>
                )}
            </SettingsModal.Body>

            <SettingsModal.Footer>
                <div className="flex justify-end">
                    <Button title="Done" onClick={() => setIsOpen(false)} />
                </div>
            </SettingsModal.Footer>
        </SettingsModal>
    );
};
