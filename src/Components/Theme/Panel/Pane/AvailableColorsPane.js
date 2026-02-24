import React, { useState } from "react";
import ThemePane from "./ThemePane";
import AvailableColorMenuItem from "../../../../Components/Theme/Panel/MenuItem/AvailableColorMenuItem";
import { colorNames, shades } from "@trops/dash-react";
import { Button } from "@trops/dash-react";

const AvailableColorsPane = ({ onChooseColor }) => {
    const [searchColorTerm, setSearchColorTerm] = useState("");

    function renderAvailableColors() {
        return colorNames
            .sort()
            .filter((c) =>
                searchColorTerm !== "" ? c.includes(searchColorTerm) : true
            )
            .map((colorName) =>
                shades.map((shade) => (
                    <AvailableColorMenuItem
                        colorName={colorName}
                        variantName={shade}
                        onClick={onChooseColor}
                    />
                ))
            );
    }

    return (
        <ThemePane
            inputValue={searchColorTerm}
            onInputChange={(e) => setSearchColorTerm(e.target.value)}
            inputPlaceholder="Available Colors"
        >
            {renderAvailableColors()}
            <Button title="Cancel" />
        </ThemePane>
    );
};

export default AvailableColorsPane;
