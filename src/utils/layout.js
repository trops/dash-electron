import { SelectMenu, FontAwesomeIcon } from "@trops/dash-react";
import {
    LayoutBuilderGridItem,
    LayoutGridContainer,
    LayoutBuilderConfigMenuItem,
    LayoutBuilderConfigContainerMenuItem,
} from "../Components/Layout/Builder";
import { WidgetFactory } from "../Widget";
import { DashboardModel, LayoutModel } from "../Models";
import { deepCopy } from "@trops/dash-react";
import { ComponentManager } from "../ComponentManager";

function compareChildren(a, b) {
    if (a.order < b.order) {
        return -1;
    }
    if (a.order > b.order) {
        return 1;
    }
    return 0;
}

/**
 * Render the layout of the Widgets recursively
 * If there are children in the layout we will call renderLayout again and so forth.
 *
 * @param {Object} tempLayout the layout we are rendering
 * @param {String} parentKey the key of the parent element we are rendering children into
 * @param {Boolean} debugMode if we are in debug mode
 * @param {*} onClick
 * @param {*} onClickRemove
 * @returns
 */

export const renderLayout = ({
    item,
    layout,
    parentKey = 0,
    workspace,
    isDraggable = true,
    debugMode = false,
    previewMode = false,
    editMode,
    onClickAdd = null,
    onClickQuickAdd = undefined,
    onClickRemove = null,
    onClickShrink = null,
    onClickExpand = null,
    onClickContextSettings = null,
    onChangeDirection = null,
    onChangeOrder = null,
    onClickEmptyCell = null,
    onSelectWidgetForCell = null,
    onOpenConfig = null,
    onOpenEvents = null,
    onDropItem = null,
    onDragItem = undefined,
    onProviderSelect = null,
    onCreateProvider = null,
    providers = [],
    dashboardId,
    // Grid operation handlers
    onSplitCell = null,
    onMergeCells = null,
    onAddGridRow = null,
    onDeleteGridRow = null,
    onAddGridColumn = null,
    onDeleteGridColumn = null,
    onChangeRowHeight = null,
    onMoveWidgetToCell = null,
    onDropWidgetFromSidebar = null,
}) => {
    try {
        // Go through each item in the Workspace Layout to render the items.

        return (
            layout !== null &&
            layout !== undefined &&
            layout
                .filter((t) => {
                    return t["parent"] === parentKey && t["id"] !== parentKey;
                }) //  && t['id'] !== parentKey
                .sort(compareChildren) // set the order of the elements
                .map((child) => {
                    const childLayout = LayoutModel(child, layout, dashboardId);
                    const {
                        id,
                        hasChildren,
                        parent,
                        direction,
                        scrollable,
                        order,
                        width,
                        height,
                        component,
                        canHaveChildren,
                        uuid,
                        space,
                        grow,
                    } = childLayout;

                    // if (gridLayout) console.log("rendering grid ", child, childLayout);

                    return hasChildren === 1 && canHaveChildren === true ? (
                        <LayoutGridContainer
                            key={`grid-container-${uuid}-${
                                previewMode === true ? "view" : "edit"
                            }`}
                            uuid={uuid}
                            id={id}
                            item={childLayout}
                            layout={layout}
                            parent={parent}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onClickRemove={onClickRemove}
                            isContainer={true}
                            direction={direction}
                            scrollable={scrollable}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickContextSettings={onClickContextSettings}
                            order={order}
                            preview={previewMode}
                            editMode={editMode}
                            onOpenConfig={onOpenConfig}
                            onOpenEvents={onOpenEvents}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onProviderSelect={onProviderSelect}
                            onCreateProvider={onCreateProvider}
                            providers={providers}
                            width={width}
                            isDraggable={isDraggable}
                            workspace={workspace}
                            height={height}
                            space={space}
                            grow={grow}
                            onSplitCell={onSplitCell}
                            onMergeCells={onMergeCells}
                            onAddGridRow={onAddGridRow}
                            onDeleteGridRow={onDeleteGridRow}
                            onAddGridColumn={onAddGridColumn}
                            onDeleteGridColumn={onDeleteGridColumn}
                            onChangeRowHeight={onChangeRowHeight}
                            onMoveWidgetToCell={onMoveWidgetToCell}
                            onDropWidgetFromSidebar={onDropWidgetFromSidebar}
                        >
                            {id > 0 &&
                                renderLayout({
                                    dashboardId,
                                    item: childLayout,
                                    layout,
                                    parentKey: id,
                                    debugMode,
                                    previewMode,
                                    editMode,
                                    onClickAdd,
                                    onClickQuickAdd,
                                    onClickRemove,
                                    onClickShrink,
                                    onClickExpand,
                                    onClickEmptyCell,
                                    onClickContextSettings,
                                    onSelectWidgetForCell,
                                    onChangeDirection,
                                    onChangeOrder,
                                    order,
                                    onOpenConfig,
                                    onOpenEvents,
                                    onDropItem,
                                    onDragItem,
                                    onProviderSelect,
                                    providers,
                                    workspace,
                                    isDraggable,
                                    onSplitCell,
                                    onMergeCells,
                                    onAddGridRow,
                                    onDeleteGridRow,
                                    onAddGridColumn,
                                    onDeleteGridColumn,
                                    onChangeRowHeight,
                                    onMoveWidgetToCell,
                                    onDropWidgetFromSidebar,
                                })}
                            {/* OLD FLEXBOX GRID RENDERING - Disabled in favor of LayoutGridContainer CSS Grid */}
                            {/* {id > 0 &&
                                gridLayout &&
                                renderGridLayoutFlow(gridLayout, {
                                    dashboardId,
                                    item: childLayout,
                                    layout,
                                    parentKey: id,
                                    debugMode,
                                    previewMode,
                                    editMode,
                                    onClickAdd,
                                    onClickQuickAdd,
                                    onClickRemove,
                                    onClickShrink,
                                    onClickExpand,
                                    onClickEmptyCell,
                                    onClickContextSettings,
                                    onSelectWidgetForCell,
                                    onChangeDirection,
                                    onChangeOrder,
                                    order,
                                    onOpenConfig,
                                    onOpenEvents,
                                    onDropItem,
                                    onDragItem,
                                    workspace,
                                    isDraggable,
                                    id,
                                    hasChildren,
                                    parent,
                                    direction,
                                    scrollable,
                                    width,
                                    height,
                                    component,
                                    canHaveChildren,
                                    uuid,
                                    space,
                                    grow,
                                    grid,
                                    onSplitCell,
                                    onMergeCells,
                                    onAddGridRow,
                                    onDeleteGridRow,
                                    onAddGridColumn,
                                    onDeleteGridColumn,
                                })} */}
                        </LayoutGridContainer>
                    ) : (
                        <LayoutBuilderGridItem
                            key={`grid-item-${uuid}-${
                                previewMode === true ? "view" : "edit"
                            }`}
                            uuid={uuid}
                            item={childLayout}
                            layout={layout}
                            id={id}
                            parent={parent}
                            row={order}
                            col={order}
                            order={order}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickExpand={onClickExpand}
                            onClickEmptyCell={onClickEmptyCell}
                            onClickContextSettings={onClickContextSettings}
                            onSelectWidgetForCell={onSelectWidgetForCell}
                            onClickShrink={onClickShrink}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onProviderSelect={onProviderSelect}
                            providers={providers}
                            name={id}
                            width={width}
                            height={height}
                            direction={direction}
                            scrollable={scrollable}
                            space={space}
                            grow={grow}
                            preview={previewMode}
                            editMode={editMode}
                            component={component}
                            onOpenConfig={onOpenConfig}
                            onOpenEvents={onOpenEvents}
                            isDraggable={isDraggable}
                            workspace={workspace}
                        />
                    );
                })
        );
    } catch (e) {
        console.log(e);
    }
};

