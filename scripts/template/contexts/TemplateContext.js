import { createContext } from "react";
/**
 * Context value
 * You may pass what you would like as a value into the createcontext method
 * This value can also be set elsewhere if you choose.
 *
 * This is generally a good place to add in your apiClient, or library so that
 * all of your widgets have access to the client.
 *
 * Below is an example :-)
 *
 * @pacakge Template
 */

export const TemplateContext = createContext({
    sampleClient: {
        foo: () => {
            console.log("foo");
        },
    },
});
