/**
 * AppContext
 *
 * {
 *      seearchClient,
 *      api
 * }
 */
import { createContext } from "react";

export const AppContext = createContext({
    settings: null,
    debugMode: false,
});
