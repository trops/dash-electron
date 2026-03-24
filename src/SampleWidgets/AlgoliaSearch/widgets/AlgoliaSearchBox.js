/**
 * AlgoliaSearchBox
 *
 * Search input widget that publishes queryChanged events on every keystroke.
 * Other Algolia widgets listen for this event via QuerySync to update their
 * own InstantSearch state.
 *
 * @package Algolia Search
 */
import { useState } from "react";
import { Panel } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

export const AlgoliaSearchBox = ({ placeholder = "Search...", ...props }) => {
    const [inputValue, setInputValue] = useState("");
    const { publishEvent } = useWidgetEvents();

    const handleChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        publishEvent("queryChanged", { query: value });
    };

    const handleClear = () => {
        setInputValue("");
        publishEvent("queryChanged", { query: "" });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            handleClear();
        }
    };

    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-8"
                        />
                        {inputValue && (
                            <button
                                onClick={handleClear}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
                                aria-label="Clear search"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                </div>
            </Panel>
        </Widget>
    );
};
