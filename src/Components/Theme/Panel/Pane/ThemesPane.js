import React, { useContext } from "react";
import { ThemeContext } from "../../../../Context";
import { Heading, ButtonIcon, Toggle, MenuItem3 } from "@trops/dash-react";

const ThemesPane = ({
    themeKey,
    onChooseTheme,
    onChooseVariant,
    onClickNewTheme,
}) => {
    const { themes, themeVariant } = useContext(ThemeContext);

    function renderCurrentThemes() {
        return Object.keys(themes).map((tk) => {
            // is this selected
            const selected = tk === themeKey;

            return (
                <MenuItem3
                    key={`index-${tk}`}
                    onClick={() => onChooseTheme(tk)}
                    selected={selected}
                    textColor={"text-gray-400"}
                    hoverTextColor={"hover:text-gray-200"}
                    backgroundColor={"bg-gray-700"}
                    hoverBackgroundColor={"hover:bg-gray-900"}
                    selectedBackgroundColor={"bg-gray-900"}
                >
                    {themes[tk]["name"]}
                </MenuItem3>
            );
        });
    }

    return (
        <div className="flex flex-col rounded font-medium w-1/4 max-w-1/3 justify-between">
            <div className="flex flex-col rounded font-medium justify-between overflow-clip">
                <div className="flex flex-col rounded p-6 py-10 space-y-4 w-full hidden xl:flex">
                    <div className="flex flex-row scrollbar">
                        <Heading
                            title={"Color."}
                            padding={false}
                            textColor={"text-gray-300"}
                        />
                        <ButtonIcon
                            icon="plus"
                            textSize="text-2xl"
                            backgroundColor={"bg-gray-800"}
                            hoverBackgroundColor={"hover:bg-green-600"}
                            iconSize="h-6 w-6"
                            textColor={"text-gray-400"}
                            onClick={onClickNewTheme}
                        />
                    </div>
                    <p className={`text-lg font-normal text-gray-300`}>
                        We all know dark is best, but if you{" "}
                        <span className="italic">have</span> to change colors,
                        we'll allow it.
                    </p>
                </div>
                <div className="flex flex-col text-xs break-all p-2 space-y-2 overflow-y-scroll scrollbar">
                    {renderCurrentThemes()}
                </div>
            </div>
            <div className="flex flex-col space-y-2 w-full">
                <Toggle
                    enabled={themeVariant === "dark" ? true : false}
                    setEnabled={() =>
                        onChooseVariant(
                            themeVariant === "dark" ? "light" : "dark"
                        )
                    }
                    text={"Dark"}
                    theme={false}
                    backgroundColor={"bg-gray-800"}
                    hoverBackgroundColor={"hover:bg-gray-900"}
                />
            </div>
        </div>
    );
};

export default ThemesPane;
