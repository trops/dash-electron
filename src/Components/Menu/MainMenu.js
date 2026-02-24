import React, { useContext, useEffect, useState } from "react";
import { withRouter } from "@trops/dash-react";

import { MainMenuItem, MainMenuSection } from "../../Components/Menu";

// Drag
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { AppContext } from "../../Context";
import { deepCopy } from "@trops/dash-react";
import { InputText } from "@trops/dash-react";
import { LayoutContainer } from "../../Components/Layout";

const MainMenuConst = ({
    onClickNewWorkspace = null,
    onCreateNewFolder,
    active,
    menuItems,
    workspaces,
    currentTheme,
    selectedMainItem = null,
    onWorkspaceMenuChange,
    onClick,
}) => {
    const { dashApi, credentials } = useContext(AppContext);
    //const { currentTheme } = useContext(ThemeContext);
    const [searchTerm, setSearchTerm] = useState("");

    console.log("MainMenu currentTheme:", currentTheme ? "exists" : "null");

    /**
     * useEffect
     * We can use the useEffect lifecycle to load the init for the plugins
     * and any other methods
     */
    useEffect(() => {
        setSearchTerm("");
    }, [active, selectedMainItem]);

    function handleClickMenuItem(ws) {
        onWorkspaceMenuChange && onWorkspaceMenuChange(ws);
    }

    function renderWorkspaces(workspaces) {
        console.log(
            "[MainMenu.renderWorkspaces] Called with workspaces:",
            workspaces?.length,
            "menuItems:",
            menuItems?.length
        );
        // We need to do this TWICE...
        // Once for the items that have a organized folder,
        // and once for the ones that do NOT....
        const m =
            workspaces &&
            menuItems
                .sort(function (a, b) {
                    return a["name"]
                        .toLowerCase()
                        .localeCompare(b["name"].toLowerCase());
                })
                .map((menuItem) => {
                    // let's check to see if the user has applied any filters...
                    // const folderSelected =
                    //     selectedMainItem !== null
                    //         ? menuItem.id === selectedMainItem.id
                    //         : false;
                    return (
                        <MainMenuSection
                            key={`menu-item-${menuItem.id}`}
                            id={menuItem.id}
                            name={menuItem.name}
                            menuItem={menuItem}
                            onCreateNew={handleCreateNew}
                        >
                            {workspaces
                                .sort(function (a, b) {
                                    return a["name"]
                                        .toLowerCase()
                                        .localeCompare(b["name"].toLowerCase());
                                })
                                .filter(
                                    (w) =>
                                        "menuId" in w &&
                                        w.menuId === menuItem.id
                                )
                                .filter((ws) =>
                                    searchTerm !== ""
                                        ? ws.name
                                              .toLowerCase()
                                              .includes(
                                                  searchTerm.toLowerCase()
                                              )
                                        : true
                                )
                                .map((ws) => (
                                    <MainMenuItem
                                        menuItem={menuItem}
                                        highlight={searchTerm !== ""}
                                        id={ws.id}
                                        workspaceId={ws.id}
                                        workspaceMenuId={ws.menuId}
                                        name={ws.name}
                                        key={`main-menu-item-ws-${ws.id}`}
                                        onClick={(e) => handleClickMenuItem(ws)}
                                        title={ws.name}
                                        onDropItem={(e) =>
                                            handleDropMenuItem({
                                                workspaceId: ws.id,
                                                menuItemId: e.dropIndex,
                                            })
                                        }
                                    />
                                ))}
                        </MainMenuSection>
                    );
                });

        console.log(
            "[MainMenu.renderWorkspaces] Returning:",
            m?.length,
            "menu sections"
        );
        return m;
    }

    function renderOrphanedWorkspaces(workspaces) {
        console.log(
            "[MainMenu.renderOrphanedWorkspaces] Called with workspaces:",
            workspaces?.length
        );
        // We need to do this TWICE...
        // Once for the items that have a organized folder,
        // and once for the ones that do NOT....

        const menuItem = {
            id: 1,
            name: "Uncategorized",
            icon: "folder",
        };

        const orphanedWorkspaces = workspaces
            .sort(function (a, b) {
                return a["name"]
                    .toLowerCase()
                    .localeCompare(b["name"].toLowerCase());
            })
            .filter((w) => {
                const isOrphan = workspaceIsOrphan(w);
                console.log(
                    `[MainMenu] Workspace "${w.name}" (menuId: ${w.menuId}) isOrphan:`,
                    isOrphan
                );
                return isOrphan === true;
            });

        console.log(
            "[MainMenu.renderOrphanedWorkspaces] Found",
            orphanedWorkspaces.length,
            "orphaned workspaces"
        );
        console.log(
            "[MainMenu.renderOrphanedWorkspaces] currentTheme:",
            currentTheme ? "exists" : "null"
        );

        return (
            workspaces && (
                <div key={`menu-item-orphan`}>
                    <MainMenuSection
                        key={`menu-item-${menuItem.id}`}
                        id={menuItem.id}
                        name={menuItem.name}
                        menuItem={menuItem}
                        onCreateNew={handleCreateNew}
                    >
                        {orphanedWorkspaces
                            .filter((ws) =>
                                searchTerm !== ""
                                    ? ws.name
                                          .toLowerCase()
                                          .includes(searchTerm.toLowerCase())
                                    : true
                            )
                            .sort((a, b) =>
                                a["name"]
                                    .toLowerCase()
                                    .localeCompare(b["name"].toLowerCase())
                            )
                            .map((ws) => {
                                console.log(
                                    `[MainMenu] Rendering orphaned workspace: ${ws.name}`
                                );
                                return (
                                    <MainMenuItem
                                        highlight={searchTerm !== ""}
                                        menuItem={menuItem}
                                        workspaceId={ws.id}
                                        workspaceMenuId={ws.menuId}
                                        id={ws.id}
                                        name={ws.name}
                                        key={`main-menu-item-ws-${ws.id}`}
                                        onClick={(e) => handleClickMenuItem(ws)}
                                        title={ws.name}
                                        onDropItem={(e) => {
                                            handleDropMenuItem({
                                                workspaceId: ws.id,
                                                menuItemId: e.dropIndex,
                                            });
                                        }}
                                    />
                                );
                            })}
                    </MainMenuSection>
                </div>
            )
        );
    }

    /**
     * workspaceIsOrphan
     * Check to see if the menuItem that is associated with the workspace no longer exists.
     * @param {Object} workspaceToCheck
     */
    function workspaceIsOrphan(workspaceToCheck) {
        return (
            menuItems.filter((menuItem) => {
                return menuItem.id === workspaceToCheck.menuId;
            }).length === 0
        );
    }

    function handleDropMenuItem(dropData) {
        try {
            console.log("handle drop menu item ", dropData);
            const { workspaceId, menuItemId } = dropData;

            let workspaceSelected = null;
            const workspaceArray = workspaces.filter(
                (ws) => ws.id === workspaceId
            );

            if (workspaceArray.length > 0) {
                workspaceSelected = workspaceArray[0];
            }

            if (workspaceSelected) {
                const newWorkspace = deepCopy(workspaceSelected);
                // we have to update the workspace menu id
                newWorkspace["menuId"] = menuItemId;

                if (dashApi && credentials) {
                    dashApi.saveWorkspace(
                        credentials.appId,
                        newWorkspace,
                        handleSaveWorkspaceMenuIdComplete,
                        handleSaveWorkspaceError
                    );
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    function handleSaveWorkspaceMenuIdComplete(e, message) {
        console.log("workspace save complete ", message);
    }

    function handleSaveWorkspaceError(e, message) {
        console.log(message);
    }

    function handleCreateNew(menuItem) {
        onClickNewWorkspace &&
            onClickNewWorkspace(
                menuItem
                // id: Date.now(),
                // name: "New Workspace",
                // label: "New",
                // type: selectedMainItem,
                // layout: newLayout,
                // menuId: menuItem["id"],
            );
    }

    function handleChangeSearch(e) {
        setSearchTerm(e.target.value);
    }

    return (
        <div className="flex flex-col min-w-64 w-full h-full">
            <div className="flex flex-col space-y-2 w-full h-full">
                <div className="flex flex-row justify-between items-center space-x-2 w-full">
                    <InputText
                        name="search-workspaces"
                        value={searchTerm}
                        placeholder="Search Dashboards"
                        onChange={handleChangeSearch}
                        textSize="text-lg"
                        className="border-transparent focus:border-transparent focus:ring-0"
                        hasBorder={false}
                    />
                    {/* <ButtonIcon
                        icon="folder-plus"
                        textSize={"text-xs"}
                        onClick={() => handleCreateNewFolder()}
                        hoverBackgroundColor={"hover:bg-green-500"}
                        backgroundColor={"bg-blue-700"}
                    /> */}
                </div>
                <DndProvider backend={HTML5Backend}>
                    <LayoutContainer
                        direction="col"
                        scrollable={true}
                        space={true}
                        width="w-full"
                        padding={"py-2"}
                    >
                        {renderWorkspaces(workspaces)}
                        {renderOrphanedWorkspaces(workspaces)}
                    </LayoutContainer>
                </DndProvider>
            </div>
        </div>
    );
};
const MainMenu = withRouter(MainMenuConst);

export { MainMenu };
