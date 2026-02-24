/**
 * DashboardPublisher
 * - Pub/Sub for the Dashboard
 */
import { isObject } from "@trops/dash-react";

const event = {
    list: new Map(),

    //  Map(1) { '<widget-UUID>' => { 'CustomSearchbar[10].searchQueryChanged': [] } }

    /**
     * on
     *
     * Register a unique event to a unique widget
     * Widgets can ONLY listen to an event ONCE, you cannot have
     * multiple handlers in the same widget.
     *
     * @param {string} eventType the unique event type for a widget
     * @param {*} eventAction the handler for the event type
     * @param {*} uuid the UUID of the widget listening
     * @returns
     */
    on(eventType, eventAction, uuid = null) {
        this.list.has(eventType) || this.list.set(eventType, []);
        // this.list.has(uuid) || this.list.set(uuid, {});
        if (this.list.get(eventType)) {
            // this is key:value pair mapping
            // each key is a widget UUID
            let currentActionsForEvent = this.list.get(eventType);

            // lets check to see if the UUID is available for the event type...
            let hasEvent = false;
            currentActionsForEvent.forEach((e, index) => {
                if (e.uuid === uuid) {
                    hasEvent = index;
                }
            });

            // if we have a match at the index, lets remove it
            // and replace with the new one
            if (hasEvent !== false) currentActionsForEvent.splice(hasEvent, 1);

            // if (hasEvent === false) {
            const eventObject = {
                uuid: uuid,
                action: eventAction,
            };
            currentActionsForEvent.push(eventObject);
            this.list.set(eventType, currentActionsForEvent);
            // }
        }
        return this;
    },

    // publish events...
    emit(eventType, ...args) {
        const subscriptionsToEvent = this.list.get(eventType);
        if (subscriptionsToEvent && subscriptionsToEvent.length > 0) {
            subscriptionsToEvent.forEach((subscriber) => {
                console.log(
                    "calling handler ",
                    subscriber["uuid"],
                    args,
                    subscriber
                );
                const objectToSend = {
                    message: args[0],
                    event: eventType,
                    uuid: subscriber["uuid"],
                };
                console.log("SEND ", objectToSend);
                if ("action" in subscriber && subscriber.action !== undefined) {
                    subscriber["action"]({ ...objectToSend });
                }
            });
        }
    },

    clear() {
        this.list = new Map();
    },
};

export const DashboardPublisher = {
    sub: (eventType, action, uuid) => {
        event.on(eventType, action, uuid);
    },
    pub: (eventType, content) => {
        event.emit(eventType, content);
        // send to ALL
        // event.emit("DashboardPublisher.monitor", { eventType, content });
    },

    listeners: () => event.list,

    registerListeners: (listeners, handlerMap, uuid) => {
        if (listeners !== undefined) {
            if (isObject(listeners) === true) {
                Object.keys(listeners).forEach((handlerKey) => {
                    if (handlerKey in listeners) {
                        listeners[handlerKey].forEach((event) => {
                            // subscribe our listeners
                            DashboardPublisher.sub(
                                event,
                                handlerMap[handlerKey],
                                uuid
                            );
                        });
                    }
                });
            }
        }
    },

    removeAllListeners: () => {
        // we want to begin fresh when we switch workspaces...
        // event = new Map();
        //event.clear();
    },

    clearAllMessage: () => {
        event.emit("clearAllMessage");
    },
};
