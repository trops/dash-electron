import React from "react";
import ThemeMainColorMenuItem from "../../../../Components/Theme/Panel/MenuItem/ThemeMainColorMenuItem";
import { colorTypes } from "@trops/dash-react";

const MainColorsPane = ({
    theme,
    variant,
    mainColor,
    onChooseColor,
    useSelected = true,
}) => {
    function renderThemeMainColors() {
        const themePreview = theme[variant];

        console.log("render theme ", theme, variant);

        return colorTypes.map((colorType) => {
            const selected =
                useSelected === true && mainColor !== null
                    ? colorType === mainColor
                    : true;
            return (
                <ThemeMainColorMenuItem
                    key={`item-${colorType}`}
                    mainColorType={colorType}
                    onClick={onChooseColor}
                    theme={themePreview}
                    selected={selected}
                />
            );
        });
    }

    return (
        <div className="flex flex-col text-xs break-all h-full p-1 space-y-1 w-full overflow-clip bg-gray-400 rounded h-full">
            <div className="flex flex-col text-xs h-full space-y-1 w-full overflow-y-scroll">
                {theme && renderThemeMainColors()}
            </div>
        </div>
    );
};

export default MainColorsPane;
