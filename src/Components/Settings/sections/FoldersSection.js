import React, { useState, useRef, useEffect } from "react";
import { ConfirmationModal, FontAwesomeIcon, Sidebar } from "@trops/dash-react";
import { SectionLayout } from "../SectionLayout";
import { FolderDetail } from "../details/FolderDetail";

export const FoldersSection = ({
    menuItems = [],
    workspaces = [],
    dashApi = null,
    credentials = null,
    onReloadMenuItems = null,
    createRequested = false,
    onCreateAcknowledged = null,
}) => {
    const [selectedId, setSelectedId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formName, setFormName] = useState("");
    const [formIcon, setFormIcon] = useState("folder");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const appId = credentials?.appId;

    function getDashboardCount(menuId) {
        return workspaces.filter((ws) => ws.menuId === menuId).length;
    }

    function resetForm() {
        setFormName("");
        setFormIcon("folder");
        setIsCreating(false);
        setIsEditing(false);
    }

    function handleCreate() {
        if (!formName.trim() || !dashApi || !appId) return;
        const menuItem = {
            id: Date.now(),
            name: formName.trim(),
            icon: formIcon,
        };
        dashApi.saveMenuItem(
            appId,
            menuItem,
            () => {
                resetForm();
                onReloadMenuItems && onReloadMenuItems();
            },
            (e, err) => console.error("Save menu item error:", err)
        );
    }

    function handleStartEdit(item) {
        setSelectedId(item.id);
        setFormName(item.name || "");
        setFormIcon(item.folder || item.icon || "folder");
        setIsEditing(true);
        setIsCreating(false);
    }

    function handleSaveEdit() {
        if (!formName.trim() || !dashApi || !appId || !selectedId) return;
        const updatedItem = {
            id: selectedId,
            name: formName.trim(),
            icon: formIcon,
        };
        dashApi.saveMenuItem(
            appId,
            updatedItem,
            () => {
                resetForm();
                onReloadMenuItems && onReloadMenuItems();
            },
            (e, err) => console.error("Save menu item error:", err)
        );
    }

    function handleConfirmDelete() {
        if (!deleteTarget || !dashApi || !appId) return;
        dashApi.deleteMenuItem(
            appId,
            deleteTarget.id,
            () => {
                if (selectedId === deleteTarget.id) {
                    setSelectedId(null);
                    resetForm();
                }
                setDeleteTarget(null);
                onReloadMenuItems && onReloadMenuItems();
            },
            (e, err) => {
                console.error("Delete menu item error:", err);
                setDeleteTarget(null);
            }
        );
    }

    // Respond to external create trigger from header
    const prevCreateRequested = useRef(false);
    useEffect(() => {
        if (createRequested && !prevCreateRequested.current) {
            resetForm();
            setSelectedId(null);
            setIsCreating(true);
        }
        prevCreateRequested.current = createRequested;
        if (createRequested && onCreateAcknowledged) {
            onCreateAcknowledged();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createRequested]);

    const selectedItem = menuItems.find((m) => m.id === selectedId);

    const deleteHasDashboards =
        deleteTarget && getDashboardCount(deleteTarget.id) > 0;

    const listContent = (
        <Sidebar.Content>
            {menuItems.map((item) => {
                const isSelected = selectedId === item.id && !isCreating;
                const count = getDashboardCount(item.id);
                return (
                    <Sidebar.Item
                        key={item.id}
                        icon={
                            <FontAwesomeIcon
                                icon={item.folder || item.icon || "folder"}
                                className="h-3.5 w-3.5"
                            />
                        }
                        active={isSelected}
                        onClick={() => {
                            setSelectedId(item.id);
                            setIsCreating(false);
                            setIsEditing(false);
                            resetForm();
                        }}
                        badge={count > 0 ? String(count) : null}
                        className={isSelected ? "bg-white/10 opacity-100" : ""}
                    >
                        {item.name}
                    </Sidebar.Item>
                );
            })}
            {menuItems.length === 0 && (
                <span className="text-sm opacity-40 py-8 text-center">
                    No folders yet
                </span>
            )}
        </Sidebar.Content>
    );

    let detailContent = null;
    if (isCreating) {
        detailContent = (
            <FolderDetail
                isCreating={true}
                formName={formName}
                setFormName={setFormName}
                formIcon={formIcon}
                setFormIcon={setFormIcon}
                onCreate={handleCreate}
                onCancelEdit={() => {
                    resetForm();
                    setIsCreating(false);
                }}
            />
        );
    } else if (selectedItem) {
        detailContent = (
            <FolderDetail
                menuItem={selectedItem}
                workspaces={workspaces}
                isEditing={isEditing}
                formName={formName}
                setFormName={setFormName}
                formIcon={formIcon}
                setFormIcon={setFormIcon}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={resetForm}
                onStartEdit={handleStartEdit}
                onDelete={(item) => setDeleteTarget(item)}
            />
        );
    }

    return (
        <>
            <SectionLayout
                listContent={listContent}
                detailContent={detailContent}
                emptyDetailMessage="Select a folder to view details"
            />
            <ConfirmationModal
                isOpen={!!deleteTarget}
                setIsOpen={() => setDeleteTarget(null)}
                title="Delete Folder"
                message={
                    deleteHasDashboards
                        ? `"${deleteTarget?.name}" contains ${getDashboardCount(
                              deleteTarget?.id
                          )} dashboard(s). Deleting this folder will leave those dashboards without a folder. Continue?`
                        : `Are you sure you want to delete "${deleteTarget?.name}"?`
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
};
