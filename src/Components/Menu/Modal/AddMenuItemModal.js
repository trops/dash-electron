import React, { useState, useEffect, useContext } from "react";
import {
    Button,
    FontAwesomeIcon,
    Heading,
    SubHeading3,
    Panel,
    Modal,
    InputText,
} from "@trops/dash-react";
import { ThemeContext } from "../../../Context";
import { LayoutContainer } from "../../../Components/Layout";

export const AddMenuItemModal = ({ menuItems, open, setIsOpen, onSave }) => {
    const { currentTheme } = useContext(ThemeContext);
    const [menuItemsSelected, setMenuItemsSelected] = useState(menuItems);
    const [menuItemNameSelected, setMenuItemNameSelected] = useState("");
    const [menuIconSelected, setMenuIconSelected] = useState(null);
    // const [, updateState] = React.useState();
    // const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        if (
            open === true &&
            menuItemsSelected === null &&
            menuItemsSelected !== menuItems
        ) {
            setMenuItemsSelected(() => menuItems);
        }

        if (menuItems !== menuItemsSelected) {
            setMenuItemsSelected(() => menuItems);
        }

        if (open === false) {
            setMenuItemsSelected(() => null);
            setMenuIconSelected(null);
            setMenuItemNameSelected(null);
        }
    }, [open, menuItems, menuItemsSelected]);

    function handleMenuNameChange(e) {
        console.log("name change ", e.target.value);
        setMenuItemNameSelected(() => e.target.value);
    }

    function handleSaveChanges(itemData) {
        try {
            if (menuIconSelected && menuItemNameSelected) {
                const menuItem = {
                    id: Date.now(),
                    name: menuItemNameSelected,
                    icon: menuIconSelected,
                };
                onSave(menuItem);
            }
            // if (workspaceSelected !== null) {

            //     const tempWorkspace = deepCopy(workspaceSelected);

            //     // craft the event handler + listeners
            //     // and add to the layout item
            //     const layoutItem = getLayoutItemById(itemSelected['id']);

            //     // now lets add to it...
            //     layoutItem['listeners'] = eventsSelected;
            //     tempWorkspace['layout'] = replaceItemInLayout(tempWorkspace.layout, layoutItem['id'], layoutItem);

            //     // save the new workspace
            //     onSave(tempWorkspace);

            //     // reset the component
            //     setItemSelected(() => null);
            //     setWorkspaceSelected(() => null);
            //     setEventsSelected(() => {});
            //     setEventHandlerSelected(() => null);
            //     setIsOpen(false);
            // }
        } catch (e) {
            console.log(e);
        }
    }

    function renderAvailableIcons() {
        const icons = [
            "phone",
            "clone",
            "home",
            "plug",
            "magnifying-glass",
            "arrow-down",
            "arrow-left",
            "arrow-right",
            "arrow-up",
            "minus",
            "arrows-up-down",
            "arrows-left-right",
            "square",
            "eye",
            "pencil",
            "folder",
            "signal",
            "hammer",
            "seedling",
            "trophy",
            "robot",
            "leaf",
            "baby",
            "baby-carriage",
            "database",
        ];
        return icons.map((icon) => {
            const selected = icon === menuIconSelected;
            return (
                <div
                    key={`icon-${icon}`}
                    className={`flex flex-col text-5xl p-4 ${
                        selected === true
                            ? `${currentTheme["bg-secondary-very-dark"]} ${currentTheme["border-secondary-very-dark"]}`
                            : currentTheme["bg-secondary-medium"]
                    } h-fit w-full rounded border-4 ${
                        currentTheme["border-secondary-medium"]
                    } ${
                        selected === false &&
                        `${currentTheme["hover-bg-secondary-medium"]} ${currentTheme["hover-border-secondary-dark"]}`
                    } cursor-pointer text-gray-200`}
                    onClick={() => setMenuIconSelected(icon)}
                >
                    <FontAwesomeIcon icon={icon} />
                </div>
            );
        });
    }

    return (
        menuItemsSelected !== null &&
        currentTheme && (
            <Modal
                isOpen={open}
                setIsOpen={setIsOpen}
                width={"w-11/12 xl:w-5/6"}
                height="h-5/6"
            >
                <Panel direction="col" padding={false}>
                    <div
                        className={`flex flex-col w-full h-full overflow-clip`}
                    >
                        <div className="flex flex-col w-full h-full overflow-clip">
                            <div className="flex flex-row w-full h-full space-x-4 overflow-clip p-6">
                                <div className="flex flex-col flex-shrink h-full rounded font-medium text-gray-400 w-1/3">
                                    {/* render the widget item here. */}
                                    {menuItemsSelected !== null && (
                                        <div className="flex flex-col rounded p-6 py-10 space-y-4">
                                            <Heading
                                                title={"Get Organized"}
                                                padding={false}
                                            />
                                            <SubHeading3
                                                title={`Add new "folders" to organize all of your dashboards.`}
                                                padding={false}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col w-2/3 space-y-4 py-10">
                                    <div className="flex flex-col rounded w-full">
                                        <InputText
                                            value={menuItemNameSelected}
                                            onChange={handleMenuNameChange}
                                            placeholder="My Folder"
                                        />
                                    </div>
                                    <div className="flex flex-row rounded overflow-clip justify-center items-center align-center w-full">
                                        <LayoutContainer
                                            direction="row"
                                            scrollable={true}
                                            space={false}
                                            height={"h-full"}
                                            width={"w-full"}
                                            className="grid grid-cols-5 gap-4"
                                        >
                                            {renderAvailableIcons()}
                                        </LayoutContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-between bg-gray-900 p-4 rounded-br rounded-bl border-t border-gray-800">
                                <div className="flex flex-row text-lg text-gray-600 items-center font-bold px-4">
                                    Click the{" "}
                                    <FontAwesomeIcon
                                        icon="plus"
                                        className="px-2"
                                    />{" "}
                                    button to open this window.
                                </div>
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
                                        hoverBackgroundColor={
                                            "hover:bg-green-700"
                                        }
                                        textSize={"text-lg"}
                                        padding={"py-2 px-4"}
                                        onClick={handleSaveChanges}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </Modal>
        )
    );
};
