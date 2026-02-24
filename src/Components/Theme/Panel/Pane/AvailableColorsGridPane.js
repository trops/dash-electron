import React from "react";
import { colorNames, shades } from "@trops/dash-react";

import ColorTile from "../../../../Components/Theme/Panel/MenuItem/ColorTile";
import { ColorModel } from "../../../../Models";
import { Button, DashPanel } from "@trops/dash-react";
import { capitalizeFirstLetter } from "../../../../utils";

const AvailableColorsGridPane = ({
    currentColor = null,
    colorType = "primary",
    onClick = null,
    onCancel = null,
    onMouseOver = null,
    shade = null,
}) => {
    function handleChooseColor(data) {
        onClick !== null && onClick(data);
    }

    function handleChooseColorTemp(data) {
        onMouseOver !== null && onMouseOver(data);
    }

    function handleCancel() {
        onCancel && onCancel(currentColor);
    }

    function renderAvailableColors() {
        return colorNames.sort().map((colorName) => {
            return shades
                .filter((c) => (shade === null ? true : c === shade))
                .map((shadeLevel) => {
                    const cModel = ColorModel({
                        colorName,
                        colorType,
                        shade: shadeLevel,
                        level: shadeLevel,
                    });

                    return (
                        <div className="flex flex-row justify-between items-center py-2 border-b border-gray-700">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-300">
                                    {capitalizeFirstLetter(colorName)}{" "}
                                    {shadeLevel}
                                </span>
                                {cModel && (
                                    <span className="text-xs font-light text-gray-500">
                                        {cModel.hex[shadeLevel]}
                                    </span>
                                )}
                                {!cModel && (
                                    <span className="text-xs font-light text-gray-500">
                                        NA
                                    </span>
                                )}
                            </div>
                            <ColorTile
                                width={"w-2/3"}
                                colorType={colorType}
                                colorName={colorName}
                                colorLevelName={shadeLevel}
                                shade={shadeLevel}
                                onClick={handleChooseColor}
                                onMouseOver={handleChooseColorTemp}
                            />
                        </div>
                    );
                });
        });
    }

    return (
        // <LayoutContainer
        //     direction="col"
        //     scrollable={false}
        //     className="space-y-1"
        //     height={"h-full"}
        // >
        <DashPanel height="h-full" scrollable={true}>
            <DashPanel.Header title="AvailableColors" />
            <DashPanel.Body scrollable={true} space={true}>
                <div className="flex flex-col space-y-1">
                    {renderAvailableColors()}
                </div>
            </DashPanel.Body>
            {onCancel && (
                <DashPanel.Footer>
                    <Button
                        title="Cancel"
                        block={true}
                        onClick={handleCancel}
                    />
                </DashPanel.Footer>
            )}
        </DashPanel>
        // </LayoutContainer>
    );
};

export default AvailableColorsGridPane;
