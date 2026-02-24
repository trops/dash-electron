import { LayoutModel } from "./LayoutModel";
import { ComponentManager } from "../ComponentManager";
import { deepCopy } from "@trops/dash-react";
import { getNextHighestId, getNextHighestOrder } from "../utils/layout";
/**
 * A Model for a Workspace (Dashboard)
 * The Dashboard in this instance is the entire Layout inclusive of the workspaces and widgets
 * When the user selects a Dashboard, this is the model that stores that information.
 */
export class DashboardModel {
    /**
     *
     * @param {Object} dashboardItem the dashboard/workspace we are using to initialize
     */
    constructor(dashboardItem) {
        this._initialize(dashboardItem);
    }

    validDashboardTypes = ["layout", "widget", "workspace", "grid"];
    validDashboardProperties = [
        "id",
        "name",
        "type",
        "label",
        "layout",
        "menuId",
        "version",
    ];

    /**
     * initialize the model
     * @param {Object} dashboardItem object containing the saved workspace layout
     */
    _initialize(dashboardItem) {
        this.dashboard = {};

        let obj =
            dashboardItem !== null && dashboardItem !== undefined
                ? deepCopy(dashboardItem)
                : {};

        this.id = "id" in obj ? obj["id"] : Date.now();
        this.name = "name" in obj ? obj["name"] : "New Dashboard";
        this.type =
            "type" in obj ? this._sanitizeType(obj["type"]) : "workspace";
        this.label = "label" in obj ? obj["label"] : "New Dashboard";
        this.version = "version" in obj ? obj["version"] : 1;
        this.layout =
            "layout" in obj ? obj["layout"] : this._initializeLayout();
        this.menuId = "menuId" in obj ? obj["menuId"] : 1;

        obj = null;

        // Normalize all grids on load to repair any persisted corruption
        this._normalizeAllGrids();
    }

    _initializeLayout() {
        try {
            // NEW: Default to 1x1 grid instead of flexbox Container
            const newLayout = {
                id: 1,
                order: 1,
                type: "grid",
                component: "LayoutGridContainer",
                hasChildren: 1,
                scrollable: false,
                parent: 0,
                menuId: 1, // default menu item id is 1
                width: "w-full",
                height: "h-full",
                grid: {
                    rows: 1,
                    cols: 1,
                    gap: "gap-2",
                    1.1: { component: null, hide: false },
                },
            };
            return [LayoutModel(newLayout, [])];
        } catch (e) {
            console.log(e);
            return [];
        }
    }

    destroy() {
        this.id = null;
        this.name = null;
        this.type = null;
        this.label = null;
        this.version = null;
        this.layout = null;
        this.menuId = null;
        this.dashboard = null;
    }

