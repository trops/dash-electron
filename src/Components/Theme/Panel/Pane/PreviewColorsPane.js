import React, { useContext } from "react";
import ThemePane from "./ThemePane";
import ColorTile from "../../../../Components/Theme/Panel/MenuItem/ColorTile";
import { ThemeContext } from "../../../../Context";
import { isObject } from "../../../../utils";
import { ButtonIcon3 } from "@trops/dash-react";
import { ColorModel } from "../../../../Models";

const COLOR_PROPERTIES = new Set([
    "backgroundColor",
    "textColor",
    "borderColor",
    "hoverBackgroundColor",
    "hoverTextColor",
    "hoverBorderColor",
    "focusRingColor",
    "focusBorderColor",
    "activeBackgroundColor",
    "activeTextColor",
    "placeholderTextColor",
]);

const PreviewColorsPane = ({
    styles = null,
    theme,
    itemType = null,
    onClickItem = null,
    onResetStyles = null,
}) => {
    const { themeVariant } = useContext(ThemeContext);

    function handleClickItem(data, styleNameCss, itemType, objectType) {
        // override the object type
        data["objectType"] = objectType;
        onClickItem({ ...data, itemType, styleName: styleNameCss });
    }

    function handleClickNonColorItem(styleNameCss) {
        onClickItem({ itemType, styleName: styleNameCss });
    }

    function handleResetStyles() {
        onResetStyles(itemType);
    }

    function hasCustomStyles() {
        let hasStyles = false;
        // are there any styles (custom) in the theme for this item?
        const themeStyles = theme[themeVariant][itemType];
        // do we have any custom styles in the theme?
        if (themeStyles !== undefined) {
            Object.keys(styles).forEach((styleKey) => {
                if (styleKey in themeStyles) {
                    hasStyles = true;
                }
            });
        }
        return hasStyles;
    }

    function renderAvailableColors() {
        // are there any styles (custom) in the theme for this item?
        const themeStyles = theme[themeVariant][itemType];
        // styles already contains resolved CSS classes (via getStylesForItem),
        // including any theme overrides. Use styles directly for display values
        // and themeStyles only for the "isCustom" indicator.
        return Object.keys(styles)
            .filter((t) => t !== "string")
            .map((key) => {
                const value = styles[key];
                const isCustom =
                    themeStyles !== undefined && key in themeStyles;

                // Non-color properties: render simpler row
                if (!COLOR_PROPERTIES.has(key)) {
                    return (
                        <div
                            key={`preview-prop-${key}`}
                            className="flex flex-row justify-between py-2 items-center border-b border-gray-700 px-4 cursor-pointer hover:bg-gray-700"
                            onClick={() => handleClickNonColorItem(key)}
                        >
                            <div className="flex flex-col space-y-1">
                                <span className="text-sm font-bold text-gray-300">
                                    {key}
                                </span>
                                <span className="text-xs font-light text-gray-500">
                                    {value || "—"}
                                </span>
                            </div>
                            {isCustom && (
                                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                        </div>
                    );
                }

                // Color properties: render with ColorTile
                const parts =
                    key in styles
                        ? value !== undefined
                            ? value.split("-")
                            : null
                        : null;

                if (parts !== null && parts.length >= 3) {
                    const objectType = parts[0];
                    const colorName = parts[1];
                    const shade = parts[2];

                    const c = ColorModel({
                        colorFromTheme: `${parts[0]}-${parts[1]}-${parts[2]}`,
                        colorName,
                        shade,
                    });

                    return (
                        key !== "string" && (
                            <div
                                key={`preview-color-${key}`}
                                className="flex flex-row justify-between py-2 items-center border-b border-gray-700 px-4"
                            >
                                <div className="flex flex-col space-y-1">
                                    <div className="flex flex-row items-center space-x-2">
                                        <span className="text-sm font-bold text-gray-300">
                                            {key}
                                        </span>
                                        {isCustom && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        )}
                                    </div>
                                    {c && "hex" in c && (
                                        <span className="text-xs font-light text-gray-500">
                                            {isObject(c.hex)
                                                ? c.hex[shade]
                                                : c.hex}
                                        </span>
                                    )}
                                </div>
                                <ColorTile
                                    width={"w-1/2"}
                                    colorFromTheme={`${parts[0]}-${parts[1]}-${parts[2]}`}
                                    shade={shade}
                                    colorName={colorName}
                                    panelType="item"
                                    itemType={itemType}
                                    objectType={"bg"}
                                    variant={"dark"}
                                    onClick={(data) =>
                                        handleClickItem(
                                            data,
                                            key,
                                            itemType,
                                            objectType
                                        )
                                    }
                                />
                            </div>
                        )
                    );
                }

                // Fallback for color properties with unexpected format
                if (parts !== null) {
                    return (
                        <div
                            key={`preview-color-fallback-${key}`}
                            className="flex flex-row justify-between py-2 items-center border-b border-gray-700 px-4 cursor-pointer hover:bg-gray-700"
                            onClick={() => handleClickNonColorItem(key)}
                        >
                            <div className="flex flex-col space-y-1">
                                <span className="text-sm font-bold text-gray-300">
                                    {key}
                                </span>
                                <span className="text-xs font-light text-gray-500">
                                    {value || "—"}
                                </span>
                            </div>
                            {isCustom && (
                                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                        </div>
                    );
                }

                return null;
            });
    }

    return styles !== null && itemType !== null ? (
        <ThemePane>
            <div className="flex flex-col">{renderAvailableColors()}</div>
            {hasCustomStyles() === true && (
                <div className="flex flex-row justify-end p-2">
                    <ButtonIcon3
                        theme={false}
                        text={"Reset to Default"}
                        icon="trash"
                        backgroundColor={"bg-orange-700"}
                        textColor={"text-white"}
                        onClick={handleResetStyles}
                    />
                </div>
            )}
        </ThemePane>
    ) : null;
};

export default PreviewColorsPane;
