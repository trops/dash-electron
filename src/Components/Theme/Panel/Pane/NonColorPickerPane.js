import React from "react";

const VALUE_OPTIONS = {
    textSize: [
        "text-xs",
        "text-sm",
        "text-base",
        "text-lg",
        "text-xl",
        "text-2xl",
        "text-3xl",
        "text-4xl",
        "text-5xl",
        "text-6xl",
    ],
    fontWeight: [
        "font-thin",
        "font-extralight",
        "font-light",
        "font-normal",
        "font-medium",
        "font-semibold",
        "font-bold",
        "font-extrabold",
        "font-black",
    ],
    borderRadius: [
        "rounded-none",
        "rounded-sm",
        "rounded",
        "rounded-md",
        "rounded-lg",
        "rounded-xl",
        "rounded-2xl",
        "rounded-3xl",
        "rounded-full",
    ],
    shadow: [
        "shadow-none",
        "shadow-sm",
        "shadow",
        "shadow-md",
        "shadow-lg",
        "shadow-xl",
        "shadow-2xl",
    ],
    spacing: [
        "p-0",
        "p-1",
        "p-2",
        "p-3",
        "p-4",
        "p-5",
        "p-6",
        "p-8",
        "px-2 py-1",
        "px-3 py-1.5",
        "px-4 py-2",
        "px-6 py-3",
        "px-8 py-4",
    ],
    iconSize: ["h-3 w-3", "h-4 w-4", "h-5 w-5", "h-6 w-6", "h-8 w-8"],
    transition: [
        "transition-none",
        "transition-all",
        "transition-colors",
        "transition-colors duration-150",
        "transition-colors duration-200",
        "transition-all duration-200",
        "transition-all duration-300",
        "transition-transform duration-300",
    ],
    letterSpacing: [
        "tracking-tighter",
        "tracking-tight",
        "tracking-normal",
        "tracking-wide",
        "tracking-wider",
        "tracking-widest",
    ],
    lineHeight: [
        "leading-none",
        "leading-tight",
        "leading-snug",
        "leading-normal",
        "leading-relaxed",
        "leading-loose",
    ],
    cursor: [
        "cursor-default",
        "cursor-pointer",
        "cursor-wait",
        "cursor-text",
        "cursor-not-allowed",
    ],
    disabledOpacity: [
        "disabled:opacity-25 disabled:pointer-events-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "disabled:opacity-75 disabled:pointer-events-none",
    ],
};

const NonColorPickerPane = ({ styleName, currentValue, onSelect }) => {
    const options = VALUE_OPTIONS[styleName] || [];

    if (options.length === 0) {
        return (
            <div className="flex flex-col p-3">
                <span className="text-xs text-gray-500">
                    No predefined values for "{styleName}"
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-0.5 p-2">
            {options.map((value) => {
                const isSelected = currentValue === value;
                return (
                    <div
                        key={`option-${value}`}
                        className={`flex flex-row items-center px-3 py-1.5 rounded cursor-pointer text-sm ${
                            isSelected
                                ? "bg-blue-900 text-blue-200"
                                : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                        }`}
                        onClick={() => onSelect(value)}
                    >
                        <span className="truncate">{value}</span>
                        {isSelected && (
                            <span className="ml-auto text-blue-400 text-xs">
                                &#10003;
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default NonColorPickerPane;
