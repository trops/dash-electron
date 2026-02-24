/**
 * WidgetHelpers
 *
 * Class created to act as a proxy for the widgetApi
 * to pass in the widget params do the developer
 * doesnt have to.
 */
export class WidgetHelpers {
    params = null;

    // the widget api that will be called by the helper function
    // default to empty functions
    api = {
        publishEvent: () => {},
        registerListeners: () => {},
    };

    constructor(params, api) {
        this.params = params;
        this.api = api;
    }

    listen(listeners, handlers) {
        if (
            "registerListeners" in this.api &&
            typeof this.api["registerListeners"] === "function"
        ) {
            this.api.registerListeners(listeners, handlers, this.params.uuid);
        }
    }

    publishEvent(eventName, payload) {
        if (
            "publishEvent" in this.api &&
            typeof this.api["publishEvent"] === "function"
        ) {
            this.api.publishEvent(
                `${this.params.component}[${this.params.id}].${eventName}`,
                payload
            );
        }
    }

    /**
     * The array of events from the Widget configuration
     * @returns
     */
    events = () => {
        return this.params.events || [];
    };

    /**
     * The widget configuration
     * @returns the configuration object of the widget
     */
    config = () => {
        return this.params || {};
    };
}
