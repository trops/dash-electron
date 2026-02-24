import React from "react";

const AvailableColorMenuItem = ({ colorName, variantName, onClick }) => {
    // construct the color "class" for tailwind based on the variables presented
    const stringColor = `bg-${colorName}${
        variantName !== null ? `-${variantName}` : ""
    }`;
    return (
        <div
            onClick={() => onClick(`${colorName}-${variantName}`)}
            className={`cursor-pointer flex flex-col text-base font-bold rounded ${stringColor} text-black p-2`}
        >
            <div className="text-sm w-full justify-start">
                {colorName} {variantName}
            </div>
            <div
                className={`flex flex-row text-xs w-full justify-start text-gray-600 font-normal`}
            >
                {stringColor}
            </div>
        </div>
    );
};

export default AvailableColorMenuItem;