/**
 * render the grid for the container, and place the children in the specified cells based on the config
 *
 * @param {Array} children the array of children to be rendered
 * @param {Object} gridLayoutForContainer the layout for the container grid system (tailwind)
 * @returns {Object} the div layouts for the grid container
 */
export function renderGridLayout(gridLayout, args) {
    // inside this function we will first render the GRID and then
    // for each cell we will then call the renderLayout to render the item inside the cell...me thinks
    // console.log("in render grid layout", gridLayout);

    const {
        layout,
        previewMode,
        editMode,
        onClickAdd,
        onClickQuickAdd,
        onClickRemove,
        onClickShrink,
        onClickExpand,
        onClickContextSettings,
        onChangeDirection,
        onChangeOrder,
        onOpenConfig,
        onOpenEvents,
        onDropItem,
        onDragItem,
        onProviderSelect,
        providers,
        workspace,
        isDraggable,
        uuid,
    } = args;

    const gridContents = [];

    const dashboard = new DashboardModel(workspace);

    for (var i = 1; i < gridLayout.rows + 1; i++) {
        for (var j = 1; j < gridLayout.cols + 1; j++) {
            // console.log("grid layout in ", gridLayout);

            const cellNumber = `${i}.${j}`;
            const cmpIdToRender =
                cellNumber in gridLayout
                    ? gridLayout[cellNumber]["component"]
                    : null;

            if (cmpIdToRender !== null) {
                // get the component based on the id in the grid
                // we have to choose the component from the layout that we have in place
                // and pass that component into the LayoutBuilderGridItem component
                // with the information for THIS component
                const componentToRender =
                    dashboard.getComponentById(cmpIdToRender);
                if (componentToRender) {
                    gridContents.push(
                        <LayoutBuilderGridItem
                            key={`grid-item-${uuid}-${
                                previewMode === true ? "view" : "edit"
                            }`}
                            uuid={uuid}
                            item={componentToRender}
                            layout={layout}
                            id={cmpIdToRender}
                            parent={componentToRender.parent}
                            row={componentToRender.order}
                            col={componentToRender.order}
                            order={componentToRender.order}
                            onClickAdd={onClickAdd}
                            onClickQuickAdd={onClickQuickAdd}
                            onClickRemove={onClickRemove}
                            onClickExpand={onClickExpand}
                            onClickShrink={onClickShrink}
                            onClickContextSettings={onClickContextSettings}
                            onChangeDirection={onChangeDirection}
                            onChangeOrder={onChangeOrder}
                            onDropItem={onDropItem}
                            onDragItem={onDragItem}
                            onProviderSelect={onProviderSelect}
                            providers={providers}
                            name={componentToRender.id}
                            width={componentToRender.width}
                            height={componentToRender.height}
                            direction={componentToRender.direction}
                            scrollable={componentToRender.scrollable}
                            space={componentToRender.space}
                            grow={componentToRender.grow}
                            preview={previewMode}
                            editMode={editMode}
                            component={componentToRender.component}
                            onOpenConfig={onOpenConfig}
                            onOpenEvents={onOpenEvents}
                            isDraggable={isDraggable}
                            workspace={workspace}
                        />
                    );
                }
            } else {
                if (previewMode === false) {
                    gridContents.push(
                        <div className="flex flex-col border-dotted border-gray-900 border-2 w-full h-full rounded-md p-4 text-gray-200 text-2xl font-bold justify-center items-center align-center">
                            {cellNumber}
                        </div>
                    );
                } else {
                    gridContents.push(
                        <div className="flex flex-col border-dotted border-gray-900 border-2 w-full h-full rounded-md p-4 text-gray-200 text-2xl font-bold justify-center items-center align-center"></div>
                    );
                }
            }
        }
    }
    return (
        <div
            className={`grid grid-cols-${gridLayout["cols"] || 1} grid-rows-${
                gridLayout["rows"] || 1
            } gap-4 h-full w-full`}
        >
            {gridContents}
        </div>
    );
}

