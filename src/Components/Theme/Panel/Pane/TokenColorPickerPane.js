import React from "react";
import { colorTypes, themeVariants } from "@trops/dash-react";

const STYLE_PREFIX_MAP = {
    backgroundColor: "bg",
    textColor: "text",
    borderColor: "border",
    hoverBackgroundColor: "hover-bg",
    hoverTextColor: "hover-text",
    hoverBorderColor: "hover-border",
    focusRingColor: "ring",
    focusBorderColor: "border",
    activeBackgroundColor: "bg",
    activeTextColor: "text",
    placeholderTextColor: "placeholder-text",
};

const TokenColorPickerPane = ({
    theme,
    themeVariant,
    styleName,
    currentValue,
    onSelect,
    onPreview = null,
}) => {
    const prefix = STYLE_PREFIX_MAP[styleName] || "bg";

    function getResolvedColor(tokenName) {
        try {
            const themeData = theme[themeVariant];
            if (themeData && tokenName in themeData) {
                return themeData[tokenName];
            }
            // Fallback: for prefixed tokens (placeholder-text, hover-bg, etc.)
            // resolve via the base token for display purposes
            if (themeData) {
                const baseToken = tokenName.replace(
                    /^(hover-|placeholder-)/,
                    ""
                );
                if (baseToken !== tokenName && baseToken in themeData) {
                    return themeData[baseToken];
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function handleSelect(tokenValue) {
        onSelect(tokenValue);
    }

    function handlePreview(tokenValue) {
        if (onPreview) {
            onPreview(tokenValue);
        }
    }

    return (
        <div className="flex flex-col space-y-3 p-2">
            {/* None/Transparent option */}
            {(() => {
                const isNoneSelected =
                    currentValue === "bg-none" ||
                    currentValue === "text-none" ||
                    currentValue === "border-none" ||
                    currentValue === `${prefix}-none`;
                return (
                    <div
                        className={`flex flex-row items-center space-x-2 px-2 py-1.5 rounded cursor-pointer ${
                            isNoneSelected
                                ? "bg-blue-900 border border-blue-500"
                                : "hover:bg-gray-700 border border-gray-700"
                        }`}
                        onClick={() => handleSelect(`${prefix}-none`)}
                    >
                        <div className="w-6 h-6 rounded border border-gray-600 bg-gray-900 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">/</span>
                        </div>
                        <span className="text-xs text-gray-400">none</span>
                        {isNoneSelected && (
                            <span className="ml-auto text-blue-400 text-xs">
                                &#10003;
                            </span>
                        )}
                    </div>
                );
            })()}

            {/* Color type groups */}
            {colorTypes.map((colorType) => {
                return (
                    <div
                        key={`token-group-${colorType}`}
                        className="flex flex-col space-y-1"
                    >
                        <span className="text-xs uppercase font-bold text-gray-500 px-1">
                            {colorType}
                        </span>
                        <div className="flex flex-row flex-wrap gap-1">
                            {themeVariants.map((variant) => {
                                const tokenName = `${prefix}-${colorType}-${variant}`;
                                const resolvedClass =
                                    getResolvedColor(tokenName);
                                const bgClass = resolvedClass
                                    ? resolvedClass.replace(
                                          /^(placeholder:|hover-|hover:|active:|focus-visible:)?(bg|text|border|ring|hover-bg|hover-text|hover-border|placeholder-text)-/,
                                          "bg-"
                                      )
                                    : "bg-gray-700";
                                const isSelected = currentValue === tokenName;

                                return (
                                    <div
                                        key={`token-${tokenName}`}
                                        className="flex flex-col items-center space-y-0.5 cursor-pointer"
                                        onClick={() => handleSelect(tokenName)}
                                        onMouseEnter={() =>
                                            handlePreview(tokenName)
                                        }
                                        title={tokenName}
                                    >
                                        <div
                                            className={`relative w-10 h-8 rounded ${bgClass} ${
                                                isSelected
                                                    ? "ring-2 ring-blue-400"
                                                    : "ring-1 ring-gray-700 hover:ring-yellow-500"
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                        &#10003;
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            className={`text-xs leading-none ${
                                                isSelected
                                                    ? "text-blue-400 font-bold"
                                                    : "text-gray-500"
                                            }`}
                                        >
                                            {variant
                                                .replace("very-", "v-")
                                                .substring(0, 4)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TokenColorPickerPane;
