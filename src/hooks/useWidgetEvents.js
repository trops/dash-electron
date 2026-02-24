import { useContext, useCallback } from "react";
import { DashboardContext } from "../Context/DashboardContext";
import { WidgetContext } from "../Context/WidgetContext";

/**
 * useWidgetEvents Hook
 *
 * Provides pub/sub event methods for inter-widget communication.
 * Replaces the prop-injected publishEvent/listen pattern from WidgetFactory.
 *
 * @returns {Object}
 *   - publishEvent(eventName, payload) — publish an event
 *   - listen(listeners, handlers) — register listener subscriptions
 *   - widgetEventNames — array of event names from widget config
 *   - listeners — current listener configuration from layout
 */
export const useWidgetEvents = () => {
    const dashboard = useContext(DashboardContext);
    const widgetContext = useContext(WidgetContext);

    if (!dashboard || !widgetContext) {
        throw new Error(
            "useWidgetEvents must be used within a Widget component. " +
                "Make sure your component is rendered inside <Widget> and within a DashboardWrapper."
        );
    }

    const { pub: publisher } = dashboard;
    const {
        componentName,
        id,
        uuid,
        events,
        listeners: listenerConfig,
    } = widgetContext.widgetData || {};

    const publishEvent = useCallback(
        (eventName, payload) => {
            console.log("in publisher", {
                eventName,
                payload,
                publisher,
                componentName,
                id,
            });
            if (publisher && componentName && id != null) {
                const formattedName = `${componentName}[${id}].${eventName}`;
                console.log("publishing event", { formattedName, payload });
                publisher.pub(formattedName, payload);
            }
        },
        [publisher, componentName, id]
    );

    const listen = useCallback(
        (listeners, handlers) => {
            if (publisher && uuid) {
                publisher.registerListeners(listeners, handlers, uuid);
            }
        },
        [publisher, uuid]
    );

    return {
        publishEvent,
        listen,
        widgetEventNames: events || [],
        listeners: listenerConfig || {},
    };
};
