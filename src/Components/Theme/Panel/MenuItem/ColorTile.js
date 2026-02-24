import React from "react";
import { ColorModel } from "../../../../Models";

const ColorTile = ({
    colorFromTheme = null,
    colorName = null,
    shade = null,
    variant = "dark",
    colorType = "primary",
    colorLevelName = null,

    selected = false,
    onClick = null,
    onMouseOver = null,
    width = "w-full",
    height = "h-10",
    ...rest
}) => {
    const c = ColorModel({
        colorFromTheme,
        colorName,
        colorType,
        shade,
        variant,
        level: colorLevelName,
        ...rest,
    });

    // console.log("Color Model Tile ", c);

    // const stringColor = colorFromTheme === null ? `bg-${colorName}${shade !== null ? `-${shade}` : ''}` : colorFromTheme;
    // const parts = colorFromTheme !== null ? colorFromTheme.split('-') : null;

    // const derivedShade = parts !== null ? parts[parts.length -1] : null;
    // const derivedColorName = parts !== null ? parts[parts.length - 2] : null;

    // const stringThemeColorName = '';
    // const objToSend = {
    //     colorName: colorName !== null ? colorName : colorFromTheme !== null && derivedColorName,
    //     shade: shade !== null ? shade : colorFromTheme !== null && derivedShade,
    //     stringColor,
    //     ...rest
    // };

    return (
        <div
            className={`flex flex-col rounded-lg cursor-pointer items-center justify-center border-2 text-xs ${
                selected === true ? "border-yellow-500" : "border-gray-800"
            } hover:border-yellow-500 border-gray-800 ${
                c.class
            } ${width} ${height}`}
            onClick={() =>
                onClick !== null ? onClick({ ...c, ...rest }) : null
            }
            onMouseOver={() =>
                onMouseOver !== null ? onMouseOver({ ...c, ...rest }) : null
            }
        >
            &nbsp;
            {/*{c.hex[shade]}*/}
        </div>
    );
};

export default ColorTile;
