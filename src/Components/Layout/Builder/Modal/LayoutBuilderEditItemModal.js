import React, { useState, useEffect, useContext, Fragment } from "react";
import { ButtonIcon, FontAwesomeIcon, Panel, Modal } from "@trops/dash-react";
import {
    getContainerColor,
    renderLayout,
    replaceItemInLayout,
} from "../../../../utils/layout";
import { WidgetConfigPanel } from "../../../../Components/Layout/Builder/Modal";
import { DashboardModel, WorkspaceModel } from "../../../../Models";
import { ThemeContext } from "../../../../Context";

export const LayoutBuilderEditItemModal = ({
    workspace,
    open,
    setIsOpen,
    onUpdate,
    item = null,
}) => {
    useContext(ThemeContext);
    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        if (item !== itemSelected) {
            setItemSelected(() => item);
        }

        if (workspace !== workspaceSelected) {
            setWorkspaceSelected(() => workspace);
        }

        if (open === false) {
            setItemSelected(null);
            setWorkspaceSelected(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, workspace, item]);

    function handleSaveChanges(itemData) {
        console.log("edit modal save changes ", itemData);
        if (itemData !== null) {
            console.log("handleSaveChanges ", itemData);
            onUpdate(itemData);
            setItemSelected(null);
            setIsOpen(false);
        }
    }

    function handleUpdate(data) {
        console.log("handle update widget panel ", data);
        const workspaceTemp = WorkspaceModel(workspaceSelected);
        const newLayout = replaceItemInLayout(
            workspaceTemp.layout,
            data["id"],
            data
        );
        console.log("new layout ", newLayout);
        workspaceTemp.layout = newLayout;

        setWorkspaceSelected(() => workspaceTemp);
        setItemSelected(() => data);
        forceUpdate();
    }

    function renderEditContainer() {
        try {
            if (itemSelected !== null && workspaceSelected !== null) {
                const workspaceSelectedTemp = JSON.parse(
                    JSON.stringify(workspaceSelected)
                );

                if (
                    itemSelected.parentWorkspace !== undefined &&
                    itemSelected.parentWorkspace !== null
                ) {
                    // let's make a custom layout with the parent workspace and the itemSelected
                    // need the workspace for the functionality...
                    let parentWorkspaceTemp = JSON.parse(
                        JSON.stringify(item.parentWorkspace)
                    );
                    let layout = JSON.parse(
                        JSON.stringify(workspaceSelectedTemp["layout"])
                    );
                    let itemTemp = JSON.parse(JSON.stringify(itemSelected));

                    // VERY IMPORTANT TO CHECK THE WORKSPACES!!!!
                    // otherwise the workspace will crash as the widget doesnt belong...
                    if (
                        itemSelected["workspace"] ===
                        parentWorkspaceTemp["workspace"]
                    ) {
                        if (itemSelected.parentWorkspace) {
                            // set the id's to work appropriately.
                            parentWorkspaceTemp["id"] = 1;
                            parentWorkspaceTemp["parent"] = 0;

                            itemTemp["parent"] = 1; //parentWorkspaceTemp['id'];
                            // set the new layout
                            layout = [parentWorkspaceTemp, itemTemp];
                        }

                        return (
                            itemSelected.parentWorkspace &&
                            renderLayout({
                                workspaceSelected,
                                layout,
                                parentKey: 0,
                                previewMode: true,
                                isDraggable: false,
                            })
                        );
                    } else {
                        // workspace mismatch!
                        return null;
                    }
                }
            }
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    function getTitle() {
        try {
            if (itemSelected.parentWorkspace) {
                if ("component" in itemSelected.parentWorkspace) {
                    return `${itemSelected.parentWorkspace["component"]}: ${itemSelected["component"]}`;
                } else {
                    return itemSelected["component"];
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function getParentContainerColor() {
        const dashboard = new DashboardModel(workspace);
        // eslint-disable-next-line no-unused-vars
        const _parentWorkspace = dashboard.getComponentById(item["parent"]);
        return getContainerColor(item["parentWorkspace"]);
    }

    return (
        itemSelected && (
            <Modal
                isOpen={open}
                setIsOpen={setIsOpen}
                width={"w-5/6 2xl:w-3/4"}
                height="h-5/6"
            >
                <Panel padding={false}>
                    <div
                        className={`flex flex-col w-full h-full space-y-2 overflow-clip`}
                    >
                        <div className="flex flex-row text-xl font-bold text-white justify-between">
                            <div className="flex flex-row text-xl font-bold text-white p-2 space-x-2 justify-center items-center">
                                {itemSelected && (
                                    <Fragment>
                                        <FontAwesomeIcon icon="folder" />
                                        <span className="text-xl font-bold text-gray-200">
                                            {getTitle()}
                                        </span>
                                    </Fragment>
                                )}
                            </div>
                            <ButtonIcon
                                icon={"xmark"}
                                onClick={() => setIsOpen(false)}
                                bgColor={`${getParentContainerColor()}`}
                            />
                        </div>
                        <div className="flex flex-row w-full h-full space-x-4 overflow-clip">
                            <div className="flex flex-col w-3/4 min-w-3/4 bg-gray-900 h-full rounded p-2">
                                {/* render the widget item here. */}
                                <div className="flex flex-col w-full h-full border-2 border-gray-800 rounded space-y-2">
                                    <div className="flex bg-gray-800 p-2 text-xs text-gray-300 rounded-br uppercase font-bold">
                                        Preview
                                    </div>
                                    <div className="flex flex-col p-2">
                                        {itemSelected !== null &&
                                            workspaceSelected !== null &&
                                            renderEditContainer()}
                                    </div>
                                </div>
                            </div>
                            {itemSelected && (
                                <div className="flex flex-col w-1/4">
                                    <WidgetConfigPanel
                                        item={itemSelected}
                                        onChange={handleUpdate}
                                        onSave={handleSaveChanges}
                                        disabled={itemSelected === null}
                                        workspace={workspaceSelected}
                                        parentWorkspace={
                                            itemSelected.parentWorkspace
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>
            </Modal>
        )
    );
};
