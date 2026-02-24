import React, { useState, useEffect, useContext } from "react";
import {
    Button,
    Panel,
    Heading,
    Heading3,
    SubHeading3,
    Paragraph,
    MenuItem3,
    Modal,
    InputText,
} from "@trops/dash-react";
import { getBorderStyle } from "../../../../utils/layout";
import { LayoutContainer } from "../../../../Components/Layout";
import { ComponentManager } from "../../../../ComponentManager";
import { LayoutModel, DashboardModel } from "../../../../Models";
import { ThemeContext } from "../../../../Context";

/**
 * @param {Object} workspace the current workspace for the overall dashboard being edited
 * @param {Object} item the SOURCE ITEM that was clicked on that triggered the modal to add a widget TO
 * @returns
 */
export const LayoutBuilderAddItemModal = ({
    workspace,
    open,
    setIsOpen,
    item = null,
    onSaveItem = null,
}) => {
    const { currentTheme } = useContext(ThemeContext);

    const [searchTerm, setSearchTerm] = useState("");
    const [menuItemSelected, setMenuItemSelected] = useState(null);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        if (open === false) {
            setMenuItemSelected(null);
            setWorkspaceSelected(null);
        } else {
            if (workspaceSelected !== workspace)
                setWorkspaceSelected(() => workspace);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (workspace !== workspaceSelected && workspace !== null) {
            setWorkspaceSelected(() => workspace);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item, open, workspace]);

    useEffect(() => {
        console.log("menu item selected ", menuItemSelected, workspace);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuItemSelected]);

    /**
     * render the widgets available in the application limited by the workspace
     * @returns
     */
    function renderWidgets() {
        const componentMap = ComponentManager.map();
        const workspaceType = item ? item["workspace"] : null;
        const canAddChildren = item ? item["canHaveChildren"] : true;

        const parentWorkspaceType =
            item["parentWorkspaceName"] !== null &&
            item["parentWorkspaceName"] !== undefined
                ? item["parentWorkspaceName"]
                : "layout";

        if (parentWorkspaceType !== null) {
            const options =
                workspaceType !== null &&
                canAddChildren &&
                Object.keys(componentMap)
                    .sort()
                    .filter((c) => componentMap[c]["type"] === "widget")
                    .filter((c) =>
                        workspaceType !== null
                            ? componentMap[c]["workspace"] ===
                              parentWorkspaceType
                            : true
                    )
                    .map((w) => renderMenuItem("widget", w));

            return (
                <div className="flex flex-col rounded space-y-1">{options}</div>
            );
        } else {
            return <div className="flex flex-col rounded"></div>;
        }
    }

    /**
     * Render the available workspaces in the application
     * @returns
     */
    function renderWorkspaces() {
        const componentMap = ComponentManager.map();
        const canAddChildren = item ? item.canHaveChildren : true;

        // We want to make sure the item (parent) can have children from the config
        // We also want to limit the workspaces to layout only
        // if the parent workspace is NOT layout, we only allow "layout" components

        const options =
            canAddChildren === true && item["parentWorkspaceName"] === "layout"
                ? Object.keys(componentMap)
                      .sort()
                      .filter((i) =>
                          searchTerm !== ""
                              ? i.toLowerCase().includes(searchTerm)
                              : true
                      )
                      .filter(
                          (c) =>
                              componentMap[c]["type"] === "workspace" ||
                              componentMap[c]["workspace"] === "layout"
                      )
                      .map((w) => renderMenuItem("workspace", w))
                : Object.keys(componentMap)
                      .sort()
                      .filter((i) =>
                          searchTerm !== ""
                              ? i.toLowerCase().includes(searchTerm)
                              : true
                      )
                      .filter((c) => componentMap[c]["workspace"] === "layout")
                      .map((w) => renderMenuItem("workspace", w));

        return <div className="flex flex-col rounded space-y-1">{options}</div>;
    }

    /**
     * Handle the selection of a widget or workspace and set the appropriate
     * layout for this element in the dashboard tree, and for preview
     * @param {String} data.type widget|workspace|layout
     * @param {String} data.component the name of the component
     * @param {Object} item the SOURCE ITEM that was clicked on
     */
    function handleClickItem(data) {
        try {
            // create the new dashboard.
            let dashboard = new DashboardModel(workspace);

            // grab the id of the source item
            const toSourceItemId = item.id;

            // get the component from the manager
            const componentToAdd = ComponentManager.getComponent(
                data["component"]
            );
            componentToAdd.hasChildren =
                componentToAdd.type !== "widget" ? 1 : 0;

            const layoutModel = LayoutModel(
                componentToAdd,
                dashboard.workspace(),
                dashboard.id
            );
            console.log("ITEM SELECTED CLICK ", componentToAdd, layoutModel);

            // add the child to the layout item selected originally
            dashboard.addChildToLayoutItem(layoutModel, toSourceItemId);

            console.log("NEW WORKSPACE ", dashboard.workspace());

            setMenuItemSelected(() => layoutModel);
            setWorkspaceSelected(() => dashboard.workspace());
            forceUpdate();
        } catch (e) {
            console.log(e);
        }
    }

    function handleAddItem(data) {
        console.log("HANDLE ADD ITEM ", data);
        // The "item" is the item we selected in the layout to add TO
        // The menuItemSelected is the item we chose from the list...
        console.log("adding item", menuItemSelected, item, workspaceSelected);

        // onSaveItem(menuItemSelected, item);
        onSaveItem(workspaceSelected);
    }

    function renderMenuItem(type, componentName) {
        //console.log("type and componnet ", type, componentName);
        return (
            <MenuItem3
                key={`menu-item-${componentName}`}
                onClick={() =>
                    handleClickItem({ type, component: componentName })
                }
            >
                {componentName}
            </MenuItem3>
        );
    }

    function renderCompatibleWidgets() {
        try {
            console.log("render compatible ", menuItemSelected);
            if (menuItemSelected) {
                const widgets =
                    ComponentManager.getCompatibleWidgetsForWorkspace(
                        menuItemSelected.workspace
                    );
                console.log("compatible widgets found ", widgets);
                const widgetArray = widgets.map((w) => {
                    console.log("widget ", w);
                    return (
                        <div className="flex flex-col rounded p-4 bg-green-600 justify-center items-center">
                            {w}
                        </div>
                    );
                });

                return (
                    <div className="grid grid-cols-4 gap-4 w-full p-4">
                        {widgetArray}
                    </div>
                );
            }
        } catch (e) {
            return [];
        }
    }

    return (
        item && (
            <Modal
                isOpen={open}
                setIsOpen={setIsOpen}
                width={"w-5/6"}
                height={"h-5/6"}
            >
                <Panel padding={false}>
                    <div
                        className={`flex flex-col w-full h-full overflow-clip`}
                    >
                        <div className="flex flex-row w-full h-full space-x-4 overflow-clip rounded">
                            <LayoutContainer
                                direction="col"
                                width="w-1/4"
                                space={true}
                                scrollable={true}
                                className={`h-full rounded p-4 text-gray-200`}
                            >
                                {/* render the widget item here. */}
                                <div className="flex flex-row pb-4">
                                    <InputText
                                        textSize="text-sm"
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                        value={searchTerm}
                                        placeholder="Search for Widgets"
                                    />
                                </div>
                                {/* {renderWidgetsByWorkspace()} */}
                                <div className="flex flex-col space-y-2">
                                    <span className="text-xs uppercase font-bold px-2 text-gray-400">
                                        Layout/Function
                                    </span>
                                    <div className="flex flex-col rounded space-y-2">
                                        {renderWorkspaces()}
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <span className="text-xs uppercase font-bold px-2 text-gray-400">
                                        Widgets
                                    </span>
                                    <div className="flex flex-col rounded space-y-2">
                                        {renderWidgets()}
                                    </div>
                                </div>
                            </LayoutContainer>

                            <LayoutContainer
                                direction="row"
                                space={true}
                                grow={true}
                                scrollable={true}
                                width={"w-full"}
                                className={`p-4 ${currentTheme["bg-secondary-dark"]}`}
                            >
                                {/* render the widget item here. */}
                                {menuItemSelected === null && (
                                    <div className="flex-col h-full rounded font-medium text-gray-400 w-full xl:w-full p-10">
                                        {/* render the widget item here. */}
                                        <div className="flex flex-col rounded p-4 py-10 space-y-4">
                                            <Heading
                                                title="Build."
                                                padding={false}
                                            />
                                            <SubHeading3
                                                title={
                                                    "Pick a Widget to add to your Dashboard Layout."
                                                }
                                                padding={false}
                                            />
                                            <Paragraph
                                                text={
                                                    "Don't worry, you can't mess this up."
                                                }
                                                padding={false}
                                            />
                                        </div>
                                    </div>
                                )}
                                {menuItemSelected !== null && (
                                    <div
                                        className={`flex flex-col rounded border-2 border-gray-800 ${getBorderStyle(
                                            menuItemSelected
                                        )} overflow-clip h-full w-full bg-gray-900`}
                                    >
                                        <Heading3
                                            title={menuItemSelected.component}
                                        />

                                        {renderCompatibleWidgets()}

                                        {/* <PanelEditItemGrid
                                        item={menuItemSelected}
                                        onUpdate={() => console.log("updated")}
                                        workspace={workspaceSelected}
                                    /> */}
                                    </div>
                                )}
                                {/* {menuItemSelected !== null && (
                                    <div
                                        className={`flex flex-col rounded border-2 border-gray-800 ${getBorderStyle(
                                            menuItemSelected
                                        )} overflow-clip h-full w-3/4 bg-gray-900`}
                                    >
                                        <div
                                            className={`flex flex-col p-2 space-x-1 uppercase text-xs text-gray-200 font-bold bg-gray-800`}
                                        >
                                            {menuItemSelected !== null && (
                                                <div className="flex flex-row">
                                                    Preview:{" "}
                                                    {
                                                        menuItemSelected[
                                                            "component"
                                                        ]
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col overflow-clip justify-between h-full">
                                            <div className="flex flex-col grow p-2">
                                                {renderAddContainer(
                                                    menuItemSelected
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )} */}

                                {/* config panel */}
                                {/* {menuItemSelected && (
                                    <div className="flex flex-col w-1/4">
                                        <WidgetConfigPanel
                                            item={menuItemSelected}
                                            onChange={handleUpdate}
                                            // onSave={handleAddItem}
                                            disabled={false}
                                            workspace={workspaceSelected}
                                            parentWorkspace={parentWorkspace}
                                        />
                                    </div>
                                )} */}
                            </LayoutContainer>
                            {/* </div> */}
                        </div>
                        <div
                            className={`flex flex-row justify-end ${currentTheme["bg-primary-very-dark"]} p-4 rounded-br rounded-bl border-t ${currentTheme["border-primary-dark"]}`}
                        >
                            <div className="flex flex-row space-x-2">
                                <Button
                                    title={"Cancel"}
                                    bgColor={"bg-gray-800"}
                                    textSize={"text-lg"}
                                    padding={"py-2 px-4"}
                                    onClick={() => setIsOpen(false)}
                                />
                                <Button
                                    title={"Save Changes"}
                                    bgColor={"bg-gray-800"}
                                    hoverBackgroundColor={"hover:bg-green-700"}
                                    textSize={"text-lg"}
                                    padding={"py-2 px-4"}
                                    onClick={handleAddItem}
                                />
                            </div>
                        </div>
                    </div>
                </Panel>
            </Modal>
        )
    );
};