export function renderGridLayoutFlow(gridLayout, args) {
    try {
        const { item, onClickEmptyCell, onSelectWidgetForCell, workspace } =
            args;

        const dashboard = new DashboardModel(workspace);

        // generate the grid contents based on the gridLayout
        let gridContentsArray = [...Array(gridLayout.rows)].map((_, row) => (
            <div
                key={row}
                className="flex h-full w-full justify-between items-center space-x-2"
            >
                {[...Array(gridLayout.cols)].map((_, col) => {
                    const cellNumber = `${row + 1}.${col + 1}`;
                    const cell = gridLayout[cellNumber];
                    if (!cell) {
                        console.log(
                            "Cell not found in grid layout: ",
                            cellNumber
                        );
                        return null;
                    }

                    const cmpIdToRender =
                        cellNumber in gridLayout
                            ? gridLayout[cellNumber]["component"]
                            : null;
                    const cellData = gridLayout[cellNumber];

                    if (cmpIdToRender !== null) {
                        // get the component based on the id in the grid
                        // we have to choose the component from the layout that we have in place
                        // and pass that component into the LayoutBuilderGridItem component
                        // with the information for THIS component
                        const componentToRender =
                            dashboard.getComponentById(cmpIdToRender);
                        if (componentToRender) {
                            // should we determine if this component is a layout container? has children? recursive in nature?

                            console.log(
                                "component to render  ",
                                componentToRender
                            );

                            const hasChildren =
                                componentToRender.hasChildren || false;
                            const canHaveChildren =
                                componentToRender.canHaveChildren || false;
                            console.log(
                                "component to render  has children",
                                hasChildren,
                                canHaveChildren
                            );

                            const cell = renderGridCell({
                                cellNumber,
                                cellData,
                                componentToRender,
                                componentToRenderId: cmpIdToRender,
                                props: args,
                            });
                            return cell;
                        }
                        return null;
                    } else {
                        const cell = renderGridCellShell({
                            cellNumber,
                            cellData,
                            component: item,
                            componentToRenderId: cmpIdToRender,
                            props: args,
                            onClickEmptyCell,
                            onSelectWidgetForCell,
                        });
                        // gridContentsNew.push(cell);
                        return cell;
                    }
                })}
            </div>
        ));

        return (
            <div className={`grid gap-2 w-full h-full rounded`}>
                {gridContentsArray}
            </div>
        );
    } catch (e) {
        console.log(e);
        return null;
    }
}

function renderGridCellShell({
    cellNumber,
    cellData,
    children = null,
    component = null,
    onClickEmptyCell = null,
    onSelectWidgetForCell = null,
    props,
}) {
    try {
        const { workspace, grid } = props;

        const dashboard = new DashboardModel(workspace);
        const bgColor =
            component !== null
                ? dashboard.getContainerColor(component.component)
                : "";
        const compatibleWidgets = ComponentManager.getWidgets(); //(component.component);
        console.log(
            "compatible widgets ",
            compatibleWidgets,
            workspace,
            component
        );

        // create a width that is based on the colSpan of the cellData
        let widthClass = "w-full";
        if (cellData.colSpan && grid.cols && cellData.colSpan < grid.cols) {
            widthClass = `w-${cellData.colSpan}/${grid.cols}`;
        }

        const hasComponent = cellData.component !== null;

        return (
            <div
                className={`flex flex-col ${bgColor} h-full rounded-md text-gray-600 ${widthClass}`}
                onClick={() =>
                    onClickEmptyCell &&
                    onClickEmptyCell(cellNumber, cellData, workspace)
                }
            >
                <div className="flex flex-row w-full justify-end p-1 space-x-1">
                    &nbsp;
                </div>
                <div className="flex flex-col w-full h-full justify-center items-center text-2xl font-bold p-4">
                    {hasComponent === false && (
                        <SelectMenu
                            onChange={(e) =>
                                onSelectWidgetForCell(
                                    e.target.value,
                                    cellNumber,
                                    cellData,
                                    component,
                                    workspace
                                )
                            }
                        >
                            <option value={""}>Select a Component</option>
                            {compatibleWidgets.map((cw) => {
                                return <option value={cw}>{cw}</option>;
                            })}
                            {/* {isLayoutContainer === true && compatibleWorkspaces.map(cw => {
                                    return (<option value={cw}>{cw}</option>)
                                })} */}
                        </SelectMenu>
                    )}
                </div>
                <div className="flex flex-row w-full justify-end p-1 space-x-1">
                    &nbsp;
                </div>
            </div>
        );
    } catch (e) {
        return null;
    }
}