    workspace() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            label: this.label,
            version: this.version,
            layout: this.layout,
            menuId: this.menuId,
        };
    }

    /**
     * Make sure the type specified in the component item is valid
     * @param {String} t the type in the dashboard item argument
     * @returns {Boolean}
     */
    _sanitizeType(t) {
        return this.validDashboardTypes.includes(t) === true ? t : "workspace";
    }

    _sanitizeLayout(layout, workspaceId) {
        if (layout) {
            if (layout.length > 0) {
                return layout;
            } else {
                return [
                    LayoutModel(
                        {
                            workspace: "layout",
                            type: "workspace",
                            dashboardId: workspaceId,
                        },
                        [],
                        workspaceId
                    ),
                ];
            }
        }
    }

    /**
     * Return the LayoutModel based on the id
     * @param {Number} componentId
     * @returns
     */
    getComponentById(componentId) {
        try {
            let item = null;
            this.layout.forEach((l) => {
                if (l.id === componentId) {
                    item = l;
                }
            });
            return item;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get the TOP Container in the layout
     * @returns {LayoutItem} the top container in the entire layout
     */
    getRootContainer() {
        const rootContainers = this.layout.filter(
            (layoutItem) => layoutItem.parent === 0
        );
        return rootContainers.length > 0 ? rootContainers[0] : null;
    }

    /**
     * Add a NEW child to the component with the specified id
     * This will automatically add the compatible workspace if necessary
     * @param {LayoutModel} childComponent the child component to add
     * @param {*} itemId the id of the component to add it TO
     * @returns
     */
    addChildToLayoutItem(childComponent, itemId = 1, cellNumber = "") {
        try {
            // Get the Parent Component to add the child TO
            const parentComponent = this.getComponentById(itemId);
            if ("grid" in parentComponent && parentComponent["grid"] !== null) {
                return this.addChildToGridLayout(
                    childComponent,
                    itemId,
                    cellNumber
                );
            } else {
                parentComponent.hasChildren = 1;

                // update the item in the layout
                // this.updateLayoutItem(parentComponent);

                console.log("adding to parent component ", parentComponent);
                // now we can add the widget to the new workspace.
                const nextId = getNextHighestId(this.layout);
                // then get the next highest ORDER based on the children
                // of the parent
                const nextOrderData = getNextHighestOrder(
                    this.layout,
                    parentComponent.id
                );
                const nextOrder = nextOrderData["highest"];

                // set the new id and order for the item
                childComponent["id"] = nextId;
                childComponent["order"] = nextOrder;
                // 1. Add the layoutItem as the parentWorkspace of the childComponent
                // childComponent["parentWorkspace"] = parentComponent;
                childComponent["parent"] = parentComponent["id"];
                childComponent["parentWorkspaceName"] =
                    parentComponent.workspace;

                console.log("child component after add ", childComponent);
                // 2. Add the element back into the layout
                this.layout.push(childComponent);

                return childComponent.id;
            }

            // this.updateLayoutItem(childComponent);
            /*
            if (childComponent.parent !== itemId) {
                console.log("parent component ", parentComponent);
                if (parentComponent) {
                    if (childComponent.type === "widget") {
                        console.log("item being added is a widget", childComponent);

                        // add the workspace component to the layout
                        const workspaceIdAdded = this.addWorkspaceForWidget(parentComponent, childComponent);
                        console.log("workspace added ", workspaceIdAdded, this.layout);

                        // get this component as the parent of the widget now?
                        const workspaceParent = this.getComponentById(workspaceIdAdded);

                        // now we can add the widget to the new workspace.
                        const nextId = getNextHighestId(this.layout);
                        // then get the next highest ORDER based on the children
                        // of the parent
                        const nextOrderData = getNextHighestOrder(this.layout, workspaceParent.id);
                        const nextOrder = nextOrderData["highest"];

                         // 2. Add the element back into the layout
                        this.layout.push(childComponent);

                        // set the new id and order for the item
                        childComponent['id'] = nextId;
                        childComponent["order"] = nextOrder;

                        this.updateLayoutItem(childComponent);

                        const testParent = this.setParentForLayoutItem(workspaceParent.id, childComponent);


                        // now we have to update the parent
                        workspaceParent.hasChildren = 1;
                        this.updateLayoutItem(workspaceParent);

                        return childComponent.id;
                        
                        // return this.addChildToLayoutItem(childComponent, workspaceIdAdded);
                    } else {
                        console.log("in lower IF");
                        // set an id for the new child component
                        // to avoid collisions
                        const nextId = getNextHighestId(this.layout);
                        // then get the next highest ORDER based on the children
                        // of the parent
                        const nextOrderData = getNextHighestOrder(this.layout, parentComponent.id);
                        const nextOrder = nextOrderData["highest"];

                        // set the new id and order for the item
                        childComponent['id'] = nextId;
                        childComponent["order"] = nextOrder;

                        // 1. Add the layoutItem as the parentWorkspace of the childComponent
                        childComponent["parentWorkspace"] = parentComponent;
                        childComponent["parent"] = parentComponent["id"];

                        // 2. Add the element back into the layout
                        this.layout.push(childComponent);

                        // now we have to update the parent
                        parentComponent.hasChildren = 1;
                        this.replaceItemInLayoutById(parentComponent["id"], parentComponent);

                        return childComponent.id;
                    }
                } else {
                    return null;
                }
            }
                */
        } catch (e) {
            return this.layout;
        }
    }

    /**
     * set the parent of the layout item using an id for the parent layout item
     * @param {*} parentId
     * @param {*} layoutItem
     * @returns {LayoutModel}
     */
    setParentForLayoutItem(parentId, layoutItem) {
        try {
            const parentComponent = this.getComponentById(parentId);
            parentComponent.hasChildren = 1;
            this.updateLayoutItem(parentComponent);

            layoutItem.parent = parentComponent.id;
            layoutItem.parentWorkspace = parentComponent;
            layoutItem.parentWorkspaceName =
                layoutItem.parentWorkspace.workspace;

            return this.updateLayoutItem(layoutItem);
        } catch (e) {
            return null;
        }
    }

    /**
     * Get all of the children for a particular layout item
     * @param {Object} workspace the Workspace Model - use the layout
     * @param {Object} layoutItem the item (LayoutModel) we are checking
     * @returns {Array} the child layout items that are a match
     */
    getChildrenForLayoutItem(layoutItem) {
        return this.layout.filter((workspaceItem) => {
            return layoutItem.id === workspaceItem.parent;
        });
    }

    getRootWorkspaceInContainer(container) {
        try {
            const children = this.getChildrenForLayoutItem(container).filter(
                (v) => v.type === "workspace"
            );
            return children;
        } catch (e) {
            return null;
        }
    }

    /**
     * this is the required contexts for the dashboard being built for the user
     * this is NOT the global list of contexts stored in the contexts.js file
     * in the main users application
     */
    getRequiredContexts() {
        try {
            const contexts = [];
            this.layout.forEach((layoutItem) => {
                if (
                    "contexts" in layoutItem &&
                    layoutItem.contexts.length > 0
                ) {
                    layoutItem.contexts.forEach((context) => {
                        if (contexts.includes(context) === false) {
                            contexts.push(context);
                        }
                    });
                }
            });
            return contexts;
        } catch (e) {
            return [];
        }
    }

    /**
     * Get the Deepest workspace in the layout for a specified layoutitem
     * @param {*} layoutItem the layout item we are checking
     * @returns {LayoutModel} the workspace that is the deepest
     */
    getHighestOrderWorkspaceForLayoutItem(layoutItem) {
        try {
            // let highestOrderWorkspace = null;
            // let highestOrderNumber = 0;
            let tree = {};

            var self = this;

            function recursiveFunction(layoutItem) {
                const children = self.getChildrenForLayoutItem(layoutItem);
                console.log("children for component ", children);
                const filtered = children.filter((v) => v.type === "workspace");
                console.log("workspace children ", children, layoutItem);
                if (filtered.length > 0) {
                    for (var i = 0; i < filtered.length; i++) {
                        const child = filtered[i];
                        const childTemp = self.getComponentById(child.id);
                        const parentId = childTemp.parent;
                        if (parentId in tree === false) {
                            tree[parentId] = [];
                        }
                        tree[parentId].push(childTemp);

                        // recurse
                        recursiveFunction(childTemp);
                    }
                }
            }

            recursiveFunction(layoutItem);
            return tree;
        } catch (e) {
            console.log(e);
            return {};
        }
    }

    getNextAvailableCellInGridLayout(gridLayout) {
        try {
            let nextCellNumber = null;
            for (var i = 1; i < gridLayout.rows + 1; i++) {
                for (var j = 1; j < gridLayout.cols + 1; j++) {
                    const cellNumber = `${i}.${j}`;
                    const cmpToRender =
                        cellNumber in gridLayout
                            ? gridLayout[cellNumber]["component"]
                            : null;
                    const isHidden = gridLayout[cellNumber]["hide"] === true;
                    if (
                        cmpToRender === null &&
                        nextCellNumber === null &&
                        isHidden === false
                    ) {
                        nextCellNumber = cellNumber;
                    }
                }
            }
            return nextCellNumber;
        } catch (e) {
            return null;
        }
    }
    /**
     * add a child layout item to a grid layout
     * @param {LayoutModel} childComponent the component we are adding to the grid layout
     * @param {*} itemId the id of the parent container we are adding the child TO
     * @param {*} cellNumber the cell number in the grid layout that is associated with this component
     */
    addChildToGridLayout(childComponent, itemId, cellNumber = "") {
        try {
            // Get the Parent Component to add the child TO
            const parentComponent = this.getComponentById(itemId);
            const parentGridLayout = parentComponent.grid;
            if (parentGridLayout) {
                console.log(
                    "adding child to grid ",
                    parentGridLayout,
                    childComponent,
                    cellNumber
                );

                // now we can add the widget to the new workspace.
                const nextId = getNextHighestId(this.layout);

                let hasCellAvailable = false;
                // if we have a cell number, add it directly...
                if (cellNumber !== "") {
                    parentComponent.grid[cellNumber]["component"] = nextId;
                    hasCellAvailable = true;
                } else {
                    // otherwise lets choose the next available cell...
                    const nextCell = this.getNextAvailableCellInGridLayout(
                        parentComponent.grid
                    );
                    console.log("next cell", nextCell);
                    if (nextCell !== null) {
                        if (nextCell in parentComponent.grid === false) {
                            parentComponent.grid[nextCell] = {
                                component: null,
                            };
                        }
                        parentComponent.grid[nextCell]["component"] = nextId;
                        hasCellAvailable = true;
                    } else {
                        hasCellAvailable = false;
                    }
                }

                if (hasCellAvailable === true) {
                    // do we need to do this?
                    parentComponent.hasChildren = 1;

                    // update the item in the layout
                    this.updateLayoutItem(parentComponent);

                    console.log(
                        "adding to parent component ",
                        parentComponent,
                        childComponent
                    );

                    // then get the next highest ORDER based on the children
                    // of the parent
                    const nextOrderData = getNextHighestOrder(
                        this.layout,
                        parentComponent.id
                    );
                    const nextOrder = nextOrderData["highest"];

                    // set the new id and order for the item
                    childComponent["id"] = nextId;
                    childComponent["order"] = nextOrder;
                    // 1. Add the layoutItem as the parentWorkspace of the childComponent
                    //childComponent["parentWorkspace"] = parentComponent;
                    childComponent["parent"] = parentComponent["id"];
                    childComponent["parentWorkspaceName"] =
                        parentComponent.workspace;

                    console.log("child component after add ", childComponent);
                    // 2. Add the element back into the layout
                    this.layout.push(childComponent);

                    return childComponent.id;
                }
            }

            return null;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    /**
     * Sanitize the workspace layouts so that the workspaces are not "side by side"
     * and formed like nexted components for a specific container
     *
     */
    sanitizeWorkspaceLayouts(layoutItem) {
        try {
            // The goal is to make ALL of the workspaces children of this main layoutItem
            // passed into the function...

            // All Workspaces also will be h-full, w-full, scrollable = false

            // Then all of the widgets become children of the deepest workspace.

            const workspacesForLayout =
                this.getHighestOrderWorkspaceForLayoutItem(layoutItem);
            console.log(
                "workspaces for layout ",
                workspacesForLayout,
                Object.keys(workspacesForLayout)
            );

            // for(var i=0; i < workspacesForLayout.length; i++) {
            //     const workspaceItem = this.getComponentById(ws.id);
            //     console.log("setting parent ", layoutItem.id, workspaceItem);
            //     this.setParentForLayoutItem(layoutItem.id, workspaceItem);
            // }

            // if (workspacesForLayout.length > 1) {
            //     workspacesForLayout.forEach(ws => {
            //         const workspaceItem = this.getComponentById(ws.id);
            //         console.log("setting parent ", layoutItem.id, workspaceItem);
            //         this.setParentForLayoutItem(layoutItem.id, workspaceItem);
            //     })
            // }
        } catch (e) {
            return null;
        }
    }
    /**
     * Change the parent for a list of child elements
     * @param {*} parentLayoutItem
     * @param {*} childLayoutItems
     */
    setParentForChildren(parentLayoutItem, childLayoutItems) {
        try {
            childLayoutItems
                .filter((v) => v.id !== parentLayoutItem.id)
                .forEach((child) => {
                    this.setParentForLayoutItem(parentLayoutItem.id, child);
                });
        } catch (e) {
            console.log("failed to set children of parent");
        }
    }

    /**
     * Once a child gets added or removed, the order numbering can get out of sync
     * This method will "reset" the order 1,2,3 etc.
     * @param {LayoutModel} parentLayoutItem the Layout item we want to reset the children FOR
     */
    sanitizeOrderForChildren(parentLayoutItem) {
        try {
            // get the children of the parent layout
            const children = this.getChildrenForLayoutItem(parentLayoutItem);
            // want to sort the children by order
            // then go through each "in order" and change the order so that it is index + 1;

            children.items
                .sort((a, b) => a.order - b.order)
                .forEach((child, index) => {
                    child.order = index + 1;
                    this.updateLayoutItem(child);
                });
        } catch (e) {
            console.log("error sanitizing order");
            return null;
        }
    }

    /**
     * Determine if the layout item has a workspace by the given workspace name
     * A child is denoted by having a parent id equal to the parent id of the item we
     * are inputting
     *
     * if parent === layoutItem.id
     */
    layoutItemHasWorkspaceAsChild(layoutItemParent, layoutItem) {
        return this.getChildrenForLayoutItem(layoutItemParent).filter(
            (workspaceItem) => {
                return (
                    workspaceItem.workspace === layoutItem.workspace &&
                    workspaceItem.type === "workspace"
                );
            }
        );
    }

    /**
     * Find the compatible workspaces in the layout for a particular layout item (widget)
     * @param {LayoutModel} layoutItem the layout item we want to find a compatible workspace for
     * @returns {Array} a list of compatible Workspace layout items
     */
    compatibleWorkspaces(layoutItem) {
        return this.layout.filter(
            (item) =>
                item.type === "workspace" &&
                item.workspace === layoutItem.workspace
        );
    }

    /**
     * Check to see if the layout item (container) that we are adding a widget/workspace TO
     * has a compatible workspace already inside (as a wrapper)
     * - If not, we will have to add a copatible workspace to the root of the container
     * - If so, we can simply add the child to the layout at the deepest level
     * @param {LayoutModel} layoutItemToCheck the LayoutModel item that we want to add a widget TO
     * @param {LayoutModel} layoutItem the LayoutModel item that we want to add
     * @returns {Boolean} if the TO layout is compatible with the LahyoutModel we are adding
     */
    layoutItemIsCompatible(layoutItemToCheck, layoutItem) {
        return (
            this.layoutItemHasWorkspaceAsChild(layoutItemToCheck, layoutItem)
                .length > 0
        );
    }

    layoutHasCompatibleWorkspace(layoutItem) {
        try {
            const rootContainer = this.getComponentById(1);
            return this.layoutItemIsCompatible(rootContainer, layoutItem);
        } catch (e) {
            return false;
        }
    }

    /**
     * Travel UP the parent chain until we find the top level container for this layout item
     * @param {LayoutModel} layoutItem the layout item we want to use as the source item
     */
    parentContainerForLayoutItem(layoutItem) {
        try {
            if (layoutItem.workspace === "layout") {
                return layoutItem;
            } else {
                const parentLayoutItem = this.getComponentById(
                    layoutItem.parent
                );
                return this.parentContainerForLayoutItem(parentLayoutItem);
            }
        } catch (e) {
            console.log(e);
            return null;
        }
    }
    /**
     * Look for a container that encapsulates 2 other containers
     * This is used for moving a workspace UP in the hierarchy
     * in case a user wants to add a widget to a container that is not currently
     * compatible, but wants to maintain the same workspace to power them both.
     * @param {Array} items the array of layoutItems that are to be checked
     */
    containsLayoutItems(layoutItems) {
        // we have to get the container for each item in the array first.
        // then check to see WHICH container CONTAINS them all!
        const containers = this.layout.filter(
            (layoutItem) => layoutItem.workspace === "layout"
        );
        console.log(containers);
        // now check all of the children of each container
    }

    /**
     * Get the nearest top level container for the layout item
     * @param {LayoutModel} layoutItem the layout item we are checking (typically a widget add motion)
     */
    containerForLayoutItem(layoutItem) {}

    /**
     * Find the deepest workspace in the given container
     * @param {*} container
     */
    deepestWorkspaceInContainer(container) {
        return this.getHighestOrderWorkspaceForLayoutItem(container);
    }

    /**
     * Find a compatible Workspace for the layout item using the ComponentManager (all registered components)
     * @param {LayoutModel} layoutItem
     * @returns {LayoutModel} the compatible workspace component
     */
    findCompatibleWorkspaceComponent(layoutItem) {
        const compatibleWorkspaceComponent =
            ComponentManager.getWorkspaceByName(layoutItem.workspace);
        if (compatibleWorkspaceComponent) {
            return LayoutModel(compatibleWorkspaceComponent);
        }
        return null;
    }

    /**
     * Add a Workspace to the Layout if required to work with the Widget being added.
     * @param {LayoutModel} layoutItem the LayoutModel component we want to check the children to see if there is a workspace compatible
     */
    addWorkspaceForWidget(toLayoutItem, layoutItemToAdd) {
        try {
            if (layoutItemToAdd.type === "widget") {
                // workspace we will use to add to the Layout
                let workspaceToAddTo = null;

                // the name of the workspace compatible with the item being added
                const workspaceRequiredName = layoutItemToAdd.workspace;

                // Fetch any compatible workspaces with in the cource container
                const compatibleWorkspaceChildren =
                    this.layoutItemHasWorkspaceAsChild(
                        toLayoutItem,
                        layoutItemToAdd
                    );

                console.log(
                    "compatible children ",
                    compatibleWorkspaceChildren,
                    workspaceRequiredName
                );
                // if (compatibleWorkspaceChildren.length > 0) {
                //     console.log("ok we can add this widget as a child per usual - highest id");
                //     // choose the workspace with the highest ID to add the item to
                //     let orderId = 0;
                //     compatibleWorkspaceChildren.forEach(childComponent => {
                //         if(childComponent.order > orderId) {
                //             workspaceToAddTo = childComponent;
                //         }
                //     });
                // } else {
                //     // we have to conjur up a Compatible workspace based on the item specified
                //     workspaceToAddTo = ComponentManager.getWorkspaceByName(workspaceRequiredName);
                //     console.log("workspace component conjured ", workspaceToAddTo);
                //     // now we have to build out a temporary layout in order to preview the widget selected
                // }

                if (compatibleWorkspaceChildren.length === 0) {
                    // we have to conjur up a Compatible workspace based on the item specified
                    const tempWorkspaceComponent =
                        ComponentManager.getWorkspaceByName(
                            workspaceRequiredName
                        );
                    console.log("temp workspace name ", tempWorkspaceComponent);
                    workspaceToAddTo = LayoutModel({
                        type: tempWorkspaceComponent.type,
                        component: tempWorkspaceComponent.name,
                        // parent: toLayoutItem.id,
                        // parentWorkspace: toLayoutItem,
                        // parentWorkspaceName: toLayoutItem.workspace
                    });

                    console.log(
                        "workspace component conjured from DashboardModel",
                        workspaceToAddTo
                    );
                } else {
                    // we have to add this as usual to the toLayoutItem
                }

                // now we have to add the workspace as a child, but NOT below the widgets
                // we want to basically add this as
                // Container
                // workspace, workspace workspace
                // widgets...
                const highestOrderWorkspace =
                    this.getHighestOrderWorkspaceForLayoutItem(toLayoutItem);
                if (highestOrderWorkspace > 0) {
                    return this.addChildToLayoutItem(
                        workspaceToAddTo,
                        highestOrderWorkspace["id"]
                    );
                } else {
                    // add to the Container if no other workspaces found
                    return this.addChildToLayoutItem(
                        workspaceToAddTo,
                        toLayoutItem["id"]
                    );
                }
            }
        } catch (e) {
            console.log(e);
        }
    }
    setParentForItem(parentId, childId) {}

    setOrderForItem(order, itemId) {}

    /**
     * Update the LayoutModel item using the id in the item itself to execute the update
     * @param {LayoutModel} itemData the LayoutModel we want to replace in the layout
     * @returns {Object} the new layout
     */
    updateLayoutItem(itemData) {
        try {
            const id = itemData["id"];
            const item = this.getComponentById(id);
            if (item) {
                Object.keys(itemData).forEach((key) => {
                    item[key] = itemData[key];
                });
                return this.replaceItemInLayout(id, item);
            }
            return this.layout;
        } catch (e) {
            return this.layout;
        }
    }

    /**
     * Find and return the index of the item in the layout
     * @param {Number} id the id of the LayoutModel item we are trying to find in the layout
     * @returns {Number} the index of the item in the layout, or -1 if not found
     */
    getIndexOfLayoutItemById(id) {
        let indexOfItem = -1;
        try {
            this.layout.forEach((t, index) => {
                if (t.id === id) {
                    indexOfItem = index;
                }
            });
            return indexOfItem;
        } catch (e) {
            return indexOfItem;
        }
    }

    getIndexOfLayoutChildrenForItem(id) {
        let indexOfItem = [];
        this.layout.forEach((t, index) => {
            if (t.parent === id) {
                indexOfItem.push(index);
            }
        });
        return indexOfItem;
    }

    /**
     * Replace the LayoutModel item in the layout based on its id, with a new LayoutModel item
     * @param {Number} id the id of the item we wish to replace
     * @param {LayoutModel} item the LayoutModel we are using as the replacement
     * @returns
     */
    replaceItemInLayoutById(id, item) {
        try {
            const indexOfItem = this.getIndexOfLayoutItemById(id);
            // console.log("Index of item to replace", indexOfItem);
            if (indexOfItem > -1) {
                this.layout[indexOfItem] = item;
            }
            // console.log("replace with ", item, tempLayout);
            return this.layout;
        } catch (e) {
            console.log(e);
            return this.layout;
        }
    }

    removeItemFromLayout(id) {
        try {
            if (this.layout.length > 1) {
                // lets filter out all of the items that have the id of the id specified
                // and also anything that has a parent of the same id, and then anything that is a parent of that item..
                // so we have to do this recursively.

                console.log("deleting", id);

                const newLayout = this.layout.filter(
                    (layoutItem) => layoutItem.id === id
                );

                console.log("new layout ", newLayout);

                // reset the layout by removing the element
                this.layout = this.layout.filter(
                    (layoutItem) => layoutItem.id !== id
                );

                console.log("layout after one recursion ", this.layout);

                const gridCleanupLayout = [];
                this.layout.forEach((layoutItem) => {
                    if (layoutItem.grid !== null) {
                        const gridLayout = layoutItem.grid;
                        Object.keys(gridLayout).forEach((gk) => {
                            if (gk !== "rows" && gk !== "cols") {
                                const cellData = gridLayout[gk];
                                if (cellData.component === id) {
                                    cellData.component = null;
                                }
                                gridLayout[gk] = cellData;
                            }
                        });
                        layoutItem.grid = gridLayout;
                        gridCleanupLayout.push(layoutItem);
                    } else {
                        gridCleanupLayout.push(layoutItem);
                    }
                });
                // and now handle the parent...
                // while(newLayoutLength > 0) {
                const children = this.layout.filter(
                    (layoutItem) => layoutItem.parent === id
                );
                children.forEach((child) => {
                    console.log("removing child ", child);
                    this.removeItemFromLayout(child.id);
                });

                // }

                return;

                // const indexOfItem = getIndexOfLayoutItem(tempLayout, id);
                // const indexOfChildren = getIndexOfLayoutChildrenForItem(
                //     tempLayout,
                //     id
                // );
                // // remove the children...
                // indexOfChildren.length > 0 &&
                //     indexOfChildren.forEach((index) => {
                //         // const i = tempLayout[index];
                //         // i['parent'] > 0 && tempLayout.splice(index, 1);
                //         tempLayout.splice(index, 1);
                //     });
                // // // remove the parent/item
                // if (indexOfItem > -1) {
                //     tempLayout.splice(indexOfItem, 1);
                // }
            }
            //return tempLayout;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    /**
     * Normalize a grid by repairing hide flags, clamping spans, filling
     * missing cells, and compacting fully-hidden rows/columns.
     * Idempotent — safe to call after every grid mutation.
     * @param {Object} grid The grid object (mutated in place)
     * @returns {boolean} True if the grid was compacted (rows/cols removed)
     */
    _normalizeGrid(grid) {
        const rows = grid.rows;
        const cols = grid.cols;

        // --- Phase 1: Fill, clean, and clamp (steps 1-3) ---
        // We need valid cells and spans before we can detect orphans.

        // 1. Fill missing cells
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const key = `${r}.${c}`;
                if (!grid[key]) {
                    grid[key] = { component: null, hide: false };
                }
            }
        }

        // 2. Remove out-of-bounds cell keys
        const cellKeyPattern = /^(\d+)\.(\d+)$/;
        for (const key of Object.keys(grid)) {
            const match = key.match(cellKeyPattern);
            if (match) {
                const r = Number(match[1]);
                const c = Number(match[2]);
                if (r < 1 || r > rows || c < 1 || c > cols) {
                    delete grid[key];
                }
            }
        }

        // 3. Clamp spans to grid bounds and remove trivial spans
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const cell = grid[`${r}.${c}`];
                if (cell && cell.span) {
                    cell.span.row = Math.min(cell.span.row || 1, rows - r + 1);
                    cell.span.col = Math.min(cell.span.col || 1, cols - c + 1);
                    if (cell.span.row <= 1 && cell.span.col <= 1) {
                        delete cell.span;
                    }
                }
            }
        }

        // --- Phase 2: Compact fully-hidden columns/rows ---
        // Detect BEFORE step 4 clears hide flags. A column is compactable
        // if every cell is hidden, has no component, and is not a span
        // origin. This catches both orphaned cells (no span covers them)
        // AND redundant span-covered cells (e.g. col 2-4 hidden by a
        // span from col 1). Shrink covering spans before shifting.

        let compacted = false;

        // 6. Compact fully-hidden columns (right-to-left)
        for (let c = grid.cols; c >= 1; c--) {
            if (grid.cols <= 1) break;

            let canCompact = true;
            for (let r = 1; r <= grid.rows; r++) {
                const cell = grid[`${r}.${c}`];
                // Column is compactable if EVERY cell is hidden and
                // is not the origin of a span. Hidden cells may have
                // stale component references from previous merges —
                // that's OK since the component is already invisible.
                if (!cell || !cell.hide || cell.span) {
                    canCompact = false;
                    break;
                }
            }
            if (!canCompact) continue;

            compacted = true;

            // Shrink any spans from earlier columns that reach into column c
            for (let r = 1; r <= grid.rows; r++) {
                for (let sc = 1; sc < c; sc++) {
                    const cell = grid[`${r}.${sc}`];
                    if (cell && cell.span && cell.span.col > 1) {
                        if (sc + cell.span.col - 1 >= c) {
                            cell.span.col--;
                            if (cell.span.row <= 1 && cell.span.col <= 1) {
                                delete cell.span;
                            }
                        }
                    }
                }
            }

            // Shift all columns after c left by one
            for (let r = 1; r <= grid.rows; r++) {
                for (let sc = c; sc < grid.cols; sc++) {
                    grid[`${r}.${sc}`] = grid[`${r}.${sc + 1}`];
                }
                delete grid[`${r}.${grid.cols}`];
            }
            grid.cols--;
        }

        // 7. Compact fully-hidden rows (bottom-to-top)
        for (let r = grid.rows; r >= 1; r--) {
            if (grid.rows <= 1) break;

            let canCompact = true;
            for (let c = 1; c <= grid.cols; c++) {
                const cell = grid[`${r}.${c}`];
                if (!cell || !cell.hide || cell.span) {
                    canCompact = false;
                    break;
                }
            }
            if (!canCompact) continue;

            compacted = true;

            // Shrink any spans from earlier rows that reach into row r
            for (let sr = 1; sr < r; sr++) {
                for (let c = 1; c <= grid.cols; c++) {
                    const cell = grid[`${sr}.${c}`];
                    if (cell && cell.span && cell.span.row > 1) {
                        if (sr + cell.span.row - 1 >= r) {
                            cell.span.row--;
                            if (cell.span.row <= 1 && cell.span.col <= 1) {
                                delete cell.span;
                            }
                        }
                    }
                }
            }

            // Shift all rows after r up by one
            for (let sr = r; sr < grid.rows; sr++) {
                for (let c = 1; c <= grid.cols; c++) {
                    grid[`${sr}.${c}`] = grid[`${sr + 1}.${c}`];
                }
            }
            for (let c = 1; c <= grid.cols; c++) {
                delete grid[`${grid.rows}.${c}`];
            }
            grid.rows--;
        }

        // --- Phase 3: Full normalization (steps 1-5) on the compacted grid ---
        this._normalizeGridSteps(grid);

        return compacted;
    }

    /**
     * Core normalization steps 1-5: fill cells, remove out-of-bounds,
     * clamp spans, clear hide flags, rebuild hide from spans.
     * @param {Object} grid The grid object (mutated in place)
     */
    _normalizeGridSteps(grid) {
        const rows = grid.rows;
        const cols = grid.cols;

        // 1. Fill missing cells
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const key = `${r}.${c}`;
                if (!grid[key]) {
                    grid[key] = { component: null, hide: false };
                }
            }
        }

        // 2. Remove out-of-bounds cell keys
        const cellKeyPattern = /^(\d+)\.(\d+)$/;
        for (const key of Object.keys(grid)) {
            const match = key.match(cellKeyPattern);
            if (match) {
                const r = Number(match[1]);
                const c = Number(match[2]);
                if (r < 1 || r > rows || c < 1 || c > cols) {
                    delete grid[key];
                }
            }
        }

        // 3. Clamp spans to grid bounds and remove trivial spans
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const cell = grid[`${r}.${c}`];
                if (cell && cell.span) {
                    cell.span.row = Math.min(cell.span.row || 1, rows - r + 1);
                    cell.span.col = Math.min(cell.span.col || 1, cols - c + 1);
                    if (cell.span.row <= 1 && cell.span.col <= 1) {
                        delete cell.span;
                    }
                }
            }
        }

        // 4. Clear ALL hide flags
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                grid[`${r}.${c}`].hide = false;
            }
        }

        // 5. Rebuild hide from spans (row-major order)
        //    Track which cells are already covered to resolve conflicts
        const covered = new Set();
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const key = `${r}.${c}`;
                const cell = grid[key];
                if (!cell.span) continue;

                // If this cell is already covered by an earlier span,
                // remove its span to resolve the conflict
                if (covered.has(key)) {
                    delete cell.span;
                    continue;
                }

                const spanRows = cell.span.row || 1;
                const spanCols = cell.span.col || 1;
                for (let sr = r; sr < r + spanRows; sr++) {
                    for (let sc = c; sc < c + spanCols; sc++) {
                        if (sr === r && sc === c) continue;
                        const coveredKey = `${sr}.${sc}`;
                        if (grid[coveredKey]) {
                            grid[coveredKey].hide = true;
                            // If covered cell had its own span, remove it
                            if (grid[coveredKey].span) {
                                delete grid[coveredKey].span;
                            }
                        }
                        covered.add(coveredKey);
                    }
                }
                covered.add(key);
            }
        }
    }

    /**
     * Normalize all grids in the layout. Called on initialization to repair
     * any corruption that was persisted to storage.
     */
    _normalizeAllGrids() {
        if (!this.layout || !Array.isArray(this.layout)) return;
        this.layout.forEach((item) => {
            if (item.grid && item.grid.rows && item.grid.cols) {
                const before = JSON.stringify(item.grid);
                this._normalizeGrid(item.grid);
                const after = JSON.stringify(item.grid);
                if (before !== after) {
                    console.warn(
                        `[DashboardModel] Grid repaired for layout item ${
                            item.id || "unknown"
                        } (${item.grid.rows}x${item.grid.cols})`
                    );
                }
            }
        });
    }

    /**
     * Split a grid cell into multiple cells
     * @param {Number} itemId The id of the grid container
     * @param {String} cellNumber The cell to split (e.g., "1.1")
     * @param {String} direction "horizontal" (left/right) or "vertical" (top/bottom)
     * @param {Number} count Number of cells to split into (2-4)
     * @returns {Object} Updated grid layout or null on error
     */
    splitGridCell(itemId, cellNumber, direction, count = 2) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "splitGridCell: Grid container not found or has no grid"
                );
                return null;
            }

            const grid = gridContainer.grid;
            const [row, col] = cellNumber.split(".").map(Number);
            const targetCell = grid[cellNumber];

            if (direction === "horizontal") {
                const targetSpanCol = targetCell?.span?.col || 1;
                const targetSpanRow = targetCell?.span?.row || 1;

                if (targetSpanCol % count === 0) {
                    // CASE A: Span is divisible — simple subdivision, no grid resize
                    const subSpan = targetSpanCol / count;
                    const component = targetCell?.component;

                    // Unhide cells covered by the old span
                    for (let sr = row; sr < row + targetSpanRow; sr++) {
                        for (let sc = col; sc < col + targetSpanCol; sc++) {
                            const k = `${sr}.${sc}`;
                            if (grid[k]) grid[k].hide = false;
                        }
                    }
                    delete targetCell.span;

                    // Create subdivided cells
                    for (let i = 0; i < count; i++) {
                        const key = `${row}.${col + i * subSpan}`;
                        grid[key] = {
                            component: i === 0 ? component : null,
                            hide: false,
                        };
                        if (subSpan > 1 || targetSpanRow > 1) {
                            grid[key].span = {};
                            if (subSpan > 1) grid[key].span.col = subSpan;
                            if (targetSpanRow > 1)
                                grid[key].span.row = targetSpanRow;
                        }
                    }
                } else {
                    // CASE B: Multiply grid resolution by count
                    const oldCols = grid.cols;

                    // 1. Collect all visible cells
                    const visibleCells = [];
                    for (let r = 1; r <= grid.rows; r++) {
                        for (let c = 1; c <= oldCols; c++) {
                            const key = `${r}.${c}`;
                            const cell = grid[key];
                            if (cell && !cell.hide) {
                                visibleCells.push({
                                    row: r,
                                    col: c,
                                    data: { ...cell },
                                    spanCol: cell.span?.col || 1,
                                    spanRow: cell.span?.row || 1,
                                });
                            }
                        }
                    }

                    // 2. Clear all cell keys
                    for (const key of Object.keys(grid)) {
                        if (/^\d+\.\d+$/.test(key)) delete grid[key];
                    }

                    // 3. Update grid dimensions
                    grid.cols = oldCols * count;

                    // 4. Reposition all cells with scaled positions and spans
                    for (const vc of visibleCells) {
                        const newCol = (vc.col - 1) * count + 1;
                        const key = `${vc.row}.${newCol}`;
                        grid[key] = {
                            ...vc.data,
                            hide: false,
                            span: {
                                row: vc.spanRow,
                                col: vc.spanCol * count,
                            },
                        };
                    }

                    // 5. Split the target cell into count sub-cells
                    const newTargetCol = (col - 1) * count + 1;
                    const newTargetSpan = (targetCell?.span?.col || 1) * count;
                    const subSpan = newTargetSpan / count;
                    const component = targetCell?.component;
                    const rowSpan = targetCell?.span?.row || 1;

                    for (let i = 0; i < count; i++) {
                        const key = `${row}.${newTargetCol + i * subSpan}`;
                        grid[key] = {
                            component: i === 0 ? component : null,
                            hide: false,
                        };
                        if (subSpan > 1 || rowSpan > 1) {
                            grid[key].span = {};
                            if (subSpan > 1) grid[key].span.col = subSpan;
                            if (rowSpan > 1) grid[key].span.row = rowSpan;
                        }
                    }
                }
            } else if (direction === "vertical") {
                const targetSpanRow = targetCell?.span?.row || 1;
                const targetSpanCol = targetCell?.span?.col || 1;

                if (targetSpanRow % count === 0) {
                    // CASE A: Span is divisible — simple subdivision, no grid resize
                    const subSpan = targetSpanRow / count;
                    const component = targetCell?.component;

                    // Unhide cells covered by the old span
                    for (let sr = row; sr < row + targetSpanRow; sr++) {
                        for (let sc = col; sc < col + targetSpanCol; sc++) {
                            const k = `${sr}.${sc}`;
                            if (grid[k]) grid[k].hide = false;
                        }
                    }
                    delete targetCell.span;

                    // Create subdivided cells
                    for (let i = 0; i < count; i++) {
                        const key = `${row + i * subSpan}.${col}`;
                        grid[key] = {
                            component: i === 0 ? component : null,
                            hide: false,
                        };
                        if (subSpan > 1 || targetSpanCol > 1) {
                            grid[key].span = {};
                            if (subSpan > 1) grid[key].span.row = subSpan;
                            if (targetSpanCol > 1)
                                grid[key].span.col = targetSpanCol;
                        }
                    }
                } else {
                    // CASE B: Multiply grid resolution by count
                    const oldRows = grid.rows;

                    // 1. Collect all visible cells
                    const visibleCells = [];
                    for (let r = 1; r <= oldRows; r++) {
                        for (let c = 1; c <= grid.cols; c++) {
                            const key = `${r}.${c}`;
                            const cell = grid[key];
                            if (cell && !cell.hide) {
                                visibleCells.push({
                                    row: r,
                                    col: c,
                                    data: { ...cell },
                                    spanRow: cell.span?.row || 1,
                                    spanCol: cell.span?.col || 1,
                                });
                            }
                        }
                    }

                    // 2. Clear all cell keys
                    for (const key of Object.keys(grid)) {
                        if (/^\d+\.\d+$/.test(key)) delete grid[key];
                    }

                    // 3. Update grid dimensions
                    grid.rows = oldRows * count;

                    // 4. Reposition all cells with scaled positions and spans
                    for (const vc of visibleCells) {
                        const newRow = (vc.row - 1) * count + 1;
                        const key = `${newRow}.${vc.col}`;
                        grid[key] = {
                            ...vc.data,
                            hide: false,
                            span: {
                                row: vc.spanRow * count,
                                col: vc.spanCol,
                            },
                        };
                    }

                    // 5. Split the target cell into count sub-cells
                    const newTargetRow = (row - 1) * count + 1;
                    const newTargetSpan = (targetCell?.span?.row || 1) * count;
                    const subSpan = newTargetSpan / count;
                    const component = targetCell?.component;
                    const colSpan = targetCell?.span?.col || 1;

                    for (let i = 0; i < count; i++) {
                        const key = `${newTargetRow + i * subSpan}.${col}`;
                        grid[key] = {
                            component: i === 0 ? component : null,
                            hide: false,
                        };
                        if (subSpan > 1 || colSpan > 1) {
                            grid[key].span = {};
                            if (subSpan > 1) grid[key].span.row = subSpan;
                            if (colSpan > 1) grid[key].span.col = colSpan;
                        }
                    }
                }
            }

            this._normalizeGrid(grid);
            this.updateLayoutItem(gridContainer);
            return grid;
        } catch (e) {
            console.error("splitGridCell error:", e);
            return null;
        }
    }

    /**
     * Merge multiple adjacent grid cells into one
     * @param {Number} itemId The id of the grid container
     * @param {Array} cellNumbers Array of cell numbers to merge (e.g., ["1.1", "1.2"])
     * @returns {Object} Updated grid layout or null on error
     */
    mergeGridCells(itemId, cellNumbers) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "mergeGridCells: Grid container not found or has no grid"
                );
                return null;
            }

            // Find bounding box accounting for existing spans
            let minRow = Infinity,
                maxRow = -Infinity;
            let minCol = Infinity,
                maxCol = -Infinity;
            cellNumbers.forEach((cn) => {
                const [r, c] = cn.split(".").map(Number);
                const cell = gridContainer.grid[cn];
                const spanRow = cell?.span?.row || 1;
                const spanCol = cell?.span?.col || 1;
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r + spanRow - 1);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c + spanCol - 1);
            });

            // Clear old merge state: if any cell in the selection already
            // has a span, unhide its previously-covered cells and remove span
            cellNumbers.forEach((cn) => {
                const cell = gridContainer.grid[cn];
                if (cell && cell.span) {
                    const [cr, cc] = cn.split(".").map(Number);
                    const sr = cell.span.row || 1;
                    const sc = cell.span.col || 1;
                    for (let r = cr; r < cr + sr; r++) {
                        for (let c = cc; c < cc + sc; c++) {
                            const coveredKey = `${r}.${c}`;
                            if (gridContainer.grid[coveredKey]) {
                                gridContainer.grid[coveredKey].hide = false;
                            }
                        }
                    }
                    delete cell.span;
                }
                if (cell) {
                    cell.hide = false;
                }
            });

            // Keep the first cell, hide the others
            const keepCell = cellNumbers[0];
            const componentsToMove = [];

            cellNumbers.forEach((cellNumber) => {
                if (cellNumber !== keepCell && gridContainer.grid[cellNumber]) {
                    if (gridContainer.grid[cellNumber].component) {
                        componentsToMove.push(
                            gridContainer.grid[cellNumber].component
                        );
                    }
                    gridContainer.grid[cellNumber].hide = true;
                }
            });

            // Add span information to the kept cell
            gridContainer.grid[keepCell].span = {
                row: maxRow - minRow + 1,
                col: maxCol - minCol + 1,
            };

            this._normalizeGrid(gridContainer.grid);
            this.updateLayoutItem(gridContainer);
            return {
                grid: gridContainer.grid,
                conflictingComponents: componentsToMove,
            };
        } catch (e) {
            console.error("mergeGridCells error:", e);
            return null;
        }
    }

    /**
     * Change the height multiplier for a row in a grid container
     * @param {Number} itemId The id of the grid container
     * @param {Number} rowNumber Row number (1-indexed)
     * @param {Number} multiplier Height multiplier (1, 2, or 3)
     * @returns {Object} Updated grid layout or null on error
     */
    /**
     * Move a widget from one grid cell to another within the same grid container
     * @param {Number} itemId The id of the grid container
     * @param {String} sourceCellNumber The cell to move FROM (e.g., "1.1")
     * @param {String} targetCellNumber The cell to move TO (e.g., "1.2")
     */
    moveWidgetToCell(itemId, sourceCellNumber, targetCellNumber) {
        const gridContainer = this.getComponentById(itemId);
        const grid = gridContainer.grid;
        const componentId = grid[sourceCellNumber].component;
        grid[targetCellNumber].component = componentId;
        grid[sourceCellNumber].component = null;
        this.updateLayoutItem(gridContainer);
    }

    changeRowHeight(itemId, rowNumber, multiplier) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "changeRowHeight: Grid container not found or has no grid"
                );
                return null;
            }

            const grid = gridContainer.grid;
            grid.rowHeights = grid.rowHeights || {};

            if (multiplier === 1) {
                delete grid.rowHeights[String(rowNumber)];
            } else {
                grid.rowHeights[String(rowNumber)] = multiplier;
            }

            // Clean up empty object
            if (Object.keys(grid.rowHeights).length === 0) {
                delete grid.rowHeights;
            }

            this.updateLayoutItem(gridContainer);
            return grid;
        } catch (e) {
            console.error("changeRowHeight error:", e);
            return null;
        }
    }

    /**
     * Add a new row to the grid
     * @param {Number} itemId The id of the grid container
     * @param {Number} afterRow Row number after which to insert (0 = beginning)
     * @returns {Object} Updated grid layout or null on error
     */
    addGridRow(itemId, afterRow = 0) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "addGridRow: Grid container not found or has no grid"
                );
                return null;
            }

            const newRowNumber = afterRow + 1;
            gridContainer.grid.rows += 1;

            // Shift existing rows down
            for (let r = gridContainer.grid.rows; r > newRowNumber; r--) {
                for (let c = 1; c <= gridContainer.grid.cols; c++) {
                    const oldCell = `${r - 1}.${c}`;
                    const newCell = `${r}.${c}`;
                    if (oldCell in gridContainer.grid) {
                        gridContainer.grid[newCell] =
                            gridContainer.grid[oldCell];
                        delete gridContainer.grid[oldCell];
                    }
                }
            }

            // Create new empty cells for the new row
            for (let c = 1; c <= gridContainer.grid.cols; c++) {
                const cellNumber = `${newRowNumber}.${c}`;
                gridContainer.grid[cellNumber] = {
                    component: null,
                    hide: false,
                };
            }

            // Shift rowHeights keys down (rows after insertion point move +1)
            if (gridContainer.grid.rowHeights) {
                const shifted = {};
                for (const [key, mult] of Object.entries(
                    gridContainer.grid.rowHeights
                )) {
                    const rowNum = Number(key);
                    shifted[
                        String(rowNum >= newRowNumber ? rowNum + 1 : rowNum)
                    ] = mult;
                }
                gridContainer.grid.rowHeights =
                    Object.keys(shifted).length > 0 ? shifted : undefined;
            }

            this._normalizeGrid(gridContainer.grid);
            this.updateLayoutItem(gridContainer);
            return gridContainer.grid;
        } catch (e) {
            console.error("addGridRow error:", e);
            return null;
        }
    }

    /**
     * Delete a row from the grid
     * @param {Number} itemId The id of the grid container
     * @param {Number} rowNumber Row number to delete (1-indexed)
     * @returns {Object} Updated grid layout or null on error
     */
    deleteGridRow(itemId, rowNumber) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "deleteGridRow: Grid container not found or has no grid"
                );
                return null;
            }

            if (gridContainer.grid.rows <= 1) {
                console.error("deleteGridRow: Cannot delete the only row");
                return null;
            }

            // Remove components in the deleted row
            for (let c = 1; c <= gridContainer.grid.cols; c++) {
                const cellNumber = `${rowNumber}.${c}`;
                if (
                    gridContainer.grid[cellNumber] &&
                    gridContainer.grid[cellNumber].component
                ) {
                    this.removeItemFromLayout(
                        gridContainer.grid[cellNumber].component
                    );
                }
                delete gridContainer.grid[cellNumber];
            }

            // Shift rows up
            for (let r = rowNumber + 1; r <= gridContainer.grid.rows; r++) {
                for (let c = 1; c <= gridContainer.grid.cols; c++) {
                    const oldCell = `${r}.${c}`;
                    const newCell = `${r - 1}.${c}`;
                    if (oldCell in gridContainer.grid) {
                        gridContainer.grid[newCell] =
                            gridContainer.grid[oldCell];
                        delete gridContainer.grid[oldCell];
                    }
                }
            }

            gridContainer.grid.rows -= 1;

            // Shift rowHeights keys up and remove the deleted row's entry
            if (gridContainer.grid.rowHeights) {
                const shifted = {};
                for (const [key, mult] of Object.entries(
                    gridContainer.grid.rowHeights
                )) {
                    const rowNum = Number(key);
                    if (rowNum === rowNumber) continue;
                    shifted[String(rowNum > rowNumber ? rowNum - 1 : rowNum)] =
                        mult;
                }
                gridContainer.grid.rowHeights =
                    Object.keys(shifted).length > 0 ? shifted : undefined;
            }

            this._normalizeGrid(gridContainer.grid);
            this.updateLayoutItem(gridContainer);
            return gridContainer.grid;
        } catch (e) {
            console.error("deleteGridRow error:", e);
            return null;
        }
    }

    /**
     * Add a new column to the grid
     * @param {Number} itemId The id of the grid container
     * @param {Number} afterCol Column number after which to insert (0 = beginning)
     * @returns {Object} Updated grid layout or null on error
     */
    addGridColumn(itemId, afterCol = 0) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "addGridColumn: Grid container not found or has no grid"
                );
                return null;
            }

            const newColNumber = afterCol + 1;
            gridContainer.grid.cols += 1;

            // Shift existing columns right
            for (let r = 1; r <= gridContainer.grid.rows; r++) {
                for (let c = gridContainer.grid.cols; c > newColNumber; c--) {
                    const oldCell = `${r}.${c - 1}`;
                    const newCell = `${r}.${c}`;
                    if (oldCell in gridContainer.grid) {
                        gridContainer.grid[newCell] =
                            gridContainer.grid[oldCell];
                        delete gridContainer.grid[oldCell];
                    }
                }
            }

            // Create new empty cells for the new column
            for (let r = 1; r <= gridContainer.grid.rows; r++) {
                const cellNumber = `${r}.${newColNumber}`;
                gridContainer.grid[cellNumber] = {
                    component: null,
                    hide: false,
                };
            }

            this._normalizeGrid(gridContainer.grid);
            this.updateLayoutItem(gridContainer);
            return gridContainer.grid;
        } catch (e) {
            console.error("addGridColumn error:", e);
            return null;
        }
    }

    /**
     * Delete a column from the grid
     * @param {Number} itemId The id of the grid container
     * @param {Number} colNumber Column number to delete (1-indexed)
     * @returns {Object} Updated grid layout or null on error
     */
    deleteGridColumn(itemId, colNumber) {
        try {
            const gridContainer = this.getComponentById(itemId);
            if (!gridContainer || !gridContainer.grid) {
                console.error(
                    "deleteGridColumn: Grid container not found or has no grid"
                );
                return null;
            }

            if (gridContainer.grid.cols <= 1) {
                console.error(
                    "deleteGridColumn: Cannot delete the only column"
                );
                return null;
            }

            // Remove components in the deleted column
            for (let r = 1; r <= gridContainer.grid.rows; r++) {
                const cellNumber = `${r}.${colNumber}`;
                if (
                    gridContainer.grid[cellNumber] &&
                    gridContainer.grid[cellNumber].component
                ) {
                    this.removeItemFromLayout(
                        gridContainer.grid[cellNumber].component
                    );
                }
                delete gridContainer.grid[cellNumber];
            }

            // Shift columns left
            for (let r = 1; r <= gridContainer.grid.rows; r++) {
                for (let c = colNumber + 1; c <= gridContainer.grid.cols; c++) {
                    const oldCell = `${r}.${c}`;
                    const newCell = `${r}.${c - 1}`;
                    if (oldCell in gridContainer.grid) {
                        gridContainer.grid[newCell] =
                            gridContainer.grid[oldCell];
                        delete gridContainer.grid[oldCell];
                    }
                }
            }

            gridContainer.grid.cols -= 1;
            this._normalizeGrid(gridContainer.grid);
            this.updateLayoutItem(gridContainer);
            return gridContainer.grid;
        } catch (e) {
            console.error("deleteGridColumn error:", e);
            return null;
        }
    }

    getContainerBorderColor(component) {
        let color = "border-gray-900";
        try {
            if (component) {
                const canHaveChildren = component
                    ? component["canHaveChildren"]
                    : false;
                if ("styles" in component) {
                    color =
                        "backgroundColor" in component["styles"]
                            ? component["styles"]["borderColor"]
                            : color;
                } else {
                    switch (component["type"]) {
                        case "workspace":
                            if (component["workspace"] === "layout") {
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

    getContainerColor(component) {
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
}
