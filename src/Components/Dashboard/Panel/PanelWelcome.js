import React, { useEffect, useContext } from "react";
import {
    ButtonIcon,
    Panel2,
    Panel3,
    Heading,
    SubHeading3,
    Tag,
    ThemeContext,
} from "@trops/dash-react";
import { LayoutContainer } from "../../../Components/Layout";
import { MainMenu } from "../../../Components/Menu";
import { WorkspaceModel } from "../../../Models";

export const PanelWelcome = ({
    menuItems = [],
    workspaces = [],
    selectedMainItem = null,
    onClickWorkspace = null,
    onClickNewWorkspace,
    onNewMenuItem = null,
    onOpenThemeManager = null,
    onOpenSettings = null,
    onOpenDashboardLoader = null,
}) => {
    const { theme, currentTheme, changeThemeVariant, themeVariant } =
        useContext(ThemeContext);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        forceUpdate();
    }, [theme, currentTheme, forceUpdate]);

    const handleAddNewMenuItem = () => {
        onNewMenuItem && onNewMenuItem();
    };

    const handleOpenThemeManager = () => {
        onOpenThemeManager && onOpenThemeManager();
    };

    const handleOpenSettings = () => {
        onOpenSettings && onOpenSettings();
    };

    const handleClickNewWorkspace = (data) => {
        try {
            if (data === undefined) {
                selectedMainItem = 1;
            } else {
                selectedMainItem = data.id;
            }

            // if we have no data, we have to create a layout
            // NEW: Grid-first approach - start with 1x1 LayoutGridContainer
            const newLayout = {
                id: 1,
                order: 1,
                component: "LayoutGridContainer",
                type: "grid",
                workspace: "layout",
                width: "w-full",
                height: "h-full",
                hasChildren: 1,
                scrollable: false,
                parent: 0,
                menuId: selectedMainItem, // default menu item id is 1
                grid: {
                    rows: 1,
                    cols: 1,
                    gap: "gap-2",
                    1.1: { component: null, hide: false },
                },
            };
            const newWorkspace = WorkspaceModel({ layout: [newLayout] });

            onClickNewWorkspace && onClickNewWorkspace(newWorkspace);
        } catch (e) {
            console.log(e);
        }
    };

    function handleClickLoadDashboard() {
        onOpenDashboardLoader();
    }

    // const handleClickWorkspace = (data) => {
    //     onClickWorkspace && onClickWorkspace(data);
    // };

    return (
        <div
            className={`flex flex-row w-full h-full overflow-clip items-center justify-center`}
        >
            <div
                className={`flex flex-col w-5/6 h-5/6 overflow-clip rounded-lg items-center justify-center`}
            >
                <Panel2
                    horizontal={true}
                    padding={false}
                    direction="row"
                    width="w-full"
                    height="h-2/3"
                >
                    <div
                        className={`flex flex-col space-y-1 p-2 h-full justify-between ${
                            currentTheme
                                ? currentTheme["bg-secondary-dark"]
                                : "bg-gray-800"
                        }`}
                    >
                        <div className="w-10 h-10 items-center justify-center">
                            <ButtonIcon
                                icon="plus"
                                onClick={() => handleClickNewWorkspace()}
                                hoverBackgroundColor={"hover:bg-green-700"}
                                backgroundColor={
                                    currentTheme
                                        ? currentTheme["bg-primary-dark"]
                                        : "bg-gray-700"
                                }
                            />
                            <ButtonIcon
                                icon="database"
                                onClick={() => handleClickLoadDashboard()}
                                hoverBackgroundColor={"hover:bg-green-700"}
                                backgroundColor={
                                    currentTheme
                                        ? currentTheme["bg-primary-dark"]
                                        : "bg-gray-700"
                                }
                            />
                        </div>
                        <div className="flex flex-col space-y-1">
                            <div className="w-10 h-10 items-center justify-center">
                                <ButtonIcon
                                    icon="folder-plus"
                                    onClick={handleAddNewMenuItem}
                                    hoverBackgroundColor={"hover:bg-green-700"}
                                />
                            </div>
                            <div className="w-10 h-10 items-center justify-center">
                                <ButtonIcon
                                    icon={
                                        themeVariant === "dark" ? "sun" : "moon"
                                    }
                                    onClick={() =>
                                        changeThemeVariant(
                                            themeVariant === "dark"
                                                ? "light"
                                                : "dark"
                                        )
                                    }
                                />
                            </div>
                            <div className="w-10 h-10 items-center justify-center">
                                <ButtonIcon
                                    icon="palette"
                                    onClick={handleOpenThemeManager}
                                    hoverBackgroundColor={"hover:bg-orange-700"}
                                />
                            </div>
                            <div className="w-10 h-10 items-center justify-center">
                                <ButtonIcon
                                    icon="computer"
                                    onClick={handleOpenSettings}
                                    hoverBackgroundColor={"hover:bg-orange-700"}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col w-full h-full overflow-clip p-4">
                        <div className="flex flex-row w-full h-full overflow-clip xl:justify-between xl:space-x-4">
                            <div
                                className={`flex-col h-full rounded font-medium w-full hidden xl:flex xl:w-1/3 p-6 justify-between`}
                            >
                                <div className="flex flex-col rounded py-4 space-y-4">
                                    <Heading title={"Dash."} padding={false} />
                                    <div className="flex-row hidden 2xl:flex w-full ">
                                        <SubHeading3
                                            title={"Dashboard Generator."}
                                            padding={false}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-row space-x-2 items-center">
                                    {theme !== null && theme !== undefined && (
                                        <Tag
                                            text={`Current theme: ${theme["name"]}`}
                                            onClick={handleOpenThemeManager}
                                        />
                                    )}
                                </div>
                            </div>
                            <Panel3
                                scrollable={false}
                                space={true}
                                horizontal={true}
                                width="w-full"
                            >
                                <Panel3.Body>
                                    <LayoutContainer
                                        direction="row"
                                        space={false}
                                        scrollable={true}
                                        width="w-full"
                                    >
                                        <MainMenu
                                            currentTheme={currentTheme}
                                            menuItems={menuItems}
                                            workspaces={workspaces}
                                            onClickNewWorkspace={
                                                handleClickNewWorkspace
                                            }
                                            selectedMainItem={selectedMainItem}
                                            onWorkspaceMenuChange={
                                                onClickWorkspace
                                            }
                                            onCreateNewFolder={
                                                handleAddNewMenuItem
                                            }
                                        />
                                    </LayoutContainer>
                                </Panel3.Body>
                            </Panel3>
                        </div>
                    </div>
                </Panel2>
            </div>
        </div>
    );
};