function renderGridCell({
    cellNumber,
    cellData,
    componentToRender,
    componentToRenderId,
    props,
}) {
    const {
        layout,
        previewMode,
        editMode,
        onClickAdd,
        onClickQuickAdd,
        onClickRemove,
        onClickShrink,
        onClickExpand,
        onClickContextSettings,
        onChangeDirection,
        onChangeOrder,
        onOpenConfig,
        onOpenEvents,
        onDropItem,
        onDragItem,
        onProviderSelect,
        providers,
        workspace,
        isDraggable,
        component,
        uuid,
        grid,
    } = props;

    console.log("GRID CELL ", componentToRender);

    const dashboard = new DashboardModel(workspace);
    const bgColor =
        component !== null ? dashboard.getContainerColor(component) : "";

    let widthClass = "w-full";
    if (cellData.colSpan && grid.cols && cellData.colSpan < grid.cols) {
        widthClass = `w-${cellData.colSpan}/${grid.cols}`;
    }

    // const spanValue = "span" in cellData && cellData["span"] !== null ? `${cellData["span"]}` : "";
    // const isSelected = cellsSelected.filter(cell => cell.cellNumber === cellNumber).length > 0;
    //const borderStyle = component !== null ? (isSelected === true ? "border-2 border-gray-200":"") : (isSelected === true ? "border-2 border-gray-200" : "border-dotted border-gray-600 border-2");
    const borderStyle = ""; //"border-2 border-gray-200";
    // const isHidden = "hide" in cellData === false ? false : (cellData.hide === true);

    return (
        componentToRender && (
            <div
                className={`flex flex-col ${bgColor} h-full rounded-md text-gray-600 ${borderStyle} ${widthClass}`}
                onClick={() =>
                    console.log("CLICKED CELL ", cellNumber, cellData)
                }
            >
                <div className="flex flex-col w-full h-full justify-center items-center">
                    <LayoutBuilderGridItem
                        key={`grid-item-${uuid}-${
                            previewMode === true ? "view" : "edit"
                        }`}
                        uuid={uuid}
                        item={componentToRender}
                        layout={layout}
                        id={componentToRenderId}
                        parent={componentToRender.parent}
                        row={componentToRender.order}
                        col={componentToRender.order}
                        order={componentToRender.order}
                        onClickAdd={onClickAdd}
                        onClickQuickAdd={onClickQuickAdd}
                        onClickRemove={onClickRemove}
                        onClickExpand={onClickExpand}
                        onClickShrink={onClickShrink}
                        onClickContextSettings={onClickContextSettings}
                        onChangeDirection={onChangeDirection}
                        onChangeOrder={onChangeOrder}
                        onDropItem={onDropItem}
                        onDragItem={onDragItem}
                        onProviderSelect={onProviderSelect}
                        providers={providers}
                        name={componentToRender.id}
                        width={componentToRender.width}
                        height={componentToRender.height}
                        direction={componentToRender.direction}
                        scrollable={componentToRender.scrollable}
                        space={componentToRender.space}
                        grow={componentToRender.grow}
                        preview={previewMode}
                        editMode={editMode}
                        component={componentToRender.component}
                        onOpenConfig={onOpenConfig}
                        onOpenEvents={onOpenEvents}
                        isDraggable={isDraggable}
                        workspace={workspace}
                    />
                </div>
            </div>
        )
    );
}

export function renderLayoutMenu({
    currentWorkspace,
    parentKey = 0,
    onClick,
    onMouseOver,
}) {
    try {
        function handleMouseOver(e) {
            onMouseOver(e);
        }

        return (
            currentWorkspace !== null &&
            currentWorkspace !== undefined &&
            currentWorkspace["layout"]
                .filter((t) => t["parent"] === parentKey)
                .sort(compareChildren)
                .map((child) => {
                    const childLayout = LayoutModel(
                        child,
                        currentWorkspace["layout"]
                    );
                    // get some data to render the child...
                    const {
                        // direction,
                        component,
                        // order,
                        id,
                    } = child;

                    const hasChildren =
                        "hasChildren" in child ? child["hasChildren"] : 0;

                    return hasChildren === 1 ? (
                        <LayoutBuilderConfigContainerMenuItem
                            key={`layout-builder-config-container-${id}`}
                            onClick={onClick}
                            onMouseOver={handleMouseOver}
                            id={id}
                            component={component}
                            item={childLayout}
                        >
                            {id > 0 &&
                                renderLayoutMenu({
                                    currentWorkspace,
                                    parentKey: id,
                                    onClick,
                                    onMouseOver,
                                })}
                        </LayoutBuilderConfigContainerMenuItem>
                    ) : (
                        <LayoutBuilderConfigMenuItem
                            onClick={onClick}
                            onMouseOver={handleMouseOver}
                            id={id}
                            component={component}
                            item={childLayout}
                            workspace={currentWorkspace}
                        />
                    );
                })
        );
    } catch (e) {
        console.log(e);
    }
}

/**
 * renderComponent
 *
 * @param {string} component the name of the component to render
 * @param {*} id the unique identifier
 * @param {*} params optional params that will be passed in as props to the component
 * @returns
 */
export function renderComponent(component, id, params = {}, children = null) {
    try {
        if (component) {
            // Check if widget exists before attempting render —
            // WidgetFactory.render() always returns a React element (truthy),
            // so the old ternary fallback could never fire.
            if (!isWidgetResolvable(component)) {
                return (
                    <div className="flex flex-col h-full justify-center items-center w-full z-10 gap-2 p-4 text-center">
                        <FontAwesomeIcon
                            icon="triangle-exclamation"
                            className="h-6 w-6 text-amber-500"
                        />
                        <div className="text-sm font-semibold text-gray-300">
                            Widget Not Found
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                            {component}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                            This widget may have been uninstalled or renamed.
                        </div>
                    </div>
                );
            }

            if ("height" in params) {
                if (params["height"] === "") {
                    params["height"] = "h-full";
                }
            }

            console.log("widget to render ", component);

            return WidgetFactory.render(
                component,
                `widget-${id}`,
                params,
                children
            );
        } else {
            return null;
        }
    } catch (e) {
        return null;
    }
}

