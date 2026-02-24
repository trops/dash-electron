import React, { useState, useEffect, useContext } from "react";
import { ButtonIcon, Panel } from "@trops/dash-react";
import { deepCopy } from "@trops/dash-react";
import { DashboardModel } from "../../../../../Models";
import deepEqual from "deep-equal";
import { ThemeContext } from "../../../../../Context";
import GridEditor from "./GridEditor";

export const PanelEditItemGrid = ({ workspace, onUpdate, item = null }) => {
    const { theme } = useContext(ThemeContext);

    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        console.log("panel edit item grid", itemSelected, workspaceSelected);
        //console.log('EFFECT PanelEditItem', workspace, workspaceSelected, item['userPrefs'], itemSelected['userPrefs']);
        //console.log('COMPARE RESULT: ', deepEqual(item, itemSelected));
        if (deepEqual(item, itemSelected) === false) {
            console.log("COMPARE CHECK DIFFERENT!");
            setItemSelected(() => item);
            forceUpdate();
        }

        if (deepEqual(workspace, workspaceSelected) === false) {
            setWorkspaceSelected(() => workspace);
            forceUpdate();
        }

        // if (open === false) {
        //     setItemSelected(null);
        //     setWorkspaceSelected(null);
        // }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace, item]);

    function updateGridLayout(data) {
        console.log("updateGridLayout ", data);
        // const dashboard = new DashboardModel(workspaceSelected);

        // get the grid layout from the itemSelected
        let itemSelectedTemp = deepCopy(itemSelected);
        let gridLayout = itemSelectedTemp.grid;

        // lets update the grid layout
        gridLayout = data;
        itemSelectedTemp.grid = gridLayout;

        setItemSelected(itemSelectedTemp);
        handleUpdate(itemSelectedTemp);
    }

    function handleUpdate(data) {
        console.log("handling update ", data);

        const dashboard = new DashboardModel(workspaceSelected);
        dashboard.updateLayoutItem(data);

        // const workspaceTemp = WorkspaceModel(workspaceSelected);
        // const newLayout = replaceItemInLayout(
        //     workspaceTemp.layout,
        //     data["id"],
        //     data
        // );
        // workspaceTemp.layout = newLayout;

        setWorkspaceSelected(() => dashboard.workspace());
        // setItemSelected(() => data);
        onUpdate(data, dashboard.workspace());
        forceUpdate();
    }

    return (
        itemSelected &&
        workspaceSelected && (
            <Panel>
                <div className={`flex flex-col w-full h-full overflow-clip`}>
                    <div className="flex flex-col w-full h-full overflow-clip">
                        <div className="flex flex-row w-full h-full overflow-clip space-x-4 justify-between">
                            <div className="flex-col h-full rounded font-medium text-gray-400 w-full hidden xl:flex lg:w-1/3 justify-between">
                                <div className="flex flex-col rounded p-4 py-10 space-y-4">
                                    <p
                                        className={`text-5xl font-bold ${theme["text-secondary-very-light"]}`}
                                    >
                                        Layout.
                                    </p>
                                    <p
                                        className={`text-xl font-normal ${theme["text-secondary-light"]}`}
                                    >
                                        Add and Remove rows and columns to
                                        create your layout. You may also merge
                                        and split cells to create a more complex
                                        layout.
                                    </p>
                                </div>
                                <div className="flex flex-col rounded p-4 space-y-2 justify-end">
                                    <div className="flex flex-row space-x-2 items-center">
                                        <ButtonIcon icon="arrow-right-from-bracket" />
                                        <span>To merge a cell</span>
                                    </div>
                                    <div className="flex flex-row space-x-2 items-center">
                                        <ButtonIcon icon="arrow-right-to-bracket" />
                                        <span>To split a cell</span>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`flex flex-col w-full h-full rounded space-y-2 border-2 border-dashed ${theme["border-secondary-very-dark"]}`}
                            >
                                <div
                                    className={`flex flex-col h-full w-full overflow-y-auto`}
                                >
                                    <GridEditor
                                        onUpdate={updateGridLayout}
                                        initialGrid={itemSelected.grid}
                                    />
                                    {/* {itemSelected !== null &&
                                    workspaceSelected !== null &&
                                    renderGridLayoutFlow()} */}
                                </div>
                            </div>

                            {/* <div className="flex flex-col w-1/4 h-full text-xs">
                        {JSON.stringify(itemSelected, null, 4)}
                    </div> */}
                        </div>
                    </div>
                </div>
            </Panel>
        )
    );
};

export default PanelEditItemGrid;
