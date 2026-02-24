import React from "react";

const ThemeColorMenuItem = ({
    colorType,
    variant,
    objectType,
    onClick,
    theme,
    selected = false,
}) => {
    // make the background color for display regardless of the objectType
    const backgroundColor = theme[`bg-${colorType}-${variant}`];

    // this is the actual theme string structure
    // const themeColor = theme[`${objectType}-${colorType}-${variant}`];

    let style = "";
    switch (objectType) {
        case "bg":
            style = `${theme[`bg-${colorType}-${variant}`]} text-gray-900`;
            break;

        case "border":
            style = `${
                theme[`border-${colorType}-${variant}`]
            } border-2 text-gray-900`;
            break;

        case "text":
            style = `${theme[`text-${colorType}-${variant}`]}`;
            break;

        case "hover-text":
            style = `${
                theme[`hover-text-${colorType}-${variant}`]
            } text-gray-900`;
            break;

        case "hover-bg":
            style = `shadow ${
                theme[`hover-bg-${colorType}-${variant}`]
            } text-gray-900`;
            break;

        default:
            break;
    }

    return (
        <div
            onClick={() => onClick(colorType, variant, objectType)}
            className={`cursor-pointer flex flex-col text-base font-bold rounded ${style} ${
                selected === true
                    ? "opacity-100"
                    : "opacity-90 hover:opacity-100"
            } text-black p-2 h-fit flex-grow`}
        >
            <div className="text-sm w-full justify-start h-full">
                {objectType}-{colorType}-{variant}
            </div>
            <div
                className={`flex flex-row text-xs w-full justify-start font-normal`}
            >
                {theme[`${objectType}-${colorType}-${variant}`]} (
                {backgroundColor} {objectType}) [{style}]
            </div>
        </div>
    );
};

export default ThemeColorMenuItem;