/**
 * getComponentInLayout
 * @param {int} componentId
 * @param {array} layout the array of Layout items
 * @returns
 */
export function getComponentInLayout(componentId, layout) {
    try {
        let item = null;
        layout.forEach((l) => {
            if (l.id === componentId) {
                item = l;
            }
        });
        return item;
    } catch (e) {
        console.log(e);
        return null;
    }
}

/**
 * getParentWorkspaceForItem
 * Loop recursively through the layout until we hit a Workspace (traverse upwards for each parent)
 * DO NOT return a Container as this is NOT a workspace
 * @param {array} componentId
 * @param {object} layout
 */
export function getParentWorkspaceForItem(componentId, layout, workspaceName) {
    // The workspace we will be returning as the parent
    let workspaceFound = null;
    /**
     * recurse
     * The recursive function that will allow us to search up the parent chain for a matching workspace
     * @param {int} componentId the id of the component we are searching for in the layout
     * @param {array} layout the layout of components in the workspace
     * @param {string} workspaceName the name of the workspace we are looking for (workspace of the component)
     */
    function recurse(componentId, layout, workspaceName) {
        const componentInLayout = getComponentInLayout(componentId, layout);
        layout.forEach((layoutItem) => {
            if (layoutItem["id"] === componentInLayout["parent"]) {
                // If the component we found is NOT a Workspace...
                if (isWorkspace(layoutItem) === false) {
                    return recurse(layoutItem["id"], layout, workspaceName);
                } else {
                    // If we have a match then we are cool...else keep going!
                    if (layoutItem["workspace"] === workspaceName) {
                        // Matched, so this is our Workspace
                        workspaceFound = layoutItem;
                        return layoutItem;
                    } else {
                        return recurse(layoutItem["id"], layout, workspaceName);
                    }
                }
            }
        });
    }

    // let's light this candle.
    recurse(componentId, layout, workspaceName);

    return workspaceFound;
}

export function isWidget(item) {
    try {
        return item["canHaveChildren"] === false && item["type"] === "widget";
    } catch (e) {
        console.log(e);
        return false;
    }
}

export function isContainer(item) {
    try {
        return (
            item["canHaveChildren"] === true &&
            (item["component"] === "Container" ||
                item["component"] === "LayoutContainer")
        );
    } catch (e) {
        console.log(e);
        return false;
    }
}

