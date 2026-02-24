import { useState, useEffect, useCallback } from "react";
import {
    Button,
    FontAwesomeIcon,
    Sidebar,
    SettingsModal,
    SubHeading2,
} from "@trops/dash-react";

import PanelEditItem from "./Panel/PanelEditItem";
import PanelEditItemGrid from "./Panel/PanelEditItemGrid";

import { PanelEditItemHandlers } from "./Panel";
import PanelCode from "./Panel/PanelCode";

const getSections = (item) => [
    { key: "edit", label: "Settings", icon: "cog" },
    ...(item?.type !== "widget" && item?.grid
        ? [{ key: "grid_layout", label: "Layout", icon: "square" }]
        : []),
    ...(item?.workspace !== "layout"
        ? [{ key: "handlers", label: "Listeners", icon: "phone" }]
        : []),
    { key: "code", label: "Code", icon: "code" },
];

export const LayoutBuilderConfigModal = ({
    workspace,
    open,
    setIsOpen,
    onSaveWorkspace,
    item = null,
    initialSection = null,
}) => {
    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [activeSection, setActiveSection] = useState("edit");

    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    useEffect(() => {
        if (item !== itemSelected) {
            setItemSelected(() => item);
        }

        if (workspace !== workspaceSelected) {
            setWorkspaceSelected(() => workspace);
        }

        if (open && initialSection) {
            setActiveSection(initialSection);
        }

        if (open === false) {
            setItemSelected(null);
            setActiveSection("edit");
            setWorkspaceSelected(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function handleEditChange(itemChanged, workspaceChanged) {
        setItemSelected(() => itemChanged);
        setWorkspaceSelected(() => workspaceChanged);
        forceUpdate();
    }

    function handleSaveConfig() {
        onSaveWorkspace(workspaceSelected);
    }

    const sections = itemSelected ? getSections(itemSelected) : [];
    const activeDef =
        sections.find((s) => s.key === activeSection) || sections[0];

    return (
        itemSelected !== null && (
            <SettingsModal isOpen={open} setIsOpen={setIsOpen}>
                <SettingsModal.Sidebar>
                    <Sidebar.Content>
                        {sections.map((section) => {
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
                                    onClick={() =>
                                        setActiveSection(section.key)
                                    }
                                    className={
                                        isActive
                                            ? "bg-white/10 opacity-100"
                                            : ""
                                    }
                                >
                                    {section.label}
                                </Sidebar.Item>
                            );
                        })}
                    </Sidebar.Content>
                </SettingsModal.Sidebar>

                <SettingsModal.Header border={true} padding="px-4 py-3">
                    <SubHeading2
                        title={activeDef?.label || "Settings"}
                        padding={false}
                    />
                </SettingsModal.Header>

                <SettingsModal.Body
                    scrollable={false}
                    padding="p-0"
                    className="flex flex-col min-h-0"
                >
                    {activeSection === "edit" && (
                        <PanelEditItem
                            item={itemSelected}
                            onUpdate={handleEditChange}
                            workspace={workspaceSelected}
                        />
                    )}

                    {activeSection === "grid_layout" && (
                        <PanelEditItemGrid
                            item={itemSelected}
                            onUpdate={handleEditChange}
                            workspace={workspaceSelected}
                        />
                    )}

                    {activeSection === "handlers" && (
                        <PanelEditItemHandlers
                            item={itemSelected}
                            onUpdate={handleEditChange}
                            workspace={workspaceSelected}
                        />
                    )}

                    {activeSection === "code" && (
                        <PanelCode
                            item={itemSelected}
                            onUpdate={handleEditChange}
                            workspace={workspaceSelected}
                        />
                    )}
                </SettingsModal.Body>

                <SettingsModal.Footer leftContent={itemSelected["component"]}>
                    <Button title={"Cancel"} onClick={() => setIsOpen(false)} />
                    <Button
                        title={"Save Changes"}
                        hoverBackgroundColor={"hover:bg-green-700"}
                        onClick={handleSaveConfig}
                    />
                </SettingsModal.Footer>
            </SettingsModal>
        )
    );
};
