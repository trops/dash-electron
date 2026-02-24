import React, { useState } from "react";
import ThemePane from "./ThemePane";
import ThemeColorMenuItem from "../../../../Components/Theme/Panel/MenuItem/ThemeColorMenuItem";

import { colorTypes, themeVariants, objectTypes } from "@trops/dash-react";

const ThemeColorsPane = ({ theme, themeEdit, variant, onChooseColor }) => {
    const [searchColorTerm, setSearchColorTerm] = useState("");

    function handleSelectThemeColor(colorType, variant, objectType) {
        onChooseColor(colorType, variant, objectType);
    }

    function renderThemePreview() {
        const themePreview = theme[variant];

        return (
            themePreview &&
            objectTypes.map((objectType) => {
                return (
                    colorTypes
                        // .filter(t => t === mainColor)
                        .map((colorType) =>
                            themeVariants
                                .filter((c) => {
                                    const stringToCheck = `${objectType}-${colorType}-${c}`;
                                    const colorToCheck =
                                        themePreview[
                                            `${objectType}-${colorType}-${c}`
                                        ];
                                    return searchColorTerm !== "" &&
                                        stringToCheck
                                        ? stringToCheck.indexOf(
                                              searchColorTerm.toLowerCase()
                                          ) > -1 ||
                                              colorToCheck.indexOf(
                                                  searchColorTerm.toLowerCase()
                                              ) > -1
                                        : true;
                                })
                                .map((variant) => {
                                    const stringToCheck = `${objectType}-${colorType}-${variant}`;
                                    const themeToEditSelected =
                                        themeEdit !== null
                                            ? `${themeEdit["objectType"]}-${themeEdit["colorType"]}-${themeEdit["variant"]}`
                                            : null;
                                    const selected =
                                        themeToEditSelected !== null
                                            ? stringToCheck ===
                                              themeToEditSelected
                                            : true;
                                    return (
                                        <ThemeColorMenuItem
                                            colorType={colorType}
                                            objectType={objectType}
                                            variant={variant}
                                            onClick={handleSelectThemeColor}
                                            theme={themePreview}
                                            selected={selected}
                                        />
                                    );
                                })
                        )
                );
            })
        );
    }

    return (
        <ThemePane
            inputValue={searchColorTerm}
            onInputChange={(e) => setSearchColorTerm(e.target.value)}
            inputPlaceholder="Theme Colors"
        >
            {renderThemePreview()}
        </ThemePane>
    );
};

export default ThemeColorsPane;
