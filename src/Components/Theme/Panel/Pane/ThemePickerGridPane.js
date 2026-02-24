import React, { useContext } from "react";
import { ThemeContext } from "../../../../Context";
import ThemePane from "./ThemePane";

const ThemePickerGridPane = ({ themeKey, onChooseTheme }) => {
    const { themes, themeVariant } = useContext(ThemeContext);

    function renderMenuItem(tk) {
        const displayTheme = themes[tk][themeVariant];
        const colors = [
            {
                colorName: displayTheme["secondary"],
                type: "secondary",
                color: displayTheme["bg-secondary-medium"],
            },
            {
                colorName: displayTheme["tertiary"],
                type: "tertiary",
                color: displayTheme["bg-tertiary-medium"],
            },
            {
                colorName: displayTheme["neutral"],
                type: "neutral",
                color: displayTheme["bg-neutral-light"],
            },
        ];

        return colors.map((color) => {
            return (
                <div
                    key={`theme-grid-${color.type}`}
                    className={`rounded ${color["color"]} h-20 w-full`}
                ></div>
            );
        });
    }

    function renderCurrentThemes() {
        if (!themes) return null;
        const sortedKeys = Object.keys(themes).sort((a, b) => {
            const nameA = (themes[a]?.[themeVariant]?.name || "").toLowerCase();
            const nameB = (themes[b]?.[themeVariant]?.name || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });
        return sortedKeys.map((tk) => {
            // is this selected
            const selected = tk === themeKey;
            const current = themes[tk][themeVariant];
            return (
                <div
                    key={`icon-${tk}`}
                    className={`flex flex-col text-xs p-4 space-y-4 h-48 w-full rounded justify-between border-2 ${
                        selected === true
                            ? "border-yellow-600 hover:border-yellow-600"
                            : "hover:border-yellow-600 border-gray-800"
                    } cursor-pointer text-gray-200 ${
                        themes[tk][themeVariant]["bg-primary-dark"]
                    }`}
                    onClick={() => onChooseTheme(tk)}
                >
                    <div className="flex flex-col w-full">
                        <span className="font-bold text-xl word-break-all">
                            {current["name"]}
                        </span>
                        <span className="font-bold text-xs text-gray-500">
                            {tk}
                        </span>
                    </div>
                    <div className="flex flex-row space-x-2">
                        {renderMenuItem(tk)}
                    </div>
                </div>
            );
        });
    }

    return (
        <ThemePane>
            <div className="flex flex-row rounded overflow-clip justify-center items-center align-center w-full">
                <div className="grid grid-cols-3 gap-4 w-full h-full overflow-y-scroll scrollbar scrollbar-thumb-gray-700 scrollbar-thin scrollbar-track-transparent">
                    {renderCurrentThemes()}
                </div>
            </div>
        </ThemePane>
    );
};

export default ThemePickerGridPane;
