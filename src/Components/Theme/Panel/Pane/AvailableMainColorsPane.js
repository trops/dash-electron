import React from "react";
import ThemePane from "./ThemePane";
import { colorNames } from "@trops/dash-react";
import { Button } from "@trops/dash-react";

const AvailableMainColorsPane = ({
    theme,
    themeVariant,
    mainColor,
    onChooseColor,
}) => {
    function handleSelectMainColor(colorName) {
        onChooseColor(mainColor, colorName);
    }

    function renderAvailableColors() {
        const tempTheme = theme[themeVariant];
        return colorNames.sort().map((colorName) => {
            const stringColor = `bg-${colorName}-${"500"}`;
            const selected = colorName === tempTheme[mainColor];
            return (
                <div
                    className={`flex w-full h-full m-2 ${stringColor} ${
                        selected === true ? "opacity-100" : "opacity-100"
                    } rounded`}
                    onClick={() => handleSelectMainColor(colorName)}
                >
                    {/* {selected === true ? (<span className="font-bold text-5xl">1</span>) : null} */}
                </div>
            );
        });
    }

    return (
        <ThemePane>
            <div className="flex grid grid-cols-3 w-full overflow-y-scroll">
                {renderAvailableColors()}
            </div>
            <Button title="Cancel" />
        </ThemePane>
    );
};

export default AvailableMainColorsPane;
