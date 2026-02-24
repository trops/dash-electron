import React, { useState, useEffect } from "react";
import { Button, FontAwesomeIcon, Panel, Modal } from "@trops/dash-react";
import { replaceItemInLayout } from "../../../../utils/layout";
import { deepCopy } from "@trops/dash-react";

/**
 * DEPRECATED
 * A modal window to set the event listeners for the widgets
 * We no longer use this modal window, but keeping in the project in case something changes
 */
export const LayoutBuilderEventModal = ({
    workspace,
    open,
    setIsOpen,
    onSave,
    item = null,
}) => {
    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [componentsSelected] = useState({});
    // const [eventSelected, setEventSelected] = useState(null);
    const [eventsSelected, setEventsSelected] = useState({});
    const [eventHandlerSelected, setEventHandlerSelected] = useState(null);
    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        console.log("event workspace ", workspaceSelected, workspace);

        if (
            open === true &&
            workspaceSelected === null &&
            workspaceSelected !== workspace
        ) {
            setWorkspaceSelected(() => workspace);
            loadExistingListeners(workspace);
        }

        if (item !== itemSelected) {
            setItemSelected(() => item);
            loadExistingListeners(workspace);
        }

        if (workspace !== workspaceSelected) {
            setWorkspaceSelected(() => workspace);
            loadExistingListeners(workspace);
        }

        if (open === false) {
            setItemSelected(() => null);
            // setComponentsSelected(() => []);
            setEventsSelected(() => {});
            setEventHandlerSelected(() => null);
        }

        if (Object.keys(componentsSelected).length < 1) {
            loadExistingListeners(workspace);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, workspace, item]);

    function loadExistingListeners(ws) {
        if (ws !== null) {
            const existingListeners = {};
            ws.layout.forEach((layoutItem) => {
                if ("listeners" in layoutItem) {
                    Object.keys(layoutItem["listeners"]).forEach((key) => {
                        const events = layoutItem["listeners"][key];
                        existingListeners[key] = events;
                    });
                }
            });

            setEventsSelected(() => existingListeners);

            // let's select one for the user
            if (Object.keys(existingListeners).length > 0) {
                setEventHandlerSelected(
                    () => Object.keys(existingListeners)[0]
                );
            }

            forceUpdate();
        }
    }

    // function loadExistingListenersForComponent(ws) {
    //     if (ws !== null) {
    //         const existingListeners = {};
    //         ws.layout.forEach(layoutItem => {
    //             existingListeners[layoutItem['id']] = layoutItem['listeners'];
    //         });
    //         console.log('EXISTING LISTENERS ', existingListeners);
    //         setComponentsSelected(() => existingListeners);
    //         forceUpdate();
    //     }
    // }

    // function handleSelectWorkspaceItem(workspaceItem) {
    //     setItemSelected(() => workspaceItem);
    //     forceUpdate();
    // }

    // function handleToggleSelectItem(selectedItem, event, eventString) {
    //     const selected = componentsSelected;
    //     if (selectedItem && event && itemSelected) {
    //         if (itemSelected['id'] in selected === false) {
    //             selected[`${itemSelected['id']}`] = [];
    //         }
    //         // add the event "string" to the listeners for the id of the item selected
    //         selected[`${itemSelected['id']}`].push(eventString);
    //         selected[`${itemSelected['id']}`].filter((value, index, array) => array.indexOf(value) === index);

    //         // let's set the current event selected so that we can tie this to the handler
    //         // when the user chooses that as well...
    //         const payload = { event, eventString };
    //         setEventSelected(() => payload);

    //         // now update the component selections
    //         setComponentsSelected(() => selected);
    //         handleUpdate();
    //     }
    // }

    function handleSelectEvent(eventString) {
        try {
            if (eventsSelected) {
                // check if we have the hander "key" in the events object
                let tempEvents = [];
                let tempEventsSelected = deepCopy(eventsSelected);

                console.log("temp events selected ", tempEventsSelected);
                if (eventHandlerSelected in tempEventsSelected) {
                    tempEvents = tempEventsSelected[eventHandlerSelected];
                }

                console.log("temp events selected ", tempEvents);

                tempEvents.push(eventString);
                const uniqueEventsSelected = tempEvents.filter(
                    (value, index, array) => array.indexOf(value) === index
                ); // remove any possible duplicates;
                tempEventsSelected[eventHandlerSelected] = uniqueEventsSelected;

                setEventsSelected(() => tempEventsSelected);

                console.log("DONE ", tempEventsSelected);
            }
        } catch (e) {
            console.log(e);
        }
    }

    function handleRemoveEvent(eventString) {
        const eventsSelectedTemp = eventsSelected[eventHandlerSelected].filter(
            (event) => event !== eventString
        );
        setEventsSelected(() => eventsSelectedTemp);
    }

    function handleSelectEventHandler(handler) {
        setEventHandlerSelected(() => handler);
    }

    function handleRemoveEventHandler(handler) {
        setEventHandlerSelected(() => null);
        setEventsSelected(() => {});
    }

    function getLayoutItemById(id) {
        if (workspaceSelected !== null) {
            const layoutItems = workspaceSelected.layout.filter(
                (layoutItem) => {
                    return layoutItem["id"] === parseInt(id, 10);
                }
            );
            if (layoutItems.length > 0) {
                return layoutItems[0];
            }
        }
        return null;
    }

    // function replaceLayoutItemInWorkspace(layoutItem, tempWorkspace) {
    //     if (tempWorkspace !== null && workspaceSelected !== null) {
    //         tempWorkspace.layout.forEach((li, index) => {
    //             if (li['id'] === layoutItem['id']) {
    //                 console.log('replacing item', layoutItem['listeners']);
    //                 //tempWorkspace.layout[index] = layoutItem;
    //                 li['listeners'] = layoutItem['listeners'];
    //             }
    //         });
    //         return tempWorkspace;
    //     }
    // }

    function handleSaveChanges(itemData) {
        try {
            if (workspaceSelected !== null) {
                const tempWorkspace = deepCopy(workspaceSelected);

                // craft the event handler + listeners
                // and add to the layout item
                const layoutItem = getLayoutItemById(itemSelected["id"]);

                // now lets add to it...
                layoutItem["listeners"] = eventsSelected;
                tempWorkspace["layout"] = replaceItemInLayout(
                    tempWorkspace.layout,
                    layoutItem["id"],
                    layoutItem
                );

                // save the new workspace
                onSave(tempWorkspace);

                // reset the component
                setItemSelected(() => null);
                setWorkspaceSelected(() => null);
                setEventsSelected(() => {});
                setEventHandlerSelected(() => null);
                setIsOpen(false);
            }
        } catch (e) {
            console.log(e);
        }
    }

    // function handleUpdate() {
    //     if (workspaceSelected !== null) {
    //         const tempWorkspace = deepCopy(workspaceSelected);
    //         Object.keys(componentsSelected).map(key => {
    //             // the item doing the listening...
    //             const layoutItem = getLayoutItemById(key); // source item
    //             if (layoutItem !== null) {
    //                 const listnersForItem = componentsSelected[layoutItem['id']];
    //                 layoutItem['listeners'] = listnersForItem;
    //                 replaceLayoutItemInWorkspace(layoutItem, tempWorkspace);
    //             }
    //         });
    //         // set the new workspace
    //         setWorkspaceSelected(() => tempWorkspace);
    //         forceUpdate();
    //     }
    // }

    // function getTitle() {
    //     try {
    //         if (itemSelected.parentWorkspace) {
    //             if ('component' in itemSelected.parentWorkspace) {
    //                 return <span className="flex flex-row">{itemSelected['component']}</span>// in the&nbsp; <span className="flex flex-row underline">{itemSelected['parentWorkspaceName']}</span> &nbsp;workspace</span>;
    //             } else {
    //                 return itemSelected['component'];
    //             }
    //         }
    //         return null;
    //     } catch(e) {
    //         return null;
    //     }
    // }

    /**
     * isSelected
     * Check to see if the event for the component is selected
     *
     * @param {String} eventString the string containing {component}[{id}].{event}
     * @returns
     */
    // function isSelected(eventString) {
    //     let selected = false;
    //     if (itemSelected !== null) {
    //         // first lets check to see if it is in our components array as "Selected" but pending save.
    //         if (itemSelected['id'] in componentsSelected) {
    //             componentsSelected[itemSelected['id']].forEach(event => {
    //                 if (event === eventString) selected = true;
    //             });
    //         }
    //     }
    //     return selected;
    // }

    function isSelectedEvent(event) {
        try {
            if (eventsSelected !== null && eventHandlerSelected) {
                console.log(
                    "checking is event selected ",
                    eventsSelected,
                    eventsSelected[eventHandlerSelected],
                    event
                );
                return eventsSelected[eventHandlerSelected].includes(event);
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function renderAvailableEvents() {
        if (workspaceSelected !== null) {
            return workspaceSelected.layout
                .filter(
                    (l) =>
                        l["component"] !== "Container" &&
                        l["component"] !== "LayoutContainer"
                )
                .filter((e) => e.events.length > 0)
                .filter((li) => li["component"] !== itemSelected["component"])
                .map((layout) => {
                    return (
                        <div
                            className={`flex flex-col text-base font-bold text-gray-400 p-2`}
                        >
                            <div className="flex flex-row border-b border-indigo-800 p-2 space-x-2 justify-between mb-4">
                                <span className="text-lg">
                                    {layout["component"]}&nbsp;[{layout["id"]}]
                                </span>
                            </div>
                            <div className="flex flex-col space-y-1 py-1">
                                {layout.events
                                    .filter(
                                        (value, index, array) =>
                                            array.indexOf(value) === index
                                    ) // remove any possible duplicates
                                    .map((event) => {
                                        const eventString = `${layout["component"]}[${layout["id"]}].${event}`;
                                        const selected =
                                            isSelectedEvent(eventString);
                                        return (
                                            <div
                                                onClick={() =>
                                                    selected === true
                                                        ? handleRemoveEvent(
                                                              eventString
                                                          )
                                                        : handleSelectEvent(
                                                              eventString
                                                          )
                                                }
                                                className={`flex flex-row ${
                                                    selected === false &&
                                                    "hover:bg-gray-800"
                                                } rounded cursor-pointer p-2 font-bold items-center space-x-2 ${
                                                    selected === true
                                                        ? "bg-blue-800"
                                                        : ""
                                                } `}
                                            >
                                                <FontAwesomeIcon
                                                    icon={"square-check"}
                                                    className={`${
                                                        selected === true
                                                            ? "text-blue-500"
                                                            : "text-gray-700"
                                                    } text-xl`}
                                                />
                                                <div className="flex flex-col">
                                                    <span
                                                        className={`text-base hover:text-gray-300 ${
                                                            selected === true
                                                                ? "text-gray-300"
                                                                : "text-gray-400"
                                                        }`}
                                                    >
                                                        {event}
                                                    </span>
                                                    {/* <span className="text-indigo-600 text-xs font-normal">{eventString}</span> */}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    );
                });
        }
    }

    function renderAvailableHandlers() {
        if (workspaceSelected !== null) {
            return workspaceSelected.layout
                .filter((li) => li["id"] === itemSelected["id"])
                .map((layout) => {
                    return (
                        <div
                            className={`flex flex-col text-base font-bold text-gray-400 p-2`}
                        >
                            <div className="flex flex-row border-b border-indigo-800 p-2 space-x-2 justify-between mb-4">
                                <span className="text-lg">
                                    {layout["component"]}&nbsp;[{layout["id"]}]
                                </span>
                            </div>
                            <div className="flex flex-col space-y-1 py-1">
                                {layout.eventHandlers
                                    .filter(
                                        (value, index, array) =>
                                            array.indexOf(value) === index
                                    ) // remove any possible duplicates
                                    .map((handler) => {
                                        const selected =
                                            eventHandlerSelected !== null
                                                ? eventHandlerSelected ===
                                                  handler
                                                : false; //isHandlerSelected(handler);
                                        return (
                                            <div
                                                onClick={() =>
                                                    selected
                                                        ? handleRemoveEventHandler(
                                                              handler
                                                          )
                                                        : handleSelectEventHandler(
                                                              handler
                                                          )
                                                }
                                                className={`flex flex-row ${
                                                    selected === false &&
                                                    "hover:bg-gray-800"
                                                } rounded cursor-pointer p-2 font-bold items-center space-x-2 ${
                                                    selected === true &&
                                                    "bg-indigo-700"
                                                }`}
                                            >
                                                <div className="flex flex-col px-2">
                                                    <span
                                                        className={`text-base hover:text-gray-300 ${
                                                            selected === true
                                                                ? "text-gray-300"
                                                                : "text-gray-400"
                                                        }`}
                                                    >
                                                        {handler}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    );
                });
        }
    }

    return (
        itemSelected !== null && (
            <Modal
                isOpen={open}
                setIsOpen={setIsOpen}
                width={"w-5/6 2xl:w-3/4"}
                height="h-5/6"
            >
                <Panel>
                    <div
                        className={`flex flex-col w-full h-full  overflow-clip bg-blue-800`}
                    >
                        <div className="flex flex-col w-full h-full overflow-clip">
                            <div className="flex flex-row w-full h-full space-x-4 overflow-clip p-6">
                                <div className="flex flex-col flex-shrink h-full rounded font-medium text-gray-400 w-1/3">
                                    {/* render the widget item here. */}
                                    {itemSelected !== null && (
                                        <div className="flex flex-col border border-blue-800 rounded p-4 py-10 space-y-4">
                                            <p className="text-5xl font-bold text-gray-200">
                                                Listen Up.
                                            </p>
                                            <p className="text-xl font-normal text-gray-300">
                                                Widgets and Workspaces can talk,
                                                but we have to setup the phone
                                                wires.
                                            </p>
                                            <p className="text-xl font-normal text-gray-300">
                                                Select the method to handle the
                                                message first, then select the
                                                message it will handle.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {/* <div className="flex flex-col h-full overflow-y-scroll bg-gray-900 h-full rounded w-1/3 min-w-1/3">
                                <span className="uppercase text-xs text-gray-400 font-bold p-2 bg-gray-800 px-4">Layout Items</span>
                                <div className="flex flex-col h-full overflow-y-scroll p-4 space-y-1">
                                    {renderWorkspaceLayoutItems()}
                                </div>
                            </div> */}
                                <div className="flex flex-col bg-gray-900 h-full rounded w-1/3">
                                    <span className="uppercase text-xs text-gray-400 font-bold p-2 bg-gray-800 rounded-t px-4">
                                        Available Handlers{" "}
                                    </span>
                                    {/* {eventSelected !== null && (<div className="text-gray-300 text-lg p-4">Choose the method below that will listen and process the message from the {eventSelected['event']} event.</div>)} */}
                                    <div className="flex flex-col h-full overflow-y-scroll p-4">
                                        {renderAvailableHandlers()}
                                    </div>
                                </div>
                                <div className="flex flex-col bg-gray-900 h-full rounded w-1/3">
                                    <span className="uppercase text-xs text-gray-400 font-bold p-2 bg-gray-800 rounded-t px-4">
                                        Available Events{" "}
                                    </span>
                                    <div className="flex flex-col h-full overflow-y-scroll p-4">
                                        {eventHandlerSelected &&
                                            renderAvailableEvents()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-end bg-gray-900 p-4 rounded-br rounded-bl border-t border-gray-800">
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
