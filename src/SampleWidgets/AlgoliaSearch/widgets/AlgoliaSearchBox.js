/**
 * AlgoliaSearchBox
 *
 * Search input widget that publishes queryChanged events on every keystroke.
 * Other Algolia widgets listen for this event via QuerySync to update their
 * own InstantSearch state.
 *
 * @package Algolia Search
 */
import { useState, useContext } from "react";
import { Panel, InputText, ThemeContext } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

export const AlgoliaSearchBox = ({ placeholder = "Search...", ...props }) => {
    const [inputValue, setInputValue] = useState("");
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);

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
                    <div className="relative flex-1 min-w-0">
                        <InputText
                            type="text"
                            value={inputValue}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            padding="pl-3 pr-8 py-2"
                            inputClassName="text-sm rounded-md"
                        />
                        {inputValue && (
                            <button
                                onClick={handleClear}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm opacity-70 hover:opacity-100 ${
                                    currentTheme?.["text-primary-medium"] || ""
                                }`}
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
