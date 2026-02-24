/**
 * WidgetApi.test.js
 *
 */

import { WidgetApi } from "./WidgetApi";
import { DashboardPublisher } from "../Components/Dashboard/DashboardPublisher.js";

const electronApiMock = {
    data: {
        saveData: (data, filename, append) => {
            return { data, filename, append };
        },
        removeAllListeners: () => {
            console.log("remove all listeners");
            return;
        },
    },
};

describe("WidgetApi tests", () => {
    // Mock
    const uuid = "12345";
    const uuid2 = "6789";
    let api, api2;

    const eventName = "CustomSearchbar-10-searchQueryChanged";
    const listeners = {
        handleSearchChange: [eventName], //["CustomSearchbar[10].searchQueryChanged"],
    };

    const pub = DashboardPublisher;

    test("initialize the api", () => {
        api = WidgetApi;
        console.log("api", api);
        expect(api).not.toBe(null);
    });

    test("set the publisher", () => {
        api.setPublisher(pub);
        expect(api.pub()).not.toBe(null);
    });

    test("register listeners", () => {
        const handlerMap = {
            handleSearchChange: (data) => console.log(data),
        };
        api.registerListeners(listeners, handlerMap, uuid);
        expect(api.pub().listeners).not.toBe(null);
    });

    test("register listeners duplicate listener", () => {
        const handlerMap = {
            handleSearchChange: (data) => console.log(data),
        };
        api.registerListeners(listeners, handlerMap, uuid);
        // holds them as an array
        const eventType = listeners[Object.keys(listeners)[0]][0];
        const handlersForKey = api.pub().listeners().get(eventType);
        expect(handlersForKey.length).toEqual(1);
    });

    test("register listeners same event different widget", () => {
        const handlerMap = {
            handleSearchChange: (data) => console.log(data),
        };
        api.registerListeners(listeners, handlerMap, uuid2);
        // holds them as an array
        const eventType = listeners[Object.keys(listeners)[0]][0];
        const handlersForKey = api.pub().listeners().get(eventType);
        expect(handlersForKey.length).toEqual(2);
    });

    test("emit event from pub", () => {
        // holds them as an array
        // const eventType = "CustomSearchbar[10].searchQueryChanged";
        api.publishEvent(eventName, { test: "hello" }, uuid);
        expect(true).toBe(true);
    });

    test("store data to test.txt", () => {
        const dataToSave = "test";
        let result = null;

        api.setElectronApi(electronApiMock);
        api.storeData({
            data: dataToSave,
            filename: "test.txt",
            callbackComplete: (e, message) => {
                console.log("complete", e, message);
                result = message;
                expect(result).not.toBe(null);
            },
            callbackError: (e, message) => {
                console.log("error: ", e, message);
                result = null;
                expect(result).toBe(null);
            },
            append: true,
            uuid,
        });
    });
});
