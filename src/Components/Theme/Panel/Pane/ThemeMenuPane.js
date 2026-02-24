import React, { useState, useContext } from "react";
import { colorTypes, themeVariants } from "@trops/dash-react";
import ColorTile from "../../../../Components/Theme/Panel/MenuItem/ColorTile";
import AvailableColorsGridPane from "./AvailableColorsGridPane";
import { capitalizeFirstLetter } from "../../../../utils";
import { ThemeContext } from "../../../../Context";
import { ColorModel } from "../../../../Models";
import { LayoutContainer } from "../../../../Components/Layout";
import { DashPanel } from "@trops/dash-react";

const ThemeMenuPane = ({
    currentColor = null,
    theme,
    onChooseColor,
    onChooseReplacementColor,
    onCancel = null,
}) => {
    const [selectedColor, setSelectedColor] = useState(null);

    const { themeVariant } = useContext(ThemeContext);

    function handleSelectColor(c, colorType) {
        setSelectedColor({
            color: c,
            colorType,
            type: c["objectType"],
            itemType: c["itemType"],
        });
        onChooseColor(c);
    }

    function handleCancelSelectColor(color) {
        setSelectedColor(null);
        onCancel && onCancel(color);
    }

    function handleReplaceColor({
        panelType = "main",
        colorType,
        colorName,
        shade = 500,
    }) {
        if (selectedColor !== null) {
            const colorReplacement = { colorName, colorType, shade, panelType };
            const r = ColorModel(colorReplacement);
            onChooseReplacementColor(selectedColor, r);
            setSelectedColor(null);
        }
    }

    function handleReplaceColorTemp({
        panelType = "main",
        colorType,
        colorName,
        shade = 500,
    }) {
        if (selectedColor !== null) {
            const colorReplacement = { colorName, colorType, shade, panelType };
            const r = ColorModel(colorReplacement);
            onChooseReplacementColor(selectedColor, r);
        }
    }

    return (
        <LayoutContainer direction="col" scrollable={true}>
            {(selectedColor === null ||
                selectedColor["color"]["panelType"] === "main") && (
                <DashPanel
                    scrollable={false}
                    // padding={true}
                    // height={selectedColor !== null ? "" : "h-fit"}
                    height="h-fit"
                >
                    <DashPanel.Header title={"Main"} />
                    <DashPanel.Body scrollable={false}>
                        {colorTypes
                            .filter((ct) =>
                                selectedColor !== null
                                    ? selectedColor["color"]["panelType"] ===
                                          "main" &&
                                      selectedColor["color"]["colorType"] === ct
                                    : true
                            )
                            .map((colorType) => {
                                console.log("color type ", colorType);
                                const bgColor = theme[themeVariant][colorType];
                                return (
                                    <div
                                        key={colorType}
                                        className="flex flex-row justify-between items-center py-2 border-b border-gray-700"
                                    >
                                        <div className="flex flex-col h-fit">
                                            <span className="text-sm font-bold text-gray-300">
                                                {capitalizeFirstLetter(
                                                    colorType
                                                )}
                                            </span>
                                            {/* {cModel && (
                                                <span className="text-xs font-light text-gray-500">
                                                    {cModel.hex[shade]}
                                                </span>
                                            )}
                                            {!cModel && (
                                                <span className="text-xs font-light text-gray-500">
                                                    NA
                                                </span>
                                            )} */}
                                        </div>
                                        <ColorTile
                                            width={"w-2/3"}
                                            colorName={bgColor}
                                            colorType={colorType}
                                            colorLevelName={null}
                                            selected={false}
                                            panelType="main"
                                            shade={500}
                                            onClick={(c) =>
                                                handleSelectColor(c, colorType)
                                            }
                                        />
                                    </div>
                                );
                            })}
                    </DashPanel.Body>
                </DashPanel>
            )}

            {(selectedColor === null ||
                selectedColor["color"]["panelType"] === "sub") && (
                // <div
                //     className={`flex flex-col rounded w-full space-y-2 min-h-1/4 overflow-y-scroll ${
                //         selectedColor !== null ? "h-1/4" : "h-full"
                //     }`}
                // >
                // <LayoutContainer scrollable={true} direction="col">
                <>
                    {colorTypes
                        .filter((ct) =>
                            selectedColor !== null
                                ? selectedColor["color"]["panelType"] ===
                                      "sub" &&
                                  selectedColor["color"]["colorType"] === ct
                                : true
                        )
                        .map((colorType) => {
                            return (
                                <div
                                    key={colorType}
                                    className="flex flex-col w-full rounded bg-gray-800"
                                >
                                    <div className="flex flex-row text-xs uppercase font-bold w-full text-gray-200 bg-gray-900 p-2 rounded-t border-b border-gray-700">
                                        {colorType}
                                    </div>
                                    <div className="flex flex-col p-2">
                                        {themeVariants
                                            .filter((v) =>
                                                selectedColor !== null
                                                    ? selectedColor["color"][
                                                          "level"
                                                      ] === v
                                                    : true
                                            )
                                            .map((colorLevelName) => {
                                                const stringToCheck = `bg-${colorType}-${colorLevelName}`;
                                                // const bgColor = theme[themeVariant][colorType];
                                                const themeColor =
                                                    theme[themeVariant][
                                                        stringToCheck
                                                    ];

                                                const parts =
                                                    themeColor.split("-");

                                                const colorName = parts[1];
                                                const shade =
                                                    parts[parts.length - 1];
                                                const selected =
                                                    selectedColor !== null
                                                        ? colorType ===
                                                              selectedColor[
                                                                  "color"
                                                              ]["colorType"] &&
                                                          colorLevelName ===
                                                              selectedColor[
                                                                  "color"
                                                              ]["level"] &&
                                                          selectedColor[
                                                              "color"
                                                          ]["panelType"] ===
                                                              "sub"
                                                        : false;
                                                return (
                                                    <div
                                                        key={colorLevelName}
                                                        className={`flex flex-row justify-between py-1 items-center ${
                                                            selectedColor ===
                                                            null
                                                                ? "border-b border-gray-700"
                                                                : ""
                                                        } px-2`}
                                                    >
                                                        <span className="text-sm font-bold text-gray-300">
                                                            {colorLevelName}
                                                        </span>
                                                        <ColorTile
                                                            colorFromTheme={
                                                                themeColor
                                                            }
                                                            colorName={
                                                                colorName
                                                            }
                                                            colorType={
                                                                colorType
                                                            }
                                                            colorLevelName={
                                                                colorLevelName
                                                            }
                                                            variant={
                                                                themeVariant
                                                            }
                                                            selected={selected}
                                                            panelType="sub"
                                                            shade={shade}
                                                            onClick={
                                                                handleSelectColor
                                                            }
                                                            // onHover={handleSelectColorTemp}
                                                            // height={'h-5'}
                                                            width={"w-1/2"}
                                                        />
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}
                </>
                // </LayoutContainer>
            )}
            {selectedColor !== null && (
                <AvailableColorsGridPane
                    currentColor={currentColor}
                    colorType={selectedColor["color"]["colorType"]}
                    onClick={handleReplaceColor}
                    onCancel={handleCancelSelectColor}
                    onMouseOver={handleReplaceColorTemp}
                    shade={
                        selectedColor["color"]["panelType"] === "main"
                            ? 500
                            : null
                    }
                />
            )}
        </LayoutContainer>
    );
};

export default ThemeMenuPane;
