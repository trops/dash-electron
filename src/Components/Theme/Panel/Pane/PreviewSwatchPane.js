import React from "react";

const PreviewSwatchPane = ({ themeEdit }) => {
    function getColorFromObject() {
        return `${themeEdit["objectType"]}-${themeEdit["colorName"]}${
            themeEdit["shade"] !== null && `-${themeEdit["shade"]}`
        }`;
    }

    return (
        <div className="flex flex-col text-xs break-all h-full w-full overflow-clip h-full">
            <div
                className={`flex flex-col text-sm break-all h-full w-full rounded overflow-y-auto text-gray-800 ${getColorFromObject()} p-2`}
            >
                <span className="font-medium">{`${themeEdit["objectType"]}-${themeEdit["colorType"]}-${themeEdit["shade"]}`}</span>
                <span className="text-xs text-gray-100">
                    {getColorFromObject()}
                </span>
                <span className="text-gray-100">
                    <pre>{JSON.stringify(themeEdit, null, 2)}</pre>
                </span>
            </div>
        </div>
    );
};

export default PreviewSwatchPane;