export function isWorkspace(item) {
    try {
        return isWidget(item) === false && isContainer(item) === false;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export function traverseParentTree(layout, item) {
    // const componentMap = ComponentManager.map();
    layout.forEach((c) => {
        console.log("tree: ", c, c["id"], item["parent"]);
        if (item["parent"] === c["id"]) {
            console.log("tree MATCH: ", c, c);
        }
    });
}

/**
 * getNExtHighestParentId
 * @param {*} tempLayout
 * @param {*} currentParent
 * @returns
 */
export function getNextHighestParentId(tempLayout, currentParent) {
    // loop through the layout to find the next highest parent id
    let parentId = -1;

    const newTemp = JSON.parse(JSON.stringify(tempLayout));
    let len = newTemp.length;

    for (let i = len; i > 0; i--) {
        const t = newTemp[i - 1];
        if (t.parent > currentParent) {
            if (t.parent > parentId) {
                parentId = t.parent;
            }
        }
    }
    return parentId;
}

export function getNextHighestId(tempLayout) {
    const newTemp = JSON.parse(JSON.stringify(tempLayout));
    let maxId = Math.max(...newTemp.map((t) => t.id));

    return maxId + 1;
}

export function isMaxOrderForItem(tempLayout, itemId, parentId) {
    const newTemp = JSON.parse(JSON.stringify(tempLayout));
    const children = newTemp.filter((i) => i.parent === parentId);
    let maxOrder = 0;
    if (children.length > 0) {
        maxOrder = Math.max(
            ...newTemp.filter((i) => i.parent === parentId).map((t) => t.order)
        );
    }
    return itemId["order"] === maxOrder;
}

export function isMinOrderForItem(tempLayout, itemId, parentId) {
    const newTemp = JSON.parse(JSON.stringify(tempLayout));
    const children = newTemp.filter((i) => i.parent === parentId);
    let maxOrder = 0;
    if (children.length > 0) {
        maxOrder = Math.min(
            ...newTemp.filter((i) => i.parent === parentId).map((t) => t.order)
        );
    }
    return itemId["order"] === maxOrder;
}

export function getNextHighestOrder(tempLayout, parentId) {
    const newTemp = JSON.parse(JSON.stringify(tempLayout));
    const children = newTemp.filter((i) => i.parent === parentId);
    let maxOrder = 0;
    if (children.length > 0) {
        maxOrder = Math.max(
            ...newTemp.filter((i) => i.parent === parentId).map((t) => t.order)
        );
    }
    return { highest: maxOrder + 1, numChildren: children.length };
}

export function getNextHighestItemInLayout(tempLayout, currentOrder) {
    var nextItem = null;
    Object.keys(tempLayout).forEach((t) => {
        if (nextItem === null) {
            if (tempLayout[t]["order"] > currentOrder) {
                nextItem = deepCopy(tempLayout[t]);
            }
        } else {
            if (
                tempLayout[t]["order"] > currentOrder &&
                nextItem["order"] > tempLayout[t]["order"]
            ) {
                nextItem = deepCopy(tempLayout[t]);
            }
        }
    });

    return nextItem;
}

export function numChildrenForLayout(item, layout) {
    let num = 0;
    if (item && layout) {
        const itemsWithParent = Object.keys(layout).filter((li) => {
            return layout[li]["parent"] === item["parent"];
        });
        // set the number of children
        num = itemsWithParent.length;
    }
    return num;
}

export function getNextLowestItemInLayout(tempLayout, currentOrder) {
    var nextItem = null;
    Object.keys(tempLayout).forEach((t) => {
        if (nextItem === null) {
            if (tempLayout[t]["order"] < currentOrder) {
                nextItem = tempLayout[t];
            }
        } else {
            if (
                tempLayout[t]["order"] < currentOrder &&
                nextItem["order"] < tempLayout[t]["order"]
            ) {
                nextItem = tempLayout[t];
            }
        }
    });

    return nextItem;
}

export function getParentForLayoutItem(tempLayout, id) {
    try {
        const match = tempLayout.filter((t) => t["id"] === id);
        let parentId = null;
        if (match.length > 0) {
            parentId = match[0]["parent"];
        }
        return parentId ? getLayoutItemById(tempLayout, parentId) : null;
    } catch (e) {
        console.log("getParentForLayoutItem ", e.message);
    }
}

export function getLayoutItemById(tempLayout, id) {
    try {
        const match = tempLayout
            ? tempLayout.filter((t) => t["id"] === parseInt(id, 10))
            : null;
        return match.length > 0 ? match[0] : null;
    } catch (e) {
        return null;
    }
}

export function addItemToItemLayout(
    tempLayout,
    id,
    itemToAdd,
    hasChildren = false
) {
    // let's get the values required to create the item
    const nextId = getNextHighestId(tempLayout, id);
    // const item = getLayoutItemById(tempLayout, id);
    const nextOrder = getNextHighestOrder(tempLayout, id);

    if (itemToAdd) {
        console.log("[addItemToItemLayout] itemToAdd:", itemToAdd);
        console.log(
            "[addItemToItemLayout] itemToAdd.component:",
            itemToAdd["component"]
        );

        const newItem = LayoutModel(itemToAdd, tempLayout);
        console.log(
            "[addItemToItemLayout] newItem after LayoutModel:",
            newItem
        );

        // generate the new Item here...
        newItem["id"] = nextId;
        newItem["order"] = nextOrder["highest"];
        newItem["hasChildren"] = hasChildren === false ? 0 : 1;
        newItem["parent"] = id;
        newItem["scrollable"] = hasChildren === false ? true : false;
        // testing
        newItem["component"] = itemToAdd["component"];

        console.log(
            "[addItemToItemLayout] newItem after setting component:",
            newItem
        );
        console.log(
            "[addItemToItemLayout] newItem.component:",
            newItem["component"]
        );

        tempLayout.push(newItem);
    }
    return tempLayout;
}

export function removeItemFromLayout(tempLayout, id) {
    if (tempLayout.length > 1) {
        const indexOfItem = getIndexOfLayoutItem(tempLayout, id);
        const indexOfChildren = getIndexOfLayoutChildrenForItem(tempLayout, id);
        // remove the children...
        indexOfChildren.length > 0 &&
            indexOfChildren.forEach((index) => {
                // const i = tempLayout[index];
                // i['parent'] > 0 && tempLayout.splice(index, 1);
                tempLayout.splice(index, 1);
            });
        // // remove the parent/item
        if (indexOfItem > -1) {
            tempLayout.splice(indexOfItem, 1);
        }
    }
    return tempLayout;
}

export function changeDirectionForLayoutItem(tempLayout, id, currentDirection) {
    const item = getLayoutItemById(tempLayout, id);
    let newLayout = null;
    if (item) {
        const { direction } = item;
        item.direction = direction === "col" ? "row" : "col";
        newLayout = replaceItemInLayout(tempLayout, id, item);
    }
    return newLayout;
}

export function updateLayoutItem(tempLayout, itemData) {
    const item = getLayoutItemById(tempLayout, itemData["id"]);
    const id = itemData["id"];
    let newLayout = null;
    if (item) {
        Object.keys(itemData).forEach((key) => {
            item[key] = itemData[key];
        });
        newLayout = replaceItemInLayout(tempLayout, id, item);
    }
    return newLayout;
}

export function updateParentForItem(tempLayout, id, parentId) {
    const item = getLayoutItemById(tempLayout, id);
    let newLayout = null;
    if (item) {
        item.parent = parentId;
        newLayout = replaceItemInLayout(tempLayout, id, item);
    }
    return newLayout;
}

export function getIndexOfLayoutItem(tempLayout, id) {
    let indexOfItem = -1;
    tempLayout.forEach((t, index) => {
        if (t.id === id) {
            indexOfItem = index;
        }
    });
    return indexOfItem;
}

export function getIndexOfLayoutChildrenForItem(tempLayout, id) {
    let indexOfItem = [];
    tempLayout.forEach((t, index) => {
        if (t.parent === id) {
            indexOfItem.push(index);
        }
    });
    return indexOfItem;
}

export function replaceItemInLayout(tempLayout, id, item) {
    const indexOfItem = getIndexOfLayoutItem(tempLayout, id);
    // console.log("Index of item to replace", indexOfItem);
    if (indexOfItem > -1) {
        tempLayout[indexOfItem] = item;
    }
    // console.log("replace with ", item, tempLayout);
    return tempLayout;
}

/**
 * getNearestParentWorkspace
 * Find the nearest workspace that matches the workspace type
 * that is not a layout workspace....
 *
 * This will tell us which parent "functional" workspace we are inside so we can list
 * the widgets that are available to that space....
 *
 * @param {object} layout the layout of the entire workspace
 * @param {object} item the item we have clicked on in the editor
 * @param {object} itemSelected
 */
export function getNearestParentWorkspace(
    workspaceLayout,
    currentItem,
    parentItem,
    count = 0
) {
    try {
        if (currentItem !== null && parentItem !== null) {
            if ("component" in currentItem) {
                if (currentItem !== null) {
                    // if this item is a workspace and same type as the item selected....
                    if (
                        currentItem["type"] === "workspace" &&
                        currentItem["workspace"] !== "layout"
                    ) {
                        return currentItem;
                    } else {
                        if (
                            currentItem["type"] === "workspace" &&
                            currentItem["workspace"] !== "layout"
                        ) {
                            return currentItem;
                        } else {
                            // if a workspace got past all the checks...
                            if (
                                currentItem["type"] === "workspace" &&
                                currentItem["workspace"] !== "layout"
                            ) {
                                return currentItem;
                            }
                            const parentId = currentItem["parent"];
                            const parentItemFromLayout = getLayoutItemById(
                                workspaceLayout,
                                parentId
                            );

                            count++;

                            return parentItemFromLayout !== null
                                ? getNearestParentWorkspace(
                                      workspaceLayout,
                                      parentItem,
                                      parentItemFromLayout,
                                      count
                                  )
                                : {};
                        }
                    }
                } else {
                    // config was null so move on to the next parent?
                    return {};
                }
            }
        }
        return {};
    } catch (e) {
        console.log("get nearest parent error ", e.message);
        return {};
    }
}

export function getContainerBorderColor(item) {
    console.log("getting container border color for item ", item);
    let color = "border-gray-900";
    try {
        if (item) {
            // const config = ComponentManager.config(item['component'], item);
            const canHaveChildren = item ? item["canHaveChildren"] : false;
            if ("styles" in item) {
                color =
                    "backgroundColor" in item["styles"]
                        ? item["styles"]["borderColor"]
                        : color;
            } else {
                switch (item["type"]) {
                    case "workspace":
                        if (item["workspace"] === "layout") {
                            color = "border-gray-700 border-dashed";
                        } else {
                            if (canHaveChildren === true) {
                                color = "border-indigo-800";
                            } else {
                                color = "border-indigo-900";
                            }
                        }
                        break;
                    case "widget":
                        color = "border-green-800";
                        break;
                    default:
                        break;
                }
            }
        }

        return color;
    } catch (e) {
        console.log(e);
        return color;
    }
}

export function getContainerColor(component) {
    let color = "bg-gray-900";
    try {
        if (
            "styles" in component &&
            Object.keys(component["styles"]).length > 0
        ) {
            color =
                "backgroundColor" in component["styles"]
                    ? component["styles"]["backgroundColor"]
                    : color;
        } else {
            switch (component["type"]) {
                case "workspace":
                    if (component["workspace"] === "layout") {
                        color = "bg-gray-900";
                    } else {
                        if (component["canHaveChildren"] === false) {
                            color = "bg-indigo-800";
                        }
                    }
                    break;
                case "widget":
                    color = "bg-green-800";
                    break;
                default:
                    break;
            }
        }
        return color;
    } catch (e) {
        return color;
    }
}

// function getContainerStyles(component) {
//     let color = 'bg-gray-900';
//     try {
//         if ('styles' in component && Object.keys(component['styles']).length > 0) {
//             color = 'backgroundColor' in component['styles'] ? component['styles']['backgroundColor'] : color;
//         } else {
//             switch(component['type']) {
//                 case 'workspace':
//                     if (component['workspace'] === 'layout') {
//                         color = 'bg-gray-900';
//                     } else {
//                         if (component['canHaveChildren'] === false) {
//                             color = 'bg-indigo-800';
//                         }
//                     }
//                 break;
//                 case 'widget':
//                     color = 'bg-green-800';
//                 break;
//                 default:
//                 break;
//             }
//         }
//         return color;
//     } catch(e) {
//         return color;
//     }
// }

export function getBorderStyle(item) {
    try {
        return WidgetFactory.workspace(item["component"]) === "layout"
            ? "border-dashed"
            : "border-2";
    } catch (e) {
        return "";
    }
}

export function getWidgetsForWorkspace(workspaceItem) {
    try {
        const componentMap = ComponentManager.map();
        console.log("component map ", componentMap);
        const workspaceType = workspaceItem ? workspaceItem["workspace"] : null;
        const canAddChildren = workspaceItem
            ? workspaceItem["canHaveChildren"]
            : true;

        const parentWorkspaceType =
            workspaceItem["parentWorkspaceName"] !== null &&
            workspaceItem["parentWorkspaceName"] !== undefined
                ? workspaceItem["parentWorkspaceName"]
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
                    .map((w) => componentMap[w]);
            // .map((w) => renderMenuItem("widget", w));

            // return <div className="flex flex-col rounded space-y-1">{options}</div>;
            return options;
        } else {
            // return <div className="flex flex-col rounded"></div>;
            return [];
        }
    } catch (e) {
        console.log(e);
    }
}

/**
 * getWorkspacesForWorkspace
 * Get the available Layout items (workspaces, containers) that may be added
 * to the workspace/container item passed in
 * @param {object} workspaceItem the layout type item
 * @param {string} searchTerm the optional search term
 * @returns Array an array of available layout objects
 */
export function getWorkspacesForWorkspace(workspaceItem, searchTerm = "") {
    const componentMap = ComponentManager.map();
    const canAddChildren = workspaceItem ? workspaceItem.canHaveChildren : true;

    // We want to make sure the workspaceItem (parent) can have children from the config
    // We also want to limit the workspaces to layout only
    // if the parent workspace is NOT layout, we only allow "layout" components

    const options =
        canAddChildren === true &&
        workspaceItem["parentWorkspaceName"] === "layout"
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
                  .map(
                      (w) => componentMap[w] /*renderMenuItem("workspace", w) */
                  )
            : Object.keys(componentMap)
                  .sort()
                  .filter((i) =>
                      searchTerm !== ""
                          ? i.toLowerCase().includes(searchTerm)
                          : true
                  )
                  .filter((c) => componentMap[c]["workspace"] === "layout")
                  .map(
                      (w) => componentMap[w] /*renderMenuItem("workspace", w)*/
                  );

    return options;
    // return <div className="flex flex-col rounded space-y-1">{options}</div>;
}

export function getLayoutItemForWorkspace(item, workspace, parentItem = null) {
    try {
        console.log("layout", item, workspace, parentItem);

        const layoutModel = LayoutModel(
            item,
            workspace["layout"],
            workspace["id"]
        );

        // we have to give the widget an ID
        const nextId = getNextHighestId(workspace["layout"]);
        const nextOrderData = getNextHighestOrder(workspace["layout"]);
        const nextOrder = nextOrderData["highest"];

        layoutModel.id = nextId;
        layoutModel.order = nextOrder;

        parentItem && "id" in parentItem
            ? (layoutModel["parent"] = parentItem["id"])
            : (layoutModel["parent"] = 0);

        // layoutModel["parentWorkspace"] = item["parentWorkspace"];
        layoutModel["parentWorkspaceName"] = item["parentWorkspaceName"];
        // layoutModel["parent"] = item["id"];
        // nearest parent workspace (use the original widget/workspace clicked
        // to begin looking...

        // lets add the data to the original workspace...
        const newWorkspace = JSON.parse(JSON.stringify(workspace));
        newWorkspace["layout"] = [layoutModel["parentWorkspace"], layoutModel];

        return { layout: layoutModel, newWorkspace };
    } catch (e) {
        console.log(e);
        return { layout: null, newWorkspace: null };
    }
}

/**
 * Get all of the children for a particular layout item
 * @param {Object} workspace the Workspace Model - use the layout
 * @param {Object} layoutItem the item (LayoutModel) we are checking
 * @returns {Array} the child layout items that are a match
 */
export function getChildrenForLayoutItem(workspace, layoutItem) {
    return workspace.layout.filter((workspaceItem) => {
        return layoutItem.id === workspaceItem.parent;
    });
}
/**
 * Determine if the layout item has a workspace by the given workspace name
 * A child is denoted by having a parent id equal to the parent id of the item we
 * are inputting
 *
 * if parent === layoutItem.id
 */
export function layoutItemHasWorkspaceAsChild(
    workspace,
    layoutItem,
    workspaceName
) {
    return getChildrenForLayoutItem(workspace, layoutItem).filter(
        (workspaceItem) => {
            return (
                workspaceItem.workspace === workspaceName &&
                workspaceItem.type === "workspace"
            );
        }
    );
}

/**
 * Add a component as a child of another component
 * @param {LayoutModel} childComponent the child component we want to add to the layout item
 * @param {LayoutModel} layoutItem the LayoutModel item we want to add the child component TO
 * @param {Object} workspace the entire workspace we are performing the layout changes
 * @returns {Object} workspace
 */
export function addChildToLayoutItem(childComponent, layoutItem, workspace) {
    const nextId = getNextHighestId(workspace["layout"]);

    // then get the next highest ORDER of the items
    const nextOrderData = getNextHighestOrder(workspace["layout"]);
    const nextOrder = nextOrderData["highest"];
    childComponent["id"] = nextId;
    childComponent["order"] = nextOrder;

    // 1. Add the layoutItem as the parentWorkspace of the childComponent
    // childComponent["parentWorkspace"] = layoutItem;
    childComponent["parent"] = layoutItem["id"];

    // 2. Add the element back into the layout
    workspace.layout.push(childComponent);

    return workspace;
}

/**
 * Check if a widget component key is resolvable in ComponentManager
 * @param {string} componentKey the component key to check
 * @returns {boolean} true if the widget can be rendered
 */
export function isWidgetResolvable(componentKey) {
    // Layout containers are always resolvable (handled specially by WidgetFactory)
    if (ComponentManager.isLayoutContainer(componentKey)) return true;
    const m = ComponentManager.componentMap();
    return !!(
        m &&
        m[componentKey] &&
        typeof m[componentKey].component === "function"
    );
}

// export {
//     renderLayout,
//     renderLayoutMenu,
//     renderComponent,
//     getParentForLayoutItem,
//     getNextHighestItemInLayout,
//     getNextLowestItemInLayout,
//     getLayoutItemById,
//     addItemToItemLayout,
//     removeItemFromLayout,
//     changeDirectionForLayoutItem,
//     getNextHighestParentId,
//     getNextHighestId,
//     getNextHighestOrder,
//     updateLayoutItem,
//     updateParentForItem,
//     getContainerBorderColor,
//     getContainerColor,
//     replaceItemInLayout,
//     getNearestParentWorkspace,
//     getBorderStyle,
//     numChildrenForLayout,
//     isMaxOrderForItem,
//     isMinOrderForItem
// }
