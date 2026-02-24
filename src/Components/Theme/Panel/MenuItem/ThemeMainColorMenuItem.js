import React from "react";

const ThemeMainColorMenuItem = ({
    mainColorType,
    onClick,
    theme,
    selected = false,
}) => {
    // make the background color for display regardless of the objectType
    // console.log('main color ', mainColorType, theme[mainColorType]);

    const backgroundColor =
        theme && mainColorType in theme
            ? `bg-${theme[mainColorType]}-500`
            : null;

    return (
        backgroundColor !== null && (
            <div
                onClick={() => onClick(mainColorType)}
                className={`cursor-pointer flex flex-col text-base font-bold rounded ${backgroundColor} text-black p-2 h-fit flex-grow ${
                    selected === false && "opacity-75"
                } hover:opacity-100`}
            >
                <div className="text-sm w-full justify-start h-full">
                    {mainColorType}
                </div>
                <div
                    className={`flex flex-row text-xs w-full justify-start font-normal`}
                >
                    {mainColorType} ({backgroundColor})
                </div>
            </div>
        )
    );
};

export default ThemeMainColorMenuItem;
