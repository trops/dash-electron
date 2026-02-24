import { useState, useEffect } from "react";
import {
    FontAwesomeIcon,
    Sidebar,
    SubHeading3,
    deepCopy,
} from "@trops/dash-react";
import { replaceItemInLayout } from "../../../../../utils/layout";
import deepEqual from "deep-equal";
import { SectionLayout } from "../../../../Settings/SectionLayout";

export const PanelEditItemHandlers = ({ workspace, onUpdate, item = null }) => {
    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [eventHandlerSelected, setEventHandlerSelected] = useState(null);

    useEffect(() => {
        if (deepEqual(item, itemSelected) === false) {
            setItemSelected(() => item);
        }

        if (deepEqual(workspace, workspaceSelected) === false) {
            setWorkspaceSelected(() => workspace);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace, item]);

    function handleSelectEvent(eventString) {
        try {
            if (eventString && eventHandlerSelected !== null) {
                let tempEvents = [];
                let currentListeners = deepCopy(
                    itemSelected["listeners"] || {}
                );

                if (eventHandlerSelected in currentListeners) {
                    tempEvents = currentListeners[eventHandlerSelected];
                }

                tempEvents.push(eventString);
                const uniqueEventsSelected = tempEvents.filter(
                    (value, index, array) => array.indexOf(value) === index
                );

                currentListeners[eventHandlerSelected] = uniqueEventsSelected;
                handleSaveChanges(currentListeners);
            }
        } catch (e) {
            // select event failed
        }
    }

    function handleRemoveEvent(eventString) {
        try {
            if (eventHandlerSelected) {
                let currentListeners = deepCopy(
                    itemSelected["listeners"] || {}
                );

                const eventsSelectedTemp =
                    eventHandlerSelected in currentListeners
                        ? currentListeners[eventHandlerSelected].filter(
                              (event) => event !== eventString
                          )
                        : [];

                if (eventsSelectedTemp.length > 0) {
                    if (eventHandlerSelected in currentListeners) {
                        currentListeners[eventHandlerSelected] =
                            eventsSelectedTemp;
                    }
                } else {
                    delete currentListeners[eventHandlerSelected];
                }

                handleSaveChanges(currentListeners);
            }
        } catch (e) {
            // remove event failed
        }
    }

    function handleSelectEventHandler(handler) {
        setEventHandlerSelected(() => handler);
    }

    function getLayoutItemById(id) {
        if (
            workspaceSelected !== null &&
            Array.isArray(workspaceSelected.layout)
        ) {
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

    function handleSaveChanges(currentListeners = {}) {
        try {
            if (
                workspaceSelected !== null &&
                eventHandlerSelected !== null &&
                "id" in itemSelected &&
                itemSelected["id"] !== null
            ) {
                const tempWorkspace = deepCopy(workspaceSelected);
                const layoutItem = getLayoutItemById(itemSelected["id"]);

                layoutItem["listeners"] = currentListeners;
                tempWorkspace["layout"] = replaceItemInLayout(
                    tempWorkspace.layout,
                    layoutItem["id"],
                    layoutItem
                );
                onUpdate(layoutItem, tempWorkspace);
            }
        } catch (e) {
            // save changes failed
        }
    }

    function isSelectedEvent(event) {
        try {
            if (event && eventHandlerSelected) {
                const itemListeners = itemSelected?.["listeners"] || {};
                if (eventHandlerSelected in itemListeners) {
                    return itemListeners[eventHandlerSelected].includes(event);
                }
                return false;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // Get the event handlers for the current item
    const eventHandlers = Array.isArray(itemSelected?.eventHandlers)
        ? itemSelected.eventHandlers.filter(
              (value, index, array) => array.indexOf(value) === index
          )
        : [];

    // Get the listeners for the current item
    const listeners = itemSelected ? itemSelected["listeners"] || {} : {};

    // Get available source widgets with events
    const layoutArray =
        workspaceSelected !== null && Array.isArray(workspaceSelected.layout)
            ? workspaceSelected.layout
            : [];
    const sourceWidgets = layoutArray
        .filter(
            (l) =>
                l["component"] !== "Container" &&
                l["component"] !== "LayoutContainer"
        )
        .filter((e) => Array.isArray(e.events) && e.events.length > 0)
        .filter((li) => li["component"] !== itemSelected?.["component"]);

    // Count connected events for a handler
    function getConnectedCount(handler) {
        return (listeners[handler] || []).length;
    }

    // Build the list content (left column)
    const listContent = (
        <Sidebar.Content>
            <div className="px-3 py-2 text-xs font-semibold opacity-40 uppercase tracking-wider">
                Event Handlers
            </div>
            {eventHandlers.map((handler) => {
                const count = getConnectedCount(handler);
                const isActive = eventHandlerSelected === handler;
                return (
                    <Sidebar.Item
                        key={handler}
                        icon={
                            <FontAwesomeIcon
                                icon="bolt"
                                className="h-3.5 w-3.5"
                            />
                        }
                        active={isActive}
                        onClick={() => handleSelectEventHandler(handler)}
                        badge={count > 0 ? String(count) : null}
                        className={isActive ? "bg-white/10 opacity-100" : ""}
                    >
                        {handler}
                    </Sidebar.Item>
                );
            })}
            {eventHandlers.length === 0 && (
                <span className="text-sm opacity-40 py-8 text-center">
                    No handlers available
                </span>
            )}
        </Sidebar.Content>
    );

    // Build the detail content (right column) — when a handler is selected
    const connectedCount = eventHandlerSelected
        ? getConnectedCount(eventHandlerSelected)
        : 0;

    const detailContent = eventHandlerSelected ? (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col space-y-1">
                    <SubHeading3 title={eventHandlerSelected} padding={false} />
                    <span className="text-sm opacity-70">
                        {connectedCount} event
                        {connectedCount !== 1 ? "s" : ""} connected
                    </span>
                </div>

                {sourceWidgets.map((layout) => (
                    <div key={layout["id"]} className="flex flex-col space-y-2">
                        <span className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                            {layout["component"]} [{layout["id"]}]
                        </span>
                        {layout.events
                            .filter(
                                (value, index, array) =>
                                    array.indexOf(value) === index
                            )
                            .map((event) => {
                                const eventString = `${layout["component"]}[${layout["id"]}].${event}`;
                                const selected = isSelectedEvent(eventString);

                                return (
                                    <div
                                        key={eventString}
                                        onClick={() =>
                                            selected
                                                ? handleRemoveEvent(eventString)
                                                : handleSelectEvent(eventString)
                                        }
                                        className={`flex flex-row items-center gap-3 px-3 py-2 rounded-md cursor-pointer ${
                                            selected
                                                ? "opacity-100"
                                                : "opacity-60 hover:opacity-80"
                                        }`}
                                    >
                                        <FontAwesomeIcon
                                            icon={
                                                selected
                                                    ? "square-check"
                                                    : "square"
                                            }
                                            className="h-4 w-4 flex-shrink-0"
                                        />
                                        <span className="text-sm">{event}</span>
                                    </div>
                                );
                            })}
                    </div>
                ))}

                {sourceWidgets.length === 0 && (
                    <span className="text-sm opacity-40">
                        No events available from other widgets
                    </span>
                )}
            </div>
        </div>
    ) : null;

    if (!itemSelected || !workspaceSelected) {
        return null;
    }

    return (
        <SectionLayout
            listContent={listContent}
            detailContent={detailContent}
            listWidth="w-72"
            emptyDetailMessage="Select a handler to view available events"
        />
    );
};
